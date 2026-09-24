"use server";

import { revalidatePath } from "next/cache";
import { fetchFeishuOpportunities } from "@/features/applications/opportunities/feishu-source";
import { favoriteOpportunity, syncRecruitmentOpportunities } from "@/features/applications/opportunities/persistence";
import { opportunityIdSchema } from "@/features/applications/opportunities/schemas";
import { toDateInputValue } from "@/lib/date";

export type OpportunityActionState = {
  success: boolean;
  message?: string;
  syncedAt?: string;
};

const initialState: OpportunityActionState = { success: false };

export async function syncRecruitmentOpportunitiesAction(
  _previousState: OpportunityActionState = initialState,
  _formData?: FormData,
): Promise<OpportunityActionState> {
  void _previousState;
  void _formData;
  try {
    const snapshot = await fetchFeishuOpportunities();
    const result = syncRecruitmentOpportunities(snapshot);
    revalidatePath("/resumes/opportunities");
    return {
      success: true,
      message: `同步完成：新增 ${result.inserted} 条，更新 ${result.updated} 条，当前开放 ${result.active} 条。`,
      syncedAt: result.syncedAt,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "飞书同步失败，请稍后重试。",
    };
  }
}

export async function favoriteOpportunityAction(
  _previousState: OpportunityActionState = initialState,
  formData: FormData,
): Promise<OpportunityActionState> {
  void _previousState;
  const parsed = opportunityIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "企业机会不存在，请刷新页面后重试。" };
  }

  try {
    const result = favoriteOpportunity(parsed.data.opportunityId, toDateInputValue());
    revalidatePath("/resumes/opportunities");
    revalidatePath("/applications");
    revalidatePath("/");
    return { success: true, message: result.created ? "已加入计划中" : "计划记录已更新" };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "收藏失败，请稍后重试。" };
  }
}
