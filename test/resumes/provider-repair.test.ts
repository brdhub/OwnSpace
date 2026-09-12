import assert from "node:assert/strict";
import test from "node:test";
import * as provider from "../../src/features/resumes/deepseek-core";
import type { OptimizationPromptInput } from "../../src/features/resumes/prompts";

const env = { DEEPSEEK_API_KEY: "test-only-key" };
const input: OptimizationPromptInput = {
  targetRole: "后端", jdText: "Java",
  materials: [{ materialId: 1, type: "project", title: "项目", tags: [], content: { projectCategory: "后端", techStack: ["Java"], content: "开发接口" } }],
};
function response(content: string | null, finishReason = "stop", usage?: unknown) {
  return Response.json({ choices: [{ finish_reason: finishReason, message: { content } }], usage });
}
const candidate = { type: "project", title: "项目", tags: [], content: { projectCategory: "后端", techStack: ["Java"], content: "开发接口" }, sourceExcerpt: "开发 接口", similarEntryId: null };

test("single optimization request returns output and nullable actual usage without retries", async () => {
  let calls = 0;
  const result = await provider.requestOptimizationOnce(input, undefined, { env, fetch: async () => {
    calls += 1;
    return response('{"suggestions":[]}', "stop", { prompt_tokens: 12, completion_tokens: 0 });
  } });
  assert.equal(calls, 1);
  assert.deepEqual(result, { output: { suggestions: [] }, inputTokens: 12, outputTokens: 0 });
  const absent = await provider.requestOptimizationOnce(input, undefined, { env, fetch: async () => response("{}") });
  assert.equal(absent.inputTokens, null);
  assert.equal(absent.outputTokens, null);
});

test("single request returns bounded repair diagnostics for malformed, empty and truncated content", async () => {
  for (const [content, finish] of [["{broken" + "x".repeat(40_000), "stop"], [null, "stop"], ['{"suggestions":[]}', "length"]] as const) {
    let calls = 0;
    const result = await provider.requestOptimizationOnce(input, undefined, { env, fetch: async () => {
      calls += 1;
      return response(content, finish);
    } });
    assert.equal(calls, 1);
    assert.equal(typeof result.output, "object");
    assert.match(JSON.stringify(result.output), /diagnostic/);
    assert.ok(JSON.stringify(result.output).length < 17_000);
  }
});

test("invalid usage never becomes a fabricated zero or discards valid model output", async () => {
  const result = await provider.requestOptimizationOnce(input, undefined, { env, fetch: async () => response("{}", "stop", { prompt_tokens: -1, completion_tokens: "12" }) });
  assert.deepEqual(result, { output: {}, inputTokens: null, outputTokens: null });
});

test("single request rejects malformed provider envelopes and transport errors without retry", async () => {
  for (const fetcher of [async () => Response.json({ choices: [] }), async () => Response.json({ choices: [{ finish_reason: "tool_calls", message: { content: "{}" } }] }), async () => new Response("private", { status: 503 }), async () => { throw new Error("secret"); }]) {
    let calls = 0;
    await assert.rejects(provider.requestOptimizationOnce(input, undefined, { env, fetch: async () => { calls += 1; return fetcher(); } }), provider.DeepSeekError);
    assert.equal(calls, 1);
  }
});

test("repair request includes bounded previous output, precise issues and only supplied facts", async () => {
  let payload: { messages: Array<{ role: string; content: string }> } | undefined;
  await provider.requestOptimizationOnce(input, { previous: "x".repeat(40_000), issues: [{ path: "suggestions.0.proposedContent.techStack", message: "locked" }], facts: "用户确认开发了两个接口" }, { env, fetch: async (_, init) => { payload = JSON.parse(String(init?.body)); return response("{}"); } });
  assert.ok(payload);
  const userData = JSON.parse(payload.messages[1].content);
  assert.equal(userData.verifiedFacts, "用户确认开发了两个接口");
  assert.ok(userData.repair.previous.length <= 16_000);
  assert.match(JSON.stringify(userData.repair.issues), /techStack/);
});

