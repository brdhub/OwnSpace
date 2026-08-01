import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { predefinedInterviewTags } from "../src/features/interviews/constants";
import { defaultPlanningEvents } from "../src/features/planning/constants";

const sqlitePath = resolve(process.cwd(), "data", "ownspace.db");
mkdirSync(dirname(sqlitePath), { recursive: true });

const db = new Database(sqlitePath);
const defaultsOnly = process.argv.includes("--defaults-only");

db.prepare("select count(*) as count from applications").get();
db.prepare("select count(*) as count from daily_actions").get();

const insertTag = db.prepare(`
  insert into interview_tags (slug, name, category, sort_order, created_at)
  values (@slug, @name, @category, @sortOrder, CURRENT_TIMESTAMP)
  on conflict(slug) do update set
    name = excluded.name,
    category = excluded.category,
    sort_order = excluded.sort_order
`);

const seedTags = db.transaction(() => {
  predefinedInterviewTags.forEach(([slug, name, category], index) => {
    insertTag.run({ slug, name, category, sortOrder: index });
  });
});

seedTags();

if (!defaultsOnly) {
const noteCount = db.prepare("select count(*) as count from interview_notes").get() as { count: number };
let firstApplication = db.prepare("select id, company, role from applications order by id limit 1").get() as
  | { id: number; company: string; role: string }
  | undefined;

if (!firstApplication) {
  const inserted = db
    .prepare(
      `
        insert into applications (company, role, source, status, applied_date, notes, created_at, updated_at)
        values ('云杉技术实验室', '后端开发实习生', '示例数据', 'firstInterview', date('now'), '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
    )
    .run();
  firstApplication = {
    id: Number(inserted.lastInsertRowid),
    company: "云杉技术实验室",
    role: "后端开发实习生",
  };
}

if (noteCount.count === 0 && firstApplication) {
  const insertNote = db.prepare(`
    insert into interview_notes
      (application_id, company_snapshot, role_snapshot, round, interview_date, result, summary, reflection, next_action, created_at, updated_at)
    values
      (@applicationId, @companySnapshot, @roleSnapshot, 'firstTechnical', @interviewDate, 'unknown', @summary, @reflection, @nextAction, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
  const insertQuestion = db.prepare(`
    insert into interview_questions
      (interview_note_id, question, my_answer, better_answer, sort_order, created_at, updated_at)
    values
      (@interviewNoteId, @question, @myAnswer, @betterAnswer, @sortOrder, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
  const insertNoteTag = db.prepare(`
    insert or ignore into interview_note_tags (interview_note_id, interview_tag_id)
    values (?, ?)
  `);

  const result = insertNote.run({
    applicationId: firstApplication.id,
    companySnapshot: firstApplication.company,
    roleSnapshot: firstApplication.role,
    interviewDate: new Date().toISOString().slice(0, 10),
    summary: "围绕项目经历和基础知识展开。",
    reflection: "需要把关键技术点讲得更有层次。",
    nextAction: "整理项目中的数据库和缓存设计。",
  });
  insertQuestion.run({
    interviewNoteId: result.lastInsertRowid,
    question: "介绍一个你负责过的后端项目，并说明核心技术取舍。",
    myAnswer: "按背景、职责、实现和结果进行说明。",
    betterAnswer: "补充架构边界、数据一致性和可观测性细节。",
    sortOrder: 0,
  });

  const tagRows = db.prepare("select id from interview_tags where slug in ('java', 'mysql', 'redis')").all() as Array<{ id: number }>;
  for (const tag of tagRows) {
    insertNoteTag.run(result.lastInsertRowid, tag.id);
  }
}

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);
const formatDate = (date: Date) => `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;

const seedJournalEntry = db.prepare(`
  insert into journal_entries
    (entry_date, content, mood, energy_level, completed_today, tomorrow_minimum_action, created_at, updated_at)
  values
    (@entryDate, @content, @mood, @energyLevel, @completedToday, @tomorrowMinimumAction, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  on conflict(entry_date) do nothing
`);

seedJournalEntry.run({
  entryDate: formatDate(yesterday),
  content: "今天把投递记录整理了一遍，也发现有些岗位需要更具体地准备项目表达。先把能做的小事写下来，压力会轻一点。",
  mood: "calm",
  energyLevel: "medium",
  completedToday: "整理了近期投递和一个项目介绍版本。",
  tomorrowMinimumAction: "补充项目中的数据库设计说明。",
});

seedJournalEntry.run({
  entryDate: formatDate(today),
  content: "今天先留下几句话，给之后的自己一个可以接上的线头。",
  mood: "focused",
  energyLevel: "medium",
  completedToday: "完成一次轻量复盘。",
  tomorrowMinimumAction: "挑一个岗位认真看 JD。",
});
}

const insertPlanningEvent = db.prepare(`
  insert into planning_events
    (title, description, event_date, event_type, status, source, sort_order, created_at, updated_at)
  values
    (@title, @description, @eventDate, @eventType, @status, @source, @sortOrder, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  on conflict(source, event_date, title) do update set
    description = excluded.description,
    event_type = excluded.event_type,
    sort_order = excluded.sort_order,
    updated_at = CURRENT_TIMESTAMP
`);

const seedPlanningEvents = db.transaction(() => {
  defaultPlanningEvents.forEach((event, index) => {
    insertPlanningEvent.run({ ...event, status: "todo", source: "system", sortOrder: index });
  });

  const examples = [
    {
      eventDate: "2026-07-20",
      title: "完善后端实习简历第二版",
      eventType: "task",
      status: "inProgress",
      description: "把项目中的性能优化、接口设计和数据一致性经历写得更具体。",
      sortOrder: 100,
    },
    {
      eventDate: "2026-08-10",
      title: "完成 Hot 100 第一轮 30 题",
      eventType: "progress",
      status: "done",
      description: "优先覆盖链表、二叉树、动态规划和滑动窗口题型。",
      sortOrder: 101,
    },
    {
      eventDate: "2027-03-20",
      title: "论文初稿完成一次导师反馈",
      eventType: "progress",
      status: "todo",
      description: "这是虚构示例，可按自己的毕业安排调整或删除。",
      sortOrder: 102,
    },
  ];

  if (!defaultsOnly) {
    for (const event of examples) {
      db.prepare(`
        insert into planning_events
          (title, description, event_date, event_type, status, source, sort_order, created_at, updated_at)
        select @title, @description, @eventDate, @eventType, @status, 'user', @sortOrder, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        where not exists (
          select 1 from planning_events where source = 'user' and event_date = @eventDate and title = @title
        )
      `).run(event);
    }
  }
});

seedPlanningEvents();
console.log(
  defaultsOnly
    ? `Fresh database is ready. ${predefinedInterviewTags.length} interview tags and ${defaultPlanningEvents.length} system planning nodes are available.`
    : `Database is ready. ${predefinedInterviewTags.length} interview tags and ${defaultPlanningEvents.length} planning nodes are available.`,
);

