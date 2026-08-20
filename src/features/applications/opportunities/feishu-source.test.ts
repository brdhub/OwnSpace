import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { FEISHU_SOURCE_URL } from "@/features/applications/opportunities/constants";
import {
  bootstrapAnonymousSession,
  decodeGzipBase64Json,
  fetchFeishuOpportunities,
  normalizeFeishuRecord,
} from "@/features/applications/opportunities/feishu-source";

function encode(value: unknown) {
  return gzipSync(Buffer.from(JSON.stringify(value), "utf8")).toString("base64");
}

const fieldMap = {
  fldCompany: { id: "fldCompany", name: "公司名称", type: 1 },
  fldBatch: {
    id: "fldBatch",
    name: "批次",
    type: 3,
    property: {
      options: [
        { id: "optAutumn", name: "27届秋招", color: 1 },
        { id: "optSpring", name: "春招", color: 2 },
      ],
    },
  },
  fldUpdated: { id: "fldUpdated", name: "岗位更新日期", type: 5 },
  fldCompanyType: {
    id: "fldCompanyType",
    name: "企业类型",
    type: 4,
    property: { options: [{ id: "optPrivate", name: "民企", color: 2 }] },
  },
  fldIndustry: { id: "fldIndustry", name: "行业", type: 1 },
  fldRoles: { id: "fldRoles", name: "岗位", type: 1 },
  fldCities: {
    id: "fldCities",
    name: "工作城市",
    type: 4,
    property: {
      options: [
        { id: "optWuhan", name: "湖北-武汉", color: 3 },
        { id: "optShanghai", name: "上海", color: 4 },
      ],
    },
  },
  fldMajor: { id: "fldMajor", name: "不限专业", type: 7 },
  fldAudience: {
    id: "fldAudience",
    name: "招聘对象",
    type: 4,
    property: { options: [{ id: "optGraduate", name: "2027届毕业生", color: 1 }] },
  },
  fldDegree: { id: "fldDegree", name: "学历", type: 1 },
  fldDeadline: { id: "fldDeadline", name: "截止时间", type: 1 },
  fldNotes: { id: "fldNotes", name: "备注", type: 1 },
  fldNoWritten: { id: "fldNoWritten", name: "含免笔试", type: 7 },
  fldAnnouncement: { id: "fldAnnouncement", name: "官方公告", type: 15 },
  fldApply: { id: "fldApply", name: "网申入口", type: 15 },
};

const sourceRecord = {
  fldCompany: { modifiedUser: "user", modifiedTime: 1, value: [{ text: "东风奕派", type: "text" }] },
  fldBatch: { modifiedUser: "user", modifiedTime: 1, value: "optAutumn" },
  fldUpdated: { modifiedUser: "user", modifiedTime: 1, value: 1785628800000 },
  fldCompanyType: { modifiedUser: "user", modifiedTime: 1, value: ["optPrivate"] },
  fldIndustry: { modifiedUser: "user", modifiedTime: 1, value: [{ text: "汽车,新能源", type: "text" }] },
  fldRoles: { modifiedUser: "user", modifiedTime: 1, value: [{ text: "后端开发，AI算法", type: "text" }] },
  fldCities: { modifiedUser: "user", modifiedTime: 1, value: ["optWuhan", "optShanghai"] },
  fldMajor: { modifiedUser: "user", modifiedTime: 1, value: false },
  fldAudience: { modifiedUser: "user", modifiedTime: 1, value: ["optGraduate"] },
  fldDegree: { modifiedUser: "user", modifiedTime: 1, value: [{ text: "本科及以上", type: "text" }] },
  fldDeadline: { modifiedUser: "user", modifiedTime: 1, value: [{ text: "招满即止", type: "text" }] },
  fldNotes: { modifiedUser: "user", modifiedTime: 1, value: [{ text: "提前批", type: "text" }] },
  fldNoWritten: { modifiedUser: "user", modifiedTime: 1, value: true },
  fldAnnouncement: {
    modifiedUser: "user",
    modifiedTime: 1,
    value: [{ text: "官方公告", type: "url", link: "https://example.com/announcement" }],
  },
  fldApply: {
    modifiedUser: "user",
    modifiedTime: 1,
    value: [{ text: "立即投递", type: "url", link: "https://example.com/apply" }],
  },
};

test("decodes Feishu gzip base64 JSON", () => {
  assert.deepEqual(decodeGzipBase64Json(encode({ ok: true, count: 2 })), { ok: true, count: 2 });
});

test("normalizes a Feishu recruitment record by field name", () => {
  const result = normalizeFeishuRecord("rec001", sourceRecord, fieldMap);

  assert.deepEqual(result, {
    sourceRecordId: "rec001",
    company: "东风奕派",
    batch: "27届秋招",
    sourceUpdatedDate: "2026-08-02",
    companyType: "民企",
    industry: "汽车,新能源",
    roles: "后端开发，AI算法",
    cities: "湖北-武汉、上海",
    unrestrictedMajor: false,
    targetAudience: "2027届毕业生",
    degree: "本科及以上",
    deadline: "招满即止",
    notes: "提前批",
    writtenTestWaived: true,
    announcementUrl: "https://example.com/announcement",
    applicationUrl: "https://example.com/apply",
  });
});

test("drops unsafe application URLs while preserving the company", () => {
  const result = normalizeFeishuRecord(
    "rec002",
    {
      ...sourceRecord,
      fldApply: { modifiedUser: "user", modifiedTime: 1, value: [{ text: "投递", type: "url", link: "javascript:alert(1)" }] },
    },
    fieldMap,
  );

  assert.equal(result.applicationUrl, null);
  assert.equal(result.company, "东风奕派");
});

