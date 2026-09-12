import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { resolve } from "node:path";

import * as schema from "../../src/db/schema";
import {
  DocumentServiceError,
  createResumeDocumentService,
} from "../../src/features/resumes/documents/service";

function createFixture() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: resolve(process.cwd(), "drizzle") });
  const service = createResumeDocumentService(database, { now: () => "2026-09-05T09:00:00.000Z" });
  return { sqlite, database, service };
}

function insertTask(database: ReturnType<typeof createFixture>["database"], targetRole = "后端开发") {
  return database.insert(schema.resumeOptimizationTasks).values({
    jdSource: "text",
    jdText: "负责 API 与数据库开发",
    targetRole,
    inputRevision: 3,
    createdAt: "2026-09-05T08:00:00.000Z",
    updatedAt: "2026-09-05T08:00:00.000Z",
  }).returning({ id: schema.resumeOptimizationTasks.id }).get().id;
}

function insertProjectMaterial(database: ReturnType<typeof createFixture>["database"], taskId: number) {
  const materialId = database.insert(schema.resumeOptimizationMaterials).values({
    taskId,
    kind: "entry",
    resumeEntryId: null,
    snapshotJson: JSON.stringify({
      kind: "entry",
      entry: {
        id: 91,
        type: "project",
        title: "订单系统",
        content: { projectCategory: "个人项目", techStack: ["Java"], content: "实现订单接口" },
        tags: ["后端"],
      },
    }),
    createdAt: "2026-09-05T08:00:00.000Z",
  }).returning({ id: schema.resumeOptimizationMaterials.id }).get().id;
  database.insert(schema.resumeOptimizationSuggestions).values({
    taskId,
    materialId,
    originalText: JSON.stringify({ projectCategory: "个人项目", techStack: ["Java"], content: "实现订单接口" }),
    proposedText: JSON.stringify({ projectCategory: "个人项目", techStack: ["Java"], content: "设计并实现订单接口" }),
    rationale: "突出设计能力",
    state: "accepted",
    inputRevision: 3,
    createdAt: "2026-09-05T08:00:00.000Z",
    updatedAt: "2026-09-05T08:00:00.000Z",
  }).run();
}

function completeDocument(document: Awaited<ReturnType<ReturnType<typeof createResumeDocumentService>["createDraft"]>>["document"]) {
  return {
    ...document,
    profile: { ...document.profile, name: "张三", email: "zhangsan@example.com" },
  };
}

test("createDraft builds and persists a draft from current task inputs", () => {
  const { database, service } = createFixture();
  const taskId = insertTask(database);
  insertProjectMaterial(database, taskId);

  const draft = service.createDraft({ taskId });

  assert.equal(draft.taskId, taskId);
  assert.equal(draft.revision, 1);
  assert.equal(draft.document.sections[2].items[0].body, "技术栈：Java\n项目内容：设计并实现订单接口");
  assert.equal(draft.document.sections[2].items[0].sourceSuggestionId !== null, true);
  assert.equal(database.select().from(schema.resumeDrafts).get()?.revision, 1);
});

test("createDraft does not treat an uploaded PDF snapshot as a selected resume entry", () => {
  const { database, service } = createFixture();
  const taskId = insertTask(database);
  const assetId = database.insert(schema.resumeAssets).values({
    originalName: "resume.pdf",
    storageKey: "asset.pdf",
    mimeType: "application/pdf",
    byteSize: 10,
    extractedText: "PDF text",
  }).returning({ id: schema.resumeAssets.id }).get().id;
  database.insert(schema.resumeOptimizationMaterials).values({
    taskId,
    kind: "asset",
    resumeAssetId: assetId,
    snapshotJson: JSON.stringify({
      kind: "asset",
      asset: {
        id: assetId,
        originalName: "resume.pdf",
        storageKey: "asset.pdf",
        mimeType: "application/pdf",
        byteSize: 10,
        extractedText: "PDF text",
      },
    }),
  }).run();

  assert.throws(
    () => service.createDraft({ taskId }),
    (error) => error instanceof DocumentServiceError && error.code === "NO_MATERIALS",
  );
});

test("createDraft requires the current revision before replacing existing edits", () => {
  const { database, service } = createFixture();
  const taskId = insertTask(database);
  insertProjectMaterial(database, taskId);
  service.createDraft({ taskId });

  assert.throws(
    () => service.createDraft({ taskId }),
    (error) => error instanceof DocumentServiceError && error.code === "REVISION_CONFLICT",
  );
  assert.throws(
    () => service.createDraft({ taskId, expectedRevision: 9 }),
    (error) => error instanceof DocumentServiceError && error.code === "REVISION_CONFLICT",
  );
  assert.equal(service.createDraft({ taskId, expectedRevision: 1 }).revision, 2);
});

