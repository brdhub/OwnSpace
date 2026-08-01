"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createInternshipEntryAction,
  type InternshipActionState,
} from "@/features/internships/actions";

const initialState: InternshipActionState = { success: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "保存中..." : "添加条目"}</Button>;
}

export function InternshipEntryForm({
  recordId,
  today,
  onCancel,
  onDone,
}: {
  recordId: number;
  today: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(createInternshipEntryAction, initialState);

  useEffect(() => {
    if (state.success) {
      onDone();
    }
  }, [onDone, state.success]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="internshipRecordId" value={recordId} />
      <div className="space-y-2">
        <Label htmlFor="internship-entry-title">条目标题</Label>
        <Input id="internship-entry-title" name="title" placeholder="例如：完成第一次代码评审" autoFocus />
        {state.errors?.title ? <p className="text-sm text-destructive">{state.errors.title[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="internship-entry-date">日期</Label>
        <Input id="internship-entry-date" name="entryDate" type="date" defaultValue={today} />
        {state.errors?.entryDate ? <p className="text-sm text-destructive">{state.errors.entryDate[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="internship-entry-content">内容</Label>
        <Textarea
          id="internship-entry-content"
          name="content"
          placeholder="简单记下完成了什么、学到了什么。"
          className="min-h-36"
        />
        {state.errors?.content ? <p className="text-sm text-destructive">{state.errors.content[0]}</p> : null}
      </div>
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
        <SubmitButton />
      </div>
    </form>
  );
}
