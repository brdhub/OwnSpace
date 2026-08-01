"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PlanningEvent } from "@/db/schema";
import { createPlanningEventAction, type PlanningActionState, updatePlanningEventAction } from "@/features/planning/actions";
import { planningEndDate, planningEventTypeMeta, planningEventTypes, planningStartDate, planningStatusMeta, planningEventStatuses } from "@/features/planning/constants";
import type { PlanningEventType } from "@/features/planning/types";

const initialState: PlanningActionState = { success: false };

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }
  return <p className="text-sm text-destructive">{errors[0]}</p>;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "保存中..." : label}</Button>;
}

type PlanningEventFormProps = {
  event?: PlanningEvent;
  defaultDate: string;
  defaultType: PlanningEventType;
  onDone: () => void;
};

export function PlanningEventForm({ event, defaultDate, defaultType, onDone }: PlanningEventFormProps) {
  const action = event ? updatePlanningEventAction : createPlanningEventAction;
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) {
      onDone();
    }
  }, [onDone, state.success]);

  return (
    <form action={formAction} className="space-y-4">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <div className="space-y-2">
        <Label htmlFor="planning-title">标题</Label>
        <Input id="planning-title" name="title" defaultValue={event?.title ?? ""} autoFocus />
        <FieldError errors={state.errors?.title} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="planning-event-date">日期</Label>
          <Input id="planning-event-date" name="eventDate" type="date" min={planningStartDate} max={planningEndDate} defaultValue={event?.eventDate ?? defaultDate} />
          <FieldError errors={state.errors?.eventDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="planning-event-type">类型</Label>
          <Select id="planning-event-type" name="eventType" defaultValue={event?.eventType ?? defaultType}>
            {planningEventTypes.map((type) => <option key={type} value={type}>{planningEventTypeMeta[type].label}</option>)}
          </Select>
          <FieldError errors={state.errors?.eventType} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="planning-status">状态</Label>
          <Select id="planning-status" name="status" defaultValue={event?.status ?? "todo"}>
            {planningEventStatuses.map((status) => <option key={status} value={status}>{planningStatusMeta[status].label}</option>)}
          </Select>
          <FieldError errors={state.errors?.status} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="planning-description">说明</Label>
        <Textarea id="planning-description" name="description" defaultValue={event?.description ?? ""} />
        <FieldError errors={state.errors?.description} />
      </div>
      {state.message && !state.success ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>取消</Button>
        <SubmitButton label={event ? "保存修改" : "新增节点"} />
      </div>
    </form>
  );
}
