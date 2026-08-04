import type { RecruitmentOpportunity } from "@/db/schema";
import { FEISHU_SOURCE_LABEL } from "@/features/applications/opportunities/constants";
import type { OpportunityApplicationDraft } from "@/features/applications/opportunities/types";

export type OpportunityApplicationMode = "favorite" | "apply";

export function buildApplicationDraft(
  opportunity: RecruitmentOpportunity,
  mode: OpportunityApplicationMode,
  appliedDate: string,
): OpportunityApplicationDraft {
  const notes = [
    opportunity.batch ? `批次：${opportunity.batch}` : "",
    opportunity.companyType ? `企业类型：${opportunity.companyType}` : "",
    opportunity.industry ? `行业：${opportunity.industry}` : "",
    opportunity.cities ? `城市：${opportunity.cities}` : "",
    opportunity.unrestrictedMajor ? "专业：不限专业" : "",
  ].filter(Boolean).join("；").slice(0, 1000);

  return {
    opportunityId: opportunity.id,
    company: opportunity.company,
    role: opportunity.roles || "待选择岗位",
    source: FEISHU_SOURCE_LABEL,
    status: mode === "favorite" ? "planned" : "applied",
    internshipType: "autumn",
    companySize: /央企|国企|外企/.test(opportunity.companyType) ? "large" : "medium",
    appliedDate,
    applicationUrl: opportunity.applicationUrl,
    notes,
  };
}

export function planOpportunitySync(existingSourceIds: string[], incomingSourceIds: string[]) {
  const existing = new Set(existingSourceIds);
  const incoming = new Set(incomingSourceIds);
  return {
    inserted: [...incoming].filter((id) => !existing.has(id)),
    updated: [...incoming].filter((id) => existing.has(id)),
    deactivated: [...existing].filter((id) => !incoming.has(id)),
  };
}
