"use client";

import { Button } from "@/components/ui/button";
import type { ResumeEntryView } from "@/features/resumes/queries";

export function ResumeEntryList({ entries, onEdit }: { entries: ResumeEntryView[]; onEdit: (entry: ResumeEntryView) => void }) {
  return (
    <div>
      {entries.length ? (
        <div className="divide-y divide-border rounded-md border border-border bg-background">
          {entries.map((entry) => (
            <div key={entry.id} className="flex min-h-10 items-center justify-between gap-3 px-3 py-1.5">
              <h3 className="truncate text-sm font-medium text-foreground">{entry.title}</h3>
              <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(entry)} aria-label={`编辑${entry.title}`}>编辑</Button>
            </div>
          ))}
        </div>
      ) : <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">先把一段真实经历、项目或技能整理成条目吧。</p>}
    </div>
  );
}
