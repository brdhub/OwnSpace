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
  applicationUrl: string | null;
};

export type FeishuOpportunitySnapshot = {
  opportunities: NormalizedRecruitmentOpportunity[];
  totalSourceRecords: number;
  fetchedAt: string;
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