test("keeps anonymous cookies through the approved Feishu guest-login redirect", async () => {
  let call = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    call += 1;
    if (call === 1) {
      return new Response(null, {
        status: 302,
        headers: {
          location: "https://accounts.feishu.cn/accounts/page/login?with_guest=1",
          "set-cookie": "source_cookie=one; Path=/; HttpOnly",
        },
      });
    }
    if (call === 2) {
      assert.equal(new Headers(init?.headers).get("cookie"), null);
      return new Response(null, {
        status: 302,
        headers: {
          location: "https://login.feishu.cn/accounts/trap?with_guest=1",
        },
      });
    }
    if (call === 3) {
      return new Response(null, {
        status: 302,
        headers: {
          location: "https://accounts.feishu.cn/accounts/page/login?no_trap=1&with_guest=1",
        },
      });
    }
    if (call === 4) {
      return new Response(null, {
        status: 302,
        headers: {
          location: FEISHU_SOURCE_URL,
          "set-cookie": "guest_cookie=two; Domain=.feishu.cn; Path=/; HttpOnly",
        },
      });
    }
    if (call === 5) {
      return new Response(null, {
        status: 302,
        headers: { location: "https://accounts.feishu.cn/accounts/page/login?with_guest=1" },
      });
    }
    if (call === 6) {
      return new Response(null, {
        status: 302,
        headers: { location: FEISHU_SOURCE_URL },
      });
    }
    return new Response("<html></html>", {
      headers: { "set-cookie": "session_cookie=three; Path=/; HttpOnly" },
    });
  };

  assert.equal(
    await bootstrapAnonymousSession(fetchImpl),
    "source_cookie=one; guest_cookie=two; session_cookie=three",
  );
});

test("fetches all table pages and returns only target-view records in rank order", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = input.toString();
    const method = init?.method ?? "GET";
    calls.push({ url, method });

    if (calls.length === 1) {
      return new Response("<html></html>", { headers: { "set-cookie": "session=abc; Path=/; HttpOnly" } });
    }
    if (calls.length === 2) {
      return Response.json({
        code: 0,
        msg: "success",
        data: {
          table: encode({
            meta: { id: "tblSgpBe77jUnejO", rev: 786, recordsNum: 201, depRev: "" },
            fieldMap,
            recordCount: 201,
            viewMap: {
              vewgPKxdon: {
                property: {
                  filterInfo: {
                    conjunction: "and",
                    conditions: [
                      { fieldId: "fldBatch", operator: "contains", value: ["optAutumn"] },
                      { fieldId: "fldRoles", operator: "contains", value: null },
                    ],
                  },
                  sortInfo: [{ fieldId: "fldUpdated", desc: true }],
                },
              },
            },
          }),
        },
      });
    }
    if (calls.length === 3) {
      return Response.json({
        code: 0,
        msg: "success",
        data: { gzipViews: encode({ vewgPKxdon: { rankMap: { recB: "b", recSpring: "c", recA: "a" } } }) },
      });
    }
    if (calls.length === 4) {
      return Response.json({
        code: 0,
        msg: "",
        data: {
          encoding: 0,
          records: encode({
            recordMap: {
              recA: sourceRecord,
              recSpring: { ...sourceRecord, fldBatch: { modifiedUser: "user", modifiedTime: 1, value: "optSpring" } },
              recIgnored: sourceRecord,
            },
          }),
        },
      });
    }
    return Response.json({
      code: 0,
      msg: "",
      data: {
        encoding: 0,
        records: encode({
          recordMap: {
            recB: {
              ...sourceRecord,
              fldCompany: { modifiedUser: "user", modifiedTime: 1, value: [{ text: "浪潮集团", type: "text" }] },
            },
          },
        }),
      },
    });
  };

  const snapshot = await fetchFeishuOpportunities(fetchImpl);

  assert.deepEqual(snapshot.opportunities.map((item) => item.company), ["东风奕派", "浪潮集团"]);
  assert.equal(snapshot.totalSourceRecords, 201);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "GET", "POST", "GET", "GET"]);
  assert.match(calls[3].url, /offset=0/);
  assert.match(calls[4].url, /offset=200/);
});

test("rejects an incomplete target view instead of returning partial data", async () => {
  let call = 0;
  const fetchImpl: typeof fetch = async () => {
    call += 1;
    if (call === 1) {
      return new Response("<html></html>", { headers: { "set-cookie": "session=abc; Path=/" } });
    }
    if (call === 2) {
      return Response.json({
        code: 0,
        msg: "success",
        data: {
          table: encode({
            meta: { id: "tblSgpBe77jUnejO", rev: 786, recordsNum: 1, depRev: "" },
            fieldMap,
            recordCount: 1,
            viewMap: {
              vewgPKxdon: {
                property: {
                  filterInfo: {
                    conjunction: "and",
                    conditions: [{ fieldId: "fldBatch", operator: "contains", value: ["optAutumn"] }],
                  },
                },
              },
            },
          }),
        },
      });
    }
    if (call === 3) {
      return Response.json({
        code: 0,
        msg: "success",
        data: { gzipViews: encode({ vewgPKxdon: { rankMap: { recMissing: "a" } } }) },
      });
    }
    return Response.json({
      code: 0,
      msg: "",
      data: { encoding: 0, records: encode({ recordMap: {} }) },
    });
  };

  await assert.rejects(() => fetchFeishuOpportunities(fetchImpl), /同步数据不完整/);
});
