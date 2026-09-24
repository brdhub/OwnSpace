"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { applications, interviewSimulations, resumeAssets } from "@/db/schema";
import { evaluateInterviewAnswer, generateInterviewQuestions, interviewAiError, interviewModelName } from "./interview-ai";
import { advanceInterview, parseInterviewQuestions } from "./interview-model";

type Result = { success: boolean; message?: string; sessionId?: number };
const idSchema = z.number().int().positive();
const answerSchema = z.string().trim().min(2, "请先输入回答。").max(5000, "回答最多 5000 字。");
const now = () => new Date().toISOString();
const refresh = () => revalidatePath("/ai-hub");
const fail = (error: unknown): Result => ({ success: false, message: error instanceof z.ZodError ? error.issues[0]?.message : interviewAiError(error) });

export async function startInterviewAction(applicationId: number, resumeAssetId: number): Promise<Result> {
  try {
    const appId = idSchema.parse(applicationId);
    const assetId = idSchema.parse(resumeAssetId);
    const application = await db.select().from(applications).where(eq(applications.id, appId)).get();
    const asset = await db.select().from(resumeAssets).where(eq(resumeAssets.id, assetId)).get();
    if (!application) throw new Error("投递记录不存在，请从投递记录重新进入。");
    if (!asset || asset.parseStatus !== "parsed" || !asset.extractedText.trim()) throw new Error("请选择已成功提取文本的简历。");
    const material = { role: application.role, jd: application.jobDescription, resume: asset.extractedText };
    const model = interviewModelName();
    const questions = await generateInterviewQuestions(material);
    const inserted = await db.insert(interviewSimulations).values({
      applicationId: appId,
      company: application.company,
      role: application.role,
      jdSnapshot: application.jobDescription,
      resumeName: asset.originalName,
      resumeSnapshot: asset.extractedText,
      model,
      questionsJson: JSON.stringify(questions),
      createdAt: now(),
      updatedAt: now(),
    }).returning({ id: interviewSimulations.id });
    refresh();
    return { success: true, sessionId: inserted[0].id };
  } catch (error) { return fail(error); }
}

async function runEvaluation(sessionId: number): Promise<Result> {
  const session = await db.select().from(interviewSimulations).where(eq(interviewSimulations.id, sessionId)).get();
  if (!session || !["evaluating_main", "evaluating_followup"].includes(session.phase)) return { success: false, message: "当前没有待评估的回答。" };
  if (session.busy) {
    const lockAge = Date.now() - Date.parse(session.updatedAt);
    if (!Number.isFinite(lockAge) || lockAge < 150_000) return { success: false, message: "回答正在评估中，请稍后刷新页面。" };
    await db.update(interviewSimulations).set({ busy: false, revision: session.revision + 1, updatedAt: now() })
      .where(and(eq(interviewSimulations.id, sessionId), eq(interviewSimulations.revision, session.revision), eq(interviewSimulations.busy, true))).run();
    return runEvaluation(sessionId);
  }
  const locked = await db.update(interviewSimulations).set({ busy: true, revision: session.revision + 1, updatedAt: now() })
    .where(and(eq(interviewSimulations.id, sessionId), eq(interviewSimulations.revision, session.revision), eq(interviewSimulations.busy, false))).run();
  if (locked.changes !== 1) return { success: false, message: "会话已更新，请刷新页面。" };
  const revision = session.revision + 1;
  const questions = parseInterviewQuestions(session.questionsJson);
  const question = questions[session.currentIndex];
  const followup = session.phase === "evaluating_followup";
  const answer = followup ? question?.followupAnswer : question?.answer;
  if (!question || !answer) {
    await db.update(interviewSimulations).set({ busy: false }).where(eq(interviewSimulations.id, sessionId)).run();
    return { success: false, message: "回答内容不存在，请刷新页面。" };
  }
  try {
    const feedback = await evaluateInterviewAnswer({
      role: session.role, jd: session.jdSnapshot, resume: session.resumeSnapshot,
      question, answer, followup,
    });
    const next = advanceInterview(questions, session.currentIndex, followup ? "evaluating_followup" : "evaluating_main", feedback);
    const saved = await db.update(interviewSimulations).set({
      questionsJson: JSON.stringify(next.questions), phase: next.phase, currentIndex: next.currentIndex, busy: false,
      revision: revision + 1, updatedAt: now(),
    }).where(and(eq(interviewSimulations.id, sessionId), eq(interviewSimulations.revision, revision))).run();
    if (saved.changes !== 1) return { success: false, message: "会话已更新，请刷新页面。" };
    refresh();
    return { success: true, sessionId };
  } catch (error) {
    await db.update(interviewSimulations).set({ busy: false, updatedAt: now() })
      .where(and(eq(interviewSimulations.id, sessionId), eq(interviewSimulations.revision, revision))).run();
    refresh();
    return fail(error);
  }
}

export async function submitInterviewAnswerAction(sessionId: number, answer: string): Promise<Result> {
  try {
    const id = idSchema.parse(sessionId);
    const text = answerSchema.parse(answer);
    const session = await db.select().from(interviewSimulations).where(eq(interviewSimulations.id, id)).get();
    if (!session || !["main_answer", "followup_answer"].includes(session.phase)) throw new Error("当前会话不接受回答，请刷新页面。");
    const questions = parseInterviewQuestions(session.questionsJson);
    const question = questions[session.currentIndex];
    if (!question) throw new Error("当前题目不存在，请刷新页面。");
    const followup = session.phase === "followup_answer";
    if (followup) question.followupAnswer = text;
    else question.answer = text;
    const saved = await db.update(interviewSimulations).set({
      questionsJson: JSON.stringify(questions),
      phase: followup ? "evaluating_followup" : "evaluating_main",
      revision: session.revision + 1, updatedAt: now(),
    }).where(and(eq(interviewSimulations.id, id), eq(interviewSimulations.revision, session.revision), eq(interviewSimulations.phase, session.phase))).run();
    if (saved.changes !== 1) throw new Error("会话已更新，请刷新页面。");
    return runEvaluation(id);
  } catch (error) { return fail(error); }
}

export async function retryInterviewEvaluationAction(sessionId: number): Promise<Result> {
  try { return await runEvaluation(idSchema.parse(sessionId)); }
  catch (error) { return fail(error); }
}

export async function deleteInterviewSessionAction(sessionId: number): Promise<Result> {
  try {
    const id = idSchema.parse(sessionId);
    await db.delete(interviewSimulations).where(eq(interviewSimulations.id, id));
    refresh();
    return { success: true };
  } catch (error) { return fail(error); }
}
