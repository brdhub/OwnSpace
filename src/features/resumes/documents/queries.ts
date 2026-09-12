import "server-only";

import { db } from "@/db";
import { createResumeDocumentService } from "@/features/resumes/documents/service";

const documentService = createResumeDocumentService(db);

export async function getDocumentWorkspace(taskId: number) {
  return documentService.getWorkspace(taskId);
}

export async function getResumeVersion(id: number) {
  return documentService.getVersion(id);
}

export async function listResumeVersions(taskId?: number) {
  return documentService.listVersions(taskId);
}
