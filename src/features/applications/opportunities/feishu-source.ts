import { gunzipSync } from "node:zlib";
import {
  FEISHU_BASE_TOKEN,
  FEISHU_MAX_DECODED_CHARACTERS,
  FEISHU_MAX_RECORDS,
  FEISHU_MAX_RESPONSE_CHARACTERS,
  FEISHU_PAGE_SIZE,
  FEISHU_REQUEST_TIMEOUT_MS,
  FEISHU_SOURCE_URL,
  FEISHU_TABLE_ID,
  FEISHU_VIEW_ID,
} from "@/features/applications/opportunities/constants";
import {
  apiEnvelopeSchema,
  clientvarsDataSchema,
  recordsDataSchema,
  recordsPageSchema,
  tableSnapshotSchema,
  viewDefinitionSchema,
  viewsDataSchema,
  viewsSnapshotSchema,
} from "@/features/applications/opportunities/source-schema";
import type {
  FeishuCell,
  FeishuField,
  FeishuFieldMap,
  FeishuFieldOption,
  FeishuOpportunitySnapshot,
  FeishuRecord,
  NormalizedRecruitmentOpportunity,
} from "@/features/applications/opportunities/types";

const sourceUrl = new URL(FEISHU_SOURCE_URL);
const sourceOrigin = sourceUrl.origin;

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error("飞书返回了无法解析的数据。");
  }
}

export function decodeGzipBase64Json(value: string) {
  let decoded: string;
  try {
    decoded = gunzipSync(Buffer.from(value, "base64")).toString("utf8");
  } catch {
    throw new Error("飞书压缩数据解码失败。");
  }

  if (decoded.length > FEISHU_MAX_DECODED_CHARACTERS) {
    throw new Error("飞书返回的数据量超出安全限制。");
  }
  return parseJson(decoded);
}

function extractSetCookieValues(headers: Headers) {
  const headersWithCookies = headers as Headers & { getSetCookie?: () => string[] };
  return headersWithCookies.getSetCookie?.() ?? [headers.get("set-cookie")].filter((value): value is string => Boolean(value));
}

