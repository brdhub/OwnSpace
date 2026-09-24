import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { applications, interviewSimulations, resumeAssets } from "@/db/schema";
import { parseInterviewQuestions } from "./interview-model";

export async function getInterviewSetup(applicationId: number | null) {
  const application = applicationId
    ? await db.select().from(applications).where(eq(applications.id, applicationId)).get()
    : null;
  const assets = await db.select({
    id: resumeAssets.id,
    name: resumeAssets.originalName,
  }).from(resumeAssets)
    .where(and(eq(resumeAssets.parseStatus, "parsed"), ne(resumeAssets.extractedText, "")))
    .orderBy(desc(resumeAssets.createdAt));
  return {
    application: application ? {
      id: application.id,
      company: application.company,
      role: application.role,
      hasJd: Boolean(application.jobDescription.trim()),
      resumeAssetId: application.resumeAssetId,
    } : null,
    assets,
  };
}

export async function getInterviewSessions() {
  return db.select({
    id: interviewSimulations.id,
    applicationId: interviewSimulations.applicationId,
    company: interviewSimulations.company,
    role: interviewSimulations.role,
    phase: interviewSimulations.phase,
    createdAt: interviewSimulations.createdAt,
  }).from(interviewSimulations).orderBy(desc(interviewSimulations.id)).limit(12);
}

export async function getInterviewSession(id: number | null) {
  if (!id) return null;
  const row = await db.select({
    id: interviewSimulations.id,
    applicationId: interviewSimulations.applicationId,
    company: interviewSimulations.company,
    role: interviewSimulations.role,
    resumeName: interviewSimulations.resumeName,
    model: interviewSimulations.model,
    questionsJson: interviewSimulations.questionsJson,
    phase: interviewSimulations.phase,
    currentIndex: interviewSimulations.currentIndex,
    busy: interviewSimulations.busy,
    createdAt: interviewSimulations.createdAt,
  }).from(interviewSimulations).where(eq(interviewSimulations.id, id)).get();
  return row ? { ...row, questions: parseInterviewQuestions(row.questionsJson) } : null;
}
