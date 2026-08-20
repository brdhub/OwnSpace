export type NormalizedRecruitmentOpportunity = {
  sourceRecordId: string;
  company: string;
  batch: string;
  sourceUpdatedDate: string | null;
  companyType: string;
  industry: string;
  roles: string;
  cities: string;
  unrestrictedMajor: boolean;
  targetAudience: string;
  degree: string;
  deadline: string;
  notes: string;
  writtenTestWaived: boolean;
  announcementUrl: string | null;
  applicationUrl: string | null;
};

export type FeishuOpportunitySnapshot = {
  opportunities: NormalizedRecruitmentOpportunity[];
  totalSourceRecords: number;
  fetchedAt: string;
};

export type OpportunityApplicationDraft = {
  opportunityId: number;
  company: string;
  role: string;
  source: string;
  status: "planned" | "applied";
  internshipType: "autumn";
  companySize: "medium" | "large";
  appliedDate: string;
  applicationUrl: string | null;
  notes: string;
};

export type FeishuFieldOption = {
  id: string;
  name: string;
};

export type FeishuField = {
  id?: string;
  name: string;
  type: number;
  property?: unknown;
};

export type FeishuCell = {
  value?: unknown;
  [key: string]: unknown;
};

export type FeishuRecord = Record<string, FeishuCell>;
export type FeishuFieldMap = Record<string, FeishuField>;
