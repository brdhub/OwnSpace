import assert from "node:assert/strict";
import test from "node:test";
import { advanceInterview, buildInterviewReport, validateGeneratedQuestions, type InterviewQuestion } from "./interview-model";
import { evaluateInterviewAnswer, generateInterviewQuestions, validateInterviewMaterial } from "./interview-ai";

const jd = "负责后端服务开发与数据库性能优化，参与智能体工作流设计。";
const questions = Array.from({ length: 5 }, (_, index) => ({
  category: index === 0 ? "项目经历" : index === 1 ? "岗位匹配" : "技术基础",
  prompt: `请介绍你如何处理后端问题 ${index + 1}？`,
  jdBasis: "后端服务开发",
}));
const feedback = { strength: "解释了处理思路", gap: "缺少量化结果", suggestion: "补充结果与指标", followup: "具体改善了多少？" };

test("generated questions require five unique prompts with real JD evidence", () => {
  assert.equal(validateGeneratedQuestions({ questions }, jd).length, 5);
  assert.throws(() => validateGeneratedQuestions({ questions: questions.slice(0, 4) }, jd));
  assert.throws(() => validateGeneratedQuestions({ questions: questions.map(item => ({ ...item, jdBasis: "不存在的要求" })) }, jd));
  assert.throws(() => validateGeneratedQuestions({ questions: questions.map(item => ({ ...item, prompt: questions[0].prompt })) }, jd));
  assert.throws(() => validateGeneratedQuestions({ questions: questions.map(item => ({ ...item, category: "技术基础" })) }, jd));
});

test("main answer permits one followup, then advances and finishes after five questions", () => {
  const initial = questions as InterviewQuestion[];
  const main = advanceInterview(initial, 0, "evaluating_main", feedback);
  assert.equal(main.phase, "followup_answer");
  assert.equal(main.currentIndex, 0);
  assert.equal(initial[0].feedback, undefined);
  const followup = advanceInterview(main.questions, 0, "evaluating_followup", feedback);
  assert.equal(followup.phase, "main_answer");
  assert.equal(followup.currentIndex, 1);
  assert.equal(followup.questions[0].followupFeedback?.followup, "");
  const last = advanceInterview(followup.questions, 4, "evaluating_main", { ...feedback, followup: "" });
  assert.equal(last.phase, "complete");
  assert.equal(last.currentIndex, 5);
  assert.equal(buildInterviewReport(last.questions)[4].gap, "缺少量化结果");
});

test("model requests use structured output and followup evaluation cannot generate another followup", async () => {
  const calls: unknown[] = [];
  const responses = [{ questions }, feedback];
  const fetcher: typeof fetch = async (_url, init) => {
    calls.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(responses.shift()) } }] }), { status: 200 });
  };
  const dependencies = { fetch: fetcher, env: { DEEPSEEK_API_KEY: "test-only", DEEPSEEK_MODEL: "test-model" } };
  const material = { role: "后端开发", jd, resume: "开发过一个服务并优化了查询。" };
  const generated = await generateInterviewQuestions(material, dependencies);
  assert.equal(generated.length, 5);
  const reviewed = await evaluateInterviewAnswer({ ...material, question: generated[0], answer: "使用了索引。", followup: true }, dependencies);
  assert.equal(reviewed.followup, "");
  assert.equal(calls.length, 2);
  assert.equal((calls[0] as { response_format: { type: string } }).response_format.type, "json_object");
});

test("empty and overlong source material is rejected before a model request", () => {
  assert.throws(() => validateInterviewMaterial({ role: "开发", jd: "", resume: "简历" }));
  assert.throws(() => validateInterviewMaterial({ role: "开发", jd, resume: "x".repeat(25_000) }));
});
