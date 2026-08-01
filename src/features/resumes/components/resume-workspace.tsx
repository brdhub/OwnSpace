"use client";

import { FileUp, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ResumeAssetList } from "@/features/resumes/components/resume-asset-list";
import { ResumeAssetUploadForm } from "@/features/resumes/components/resume-asset-upload-form";
import { ResumeEntryForm } from "@/features/resumes/components/resume-entry-form";
import { ResumeEntryList } from "@/features/resumes/components/resume-entry-list";
import type { ResumeEntryView, ResumeWorkspaceData } from "@/features/resumes/queries";

type DialogKind = "asset" | "entry" | null;

export function ResumeWorkspace({ assets, entries }: ResumeWorkspaceData) {
  const router = useRouter();
  const [dialogKind, setDialogKind] = useState<DialogKind>(null);
  const [editingEntry, setEditingEntry] = useState<ResumeEntryView>();

  const closeDialog = useCallback(() => {
    setDialogKind(null);
    setEditingEntry(undefined);
    router.refresh();
  }, [router]);

  const editEntry = useCallback((entry: ResumeEntryView) => {
    setEditingEntry(entry);
    setDialogKind("entry");
  }, []);

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-foreground">PDF 原件</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">保留每次投递前的本地版本。</p>
            </div>
            <Button type="button" size="sm" onClick={() => setDialogKind("asset")}>
              <FileUp className="h-4 w-4" />上传 PDF
            </Button>
          </div>
          <ResumeAssetList assets={assets} />
        </section>
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-foreground">结构化条目</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">将真实经历拆成可复用的小块，之后再按岗位选择。</p>
            </div>
            <Button type="button" size="sm" onClick={() => setDialogKind("entry")}>
              <Plus className="h-4 w-4" />添加条目
            </Button>
          </div>
          <ResumeEntryList entries={entries} onEdit={editEntry} />
        </section>
      </div>

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
    </>
  );
}
