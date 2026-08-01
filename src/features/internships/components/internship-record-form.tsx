"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createInternshipRecordAction,
  type InternshipActionState,
} from "@/features/internships/actions";

const initialState: InternshipActionState = { success: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "创建中..." : "创建记录"}</Button>;
}

export function InternshipRecordForm({
  today,
  onCancel,
  onDone,
}: {
  today: string;
  onCancel: () => void;
  onDone: (recordId: number) => void;
}) {
  const [state, formAction] = useActionState(createInternshipRecordAction, initialState);

  useEffect(() => {
    if (state.success && state.recordId) {
      onDone(state.recordId);
    }
  }, [onDone, state.recordId, state.success]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="internship-company-name">企业名称</Label>
        <Input id="internship-company-name" name="companyName" autoFocus />
        {state.errors?.companyName ? <p className="text-sm text-destructive">{state.errors.companyName[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="internship-start-date">入职时间</Label>
        <Input id="internship-start-date" name="startDate" type="date" defaultValue={today} />
        {state.errors?.startDate ? <p className="text-sm text-destructive">{state.errors.startDate[0]}</p> : null}
      </div>
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
        <SubmitButton />
      </div>
    </form>
  );
}
