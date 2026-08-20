import assert from "node:assert/strict";
import test from "node:test";

import {
  DeepSeekError,
  generateEntryCandidates,
  getDeepSeekConfig,
  optimizeEntriesForJd,
  recommendEntriesForJd,
} from "../../src/features/resumes/deepseek-core";

const env = {
  DEEPSEEK_API_KEY: "test-only-key",
};

function providerResponse(content: string, finishReason = "stop") {
  return new Response(JSON.stringify({
    id: "response-1",
    object: "chat.completion",
    created: 1,
    model: "deepseek-v4-flash",
    choices: [{
      index: 0,
      finish_reason: finishReason,
      message: { role: "assistant", content, reasoning_content: null },
      logprobs: null,
    }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

test("requires a server-side API key", () => {
  assert.throws(
    () => getDeepSeekConfig({}),
    (error: unknown) => error instanceof DeepSeekError && error.code === "missing_config",
  );
});

test("uses current official defaults and supports non-secret overrides", () => {
  assert.deepEqual(getDeepSeekConfig(env), {
    apiKey: "test-only-key",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    timeoutMs: 30_000,
  });
  assert.deepEqual(getDeepSeekConfig({
    ...env,
    DEEPSEEK_BASE_URL: "https://deepseek.example/v1/",
    DEEPSEEK_MODEL: "deepseek-v4-pro",
    DEEPSEEK_TIMEOUT_MS: "45000",
  }), {
    apiKey: "test-only-key",
    baseUrl: "https://deepseek.example/v1",
    model: "deepseek-v4-pro",
    timeoutMs: 45_000,
  });
});

test("candidate generation sends a JSON-output request and returns validated candidates", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fakeFetch: typeof fetch = async (input, init) => {
    capturedUrl = input.toString();
    capturedInit = init;
    return providerResponse(JSON.stringify({
      candidates: [{
        type: "project",
        title: "数据看板",
        content: { projectCategory: "数据分析", techStack: ["SQL"], content: "整理数据" },
        tags: ["数据分析"],
        sourceExcerpt: "负责整理数据",
        similarEntryId: null,
      }],
    }));
  };

  const result = await generateEntryCandidates({ extractedText: "负责整理数据", formalEntries: [] }, { fetch: fakeFetch, env });
  const headers = new Headers(capturedInit?.headers);
  const body = JSON.parse(capturedInit?.body?.toString() ?? "{}");

  assert.equal(result[0].title, "数据看板");
  assert.equal(capturedUrl, "https://api.deepseek.com/chat/completions");
  assert.equal(headers.get("authorization"), "Bearer test-only-key");
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.deepEqual(body.thinking, { type: "disabled" });
  assert.equal(body.model, "deepseek-v4-flash");
  assert.equal(body.max_tokens, 8_000);
});

test("JD recommendation rejects IDs outside the submitted formal entries", async () => {
  const fakeFetch: typeof fetch = async () => providerResponse(JSON.stringify({
    recommendations: [{ entryId: 99, level: "high", reason: "不存在" }],
  }));

  await assert.rejects(
    recommendEntriesForJd({
      targetRole: "产品经理",
      jdText: "需要用户研究能力",
      formalEntries: [{ id: 1, type: "experience", title: "示例科技", content: { position: "产品实习生", techStack: [], responsibilities: "用户研究", workContent: "完成访谈" }, tags: ["用户研究"] }],
    }, { fetch: fakeFetch, env }),
    (error: unknown) => error instanceof DeepSeekError && error.code === "invalid_response",
  );
});

test("JD recommendation retries when the first response omits a formal entry", async () => {
  let attempts = 0;
  const fakeFetch: typeof fetch = async () => {
    attempts += 1;
    return providerResponse(JSON.stringify({ recommendations: attempts === 1
      ? [{ entryId: 1, level: "high", reason: "直接相关" }]
      : [
        { entryId: 1, level: "high", reason: "直接相关" },
        { entryId: 2, level: "medium", reason: "部分相关" },
      ] }));
  };

  const result = await recommendEntriesForJd({
    targetRole: "后端开发",
    jdText: "负责服务端性能优化",
    formalEntries: [
      { id: 1, type: "experience", title: "示例科技", content: { position: "后端实习生", techStack: ["Java"], responsibilities: "开发接口", workContent: "维护服务" }, tags: ["后端"] },
      { id: 2, type: "project", title: "检索项目", content: { projectCategory: "后端", techStack: ["Java"], content: "优化查询" }, tags: ["检索"] },
    ],
  }, { fetch: fakeFetch, env });

  assert.equal(attempts, 2);
  assert.deepEqual(result.map((item) => item.entryId), [1, 2]);
});

test("entry optimization retries when proposed field keys differ from the snapshot", async () => {
  let attempts = 0;
  const fakeFetch: typeof fetch = async () => {
    attempts += 1;
    return providerResponse(JSON.stringify({ suggestions: attempts === 1
      ? [{ materialId: 10, proposedContent: { award: "二等奖" }, rationale: "错误类型" }]
      : [{ materialId: 10, proposedContent: { projectCategory: "后端", techStack: ["Java"], content: "优化查询逻辑" }, rationale: "突出行动与结果" }] }));
  };

  const result = await optimizeEntriesForJd({
    targetRole: "后端开发",
    jdText: "负责服务端性能优化",
    materials: [{ materialId: 10, type: "project", title: "检索项目", content: { projectCategory: "后端", techStack: ["Java"], content: "优化查询" }, tags: ["检索"] }],
  }, { fetch: fakeFetch, env });

  assert.equal(attempts, 2);
  assert.deepEqual(result[0].proposedContent, { projectCategory: "后端", techStack: ["Java"], content: "优化查询逻辑" });
});

test("entry optimization rejects changes to factual metadata", async () => {
  let attempts = 0;
  const fakeFetch: typeof fetch = async () => {
    attempts += 1;
    return providerResponse(JSON.stringify({ suggestions: [{
      materialId: 12,
      proposedContent: attempts === 1
        ? { proficiency: "精通", content: "能够开发服务" }
        : { proficiency: "熟悉", content: "能够使用 Java 开发服务" },
      rationale: "突出岗位相关能力",
    }] }));
  };

  const result = await optimizeEntriesForJd({
    targetRole: "后端开发",
    jdText: "熟悉 Java",
    materials: [{ materialId: 12, type: "skill", title: "Java", content: { proficiency: "熟悉", content: "能够开发服务" }, tags: ["Java"] }],
  }, { fetch: fakeFetch, env });

  assert.equal(attempts, 2);
  assert.deepEqual(result[0].proposedContent, { proficiency: "熟悉", content: "能够使用 Java 开发服务" });
});

test("rejects truncated and empty provider output", async () => {
  const truncatedFetch: typeof fetch = async () => providerResponse("{}", "length");
  const emptyFetch: typeof fetch = async () => providerResponse("");

  await assert.rejects(
    generateEntryCandidates({ extractedText: "text", formalEntries: [] }, { fetch: truncatedFetch, env }),
    (error: unknown) => error instanceof DeepSeekError && error.code === "invalid_response",
  );
  await assert.rejects(
    generateEntryCandidates({ extractedText: "text", formalEntries: [] }, { fetch: emptyFetch, env }),
    (error: unknown) => error instanceof DeepSeekError && error.code === "invalid_response",
  );
});

test("HTTP errors are retryable and do not expose provider bodies or secrets", async () => {
  const fakeFetch: typeof fetch = async () => new Response("SECRET_PROVIDER_BODY", { status: 503 });

  await assert.rejects(
    generateEntryCandidates({ extractedText: "PRIVATE_RESUME_TEXT", formalEntries: [] }, { fetch: fakeFetch, env }),
    (error: unknown) => {
      assert.equal(error instanceof DeepSeekError, true);
      assert.equal((error as DeepSeekError).code, "provider_error");
      assert.equal((error as DeepSeekError).retryable, true);
      assert.doesNotMatch((error as Error).message, /SECRET_PROVIDER_BODY|PRIVATE_RESUME_TEXT|test-only-key/);
      return true;
    },
  );
});

test("candidate generation retries once when the provider returns invalid domain JSON", async () => {
  let attempts = 0;
  const fakeFetch: typeof fetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      return providerResponse(JSON.stringify({
        candidates: [{
          type: "project",
          title: "数据看板",
          content: { projectCategory: "数据分析", techStack: ["SQL"], content: "整理数据" },
          tags: ["数据分析"],
          sourceExcerpt: "负责整理数据",
        }],
      }));
    }
    return providerResponse(JSON.stringify({
      candidates: [{
        type: "project",
        title: "数据看板",
        content: { projectCategory: "数据分析", techStack: ["SQL"], content: "整理数据" },
        tags: ["数据分析"],
        sourceExcerpt: "负责整理数据",
        similarEntryId: null,
      }],
    }));
  };

  const result = await generateEntryCandidates(
    { extractedText: "负责整理数据", formalEntries: [] },
    { fetch: fakeFetch, env },
  );

  assert.equal(attempts, 2);
  assert.equal(result[0].title, "数据看板");
});