test("saveDraft prevents a stale editor from overwriting a newer draft", () => {
  const { database, service } = createFixture();
  const taskId = insertTask(database);
  insertProjectMaterial(database, taskId);
  const draft = service.createDraft({ taskId });
  const firstEdit = { ...draft.document, profile: { ...draft.document.profile, name: "第一次编辑" } };

  const saved = service.saveDraft({ taskId, revision: 1, document: firstEdit });
  assert.equal(saved.revision, 2);
  assert.equal(saved.document.profile.name, "第一次编辑");
  assert.throws(
    () => service.saveDraft({ taskId, revision: 1, document: draft.document }),
    (error) => error instanceof DocumentServiceError && error.code === "REVISION_CONFLICT",
  );
});

test("saveVersion validates the profile and treats one idempotency key as one immutable version", () => {
  const { database, service } = createFixture();
  const taskId = insertTask(database);
  insertProjectMaterial(database, taskId);
  const draft = service.createDraft({ taskId });

  assert.throws(
    () => service.saveVersion({ taskId, revision: 1, idempotencyKey: "save-1", name: "投递版" }),
    (error) => error instanceof DocumentServiceError && error.code === "INCOMPLETE_PROFILE",
  );
  const invalidPhoneDraft = service.saveDraft({
    taskId,
    revision: 1,
    document: { ...draft.document, profile: { ...draft.document.profile, name: "张三", phone: "------" } },
  });
  assert.throws(
    () => service.saveVersion({ taskId, revision: invalidPhoneDraft.revision, idempotencyKey: "save-1", name: "投递版" }),
    (error) => error instanceof DocumentServiceError && error.code === "INCOMPLETE_PROFILE",
  );
  const savedDraft = service.saveDraft({
    taskId,
    revision: invalidPhoneDraft.revision,
    document: completeDocument(invalidPhoneDraft.document),
  });
  const first = service.saveVersion({ taskId, revision: savedDraft.revision, idempotencyKey: "save-1", name: "投递版" });
  const repeated = service.saveVersion({ taskId, revision: savedDraft.revision, idempotencyKey: "save-1", name: "任意名称" });

  assert.equal(first.id, repeated.id);
  assert.equal(first.versionNumber, 1);
  assert.equal(first.name, "投递版");
  assert.equal(database.select().from(schema.resumeVersions).all().length, 1);

  const edited = service.saveDraft({
    taskId,
    revision: savedDraft.revision,
    document: { ...savedDraft.document, targetRole: "全栈开发" },
  });
  service.saveVersion({ taskId, revision: edited.revision, idempotencyKey: "save-2", name: "第二版" });
  assert.equal(service.getVersion(first.id)?.document.targetRole, "后端开发");
});

test("saved versions survive source task deletion while its draft is removed", () => {
  const { database, service } = createFixture();
  const taskId = insertTask(database);
  insertProjectMaterial(database, taskId);
  const draft = service.createDraft({ taskId });
  const savedDraft = service.saveDraft({ taskId, revision: 1, document: completeDocument(draft.document) });
  const version = service.saveVersion({ taskId, revision: savedDraft.revision, idempotencyKey: "save-1", name: "保留版" });

  database.delete(schema.resumeOptimizationTasks).where(eq(schema.resumeOptimizationTasks.id, taskId)).run();

  assert.equal(database.select().from(schema.resumeDrafts).all().length, 0);
  assert.equal(service.getVersion(version.id)?.taskId, null);
  assert.equal(service.getVersion(version.id)?.document.profile.name, "张三");
});

test("copyVersion creates a target draft and requires a revision to replace it", () => {
  const { database, service } = createFixture();
  const sourceTaskId = insertTask(database);
  insertProjectMaterial(database, sourceTaskId);
  const sourceDraft = service.createDraft({ taskId: sourceTaskId });
  const savedDraft = service.saveDraft({ taskId: sourceTaskId, revision: 1, document: completeDocument(sourceDraft.document) });
  const version = service.saveVersion({ taskId: sourceTaskId, revision: savedDraft.revision, idempotencyKey: "save-1", name: "源版本" });
  const targetTaskId = insertTask(database, "全栈开发");

  const copied = service.copyVersion({ versionId: version.id, targetTaskId });
  assert.equal(copied.taskId, targetTaskId);
  assert.equal(copied.revision, 1);
  assert.equal(copied.document.profile.name, "张三");
  assert.throws(
    () => service.copyVersion({ versionId: version.id, targetTaskId }),
    (error) => error instanceof DocumentServiceError && error.code === "REVISION_CONFLICT",
  );
  assert.equal(service.copyVersion({ versionId: version.id, targetTaskId, expectedRevision: 1 }).revision, 2);
});
