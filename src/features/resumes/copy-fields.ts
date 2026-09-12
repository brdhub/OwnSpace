import type { ResumeEntryType } from "@/features/resumes/constants";
import type { ResumeEntryContent } from "@/features/resumes/schema";

import { formatExperienceProjects, getExperienceProjects } from "./experience-projects";

export type ResumeCopyEntry = {
  type: ResumeEntryType;
  title: string;
  content: ResumeEntryContent;
};

export type ResumeCopyField = {
  key: string;
  label: string;
  value: string;
  multiline: boolean;
};

function field(key: string, label: string, value: string, multiline = false): ResumeCopyField | null {
  return value.trim() ? { key, label, value, multiline } : null;
}

function compact(fields: Array<ResumeCopyField | null>) {
  return fields.filter((item): item is ResumeCopyField => item !== null);
}

function stringValue(content: ResumeEntryContent, key: string) {
  const value = (content as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function listValue(content: ResumeEntryContent, key: string) {
  const value = (content as unknown as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function getResumeCopyFields(entry: ResumeCopyEntry): ResumeCopyField[] {
  const title = field("title", "条目名称", entry.title);

  switch (entry.type) {
    case "project":
      return compact([
        title,
        field("projectCategory", "项目分类", stringValue(entry.content, "projectCategory")),
        field("techStack", "技术栈", listValue(entry.content, "techStack").join("、")),
        field("content", "项目内容", stringValue(entry.content, "content"), true),
        field("responsibilities", "个人职责", stringValue(entry.content, "responsibilities"), true),
      ]);
    case "experience":
      return compact([
        title,
        field("position", "岗位", stringValue(entry.content, "position")),
        field("techStack", "技术栈", listValue(entry.content, "techStack").join("、")),
        field("responsibilities", "工作职责", stringValue(entry.content, "responsibilities"), true),
        field("workContent", "工作内容", stringValue(entry.content, "workContent"), true),
        field("projects", "负责项目", formatExperienceProjects(getExperienceProjects(entry.content)), true),
      ]);
    case "education":
      return compact([
        title,
        field("degree", "学历", stringValue(entry.content, "degree")),
        field("major", "专业", stringValue(entry.content, "major")),
        field("dateRange", "时间", stringValue(entry.content, "dateRange")),
        field("content", "教育经历", stringValue(entry.content, "content"), true),
      ]);
    case "skill":
      return compact([
        title,
        field("proficiency", "掌握程度", stringValue(entry.content, "proficiency")),
        field("content", "技能说明", stringValue(entry.content, "content"), true),
      ]);
    case "honor":
      return compact([
        title,
        field("award", "奖项 / 等级", stringValue(entry.content, "award")),
      ]);
  }
}
