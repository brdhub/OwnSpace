"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createResumeAssetAction, type ResumeActionState } from "@/features/resumes/actions";

const initialState: ResumeActionState = { success: false };

export function ResumeAssetUploadForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createResumeAssetAction, initialState);

  useEffect(() => {
    if (state.success) onDone();
  }, [onDone, state.success]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="resume-pdf">PDF 简历</Label>
        <Input id="resume-pdf" name="file" type="file" accept="application/pdf,.pdf" required />
        <p className="text-xs text-muted-foreground">文件仅保存在本机，最大 10 MB。</p>
        {state.errors?.file?.[0] ? <p className="text-sm text-destructive">{state.errors.file[0]}</p> : null}
      </div>
      {state.message ? <p className={state.success ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{state.message}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>取消</Button>
        <Button disabled={pending}>{pending ? "保存中…" : "保存 PDF"}</Button>
      </div>
    </form>
  );
}
