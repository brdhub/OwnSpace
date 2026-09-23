"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { applicationStatusMeta, applicationStatuses } from "@/config/application-status";
import type { Application } from "@/db/schema";
import { createApplicationAction, type ApplicationActionState, updateApplicationAction } from "@/features/applications/actions";
import { applicationCities, jobCategories, jobCategoryLabels, companySizeMeta, companySizes, internshipTypeMeta, internshipTypes } from "@/features/applications/constants";
import { matchJobCategory } from "@/features/applications/job-category";
import type { ResumeAssetOption } from "@/features/resumes/types";
import { formatDate, toDateInputValue } from "@/lib/date";

type ApplicationFormProps = {
  application?: Application;
  initialValues?: ApplicationInitialValues;
  resumeAssets?: ResumeAssetOption[];
  onDone: () => void;
};

export type ApplicationInitialValues = Partial<
  Pick<
    Application,
    | "opportunityId"
    | "resumeAssetId"
    | "company"
    | "city"
    | "jobCategory"
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

export function ApplicationForm({ application, initialValues, resumeAssets = [], onDone }: ApplicationFormProps) {
  const initialCity = application ? application.city ?? "" : initialValues?.city ?? "深圳";
  const [cityChoice, setCityChoice] = useState<string>(!initialCity || applicationCities.some((city) => city === initialCity) ? initialCity : "other");
  const [customCity, setCustomCity] = useState(initialCity && !applicationCities.some((city) => city === initialCity) ? initialCity : "");
  const [role, setRole] = useState(application?.role ?? initialValues?.role ?? "");
  const [categoryManual, setCategoryManual] = useState(Boolean(application?.jobCategory ?? initialValues?.jobCategory));
  const [manualCategory, setManualCategory] = useState(application?.jobCategory ?? initialValues?.jobCategory ?? "");
  const suggestedCategory = matchJobCategory(role) ?? "";
  const selectedCategory = categoryManual ? manualCategory : suggestedCategory;
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
          <Input id="role" name="role" value={role} onChange={(event) => setRole(event.target.value)} />
          <FieldError errors={state.errors?.role} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cityChoice">城市</Label>
          <Select id="cityChoice" value={cityChoice} onChange={(event) => setCityChoice(event.target.value)}>
            <option value="">未填写</option>
            {applicationCities.map((city) => <option key={city} value={city}>{city}</option>)}
            <option value="other">其他</option>
          </Select>
          <input type="hidden" name="city" value={cityChoice === "other" ? customCity.trim() || "其他" : cityChoice} />
          {cityChoice === "other" ? <><Label htmlFor="customCity">具体城市（可选）</Label><Input id="customCity" maxLength={40} value={customCity} onChange={(event) => setCustomCity(event.target.value)} placeholder="例如：成都" /></> : null}
          <FieldError errors={state.errors?.city} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobCategory">岗位类型</Label>
          <Select id="jobCategory" name="jobCategory" value={selectedCategory} onChange={(event) => { setCategoryManual(true); setManualCategory(event.target.value as typeof manualCategory); }}>
            <option value="">未填写</option>
            {jobCategories.map((category) => <option key={category} value={category}>{jobCategoryLabels[category]}</option>)}
          </Select>
          <p className="text-xs text-muted-foreground">{categoryManual ? "已手动选择，修改标题不会覆盖。" : suggestedCategory ? "已根据标题匹配，可手动调整。" : "标题不明确时保留未填写，可手动选择。"}</p>
          {categoryManual ? <Button type="button" variant="ghost" size="sm" onClick={() => setCategoryManual(false)}>按标题重新匹配</Button> : null}
          <FieldError errors={state.errors?.jobCategory} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="internshipType">招聘类型</Label>
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
          <Select id="status" name="status" defaultValue={application?.status ?? initialValues?.status ?? "applied"}>
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
        <Label htmlFor="resumeAssetId">投递简历</Label>
        <Select
          id="resumeAssetId"
          name="resumeAssetId"
          defaultValue={String(application ? application.resumeAssetId ?? "" : initialValues?.resumeAssetId ?? resumeAssets[0]?.id ?? "")}
        >
          <option value="">不关联</option>
          {resumeAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.originalName} · 上传于 {formatDate(asset.createdAt)}
            </option>
          ))}
        </Select>
        <FieldError errors={state.errors?.resumeAssetId} />
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
