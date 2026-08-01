"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { interviewTagCategoryMeta } from "@/features/interviews/constants";
import type { InterviewTag } from "@/db/schema";

type InterviewTagSelectorProps = {
  tags: InterviewTag[];
  selectedIds: number[];
  onChange: (nextIds: number[]) => void;
};

export function InterviewTagSelector({ tags, selectedIds, onChange }: InterviewTagSelectorProps) {
  const [query, setQuery] = useState("");
  const selected = tags.filter((tag) => selectedIds.includes(tag.id));
  const filtered = tags.filter((tag) => tag.name.toLowerCase().includes(query.trim().toLowerCase()));

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, InterviewTag[]>>((acc, tag) => {
      acc[tag.category] = acc[tag.category] ?? [];
      acc[tag.category].push(tag);
      return acc;
    }, {});
  }, [filtered]);

  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground"
              onClick={() => toggle(tag.id)}
            >
              {tag.name}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      ) : null}
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索技术标签" />
      <div className="max-h-52 space-y-3 overflow-y-auto">
        {Object.entries(grouped).map(([category, categoryTags]) => (
          <div key={category} className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {interviewTagCategoryMeta[category as keyof typeof interviewTagCategoryMeta]}
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryTags.map((tag) => (
                <Button
                  key={tag.id}
                  type="button"
                  size="sm"
                  variant={selectedIds.includes(tag.id) ? "default" : "outline"}
                  onClick={() => toggle(tag.id)}
                >
                  {tag.name}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
