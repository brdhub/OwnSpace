"use client";

import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resumeEntryTypeLabels, resumeEntryTypes } from "@/features/resumes/constants";
import type { ResumeEntryView } from "@/features/resumes/queries";

function entrySummary(entry: ResumeEntryView) {
  const content = entry.content as Record<string, unknown>;
  switch (entry.type) {
    case "project":
      return [content.projectCategory, ...(Array.isArray(content.techStack) ? content.techStack : [])].filter(Boolean).join(" · ");
    case "experience":
      return [content.position, ...(Array.isArray(content.techStack) ? content.techStack : [])].filter(Boolean).join(" · ");
    case "education":
      return [content.degree, content.major, content.dateRange].filter(Boolean).join(" · ");
    case "skill":
      return typeof content.proficiency === "string" ? content.proficiency : "";
    case "honor":
      return typeof content.award === "string" ? content.award : "";
  }
}

export function ResumeEntryList({
  entries,
  onView,
  onEdit,
}: {
  entries: ResumeEntryView[];
  onView: (entry: ResumeEntryView) => void;
  onEdit: (entry: ResumeEntryView) => void;
}) {
  if (!entries.length) {
    return <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">条目仓库还是空的。可以手动添加，也可以从已上传的 PDF 重新生成。</p>;
  }

  return <div className="space-y-5">
    {resumeEntryTypes.map((type) => {
      const typeEntries = entries.filter((entry) => entry.type === type);
      if (!typeEntries.length) return null;
      return <section key={type} aria-labelledby={`resume-entry-group-${type}`}>
        <div className="mb-2 flex items-center gap-2">
          <h3 id={`resume-entry-group-${type}`} className="text-sm font-semibold text-foreground">{resumeEntryTypeLabels[type]}</h3>
          <Badge variant="secondary">{typeEntries.length}</Badge>
        </div>
        <div className="divide-y divide-border rounded-md border border-border bg-background">
          {typeEntries.map((entry) => {
            const summary = entrySummary(entry);
            return <div key={entry.id} className="flex min-h-14 items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
                {summary ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{summary}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => onView(entry)} aria-label={`查看${entry.title}`}>
                  <Eye className="h-3.5 w-3.5" />查看
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(entry)} aria-label={`编辑${entry.title}`}>编辑</Button>
              </div>
            </div>;
          })}
        </div>
      </section>;
    })}
  </div>;
}
