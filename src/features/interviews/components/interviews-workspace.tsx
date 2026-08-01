"use client";

import { Edit3, Plus, Search, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Application, InterviewTag } from "@/db/schema";
import { deleteInterviewAction } from "@/features/interviews/actions";
import { InterviewForm } from "@/features/interviews/components/interview-form";
import { interviewResultMeta, interviewResults, interviewRoundMeta, interviewRounds } from "@/features/interviews/constants";
import type { InterviewNoteView } from "@/features/interviews/types";
import { formatDate } from "@/lib/date";

type InterviewsWorkspaceProps = {
  notes: InterviewNoteView[];
  applications: Application[];
  tags: InterviewTag[];
  filters: {
    query?: string;
    round?: string;
    result?: string;
    tagId?: string;
    applicationId?: string;
  };
};

export function InterviewsWorkspace({ notes, applications, tags, filters }: InterviewsWorkspaceProps) {
  const [editing, setEditing] = useState<InterviewNoteView | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();

  const modalTitle = useMemo(() => {
    if (editing) {
      return "编辑面经";
    }
    if (isCreating) {
      return "新增面经";
    }
    return "";
  }, [editing, isCreating]);

  function updateFilter(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, rawValue] of Object.entries(next)) {
      const value = rawValue.trim();
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    if (params.toString() === searchParams.toString()) {
      return;
    }

    const target = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => router.replace(target));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get("query")?.toString() ?? "";
    updateFilter({ query });
  }

  function closeForm() {
    setEditing(null);
    setIsCreating(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <form onSubmit={handleSearch} className="flex-1 space-y-2">
            <Label htmlFor="interview-search">搜索</Label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="interview-search"
                  name="query"
                  defaultValue={filters.query ?? ""}
                  className="pl-9"
                  placeholder="按公司、岗位或问题搜索"
                />
              </div>
              <Button type="submit" variant="outline" disabled={isNavigating} className="min-w-24">
                <Search className="h-4 w-4" />
                {isNavigating ? "搜索中..." : "搜索"}
              </Button>
            </div>
          </form>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[620px]">
            <div className="space-y-2">
              <Label htmlFor="round-filter">轮次</Label>
              <Select id="round-filter" value={filters.round ?? ""} disabled={isNavigating} onChange={(event) => {
                if (event.target.value !== (filters.round ?? "")) {
                  updateFilter({ round: event.target.value });
                }
              }}>
                <option value="">全部</option>
                {interviewRounds.map((round) => (
                  <option key={round} value={round}>
                    {interviewRoundMeta[round]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="result-filter">结果</Label>
              <Select id="result-filter" value={filters.result ?? ""} disabled={isNavigating} onChange={(event) => {
                if (event.target.value !== (filters.result ?? "")) {
                  updateFilter({ result: event.target.value });
                }
              }}>
                <option value="">全部</option>
                {interviewResults.map((result) => (
                  <option key={result} value={result}>
                    {interviewResultMeta[result]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag-filter">标签</Label>
              <Select id="tag-filter" value={filters.tagId ?? ""} disabled={isNavigating} onChange={(event) => {
                if (event.target.value !== (filters.tagId ?? "")) {
                  updateFilter({ tagId: event.target.value });
                }
              }}>
                <option value="">全部</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button type="button" onClick={() => setIsCreating(true)} disabled={applications.length === 0}>
            <Plus className="h-4 w-4" />
            新增面经
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState title="还没有面经记录" description="先写下第一场面试中最值得复盘的一道题即可。" />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{note.companySnapshot}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{note.roleSnapshot}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>{interviewRoundMeta[note.round]}</span>
                    <span>{formatDate(note.interviewDate)}</span>
                    <span>{interviewResultMeta[note.result]}</span>
                    <span>{note.questions.length} 题</span>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={() => setEditing(note)} aria-label="编辑面经">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <form
                      action={deleteInterviewAction}
                      onSubmit={(event) => {
                        if (!window.confirm("确认删除这条面经记录？")) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={note.id} />
                      <Button type="submit" variant="ghost" size="icon" aria-label="删除面经">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </div>
                {note.tags.length ? (
                  <div className="flex flex-wrap gap-2">
                    {note.tags.slice(0, 8).map((tag) => (
                      <span key={tag.id} className="rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground">
                        {tag.name}
                      </span>
                    ))}
                  </div>
                ) : null}
                {note.summary ? <p className="text-sm leading-6 text-muted-foreground">{note.summary}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing || isCreating ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/20 px-4 py-8">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">{modalTitle}</h2>
            <InterviewForm note={editing ?? undefined} applications={applications} tags={tags} onDone={closeForm} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
