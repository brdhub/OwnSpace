import { sql } from "drizzle-orm";
import { foreignKey, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { applicationStatuses } from "@/config/application-status";
import { companySizes, internshipTypes, jobCategories } from "@/features/applications/constants";
import { interviewResults, interviewRounds, interviewTagCategories } from "@/features/interviews/constants";
import { planningEventSources, planningEventStatuses, planningEventTypes } from "@/features/planning/constants";
import { studyCategories } from "@/features/study/constants";
import {
  optimizationMaterialKinds,
  optimizationSuggestionStates,
  optimizationTaskSources,
  optimizationTaskStatuses,
  resumeAssetParseStatuses,
  resumeCandidateDuplicateKinds,
  resumeCandidateStates,
  resumeEntryExtractionStatuses,
  resumeEntryTypes,
} from "@/features/resumes/constants";

export const recruitmentOpportunities = sqliteTable(
  "recruitment_opportunities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceRecordId: text("source_record_id").notNull(),
    company: text("company").notNull(),
    batch: text("batch").notNull().default(""),
    sourceUpdatedDate: text("source_updated_date"),
    companyType: text("company_type").notNull().default(""),
    industry: text("industry").notNull().default(""),
    roles: text("roles").notNull().default(""),
    cities: text("cities").notNull().default(""),
    unrestrictedMajor: integer("unrestricted_major", { mode: "boolean" }).notNull().default(false),
    targetAudience: text("target_audience").notNull().default(""),
    degree: text("degree").notNull().default(""),
    deadline: text("deadline").notNull().default(""),
    notes: text("notes").notNull().default(""),
    writtenTestWaived: integer("written_test_waived", { mode: "boolean" }).notNull().default(false),
    announcementUrl: text("announcement_url"),
    applicationUrl: text("application_url"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    syncedAt: text("synced_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sourceRecordIdUnique: uniqueIndex("recruitment_opportunities_source_record_id_unique").on(table.sourceRecordId),
    activeIndex: index("recruitment_opportunities_is_active_idx").on(table.isActive),
  }),
);

export const applications = sqliteTable(
  "applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    opportunityId: integer("opportunity_id").references(() => recruitmentOpportunities.id, { onDelete: "set null" }),
    resumeAssetId: integer("resume_asset_id").references(() => resumeAssets.id, { onDelete: "set null" }),
    company: text("company").notNull(),
    role: text("role").notNull(),
    city: text("city"),
    jobCategory: text("job_category", { enum: jobCategories }),
    source: text("source").notNull(),
    status: text("status", { enum: applicationStatuses }).notNull().default("planned"),
    internshipType: text("internship_type", { enum: internshipTypes }).notNull().default("daily"),
    companySize: text("company_size", { enum: companySizes }).notNull().default("medium"),
    appliedDate: text("applied_date").notNull(),
    interviewTime: text("interview_time"),
    applicationUrl: text("application_url"),
    jobDescription: text("job_description").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    resumeAssetIndex: index("applications_resume_asset_id_idx").on(table.resumeAssetId),
  }),
);

export const dailyActions = sqliteTable("daily_actions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actionDate: text("action_date").notNull().unique(),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const internshipRecords = sqliteTable("internship_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyName: text("company_name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const internshipEntries = sqliteTable("internship_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  internshipRecordId: integer("internship_record_id")
    .notNull()
    .references(() => internshipRecords.id, { onDelete: "cascade" }),
  entryDate: text("entry_date").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const interviewNotes = sqliteTable("interview_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id").references(() => applications.id, { onDelete: "set null" }),
  companySnapshot: text("company_snapshot").notNull(),
  roleSnapshot: text("role_snapshot").notNull(),
  round: text("round", { enum: interviewRounds }).notNull(),
  interviewDate: text("interview_date").notNull(),
  result: text("result", { enum: interviewResults }).notNull().default("unknown"),
  summary: text("summary").notNull().default(""),
  reflection: text("reflection").notNull().default(""),
  nextAction: text("next_action").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const interviewQuestions = sqliteTable("interview_questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  interviewNoteId: integer("interview_note_id")
    .notNull()
    .references(() => interviewNotes.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  myAnswer: text("my_answer").notNull().default(""),
  betterAnswer: text("better_answer").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const interviewTags = sqliteTable(
  "interview_tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: text("category", { enum: interviewTagCategories }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    slugUnique: uniqueIndex("interview_tags_slug_unique").on(table.slug),
  }),
);

export const journalEntries = sqliteTable(
  "journal_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entryDate: text("entry_date").notNull(),
    content: text("content").notNull(),
    mood: text("mood"),
    energyLevel: text("energy_level"),
    completedToday: text("completed_today").notNull().default(""),
    tomorrowMinimumAction: text("tomorrow_minimum_action").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    entryDateUnique: uniqueIndex("journal_entries_entry_date_unique").on(table.entryDate),
  }),
);