test("candidate malformed JSON receives exactly one error-directed repair", async () => {
  const bodies: Array<{ messages: Array<{ content: string }> }> = [];
  const result = await provider.generateEntryCandidates({ extractedText: "开发\n 接口", formalEntries: [] }, { env, fetch: async (_, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return response(bodies.length === 1 ? "{bad json" : JSON.stringify({ candidates: [candidate] }));
  } });
  assert.equal(result.length, 1);
  assert.equal(bodies.length, 2);
  assert.match(bodies[1].messages[1].content, /bad json/);
  assert.match(bodies[1].messages[1].content, /invalid_json/);
});

test("candidate excerpts and entry IDs are checked and included in repair guidance", async () => {
  const bodies: Array<{ messages: Array<{ content: string }> }> = [];
  const result = await provider.generateEntryCandidates({ extractedText: "开发 接口", formalEntries: [] }, { env, fetch: async (_, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return response(JSON.stringify({ candidates: [{ ...candidate, ...(bodies.length === 1 ? { sourceExcerpt: "不存在的经历", similarEntryId: 99 } : {}) }] }));
  } });
  assert.equal(result.length, 1);
  assert.match(bodies[1].messages[1].content, /sourceExcerpt/);
  assert.match(bodies[1].messages[1].content, /similarEntryId/);
});

test("candidate repair stops after two invalid responses and transport failure never loops", async () => {
  for (const failsNetwork of [false, true]) {
    let calls = 0;
    await assert.rejects(provider.generateEntryCandidates({ extractedText: "text", formalEntries: [] }, { env, fetch: async () => {
      calls += 1;
      if (failsNetwork) throw new Error("offline");
      return response("broken");
    } }), provider.DeepSeekError);
    assert.equal(calls, failsNetwork ? 1 : 2);
  }
});

test("candidate repair keeps valid entries and sends only failures for repair", async () => {
  const bodies: Array<{ messages: Array<{ content: string }> }> = [];
  const result = await provider.generateEntryCandidates({ extractedText: "开发 接口", formalEntries: [] }, { env, fetch: async (_, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return response(JSON.stringify({ candidates: bodies.length === 1
      ? [candidate, { ...candidate, title: "待修正", sourceExcerpt: "编造引用" }]
      : [{ ...candidate, title: "已修正" }] }));
  } });
  assert.deepEqual(result.map(item => item.title), ["项目", "已修正"]);
  const repair = JSON.parse(JSON.parse(bodies[1].messages[1].content).repair.previous);
  assert.equal(repair.candidates.length, 1);
  assert.equal(repair.candidates[0].title, "待修正");
});

test("valid candidates survive invalid or unavailable repair responses", async () => {
  for (const network of [false, true]) {
    let calls = 0;
    const result = await provider.generateEntryCandidates({ extractedText: "开发 接口", formalEntries: [] }, { env, fetch: async () => {
      calls += 1;
      if (calls === 1) return response(JSON.stringify({ candidates: [candidate, { ...candidate, sourceExcerpt: "编造引用" }] }));
      if (network) throw new Error("offline");
      return response("broken");
    } });
    assert.equal(result.length, 1);
    assert.equal(calls, 2);
  }
});

test("repair that repeats an already valid candidate remains partial, not successful replacement", async () => {
  let calls = 0;
  const result = await provider.generateEntryCandidatesDetailed({ extractedText: "开发 接口", formalEntries: [] }, { env, fetch: async () => {
    calls += 1;
    return response(JSON.stringify({ candidates: calls === 1 ? [candidate, { ...candidate, title: '其他项目', sourceExcerpt: '错误引用' }] : [candidate] }));
  } });
  assert.equal(result.candidates.length, 1);
  assert.ok(result.issues.length);
});
