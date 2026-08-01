"use client";

import { Building2, CalendarDays, LogOut, NotebookPen, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import type { InternshipEntry, JournalEntry } from "@/db/schema";
import { markInternshipDepartureAction } from "@/features/internships/actions";
import { InternshipEntryForm } from "@/features/internships/components/internship-entry-form";
import { InternshipRecordForm } from "@/features/internships/components/internship-record-form";
import type { InternshipRecordSummary } from "@/features/internships/queries";
import { JournalEditor } from "@/features/journal/components/journal-editor";
import type { JournalMonthGroup } from "@/features/journal/types";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/utils";

type InternshipWorkspaceProps = {
  records: InternshipRecordSummary[];
  selectedRecord: InternshipRecordSummary | null;
  entries: InternshipEntry[];
  today: string;
  journalActive: boolean;
  journalGroups: JournalMonthGroup[];
  journalEntry: JournalEntry | null;
  selectedJournalDate: string;
};

export function InternshipWorkspace({
  records,
  selectedRecord,
  entries,
  today,
  journalActive,
  journalGroups,
  journalEntry,
  selectedJournalDate,
}: InternshipWorkspaceProps) {
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const router = useRouter();

  const finishRecordCreation = useCallback((recordId: number) => {
    setShowRecordForm(false);
    router.push(`/internships?id=${recordId}`);
  }, [router]);

  const finishEntryCreation = useCallback(() => {
    setShowEntryForm(false);
    router.refresh();
  }, [router]);

  const journalDates = journalGroups.flatMap((group) => group.entries);
  const hasTodayJournal = journalDates.some((entry) => entry.entryDate === today);

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">全部实习</h2>
          <Button
            type="button"
            size="icon"
            onClick={() => setShowRecordForm(true)}
            aria-label="新建实习记录"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {records.length ? (
          <div className="space-y-2">
            {records.map((record) => (
              <Link
                key={record.id}
                href={`/internships?id=${record.id}`}
                className={cn(
                  "block rounded-md border border-border bg-background p-3 transition-colors hover:bg-accent",
                  selectedRecord?.id === record.id && "border-primary bg-accent",
                )}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate text-sm font-medium text-foreground">{record.companyName}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(record.startDate)} 入职</span>
                  <span>{record.entryCount} 条</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">创建第一份实习记录后，会显示在这里。</p>
        )}

        <div className="mt-5 border-t border-border pt-5">
          <Link
            href={`/internships?view=journal&date=${today}`}
            className={cn(
              "flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:bg-accent",
              journalActive && selectedJournalDate === today && "border-primary bg-accent",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <NotebookPen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              日记
            </span>
            <span className="text-xs text-muted-foreground">{hasTodayJournal ? "今天已记录" : "写今天"}</span>
          </Link>
          {journalDates.length ? (
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
              {journalDates.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/internships?view=journal&date=${entry.entryDate}`}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    journalActive && selectedJournalDate === entry.entryDate && "bg-accent text-foreground",
                  )}
                >
                  <span>{formatDate(entry.entryDate)}</span>
                  <span>已记录</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </aside>

      <main className="min-w-0">
        {journalActive ? (
          <JournalEditor
            key={selectedJournalDate}
            entry={journalEntry}
            selectedDate={selectedJournalDate}
            today={today}
          />
        ) : !selectedRecord ? (
          <EmptyState
            title="加油！快找实习吧"
            actionLabel="新建实习记录"
            onAction={() => setShowRecordForm(true)}
          />
        ) : (
          <div className="space-y-5">
            <section className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">当前实习</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">{selectedRecord.companyName}</h2>
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    {formatDate(selectedRecord.startDate)} 入职
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedRecord.endDate ? (
                    <Button type="button" variant="outline" disabled>
                      <LogOut className="h-4 w-4" />
                      已离职 · {formatDate(selectedRecord.endDate)}
                    </Button>
                  ) : (
                    <form
                      action={markInternshipDepartureAction}
                      onSubmit={(event) => {
                        if (!window.confirm("确认将今天记录为离职日期？")) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={selectedRecord.id} />
                      <Button type="submit" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50">
                        <LogOut className="h-4 w-4" />
                        离职
                      </Button>
                    </form>
                  )}
                  <Button type="button" onClick={() => setShowEntryForm(true)}>
                    <Plus className="h-4 w-4" />
                    添加条目
                  </Button>
                </div>
              </div>
            </section>

            {entries.length ? (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <article key={entry.id} className="rounded-lg border border-border bg-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="font-semibold text-foreground">{entry.title}</h3>
                      <time className="text-sm text-muted-foreground">{formatDate(entry.entryDate)}</time>
                    </div>
                    {entry.content ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{entry.content}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-background px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">还没有条目，可以从一件刚完成的小事开始记录。</p>
              </div>
            )}
          </div>
        )}
      </main>

      {showRecordForm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 py-8">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">新建实习记录</h2>
            <InternshipRecordForm
              today={today}
              onCancel={() => setShowRecordForm(false)}
              onDone={finishRecordCreation}
            />
          </div>
        </div>
      ) : null}

      {showEntryForm && selectedRecord ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 py-8">
          <div className="w-full max-w-xl rounded-lg border border-border bg-card p-5 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">添加实习条目</h2>
            <InternshipEntryForm
              recordId={selectedRecord.id}
              today={today}
              onCancel={() => setShowEntryForm(false)}
              onDone={finishEntryCreation}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
