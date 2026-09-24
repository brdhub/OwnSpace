"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { matchJobCategory } from "@/features/applications/job-category";
import { db } from "@/db";
import { applications, applicationStatusEvents, interviewNotes, resumeAssets } from "@/db/schema";
import {
  addHistoricalStatusSchema,
  applicationFormSchema,
  applicationIdSchema,
  updateApplicationSchema,
  updateApplicationStatusSchema,
} from "@/features/applications/schemas";

export type ApplicationActionState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

export type UpdateApplicationStatusResult = {
  success: boolean;
  message?: string;
};

const emptyState: ApplicationActionState = { success: false };

function formDataToRecord(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function now() {
  return new Date().toISOString();
}

async function validateResumeAssetId(resumeAssetId: number | undefined) {
  if (resumeAssetId === undefined) {
    return { id: null as number | null };
  }

  const asset = await db
    .select({ id: resumeAssets.id })
    .from(resumeAssets)
    .where(eq(resumeAssets.id, resumeAssetId))
    .get();

  return asset ? { id: asset.id } : { error: "所选简历不存在，请重新选择。" };
}

export async function createApplicationAction(
  _previousState: ApplicationActionState = emptyState,
  formData: FormData,
): Promise<ApplicationActionState> {
  void _previousState;
  const parsed = applicationFormSchema.safeParse(formDataToRecord(formData));

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const resumeAsset = await validateResumeAssetId(parsed.data.resumeAssetId);
  if (resumeAsset.error) {
    return { success: false, errors: { resumeAssetId: [resumeAsset.error] } };
  }

  await db.insert(applications).values({
    ...parsed.data,
    resumeAssetId: resumeAsset.id,
    interviewTime: parsed.data.interviewTime ?? null,
    applicationUrl: parsed.data.applicationUrl ?? null,
    jobDescription: parsed.data.jobDescription ?? "",
    notes: parsed.data.notes ?? "",
    createdAt: now(),
    updatedAt: now(),
  });

  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/resumes/opportunities");
  return { success: true, message: "投递记录已新增" };
}

export async function updateApplicationAction(
  _previousState: ApplicationActionState = emptyState,
  formData: FormData,
): Promise<ApplicationActionState> {
  void _previousState;
  const parsed = updateApplicationSchema.safeParse(formDataToRecord(formData));

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { id, ...values } = parsed.data;
  const resumeAsset = await validateResumeAssetId(values.resumeAssetId);
  if (resumeAsset.error) {
    return { success: false, errors: { resumeAssetId: [resumeAsset.error] } };
  }

  await db
    .update(applications)
    .set({
      ...values,
      resumeAssetId: resumeAsset.id,
      interviewTime: values.interviewTime ?? null,
      applicationUrl: values.applicationUrl ?? null,
      jobDescription: values.jobDescription ?? "",
      notes: values.notes ?? "",
      updatedAt: now(),
    })
    .where(eq(applications.id, id));

  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/resumes/opportunities");
  return { success: true, message: "投递记录已更新" };
}

export async function deleteApplicationAction(formData: FormData) {
  const parsed = applicationIdSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) {
    return;
  }

  await db.update(interviewNotes).set({ applicationId: null, updatedAt: now() }).where(eq(interviewNotes.applicationId, parsed.data.id));
  await db.delete(applications).where(eq(applications.id, parsed.data.id));
  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/interviews");
}

export async function updateApplicationStatusAction(formData: FormData): Promise<UpdateApplicationStatusResult> {
  const parsed = updateApplicationStatusSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) {
    return { success: false, message: "状态更新失败，请重试。" };
  }

  await db
    .update(applications)
    .set({ status: parsed.data.status, updatedAt: now() })
    .where(eq(applications.id, parsed.data.id));

  revalidatePath("/");
  revalidatePath("/applications");
  return { success: true };
}

export async function addHistoricalStatusAction(input: unknown): Promise<ApplicationActionState> {
  const parsed = addHistoricalStatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.flatten().fieldErrors.date?.[0] ?? "补录信息无效，请检查日期和状态。" };

  const application = await db.select({ id: applications.id }).from(applications)
    .where(eq(applications.id, parsed.data.id)).get();
  if (!application) return { success: false, message: "投递记录不存在。" };

  await db.insert(applicationStatusEvents).values({
    applicationId: application.id,
    fromStatus: null,
    toStatus: parsed.data.status,
    kind: "manual",
    occurredAt: parsed.data.date,
  });
  revalidatePath("/applications");
  return { success: true, message: "历史状态已补录" };
}

export async function matchMissingJobCategoriesAction(input: unknown): Promise<ApplicationActionState> {
  if (!z.object({ scope: z.literal("all_missing") }).strict().safeParse(input).success) {
    return { success: false, message: "匹配请求无效，请重试。" };
  }
  try {
    const result = db.transaction((tx) => {
      const rows = tx.select({ id: applications.id, role: applications.role })
        .from(applications).where(isNull(applications.jobCategory)).all();
      let matched = 0;
      for (const row of rows) {
        const jobCategory = matchJobCategory(row.role);
        if (!jobCategory) continue;
        matched += tx.update(applications).set({ jobCategory, updatedAt: now() })
          .where(and(eq(applications.id, row.id), eq(applications.role, row.role), isNull(applications.jobCategory)))
          .run().changes;
      }
      return { matched, remaining: rows.length - matched };
    });
    revalidatePath("/applications");
    return { success: true, message: `已匹配 ${result.matched} 条，${result.remaining} 条标题不明确，待手动填写。` };
  } catch {
    return { success: false, message: "匹配未完成，请重试。" };
  }
}