async function fetchWithTimeout(fetchImpl: typeof fetch, input: string, init?: RequestInit, allowRedirect = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEISHU_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(input, { ...init, cache: "no-store", signal: controller.signal });
    if (!response.ok && !(allowRedirect && response.status >= 300 && response.status < 400)) {
      throw new Error(`飞书请求失败（${response.status}）。`);
    }
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("飞书同步超时，请稍后重试。");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function bootstrapAnonymousSession(fetchImpl: typeof fetch = fetch) {
  const cookies = new Map<string, { domain: string; pair: string }>();
  const allowedOrigins = new Set([sourceOrigin, "https://accounts.feishu.cn", "https://login.feishu.cn"]);
  let currentUrl = FEISHU_SOURCE_URL;

  const cookieHeaderFor = (url: string) => {
    const hostname = new URL(url).hostname.toLowerCase();
    return [...cookies.values()]
      .filter((cookie) => hostname === cookie.domain || hostname.endsWith(`.${cookie.domain}`))
      .map((cookie) => cookie.pair)
      .join("; ");
  };

  for (let redirectCount = 0; redirectCount <= 10; redirectCount += 1) {
    const currentHostname = new URL(currentUrl).hostname.toLowerCase();
    const cookieHeader = cookieHeaderFor(currentUrl);
    const response = await fetchWithTimeout(
      fetchImpl,
      currentUrl,
      {
        redirect: "manual",
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      },
      true,
    );
    for (const value of extractSetCookieValues(response.headers)) {
      const parts = value.split(";").map((part) => part.trim());
      const pair = parts[0];
      const name = pair?.split("=", 1)[0];
      const domainAttribute = parts.find((part) => part.toLowerCase().startsWith("domain="));
      const domain = (domainAttribute?.slice("domain=".length) ?? currentHostname).replace(/^\./, "").toLowerCase();
      const validDomain = currentHostname === domain || currentHostname.endsWith(`.${domain}`);
      if (name && pair && validDomain) cookies.set(`${domain}:${name}`, { domain, pair });
    }

    if (response.ok) {
      const result = cookieHeaderFor(FEISHU_SOURCE_URL);
      if (!result) throw new Error("无法建立飞书匿名读取会话。");
      return result;
    }

    const location = response.headers.get("location");
    if (!location) throw new Error("飞书匿名会话重定向缺少目标地址。");
    const nextUrl = new URL(location, currentUrl);
    if (!allowedOrigins.has(nextUrl.origin)) throw new Error("飞书匿名会话发生了非预期跳转。");
    currentUrl = nextUrl.toString();
  }

  throw new Error("飞书匿名会话重定向次数过多。");
}

async function readEnvelope(response: Response) {
  const text = await response.text();
  if (text.length > FEISHU_MAX_RESPONSE_CHARACTERS) {
    throw new Error("飞书响应超出安全限制。");
  }
  const envelope = apiEnvelopeSchema.parse(parseJson(text));
  if (envelope.code !== 0) {
    throw new Error(envelope.msg || "飞书同步失败，请稍后重试。");
  }
  return envelope.data;
}

function fieldByName(fieldMap: FeishuFieldMap, name: string) {
  const entry = Object.entries(fieldMap).find(([, field]) => field.name === name);
  return entry ? { id: entry[0], field: entry[1] } : null;
}

function richText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (!Array.isArray(value)) {
    return "";
  }
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const text = (item as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("")
    .trim();
}

function fieldOptions(field: FeishuField): FeishuFieldOption[] {
  if (!field.property || typeof field.property !== "object") return [];
  const options = (field.property as { options?: unknown }).options;
  if (Array.isArray(options)) {
    return options.flatMap((option) => {
      if (!option || typeof option !== "object") return [];
      const id = (option as { id?: unknown }).id;
      const name = (option as { name?: unknown }).name;
      return typeof id === "string" && typeof name === "string" ? [{ id, name }] : [];
    });
  }
  if (options && typeof options === "object") {
    return Object.entries(options).flatMap(([id, option]) => {
      const name = option && typeof option === "object" ? (option as { name?: unknown }).name : undefined;
      return typeof name === "string" ? [{ id, name }] : [];
    });
  }
  return [];
}

function selectLabels(cell: FeishuCell | undefined, field: FeishuField) {
  const raw = cell?.value;
  const ids = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const labels = new Map(fieldOptions(field).map((option) => [option.id, option.name]));
  return ids.flatMap((id) => typeof id === "string" && labels.has(id) ? [labels.get(id)!] : []);
}

function safeUrl(value: unknown) {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const link = (item as { link?: unknown }).link;
    if (typeof link !== "string") continue;
    try {
      const parsed = new URL(link);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
    } catch {
      continue;
    }
  }
  return null;
}

function sourceDate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function normalizeFeishuRecord(
  sourceRecordId: string,
  record: FeishuRecord,
  fieldMap: FeishuFieldMap,
): NormalizedRecruitmentOpportunity {
  const readCell = (name: string) => {
    const found = fieldByName(fieldMap, name);
    return found ? record[found.id] : undefined;
  };
  const readText = (name: string) => richText(readCell(name)?.value);
  const readSelect = (name: string) => {
    const found = fieldByName(fieldMap, name);
    return found ? selectLabels(record[found.id], found.field) : [];
  };

  const company = readText("公司名称");
  if (!company) {
    throw new Error(`飞书记录 ${sourceRecordId} 缺少公司名称。`);
  }

  return {
    sourceRecordId,
    company,
    batch: readSelect("批次").join("、"),
    sourceUpdatedDate: sourceDate(readCell("岗位更新日期")?.value),
    companyType: readSelect("企业类型").join("、"),
    industry: readText("行业"),
    roles: readText("岗位"),
    cities: readSelect("工作城市").join("、"),
    unrestrictedMajor: readCell("不限专业")?.value === true,
    applicationUrl: safeUrl(readCell("网申入口")?.value),
  };
}

function requestHeaders(cookie: string) {
  return {
    Accept: "application/json",
    Cookie: cookie,
    Referer: FEISHU_SOURCE_URL,
  };
}

