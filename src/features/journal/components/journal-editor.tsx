"use client";

import { Save, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { JournalEntry } from "@/db/schema";
import { deleteJournalEntryAction, saveJournalEntryAction, type JournalActionState } from "@/features/journal/actions";
import { journalEnergyMeta, journalEnergyOptions, journalMoodMeta, journalMoodOptions } from "@/features/journal/constants";
import { formatDateTime } from "@/lib/date";

type JournalEditorProps = {
  entry: JournalEntry | null;
  selectedDate: string;
  today: string;
};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }
  return <p className="text-sm text-destructive">{errors[0]}</p>;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "保存中..." : "保存"}
    </Button>
  );
}

export function JournalEditor({ entry, selectedDate, today }: JournalEditorProps) {
  const [state, formAction] = useActionState<JournalActionState, FormData>(saveJournalEntryAction, { success: false });
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (state.success) {
      setSavedMessage("已保存");
      const timer = window.setTimeout(() => setSavedMessage(""), 1800);
      return () => window.clearTimeout(timer);
    }
  }, [state.success]);

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{selectedDate === today ? "今日记录" : selectedDate}</CardTitle>
            {entry ? (
              <p className="mt-2 text-sm text-muted-foreground">
                创建于 {formatDateTime(entry.createdAt)}，最后更新于 {formatDateTime(entry.updatedAt)}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">今天还没有留下记录，写下一句话也算开始。</p>
            )}
          </div>
          {entry ? (
            <form
              action={deleteJournalEntryAction}
              onSubmit={(event) => {
                if (!window.confirm("确认删除这篇日记？")) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="entryDate" value={selectedDate} />
              <Button type="submit" variant="ghost">
                <Trash2 className="h-4 w-4" />
                删除
              </Button>
            </form>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="entryDate" value={selectedDate} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mood">当天心情</Label>
              <Select id="mood" name="mood" defaultValue={entry?.mood ?? ""}>
                <option value="">不选择</option>
                {journalMoodOptions.map((mood) => (
                  <option key={mood} value={mood}>
                    {journalMoodMeta[mood]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="energyLevel">精力状态</Label>
              <Select id="energyLevel" name="energyLevel" defaultValue={entry?.energyLevel ?? ""}>
                <option value="">不选择</option>
                {journalEnergyOptions.map((energy) => (
                  <option key={energy} value={energy}>
                    {journalEnergyMeta[energy]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">正文</Label>
            <Textarea id="content" name="content" defaultValue={entry?.content ?? ""} className="min-h-80 resize-y leading-7" />
            <FieldError errors={state.errors?.content} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="completedToday">今天完成了什么</Label>
              <Input id="completedToday" name="completedToday" defaultValue={entry?.completedToday ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tomorrowMinimumAction">明天最小行动</Label>
              <Input id="tomorrowMinimumAction" name="tomorrowMinimumAction" defaultValue={entry?.tomorrowMinimumAction ?? ""} />
            </div>
          </div>

          {state.message && !state.success ? <p className="text-sm text-destructive">{state.message}</p> : null}
          {savedMessage ? <p className="text-sm text-primary">{savedMessage}</p> : null}
          <div className="flex justify-end">
            <SaveButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}