"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { applicationStatusMeta, applicationStatuses } from "@/config/application-status";
import type { Application } from "@/db/schema";
import { createApplicationAction, deleteApplicationAction, type ApplicationActionState, updateApplicationAction } from "@/features/applications/actions";
import { applicationCities, jobCategories, jobCategoryLabels, companySizeMeta, companySizes, internshipTypeMeta, internshipTypes } from "@/features/applications/constants";
import { matchJobCategory } from "@/features/applications/job-category";
import type { ResumeAssetOption } from "@/features/resumes/types";
import { formatDate, toDateInputValue } from "@/lib/date";

type ApplicationFormProps = {
  application?: Application;
  initialValues?: ApplicationInitialValues;
  resumeAssets?: ResumeAssetOption[];
  onDone: () => void;
  modalTitle?: string;
  modalSubtitle?: string;
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

export function ApplicationForm({ application, initialValues, resumeAssets = [], onDone, modalTitle, modalSubtitle }: ApplicationFormProps) {
  const router = useRouter();
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
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (state.success) {
      onDone();
    }
  }, [onDone, state.success]);

  useEffect(() => {
    if (!isDeleteConfirmOpen || isDeleting) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsDeleteConfirmOpen(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isDeleteConfirmOpen, isDeleting]);

  async function confirmDelete() {
    if (!application || isDeleting) return;
    setDeleteError("");
    setIsDeleting(true);
    try {
      const formData = new FormData();
      formData.set("id", String(application.id));
      await deleteApplicationAction(formData);
      setIsDeleteConfirmOpen(false);
      onDone();
      router.refresh();
    } catch {
      setDeleteError("删除失败，请重试。");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <form action={formAction} className={modalTitle ? "flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-teal-900/10 bg-white shadow-2xl" : "space-y-5"}>
      {modalTitle ? <div className="flex shrink-0 flex-col gap-4 border-b border-teal-100 bg-gradient-to-r from-teal-50 via-white to-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="min-w-0"><p className="text-xs font-semibold tracking-[0.2em] text-teal-700">APPLICATION RECORD</p><h2 id="application-form-title" className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">{modalTitle}</h2><p className="mt-1 truncate text-sm text-slate-500">{modalSubtitle}</p></div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {application ? <Button type="button" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => setIsDeleteConfirmOpen(true)}><Trash2 className="h-4 w-4" />删除记录</Button> : null}
          <Button type="button" variant="outline" onClick={onDone}>取消</Button>
          <SubmitButton label={application ? "保存修改" : "新增记录"} />
        </div>
      </div> : null}
      <div className={modalTitle ? "min-h-0 space-y-5 overflow-y-auto px-6 py-6 sm:px-8 sm:py-7" : "space-y-5"}>
      {application ? <input type="hidden" name="id" value={application.id} /> : null}
      {!application && initialValues?.opportunityId ? <input type="hidden" name="opportunityId" value={initialValues.opportunityId} /> : null}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">01</span><h3 className="font-semibold text-slate-800">岗位信息</h3></div>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      <div className="flex items-center gap-3 border-b border-slate-100 pb-3 pt-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">02</span><h3 className="font-semibold text-slate-800">投递进展</h3></div>
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
      <div className="flex items-center gap-3 border-b border-slate-100 pb-3 pt-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">03</span><h3 className="font-semibold text-slate-800">补充资料</h3></div>
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
      {!modalTitle ? <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
        <Button type="button" variant="outline" onClick={onDone}>
          取消
        </Button>
        <SubmitButton label={application ? "保存修改" : "新增记录"} />
      </div> : null}
      </div>
      {isDeleteConfirmOpen && application && typeof document !== "undefined" ? createPortal(<div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 px-4 backdrop-blur-[2px]">
        <div role="alertdialog" aria-modal="true" aria-labelledby="delete-application-title" aria-describedby="delete-application-description" className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-700"><Trash2 className="h-5 w-5" /></div>
          <h3 id="delete-application-title" className="mt-4 text-lg font-semibold text-slate-900">确认删除投递记录？</h3>
          <p id="delete-application-description" className="mt-2 text-sm leading-6 text-slate-600">将删除「{application.company} · {application.role}」及其状态轨迹。此操作无法撤销。</p>
          {deleteError ? <p role="alert" className="mt-3 text-sm text-rose-700">{deleteError}</p> : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isDeleting} autoFocus onClick={() => setIsDeleteConfirmOpen(false)}>返回编辑</Button>
            <Button type="button" variant="destructive" disabled={isDeleting} onClick={confirmDelete}>{isDeleting ? "删除中..." : "确认删除"}</Button>
          </div>
        </div>
      </div>, document.body) : null}
    </form>
  );
}