export async function fetchFeishuOpportunities(fetchImpl: typeof fetch = fetch): Promise<FeishuOpportunitySnapshot> {
  const cookie = await bootstrapAnonymousSession(fetchImpl);

  const clientvarsResponse = await fetchWithTimeout(
    fetchImpl,
    `${sourceOrigin}/space/api/v1/bitable/${FEISHU_BASE_TOKEN}/clientvars`,
    { headers: requestHeaders(cookie) },
  );
  const clientvarsData = clientvarsDataSchema.parse(await readEnvelope(clientvarsResponse));
  const tableSnapshot = tableSnapshotSchema.parse(decodeGzipBase64Json(clientvarsData.table));
  const targetView = viewDefinitionSchema.parse(tableSnapshot.viewMap[FEISHU_VIEW_ID]);
  const totalSourceRecords = tableSnapshot.recordCount ?? tableSnapshot.meta.recordsNum;
  if (totalSourceRecords > FEISHU_MAX_RECORDS) {
    throw new Error("飞书表格记录数超出当前同步上限。");
  }

  const viewsResponse = await fetchWithTimeout(
    fetchImpl,
    `${sourceOrigin}/space/api/bitable/views/`,
    {
      method: "POST",
      headers: { ...requestHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({
        token: FEISHU_BASE_TOKEN,
        tableId: FEISHU_TABLE_ID,
        tableRev: tableSnapshot.meta.rev,
        viewIdList: [FEISHU_VIEW_ID],
        supportRank: true,
      }),
    },
  );
  const viewsData = viewsDataSchema.parse(await readEnvelope(viewsResponse));
  const views = viewsSnapshotSchema.parse(decodeGzipBase64Json(viewsData.gzipViews));
  const targetRankMap = views[FEISHU_VIEW_ID]?.rankMap;
  if (!targetRankMap || Object.keys(targetRankMap).length === 0) {
    throw new Error("飞书秋招视图暂时没有可同步记录。");
  }

  const recordMap: Record<string, FeishuRecord> = {};
  const pageCount = Math.ceil(totalSourceRecords / FEISHU_PAGE_SIZE);
  for (let page = 0; page < pageCount; page += 1) {
    const recordsUrl = new URL(`${sourceOrigin}/space/api/v1/bitable/${FEISHU_BASE_TOKEN}/records`);
    recordsUrl.search = new URLSearchParams({
      tableID: FEISHU_TABLE_ID,
      viewID: FEISHU_VIEW_ID,
      tableRev: String(tableSnapshot.meta.rev),
      viewLazyLoad: "true",
      offset: String(page * FEISHU_PAGE_SIZE),
      limit: String(FEISHU_PAGE_SIZE),
    }).toString();
    const pageResponse = await fetchWithTimeout(fetchImpl, recordsUrl.toString(), { headers: requestHeaders(cookie) });
    const pageData = recordsDataSchema.parse(await readEnvelope(pageResponse));
    const decodedPage = recordsPageSchema.parse(decodeGzipBase64Json(pageData.records));
    Object.assign(recordMap, decodedPage.recordMap);
  }

  const rankedRecords = Object.entries(targetRankMap).sort((left, right) => left[1].localeCompare(right[1]));
  const missing = rankedRecords.filter(([recordId]) => !recordMap[recordId]);
  if (missing.length > 0) {
    throw new Error(`飞书同步数据不完整，缺少 ${missing.length} 条记录。`);
  }

  const matchesFilter = (record: FeishuRecord) => {
    const results = targetView.property.filterInfo.conditions.map((condition) => {
      const raw = record[condition.fieldId]?.value;
      const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
      return values.some((value) => typeof value === "string" && condition.value.includes(value));
    });
    return targetView.property.filterInfo.conjunction === "and" ? results.every(Boolean) : results.some(Boolean);
  };

  const filteredRecords = rankedRecords
    .filter(([recordId]) => matchesFilter(recordMap[recordId]))
    .map(([recordId, rank]) => ({
      opportunity: normalizeFeishuRecord(recordId, recordMap[recordId], tableSnapshot.fieldMap),
      rank,
    }))
    .sort((left, right) => {
      const dateOrder = (right.opportunity.sourceUpdatedDate ?? "").localeCompare(left.opportunity.sourceUpdatedDate ?? "");
      return dateOrder || left.rank.localeCompare(right.rank);
    });

  return {
    opportunities: filteredRecords.map((item) => item.opportunity),
    totalSourceRecords,
    fetchedAt: new Date().toISOString(),
  };
}
