"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { updateApplicationQuickFieldAction } from "@/features/applications/actions";
import { applicationCities, jobCategories, jobCategoryLabels, type JobCategory } from "@/features/applications/constants";

type Field = "city" | "jobCategory";

export function ApplicationQuickFields({ id, city, jobCategory }: {
  id: number;
  city: string | null;
  jobCategory: JobCategory | null;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [editing, setEditing] = useState<Field | null>(null);
  const [cityValue, setCityValue] = useState(city ?? "");
  const [categoryValue, setCategoryValue] = useState<JobCategory | null>(jobCategory);
  const [draftCity, setDraftCity] = useState(city ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => { setCityValue(city ?? ""); }, [city]);
  useEffect(() => { setCategoryValue(jobCategory); }, [jobCategory]);
  useEffect(() => {
    if (!editing) return;
    function onOutside(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setEditing(null);
        setError("");
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEditing(null);
        setError("");
      }
    }
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [editing]);

  function open(field: Field) {
    setError("");
    setDraftCity(cityValue);
    setEditing(field);
    requestAnimationFrame(() => (field === "city" ? inputRef.current : selectRef.current)?.focus());
  }

  function save(field: Field, value: string) {
    startTransition(async () => {
      const result = await updateApplicationQuickFieldAction({ id, field, value });
      if (!result.success) {
        setError(result.message ?? "保存失败，请重试。");
        return;
      }
      if (field === "city") setCityValue(value.trim());
      else setCategoryValue(value ? value as JobCategory : null);
      setEditing(null);
      setError("");
      router.refresh();
    });
  }

  function saveCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) save("city", draftCity);
  }

  const chipClass = "inline-flex min-h-7 items-center rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div ref={rootRef} className="contents">
      {editing === "city" ? (
        <form onSubmit={saveCity} className="inline-flex items-center gap-1">
          <input ref={inputRef} list={`application-cities-${id}`} aria-label="快速填写城市" value={draftCity} onChange={(event) => setDraftCity(event.target.value)} maxLength={40} disabled={pending} placeholder="填写城市" className="h-7 w-24 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <datalist id={`application-cities-${id}`}>{applicationCities.map((item) => <option key={item} value={item} />)}</datalist>
          <button type="submit" disabled={pending} aria-label="保存城市" className={chipClass}><Check className="h-3.5 w-3.5" /></button>
          <button type="button" disabled={pending} aria-label="取消填写城市" onClick={() => setEditing(null)} className={chipClass}><X className="h-3.5 w-3.5" /></button>
        </form>
      ) : (
        <button type="button" onClick={() => open("city")} aria-label={`城市：${cityValue || "未填写"}，点击修改`} className={chipClass}>{cityValue || "城市未填写"}</button>
      )}
      {editing === "jobCategory" ? (
        <select ref={selectRef} aria-label="快速填写岗位类型" value={categoryValue ?? ""} disabled={pending} onChange={(event) => save("jobCategory", event.target.value)} className="h-7 max-w-40 rounded-md border border-input bg-background px-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">岗位类型未填写</option>
          {jobCategories.map((item) => <option key={item} value={item}>{jobCategoryLabels[item]}</option>)}
        </select>
      ) : (
        <button type="button" onClick={() => open("jobCategory")} aria-label={`岗位类型：${categoryValue ? jobCategoryLabels[categoryValue] : "未填写"}，点击修改`} className={chipClass}>{categoryValue ? jobCategoryLabels[categoryValue] : "岗位类型未填写"}</button>
      )}
      {error ? <span role="alert" className="self-center text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
