"use client";

import { Check, CircleAlert, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "error";

export function ResumeCopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copyValue() {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("error");
    }
    timer.current = setTimeout(() => setState("idle"), 1600);
  }

  const accessibleLabel = state === "copied"
    ? `已复制${label}`
    : state === "error"
      ? `${label}复制失败，请手动选择`
      : `复制${label}`;

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
      onClick={copyValue}
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      {state === "copied" ? <Check className="h-3.5 w-3.5" /> : state === "error" ? <CircleAlert className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {state === "copied" ? "已复制" : state === "error" ? "复制失败" : "复制"}
    </Button>
  );
}
