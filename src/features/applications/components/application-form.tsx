"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { applicationStatusMeta, applicationStatuses } from "@/config/application-status";
import type { Application } from "@/db/schema";
import { createApplicationAction, type ApplicationActionState, updateApplicationAction } from "@/features/applications/actions";
import { companySizeMeta, companySizes, internshipTypeMeta, internshipTypes } from "@/features/applications/constants";
import { toDateInputValue } from "@/lib/date";

type ApplicationFormProps = {
  application?: Application;
  initialValues?: ApplicationInitialValues;
  onDone: () => void;
};

export type ApplicationInitialValues = Partial<
  Pick<
    Application,
    | "opportunityId"
    | "company"
    | "role"
    | "source"
    | "status"
    | "internshipType"
    | "companySize"
    | "appliedDate"
    | "applicationUrl"
    | "jobDescription"
    | "notes"
  >
>;

const initialState: ApplicationActionState = { success: false };

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{errors[0]}</p>;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "保存中..." : label}
    </Button>
  );
}

export function ApplicationForm({ application, initialValues, onDone }: ApplicationFormProps) {
  const action = application ? updateApplicationAction : createApplicationAction;
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) {
      onDone();
    }
  }, [onDone, state.success]);

  return (
    <form action={formAction} className="space-y-4">
      {application ? <input type="hidden" name="id" value={application.id} /> : null}
      {!application && initialValues?.opportunityId ? <input type="hidden" name="opportunityId" value={initialValues.opportunityId} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company">公司名称</Label>
          <Input id="company" name="company" defaultValue={application?.company ?? initialValues?.company ?? ""} />
          <FieldError errors={state.errors?.company} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">岗位名称</Label>
          <Input id="role" name="role" defaultValue={application?.role ?? initialValues?.role ?? ""} />
          <FieldError errors={state.errors?.role} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="internshipType">实习类型</Label>
          <Select id="internshipType" name="internshipType" defaultValue={application?.internshipType ?? initialValues?.internshipType ?? "daily"}>
            {internshipTypes.map((type) => (
              <option key={type} value={type}>
                {internshipTypeMeta[type].label}
              </option>
            ))}
          </Select>
          <FieldError errors={state.errors?.internshipType} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companySize">厂型</Label>
          <Select id="companySize" name="companySize" defaultValue={application?.companySize ?? initialValues?.companySize ?? "medium"}>
            {companySizes.map((size) => (
              <option key={size} value={size}>
                {companySizeMeta[size].label}
              </option>
            ))}
          </Select>
          <FieldError errors={state.errors?.companySize} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="source">投递渠道</Label>
          <Input id="source" name="source" defaultValue={application?.source ?? initialValues?.source ?? ""} />
          <FieldError errors={state.errors?.source} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">当前状态</Label>
          <Select id="status" name="status" defaultValue={application?.status ?? initialValues?.status ?? "planned"}>
            {applicationStatuses.map((status) => (
              <option key={status} value={status}>
                {applicationStatusMeta[status].label}
              </option>
            ))}
          </Select>
          <FieldError errors={state.errors?.status} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="appliedDate">投递日期</Label>
          <Input id="appliedDate" name="appliedDate" type="date" defaultValue={application?.appliedDate ?? initialValues?.appliedDate ?? toDateInputValue()} />
          <FieldError errors={state.errors?.appliedDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interviewTime">面试时间</Label>
          <Input id="interviewTime" name="interviewTime" type="datetime-local" defaultValue={application?.interviewTime ?? ""} />
          <FieldError errors={state.errors?.interviewTime} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="applicationUrl">投递网址</Label>
        <Input id="applicationUrl" name="applicationUrl" type="url" defaultValue={application?.applicationUrl ?? initialValues?.applicationUrl ?? ""} />
        <FieldError errors={state.errors?.applicationUrl} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="jobDescription">岗位描述（可选）</Label>
        <Textarea
          id="jobDescription"
          name="jobDescription"
          rows={9}
          defaultValue={application?.jobDescription ?? initialValues?.jobDescription ?? ""}
          placeholder="粘贴完整 JD，之后可以直接用于简历匹配"
        />
        <FieldError errors={state.errors?.jobDescription} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">备注</Label>
        <Textarea id="notes" name="notes" defaultValue={application?.notes ?? initialValues?.notes ?? ""} />
        <FieldError errors={state.errors?.notes} />
      </div>
      {state.message && !state.success ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          取消
        </Button>
        <SubmitButton label={application ? "保存修改" : "新增记录"} />
      </div>
    </form>
  );
}
