import { and, asc, desc, eq, max } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as databaseSchema from "@/db/schema";
import {
  buildResumeDocument,
  readResumeDocument,
  resumeDocumentSchema,
  type ResumeDocument,
} from "@/features/resumes/documents/model";

export type DocumentDatabase = BetterSQLite3Database<typeof databaseSchema>;

export type DraftView = {
  taskId: number;
  revision: number;
  document: ResumeDocument;
  updatedAt: string;
};

export type VersionView = {
  id: number;
  taskId: number | null;
  name: string;
  versionNumber: number;
  document: ResumeDocument;
  createdAt: string;
};

export type DocumentWorkspace = {
  task: databaseSchema.ResumeOptimizationTask;
  draft: DraftView | null;
  versions: VersionView[];
};

export type DocumentServiceErrorCode =
  | "NOT_FOUND"
  | "NO_MATERIALS"
  | "REVISION_CONFLICT"
  | "INVALID_DOCUMENT"
  | "INCOMPLETE_PROFILE"
  | "TARGET_TASK_REQUIRED"
  | "IDEMPOTENCY_CONFLICT";

export class DocumentServiceError extends Error {
  constructor(
    public readonly code: DocumentServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DocumentServiceError";
  }
}

function parseDocument(contentJson: string, legacyContext: { targetRole?: string; jdText?: string } = {}) {
  try {
    return readResumeDocument(contentJson, legacyContext);
  } catch {
    throw new DocumentServiceError("INVALID_DOCUMENT", "简历内容格式无效，请刷新后重试。");
  }
}

function validatedDocument(document: ResumeDocument) {
  const parsed = resumeDocumentSchema.safeParse(document);
  if (!parsed.success) {
    throw new DocumentServiceError("INVALID_DOCUMENT", "简历内容格式无效，请检查后重试。");
  }
  return parsed.data;
}

function hasValidContact(document: ResumeDocument) {
  const email = document.profile.email.trim();
  const phone = document.profile.phone.trim();
  const validEmail = email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneDigitCount = phone.replace(/\D/g, "").length;
  const validPhone = /^[+()\d\s-]{6,30}$/.test(phone) && phoneDigitCount >= 6 && phoneDigitCount <= 20;
  return validEmail || validPhone;
}