export const studyCheckins = sqliteTable(
  "study_checkins",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    checkinDate: text("checkin_date").notNull(),
    category: text("category", { enum: studyCategories }).notNull(),
    isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
    durationMinutes: integer("duration_minutes"),
    quantity: integer("quantity"),
    title: text("title").notNull().default(""),
    notes: text("notes").notNull().default(""),
    sourceUrl: text("source_url"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    dateCategoryUnique: uniqueIndex("study_checkins_date_category_unique").on(table.checkinDate, table.category),
  }),
);


export const planningEvents = sqliteTable(
  "planning_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    eventDate: text("event_date").notNull(),
    eventType: text("event_type", { enum: planningEventTypes }).notNull(),
    status: text("status", { enum: planningEventStatuses }).notNull().default("todo"),
    source: text("source", { enum: planningEventSources }).notNull().default("user"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    systemEventUnique: uniqueIndex("planning_events_system_event_unique").on(table.source, table.eventDate, table.title),
  }),
);
export const interviewNoteTags = sqliteTable(
  "interview_note_tags",
  {
    interviewNoteId: integer("interview_note_id")
      .notNull()
      .references(() => interviewNotes.id, { onDelete: "cascade" }),
    interviewTagId: integer("interview_tag_id")
      .notNull()
      .references(() => interviewTags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.interviewNoteId, table.interviewTagId] }),
  }),
);

export const resumeAssets = sqliteTable(
  "resume_assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    originalName: text("original_name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    extractedText: text("extracted_text").notNull().default(""),
    parseStatus: text("parse_status", { enum: resumeAssetParseStatuses }).notNull().default("pending"),
    parseError: text("parse_error"),
    entryExtractionStatus: text("entry_extraction_status", { enum: resumeEntryExtractionStatuses }).notNull().default("idle"),
    entryExtractionError: text("entry_extraction_error"),
    entryExtractedAt: text("entry_extracted_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ storageKeyUnique: uniqueIndex("resume_assets_storage_key_unique").on(table.storageKey) }),
);

export const resumeEntries = sqliteTable("resume_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: resumeEntryTypes }).notNull(),
  title: text("title").notNull(),
  contentJson: text("content_json").notNull(),
  tagsJson: text("tags_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const resumeEntryCandidates = sqliteTable(
  "resume_entry_candidates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    resumeAssetId: integer("resume_asset_id")
      .notNull()
      .references(() => resumeAssets.id, { onDelete: "cascade" }),
    type: text("type", { enum: resumeEntryTypes }).notNull(),
    title: text("title").notNull(),
    contentJson: text("content_json").notNull(),
    tagsJson: text("tags_json").notNull().default("[]"),
    sourceExcerpt: text("source_excerpt").notNull(),
    duplicateEntryId: integer("duplicate_entry_id")
      .references(() => resumeEntries.id, { onDelete: "set null" }),
    duplicateKind: text("duplicate_kind", { enum: resumeCandidateDuplicateKinds }).notNull().default("none"),
    state: text("state", { enum: resumeCandidateStates }).notNull().default("pending"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    assetIndex: index("resume_entry_candidates_asset_id_idx").on(table.resumeAssetId),
    stateIndex: index("resume_entry_candidates_state_idx").on(table.state),
  }),
);

export const resumeEntryMerges = sqliteTable("resume_entry_merges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entryId: integer("entry_id").notNull().references(() => resumeEntries.id, { onDelete: "cascade" }),
  candidateId: integer("candidate_id").references(() => resumeEntryCandidates.id, { onDelete: "set null" }),
  beforeJson: text("before_json").notNull(),
  afterJson: text("after_json").notNull(),
  sourceExcerpt: text("source_excerpt").notNull(),
  createdAt: text("created_at").notNull(),
  undoneAt: text("undone_at"),
});

export const resumeOptimizationTasks = sqliteTable(
  "resume_optimization_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    applicationId: integer("application_id").references(() => applications.id, { onDelete: "set null" }),
    jdSource: text("jd_source", { enum: optimizationTaskSources }).notNull(),
    jdImageStorageKey: text("jd_image_storage_key"),
    jdText: text("jd_text").notNull().default(""),
    targetRole: text("target_role").notNull(),
    status: text("status", { enum: optimizationTaskStatuses }).notNull().default("draft"),
    aiOutputJson: text("ai_output_json"),
    inputRevision: integer("input_revision").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    applicationIndex: index("resume_optimization_tasks_application_id_idx").on(table.applicationId),
  }),
);

export const resumeOptimizationMaterials = sqliteTable(
  "resume_optimization_materials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id").notNull().references(() => resumeOptimizationTasks.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: optimizationMaterialKinds }).notNull(),
    resumeAssetId: integer("resume_asset_id").references(() => resumeAssets.id, { onDelete: "set null" }),
    resumeEntryId: integer("resume_entry_id").references(() => resumeEntries.id, { onDelete: "set null" }),
    snapshotJson: text("snapshot_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ taskOwnershipUnique: uniqueIndex("resume_optimization_materials_id_task_id_unique").on(table.id, table.taskId) }),
);

