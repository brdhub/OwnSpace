"use client";

import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResumeAsset } from "@/db/schema";
import { deleteResumeAssetAction } from "@/features/resumes/actions";
import { ResumeGenerateButton } from "@/features/resumes/components/resume-generate-button";

function formatBytes(byteSize: number) {
  return byteSize < 1024 * 1024 ? `${Math.max(1, Math.round(byteSize / 1024))} KB` : `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResumeAssetList({ assets, pendingCandidateCounts }: { assets: ResumeAsset[]; pendingCandidateCounts: Record<number, number> }) {
  if (!assets.length) {
    return <p className="rounded-md border border-dashed border-border px-4 py-8 text-sm leading-6 text-muted-foreground">还没有保存 PDF 简历。上传一份现有版本，就能在这里作为后续整理的原始资料。</p>;
  }

  return (
    <div className="space-y-2">
      {assets.map((asset) => (
        <article key={asset.id} className="rounded-md border border-border bg-background p-3">
          <div className="flex gap-3">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className="truncate text-sm font-medium text-foreground">{asset.originalName}</h3>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formatBytes(asset.byteSize)}</span>
                  <form
                    action={deleteResumeAssetAction}
                    onSubmit={(event) => {
                      if (!window.confirm(`确认删除“${asset.originalName}”？本地 PDF 原件也会一并删除。`)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="id" value={asset.id} />
                    <Button type="submit" variant="ghost" size="icon" aria-label={`删除 ${asset.originalName}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{asset.parseStatus === "parsed" ? "已提取文本" : asset.parseStatus === "failed" ? "文本提取失败，原文件已保留" : "等待提取"}</p>
              {asset.entryExtractionStatus === "processing" ? <p className="mt-1 text-xs text-muted-foreground">AI 正在生成候选条目…</p> : null}
              {asset.entryExtractionStatus === "completed" && asset.entryExtractedAt ? <p className="mt-1 text-xs text-muted-foreground">候选最近生成于 {new Date(asset.entryExtractedAt).toLocaleString("zh-CN")}</p> : null}
              {asset.entryExtractionStatus === "failed" ? <p className="mt-1 text-xs text-destructive">{asset.entryExtractionError || "AI 候选生成失败，可重试。"}</p> : null}
              {asset.entryExtractionStatus === "completed" && asset.entryExtractionError ? <p className="mt-1 text-xs text-amber-700">{asset.entryExtractionError}</p> : null}
              {asset.parseStatus === "parsed" && asset.extractedText.trim() ? (
                <ResumeGenerateButton assetId={asset.id} pendingCount={pendingCandidateCounts[asset.id] ?? 0} />
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