export function createResumeDocumentService(
  database: DocumentDatabase,
  options: { now?: () => string } = {},
) {
  const now = options.now ?? (() => new Date().toISOString());

  function taskById(taskId: number) {
    const task = database.select().from(databaseSchema.resumeOptimizationTasks)
      .where(eq(databaseSchema.resumeOptimizationTasks.id, taskId)).get();
    if (!task) throw new DocumentServiceError("NOT_FOUND", "未找到这项简历制作任务。");
    return task;
  }

  function draftView(row: databaseSchema.ResumeDraft): DraftView {
    return {
      taskId: row.taskId,
      revision: row.revision,
      document: parseDocument(row.contentJson),
      updatedAt: row.updatedAt,
    };
  }

  function versionView(row: databaseSchema.ResumeVersion): VersionView {
    const sourceTask = row.taskId === null
      ? null
      : database.select({
        targetRole: databaseSchema.resumeOptimizationTasks.targetRole,
        jdText: databaseSchema.resumeOptimizationTasks.jdText,
      }).from(databaseSchema.resumeOptimizationTasks)
        .where(eq(databaseSchema.resumeOptimizationTasks.id, row.taskId)).get();
    return {
      id: row.id,
      taskId: row.taskId,
      name: row.name,
      versionNumber: row.versionNumber,
      document: parseDocument(row.acceptedContentJson, sourceTask ?? {}),
      createdAt: row.createdAt,
    };
  }

  function getVersion(id: number): VersionView | null {
    const row = database.select().from(databaseSchema.resumeVersions)
      .where(eq(databaseSchema.resumeVersions.id, id)).get();
    return row ? versionView(row) : null;
  }

  function listVersions(taskId?: number): VersionView[] {
    const base = database.select().from(databaseSchema.resumeVersions);
    const rows = taskId === undefined
      ? base.orderBy(desc(databaseSchema.resumeVersions.createdAt), desc(databaseSchema.resumeVersions.id)).all()
      : base.where(eq(databaseSchema.resumeVersions.taskId, taskId))
        .orderBy(desc(databaseSchema.resumeVersions.versionNumber)).all();
    return rows.map(versionView);
  }

  function getWorkspace(taskId: number): DocumentWorkspace {
    const task = taskById(taskId);
    const draft = database.select().from(databaseSchema.resumeDrafts)
      .where(eq(databaseSchema.resumeDrafts.taskId, taskId)).get();
    return {
      task,
      draft: draft ? draftView(draft) : null,
      versions: listVersions(taskId),
    };
  }

  function createDraft(input: { taskId: number; expectedRevision?: number }): DraftView {
    return database.transaction((transaction) => {
      const task = transaction.select().from(databaseSchema.resumeOptimizationTasks)
        .where(eq(databaseSchema.resumeOptimizationTasks.id, input.taskId)).get();
      if (!task) throw new DocumentServiceError("NOT_FOUND", "未找到这项简历制作任务。");

      const materials = transaction.select({
        id: databaseSchema.resumeOptimizationMaterials.id,
        snapshotJson: databaseSchema.resumeOptimizationMaterials.snapshotJson,
      }).from(databaseSchema.resumeOptimizationMaterials)
        .where(and(
          eq(databaseSchema.resumeOptimizationMaterials.taskId, input.taskId),
          eq(databaseSchema.resumeOptimizationMaterials.kind, "entry"),
        ))
        .orderBy(asc(databaseSchema.resumeOptimizationMaterials.id)).all();
      if (!materials.length) {
        throw new DocumentServiceError("NO_MATERIALS", "请先保存至少一条岗位素材，再制作简历。");
      }
      const suggestions = transaction.select({
        id: databaseSchema.resumeOptimizationSuggestions.id,
        materialId: databaseSchema.resumeOptimizationSuggestions.materialId,
        inputRevision: databaseSchema.resumeOptimizationSuggestions.inputRevision,
        state: databaseSchema.resumeOptimizationSuggestions.state,
        proposedText: databaseSchema.resumeOptimizationSuggestions.proposedText,
      }).from(databaseSchema.resumeOptimizationSuggestions)
        .where(eq(databaseSchema.resumeOptimizationSuggestions.taskId, input.taskId))
        .orderBy(asc(databaseSchema.resumeOptimizationSuggestions.sortOrder)).all();

      let document: ResumeDocument;
      try {
        document = buildResumeDocument({ task, materials, suggestions });
      } catch {
        throw new DocumentServiceError("INVALID_DOCUMENT", "岗位素材格式异常，请重新保存选材。");
      }
      const timestamp = now();
      const existing = transaction.select().from(databaseSchema.resumeDrafts)
        .where(eq(databaseSchema.resumeDrafts.taskId, input.taskId)).get();
      if (!existing) {
        transaction.insert(databaseSchema.resumeDrafts).values({
          taskId: input.taskId,
          contentJson: JSON.stringify(document),
          schemaVersion: document.schemaVersion,
          revision: 1,
          updatedAt: timestamp,
        }).run();
        return { taskId: input.taskId, revision: 1, document, updatedAt: timestamp };
      }
      if (input.expectedRevision === undefined || input.expectedRevision !== existing.revision) {
        throw new DocumentServiceError("REVISION_CONFLICT", "草稿已发生变化，请刷新后再确认替换。");
      }

      const revision = existing.revision + 1;
      const result = transaction.update(databaseSchema.resumeDrafts).set({
        contentJson: JSON.stringify(document),
        schemaVersion: document.schemaVersion,
        revision,
        updatedAt: timestamp,
      }).where(and(
        eq(databaseSchema.resumeDrafts.taskId, input.taskId),
        eq(databaseSchema.resumeDrafts.revision, existing.revision),
      )).run();
      if (result.changes !== 1) {
        throw new DocumentServiceError("REVISION_CONFLICT", "草稿已发生变化，请刷新后重试。");
      }
      return { taskId: input.taskId, revision, document, updatedAt: timestamp };
    });
  }

  function saveDraft(input: { taskId: number; revision: number; document: ResumeDocument }): DraftView {
    const document = validatedDocument(input.document);
    const updatedAt = now();
    const revision = input.revision + 1;
    const result = database.update(databaseSchema.resumeDrafts).set({
      contentJson: JSON.stringify(document),
      schemaVersion: document.schemaVersion,
      revision,
      updatedAt,
    }).where(and(
      eq(databaseSchema.resumeDrafts.taskId, input.taskId),
      eq(databaseSchema.resumeDrafts.revision, input.revision),
    )).run();
    if (result.changes !== 1) {
      const exists = database.select({ taskId: databaseSchema.resumeDrafts.taskId })
        .from(databaseSchema.resumeDrafts)
        .where(eq(databaseSchema.resumeDrafts.taskId, input.taskId)).get();
      if (!exists) throw new DocumentServiceError("NOT_FOUND", "未找到要保存的简历草稿。");
      throw new DocumentServiceError("REVISION_CONFLICT", "草稿已在其他页面更新，请刷新后重试。");
    }
    return { taskId: input.taskId, revision, document, updatedAt };
  }

  function saveVersion(input: {
    taskId: number;
    revision: number;
    idempotencyKey: string;
    name: string;
  }): VersionView {
    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey) throw new DocumentServiceError("INVALID_DOCUMENT", "缺少本次保存标识，请重试。");

    return database.transaction((transaction) => {
      const repeated = transaction.select().from(databaseSchema.resumeVersions)
        .where(eq(databaseSchema.resumeVersions.idempotencyKey, idempotencyKey)).get();
      if (repeated) {
        if (repeated.taskId !== input.taskId) {
          throw new DocumentServiceError("IDEMPOTENCY_CONFLICT", "本次保存标识已用于其他任务，请重试。");
        }
        return versionView(repeated);
      }

      const draft = transaction.select().from(databaseSchema.resumeDrafts)
        .where(and(
          eq(databaseSchema.resumeDrafts.taskId, input.taskId),
          eq(databaseSchema.resumeDrafts.revision, input.revision),
        )).get();
      if (!draft) {
        const exists = transaction.select({ revision: databaseSchema.resumeDrafts.revision })
          .from(databaseSchema.resumeDrafts)
          .where(eq(databaseSchema.resumeDrafts.taskId, input.taskId)).get();
        if (!exists) throw new DocumentServiceError("NOT_FOUND", "未找到要保存的简历草稿。");
        throw new DocumentServiceError("REVISION_CONFLICT", "草稿已发生变化，请使用最新内容保存版本。");
      }

      const document = parseDocument(draft.contentJson);
      if (!document.profile.name.trim() || !hasValidContact(document)) {
        throw new DocumentServiceError("INCOMPLETE_PROFILE", "保存版本前请填写姓名和至少一种有效联系方式。");
      }
      const maximum = transaction.select({ value: max(databaseSchema.resumeVersions.versionNumber) })
        .from(databaseSchema.resumeVersions)
        .where(eq(databaseSchema.resumeVersions.taskId, input.taskId)).get()?.value ?? 0;
      const createdAt = now();
      const row = transaction.insert(databaseSchema.resumeVersions).values({
        taskId: input.taskId,
        name: input.name.trim() || `版本 ${maximum + 1}`,
        versionNumber: maximum + 1,
        schemaVersion: document.schemaVersion,
        templateVersion: document.templateVersion,
        idempotencyKey,
        acceptedContentJson: JSON.stringify(document),
        createdAt,
      }).returning().get();
      return versionView(row);
    });
  }

  function copyVersion(input: {
    versionId: number;
    targetTaskId?: number;
    expectedRevision?: number;
  }): DraftView {
    return database.transaction((transaction) => {
      const version = transaction.select().from(databaseSchema.resumeVersions)
        .where(eq(databaseSchema.resumeVersions.id, input.versionId)).get();
      if (!version) throw new DocumentServiceError("NOT_FOUND", "未找到要复制的简历版本。");
      const taskId = input.targetTaskId ?? version.taskId;
      if (taskId === null) {
        throw new DocumentServiceError("TARGET_TASK_REQUIRED", "原任务已删除，请选择一个目标任务后再复制。");
      }
      const targetTask = transaction.select().from(databaseSchema.resumeOptimizationTasks)
        .where(eq(databaseSchema.resumeOptimizationTasks.id, taskId)).get();
      if (!targetTask) throw new DocumentServiceError("NOT_FOUND", "未找到复制版本的目标任务。");
      const document = parseDocument(version.acceptedContentJson, {
        targetRole: targetTask.targetRole,
        jdText: targetTask.jdText,
      });
      const existing = transaction.select().from(databaseSchema.resumeDrafts)
        .where(eq(databaseSchema.resumeDrafts.taskId, taskId)).get();
      const updatedAt = now();
      if (!existing) {
        transaction.insert(databaseSchema.resumeDrafts).values({
          taskId,
          contentJson: JSON.stringify(document),
          schemaVersion: document.schemaVersion,
          revision: 1,
          updatedAt,
        }).run();
        return { taskId, revision: 1, document, updatedAt };
      }
      if (input.expectedRevision === undefined || input.expectedRevision !== existing.revision) {
        throw new DocumentServiceError("REVISION_CONFLICT", "目标任务已有草稿，请刷新后再确认替换。");
      }
      const revision = existing.revision + 1;
      const result = transaction.update(databaseSchema.resumeDrafts).set({
        contentJson: JSON.stringify(document),
        schemaVersion: document.schemaVersion,
        revision,
        updatedAt,
      }).where(and(
        eq(databaseSchema.resumeDrafts.taskId, taskId),
        eq(databaseSchema.resumeDrafts.revision, existing.revision),
      )).run();
      if (result.changes !== 1) {
        throw new DocumentServiceError("REVISION_CONFLICT", "目标草稿已发生变化，请刷新后重试。");
      }
      return { taskId, revision, document, updatedAt };
    });
  }

  return {
    createDraft,
    saveDraft,
    saveVersion,
    copyVersion,
    getWorkspace,
    getVersion,
    listVersions,
  };
}

export type ResumeDocumentService = ReturnType<typeof createResumeDocumentService>;
