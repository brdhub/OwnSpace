"use client";

import { FileUp, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ResumeAssetList } from "@/features/resumes/components/resume-asset-list";
import { ResumeAssetUploadForm } from "@/features/resumes/components/resume-asset-upload-form";
import { ResumeEntryDetail } from "@/features/resumes/components/resume-entry-detail";
import { ResumeEntryForm } from "@/features/resumes/components/resume-entry-form";
import { ResumeEntryList } from "@/features/resumes/components/resume-entry-list";
import { ResumeCandidateList } from "@/features/resumes/components/resume-candidate-list";
import { JdMatchingWorkspace } from "@/features/resumes/components/jd-matching-workspace";
import type { ResumeEntryView, ResumeWorkspaceData } from "@/features/resumes/queries";

type DialogKind = "asset" | "entry" | null;

export function ResumeWorkspace({ assets, entries, candidates, jdTasks }: ResumeWorkspaceData) {
  const router = useRouter();
  const [dialogKind, setDialogKind] = useState<DialogKind>(null);
  const [editingEntry, setEditingEntry] = useState<ResumeEntryView>();
  const [viewingEntry, setViewingEntry] = useState<ResumeEntryView>();
  const [workspaceTab, setWorkspaceTab] = useState<"vault" | "jd">("vault");
  const pendingCandidateCounts = candidates.reduce<Record<number, number>>((counts, candidate) => {
    if (candidate.state === "pending") counts[candidate.resumeAssetId] = (counts[candidate.resumeAssetId] ?? 0) + 1;
    return counts;
  }, {});

  const closeDialog = useCallback(() => {
    setDialogKind(null);
    setEditingEntry(undefined);
    router.refresh();
  }, [router]);

  const editEntry = useCallback((entry: ResumeEntryView) => {
    setViewingEntry(undefined);
    setEditingEntry(entry);
    setDialogKind("entry");
  }, []);

  return (
    <>
      <div className="mb-5 flex gap-2 border-b border-border pb-3">
        <Button type="button" size="sm" variant={workspaceTab === "vault" ? "default" : "ghost"} onClick={() => setWorkspaceTab("vault")}>简历仓库</Button>
        <Button type="button" size="sm" variant={workspaceTab === "jd" ? "default" : "ghost"} onClick={() => setWorkspaceTab("jd")}>JD 匹配</Button>
      </div>
      {workspaceTab === "vault" ? <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="font-semibold text-foreground">PDF 原件</h2>
            <Button type="button" size="sm" onClick={() => setDialogKind("asset")}>
              <FileUp className="h-4 w-4" />上传 PDF
            </Button>
          </div>
          <ResumeAssetList assets={assets} pendingCandidateCounts={pendingCandidateCounts} />
        </section>
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4">
            <h2 className="font-semibold text-foreground">AI 候选审核</h2>
          </div>
          <ResumeCandidateList candidates={candidates} />
        </section>
        <section className="rounded-lg border border-border bg-card p-4 xl:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="font-semibold text-foreground">结构化条目</h2>
            <Button type="button" size="sm" onClick={() => setDialogKind("entry")}>
              <Plus className="h-4 w-4" />添加条目
            </Button>
          </div>
          <ResumeEntryList entries={entries} onView={setViewingEntry} onEdit={editEntry} />
        </section>
      </div> : <JdMatchingWorkspace entries={entries} tasks={jdTasks} />}

      {dialogKind ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 py-8" role="presentation">
          <div className="max-h-full w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="resume-dialog-title">
            <h2 id="resume-dialog-title" className="mb-4 text-lg font-semibold text-foreground">
              {dialogKind === "asset" ? "上传 PDF 简历" : editingEntry ? "编辑简历条目" : "添加简历条目"}
            </h2>
            {dialogKind === "asset" ? <ResumeAssetUploadForm onDone={closeDialog} /> : <ResumeEntryForm entry={editingEntry} onDone={closeDialog} />}
          </div>
        </div>
      ) : null}
      {viewingEntry ? <ResumeEntryDetail entry={viewingEntry} onClose={() => setViewingEntry(undefined)} onEdit={editEntry} /> : null}
    </>
  );
}
