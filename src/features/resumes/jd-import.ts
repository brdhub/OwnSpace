import type { ApplicationJdContext } from "@/features/applications/jd-context";

type LinkedJdTask = {
  id: number;
  applicationId: number | null;
  targetRole: string;
  jdText: string;
  updatedAt: string;
};

export type JdImportState = {
  activeTaskId: number | null;
  targetRole: string;
  jdText: string;
};

export function resolveJdImportState(tasks: LinkedJdTask[], context: ApplicationJdContext | null): JdImportState {
  if (!context) return { activeTaskId: null, targetRole: "", jdText: "" };

  const linkedTask = tasks
    .filter((task) => task.applicationId === context.id)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  return linkedTask
    ? { activeTaskId: linkedTask.id, targetRole: linkedTask.targetRole, jdText: linkedTask.jdText }
    : { activeTaskId: null, targetRole: context.role, jdText: context.jobDescription };
}

