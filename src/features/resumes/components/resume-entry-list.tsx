"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { resumeEntryTypes, type ResumeEntryType } from "@/features/resumes/constants";
import type { ResumeEntryView } from "@/features/resumes/queries";

const typeLabels: Record<ResumeEntryType, string> = {
  profile: "个人信息",
  education: "教育经历",
  experience: "工作经历",
  project: "项目经历",
  skill: "技能",
};

function contentPreview(content: Record<string, string>) {
  return Object.values(content).join(" ");
}

export function ResumeEntryList({ entries, onEdit }: { entries: ResumeEntryView[]; onEdit: (entry: ResumeEntryView) => void }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ResumeEntryType | "all">("all");
  const filteredEntries = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesType = type === "all" || entry.type === type;
      const haystack = `${entry.title} ${entry.tags.join(" ")} ${contentPreview(entry.content)}`.toLowerCase();
      return matchesType && (!keyword || haystack.includes(keyword));
    });
  }, [entries, query, type]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="搜索标题、标签或内容" aria-label="搜索简历条目" />
        </div>
        <Select value={type} onChange={(event) => setType(event.target.value as ResumeEntryType | "all")} className="sm:w-40" aria-label="筛选简历条目类型">
          <option value="all">全部类型</option>
          {resumeEntryTypes.map((entryType) => <option key={entryType} value={entryType}>{typeLabels[entryType]}</option>)}
        </Select>
      </div>
      {filteredEntries.length ? (
        <div className="space-y-2">
          {filteredEntries.map((entry) => (
            <article key={entry.id} className="rounded-md border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{typeLabels[entry.type]}</Badge>
                    <span className="text-xs text-muted-foreground">{entry.completeness === "complete" ? "已整理" : "待补充"}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-foreground">{entry.title}</h3>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => onEdit(entry)}>编辑</Button>
              </div>
              {contentPreview(entry.content) ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{contentPreview(entry.content)}</p> : null}
              {entry.tags.length ? <p className="mt-3 text-xs text-muted-foreground">{entry.tags.map((tag) => `#${tag}`).join("  ")}</p> : null}
            </article>
          ))}
        </div>
      ) : <p className="rounded-md border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">{entries.length ? "没有匹配的条目。" : "先把一段真实经历、项目或技能整理成条目吧。"}</p>}
    </div>
  );
}
