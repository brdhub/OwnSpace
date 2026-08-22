"use client";

import {
  Award,
  Briefcase,
  FolderKanban,
  GraduationCap,
  Pencil,
  Tags,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResumeCopyButton } from "@/features/resumes/components/resume-copy-button";
import { resumeEntryTypeLabels, type ResumeEntryType } from "@/features/resumes/constants";
import { getResumeCopyFields, type ResumeCopyField } from "@/features/resumes/copy-fields";
import type { ResumeEntryView } from "@/features/resumes/queries";

const entryVisuals: Record<ResumeEntryType, { icon: LucideIcon; accent: string; iconStyle: string }> = {
  project: {
    icon: FolderKanban,
    accent: "from-sky-500/15 via-cyan-500/5 to-transparent",
    iconStyle: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  experience: {
    icon: Briefcase,
    accent: "from-emerald-500/15 via-teal-500/5 to-transparent",
    iconStyle: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  education: {
    icon: GraduationCap,
    accent: "from-violet-500/15 via-indigo-500/5 to-transparent",
    iconStyle: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  skill: {
    icon: Wrench,
    accent: "from-amber-500/15 via-orange-500/5 to-transparent",
    iconStyle: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  honor: {
    icon: Award,
    accent: "from-rose-500/15 via-pink-500/5 to-transparent",
    iconStyle: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

function listValue(content: Record<string, unknown>, key: string) {
  return Array.isArray(content[key]) ? content[key].filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
}

function FactCard({ field }: { field?: ResumeCopyField }) {
  if (!field) return null;
  return (
    <div className="relative rounded-xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{field.label}</p>
        <ResumeCopyButton label={field.label} value={field.value} />
      </div>
      <p className="mt-1.5 select-text text-sm font-semibold leading-6 text-foreground">{field.value}</p>
    </div>
  );
}

function PillList({ field, items }: { field?: ResumeCopyField; items: string[] }) {
  if (!field || !items.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
        <ResumeCopyButton label={field.label} value={field.value} />
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => <Badge key={item} variant="outline" className="rounded-full bg-background/70 px-2.5 py-1">{item}</Badge>)}
      </div>
    </div>
  );
}

function ContentSection({ field }: { field?: ResumeCopyField }) {
  if (!field) return null;
  return (
    <section className="relative pl-5">
      <span className="absolute bottom-1 left-0 top-1 w-0.5 rounded-full bg-primary/25" aria-hidden="true" />
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{field.label}</h3>
        <ResumeCopyButton label={field.label} value={field.value} />
      </div>
      <p className="mt-2 select-text whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{field.value}</p>
    </section>
  );
}

function EntryBody({ entry }: { entry: ResumeEntryView }) {
  const content = entry.content as Record<string, unknown>;
  const fields = new Map(getResumeCopyFields(entry).map((field) => [field.key, field]));

  switch (entry.type) {
    case "project":
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <FactCard field={fields.get("projectCategory")} />
          </div>
          <PillList field={fields.get("techStack")} items={listValue(content, "techStack")} />
          <ContentSection field={fields.get("content")} />
        </>
      );
    case "experience":
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <FactCard field={fields.get("position")} />
          </div>
          <PillList field={fields.get("techStack")} items={listValue(content, "techStack")} />
          <ContentSection field={fields.get("responsibilities")} />
          <ContentSection field={fields.get("workContent")} />
        </>
      );
    case "education":
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <FactCard field={fields.get("degree")} />
            <FactCard field={fields.get("major")} />
            <FactCard field={fields.get("dateRange")} />
          </div>
          <ContentSection field={fields.get("content")} />
        </>
      );
    case "skill":
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <FactCard field={fields.get("proficiency")} />
          </div>
          <ContentSection field={fields.get("content")} />
        </>
      );
    case "honor":
      return <FactCard field={fields.get("award")} />;
  }
}

export function ResumeEntryDetail({
  entry,
  onClose,
  onEdit,
}: {
  entry: ResumeEntryView;
  onClose: () => void;
  onEdit: (entry: ResumeEntryView) => void;
}) {
  const visual = entryVisuals[entry.type];
  const EntryIcon = visual.icon;
  const titleField = getResumeCopyFields(entry).find((field) => field.key === "title");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl border border-border/80 bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-entry-detail-title"
      >
        <header className={`relative overflow-hidden border-b border-border/70 bg-gradient-to-br ${visual.accent} px-5 py-6 sm:px-7`}>
          <Button type="button" size="icon" variant="ghost" className="absolute right-3 top-3 rounded-full" onClick={onClose} aria-label="关闭条目详情" autoFocus>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-start gap-4 pr-10">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${visual.iconStyle}`}>
              <EntryIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <Badge variant="outline" className="mb-2 rounded-full bg-background/60">{resumeEntryTypeLabels[entry.type]}</Badge>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="resume-entry-detail-title" className="select-text text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">{entry.title}</h2>
                {titleField ? <ResumeCopyButton label={titleField.label} value={titleField.value} /> : null}
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-6 px-5 py-6 sm:px-7">
          <EntryBody entry={entry} />
          {entry.tags.length ? (
            <section className="rounded-xl bg-muted/45 px-4 py-3.5">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Tags className="h-3.5 w-3.5" />标签
              </div>
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag) => <Badge key={tag} className="rounded-full">{tag}</Badge>)}
              </div>
            </section>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/20 px-5 py-4 sm:px-7">
          <Button type="button" variant="ghost" onClick={onClose}>关闭</Button>
          <Button type="button" onClick={() => onEdit(entry)}>
            <Pencil className="h-4 w-4" />编辑条目
          </Button>
        </footer>
      </div>
    </div>
  );
}
