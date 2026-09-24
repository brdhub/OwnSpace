import { z } from "zod";

export const interviewQuestionSchema = z.object({
  category: z.enum(["项目经历", "技术基础", "岗位匹配"]),
  prompt: z.string().trim().min(8).max(500),
  jdBasis: z.string().trim().min(2).max(160),
});

export const interviewFeedbackSchema = z.object({
  strength: z.string().trim().min(2).max(500),
  gap: z.string().trim().min(2).max(500),
  suggestion: z.string().trim().min(2).max(700),
  followup: z.string().trim().max(300).default(""),
});

export type InterviewFeedback = z.infer<typeof interviewFeedbackSchema>;
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema> & {
  answer?: string;
  feedback?: InterviewFeedback;
  followupAnswer?: string;
  followupFeedback?: InterviewFeedback;
};

export const interviewQuestionsSchema = z.array(interviewQuestionSchema).length(5);
export const interviewPhaseSchema = z.enum(["main_answer", "followup_answer", "evaluating_main", "evaluating_followup", "complete"]);
export type InterviewPhase = z.infer<typeof interviewPhaseSchema>;

export function parseInterviewQuestions(value: string): InterviewQuestion[] {
  const parsed = z.array(interviewQuestionSchema.extend({
    answer: z.string().optional(),
    feedback: interviewFeedbackSchema.optional(),
    followupAnswer: z.string().optional(),
    followupFeedback: interviewFeedbackSchema.optional(),
  })).length(5).parse(JSON.parse(value));
  return parsed;
}

export function validateGeneratedQuestions(value: unknown, jd: string): InterviewQuestion[] {
  const parsed = z.object({ questions: interviewQuestionsSchema }).parse(value).questions;
  if (new Set(parsed.map(item => item.prompt)).size !== 5) throw new Error("生成的问题有重复，请重试。");
  if (parsed.some(item => !jd.includes(item.jdBasis))) throw new Error("问题依据与 JD 不一致，请重试。");
  if (new Set(parsed.map(item => item.category)).size !== 3) throw new Error("问题未覆盖项目、技术和岗位匹配，请重试。");
  return parsed;
}

export function buildInterviewReport(questions: InterviewQuestion[]) {
  return questions.map((question, index) => ({
    number: index + 1,
    category: question.category,
    prompt: question.prompt,
    strength: question.feedback?.strength ?? "",
    gap: question.feedback?.gap ?? "",
    suggestion: question.feedback?.suggestion ?? "",
    followupGap: question.followupFeedback?.gap ?? "",
  }));
}

export function advanceInterview(questions: InterviewQuestion[], currentIndex: number, evaluatingPhase: "evaluating_main" | "evaluating_followup", feedback: InterviewFeedback) {
  const updated = questions.map(question => ({ ...question }));
  const current = updated[currentIndex];
  if (!current) throw new Error("当前题目不存在。");
  if (evaluatingPhase === "evaluating_main") current.feedback = feedback;
  else current.followupFeedback = { ...feedback, followup: "" };
  if (evaluatingPhase === "evaluating_main" && feedback.followup) {
    return { questions: updated, currentIndex, phase: "followup_answer" as const };
  }
  const nextIndex = currentIndex + 1;
  return { questions: updated, currentIndex: nextIndex, phase: nextIndex === questions.length ? "complete" as const : "main_answer" as const };
}
