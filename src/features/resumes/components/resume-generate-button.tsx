"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateResumeCandidatesAction } from "@/features/resumes/candidate-actions";
import type { ResumeActionState } from "@/features/resumes/actions";

const initialState: ResumeActionState = { success: false };

export function ResumeGenerateButton({ assetId, pendingCount }: { assetId: number; pendingCount: number }) {
  const router = useRouter();
  const replaceRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(generateResumeCandidatesAction, initialState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state]);

  return (
    <form
      action={action}
      className="mt-3"
      onSubmit={(event) => {
        if (!window.confirm("将把这份 PDF 已提取的文字发送给 DeepSeek，用于生成待确认的结构化条目。是否继续？")) {
          event.preventDefault();
          return;
        }
        if (pendingCount > 0 && !window.confirm(`当前还有 ${pendingCount} 条待处理候选。是否替换这些待处理候选？`)) {
          event.preventDefault();
          return;
        }
        if (replaceRef.current) replaceRef.current.value = pendingCount > 0 ? "true" : "false";
      }}
    >
      <input type="hidden" name="assetId" value={assetId} />
      <input ref={replaceRef} type="hidden" name="replacePending" defaultValue="false" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <Sparkles className="h-4 w-4" />{pending ? "正在生成…" : "生成结构化条目"}
      </Button>
      {state.message ? <p className={`mt-2 text-xs ${state.success ? "text-muted-foreground" : "text-destructive"}`}>{state.message}</p> : null}
    </form>
  );
}