export const resumeOptimizationSuggestions = sqliteTable(
  "resume_optimization_suggestions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id").notNull().references(() => resumeOptimizationTasks.id, { onDelete: "cascade" }),
    materialId: integer("material_id").notNull().references(() => resumeOptimizationMaterials.id, { onDelete: "cascade" }),
    originalText: text("original_text").notNull(),
    proposedText: text("proposed_text").notNull(),
    rationale: text("rationale").notNull(),
    state: text("state", { enum: optimizationSuggestionStates }).notNull().default("pending"),
    inputRevision: integer("input_revision").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ materialTaskOwnership: foreignKey({ columns: [table.materialId, table.taskId], foreignColumns: [resumeOptimizationMaterials.id, resumeOptimizationMaterials.taskId], name: "resume_optimization_suggestions_material_task_fk" }).onDelete("cascade") }),
);

export const resumeDrafts = sqliteTable("resume_drafts", {
  taskId: integer("task_id")
    .primaryKey()
    .references(() => resumeOptimizationTasks.id, { onDelete: "cascade" }),
  contentJson: text("content_json").notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const resumeVersions = sqliteTable(
  "resume_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id").references(() => resumeOptimizationTasks.id, { onDelete: "set null" }),
    name: text("name").notNull().default("未命名版本"),
    versionNumber: integer("version_number").notNull().default(1),
    schemaVersion: integer("schema_version").notNull().default(1),
    templateVersion: text("template_version").notNull().default("classic-v1"),
    idempotencyKey: text("idempotency_key"),
    acceptedContentJson: text("accepted_content_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    idempotencyKeyUnique: uniqueIndex("resume_versions_idempotency_key_unique").on(table.idempotencyKey),
    taskVersionUnique: uniqueIndex("resume_versions_task_version_unique").on(table.taskId, table.versionNumber),
  }),
);

export const resumeAiRuns = sqliteTable(
  "resume_ai_runs",
  {
    id: text("id").primaryKey(),
    taskId: integer("task_id").references(() => resumeOptimizationTasks.id, { onDelete: "set null" }),
    operation: text("operation", { enum: ["recommendation", "optimization"] }).notNull(),
    inputRevision: integer("input_revision").notNull(),
    inputHash: text("input_hash").notNull(),
    status: text("status", { enum: ["running", "waiting", "completed", "failed", "interrupted", "superseded"] }).notNull(),
    stage: text("stage").notNull().default("prepare"),
    executionId: text("execution_id"),
    heartbeatAt: text("heartbeat_at"),
    inputJson: text("input_json"),
    targetMaterialId: integer("target_material_id"),
    callCount: integer("call_count").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    fallbackCount: integer("fallback_count").notNull().default(0),
    checkpointsCleared: integer("checkpoints_cleared", { mode: "boolean" }).notNull().default(false),
    model: text("model"),
    promptVersion: text("prompt_version").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    errorCode: text("error_code"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
  },
  (table) => ({
    taskOperationRunningUnique: uniqueIndex("resume_ai_runs_task_operation_running_unique")
      .on(table.taskId, table.operation)
      .where(sql`${table.status} = 'running'`),
  }),
);


export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type RecruitmentOpportunity = typeof recruitmentOpportunities.$inferSelect;
export type NewRecruitmentOpportunity = typeof recruitmentOpportunities.$inferInsert;
export type DailyAction = typeof dailyActions.$inferSelect;
export type InternshipRecord = typeof internshipRecords.$inferSelect;
export type InternshipEntry = typeof internshipEntries.$inferSelect;
export type InterviewNote = typeof interviewNotes.$inferSelect;
export type InterviewQuestion = typeof interviewQuestions.$inferSelect;
export type InterviewTag = typeof interviewTags.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type StudyCheckin = typeof studyCheckins.$inferSelect;
export type PlanningEvent = typeof planningEvents.$inferSelect;
export type ResumeAsset = typeof resumeAssets.$inferSelect;
export type ResumeEntry = typeof resumeEntries.$inferSelect;
export type ResumeEntryCandidate = typeof resumeEntryCandidates.$inferSelect;
export type ResumeOptimizationTask = typeof resumeOptimizationTasks.$inferSelect;
export type ResumeOptimizationMaterial = typeof resumeOptimizationMaterials.$inferSelect;
export type ResumeOptimizationSuggestion = typeof resumeOptimizationSuggestions.$inferSelect;
export type ResumeDraft = typeof resumeDrafts.$inferSelect;
export type ResumeVersion = typeof resumeVersions.$inferSelect;
export type ResumeAiRun = typeof resumeAiRuns.$inferSelect;


