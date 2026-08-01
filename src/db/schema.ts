import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { applicationStatuses } from "@/config/application-status";
import { companySizes, internshipTypes } from "@/features/applications/constants";
import { interviewResults, interviewRounds, interviewTagCategories } from "@/features/interviews/constants";
import { planningEventSources, planningEventStatuses, planningEventTypes } from "@/features/planning/constants";
import { studyCategories } from "@/features/study/constants";

export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  company: text("company").notNull(),
  role: text("role").notNull(),
  source: text("source").notNull(),
  status: text("status", { enum: applicationStatuses }).notNull().default("planned"),
  internshipType: text("internship_type", { enum: internshipTypes }).notNull().default("daily"),
  companySize: text("company_size", { enum: companySizes }).notNull().default("medium"),
  appliedDate: text("applied_date").notNull(),
  interviewTime: text("interview_time"),
  applicationUrl: text("application_url"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

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


export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type DailyAction = typeof dailyActions.$inferSelect;
export type InternshipRecord = typeof internshipRecords.$inferSelect;
export type InternshipEntry = typeof internshipEntries.$inferSelect;
export type InterviewNote = typeof interviewNotes.$inferSelect;
export type InterviewQuestion = typeof interviewQuestions.$inferSelect;
export type InterviewTag = typeof interviewTags.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type StudyCheckin = typeof studyCheckins.$inferSelect;
export type PlanningEvent = typeof planningEvents.$inferSelect;


