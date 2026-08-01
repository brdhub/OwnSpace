"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Application, InterviewTag } from "@/db/schema";
import { createInterviewAction, type InterviewActionState, updateInterviewAction } from "@/features/interviews/actions";
import { interviewResultMeta, interviewResults, interviewRoundMeta, interviewRounds } from "@/features/interviews/constants";
import { InterviewQuestionEditor, type QuestionDraft } from "@/features/interviews/components/interview-question-editor";
import { InterviewTagSelector } from "@/features/interviews/components/interview-tag-selector";
import type { InterviewNoteView } from "@/features/interviews/types";
import { toDateInputValue } from "@/lib/date";

type InterviewFormProps = {
  note?: InterviewNoteView;
  applications: Application[];
  tags: InterviewTag[];
  onDone: () => void;
};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }
  return <p className="text-sm text-destructive">{errors[0]}</p>;
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return <Button disabled={pending}>{pending ? "保存中..." : editing ? "保存修改" : "新增面经"}</Button>;
}

export function InterviewForm({ note, applications, tags, onDone }: InterviewFormProps) {
  const action = note ? updateInterviewAction : createInterviewAction;
  const [state, formAction] = useActionState<InterviewActionState, FormData>(action, { success: false });
  const [applicationId, setApplicationId] = useState(note?.applicationId ? String(note.applicationId) : "");
  const [selectedTagIds, setSelectedTagIds] = useState(note?.tags.map((tag) => tag.id) ?? []);
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    note?.questions.map((question) => ({
      question: question.question,
      myAnswer: question.myAnswer,
      betterAnswer: question.betterAnswer,
    })) ?? [],
  );

  const selectedApplication = useMemo(
    () => applications.find((application) => String(application.id) === applicationId),
    [applicationId, applications],
  );

  useEffect(() => {
    if (state.success) {
      onDone();
    }
  }, [onDone, state.success]);

  return (
    <form action={formAction} className="space-y-5">
      {note ? <input type="hidden" name="id" value={note.id} /> : null}
      <input type="hidden" name="tagIds" value={JSON.stringify(selectedTagIds)} />
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="applicationId">关联投递记录</Label>
          <Select id="applicationId" name="applicationId" value={applicationId} onChange={(event) => setApplicationId(event.target.value)}>
            <option value="">请选择</option>
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {application.company} / {application.role}
              </option>
            ))}
          </Select>
          <FieldError errors={state.errors?.applicationId} />
        </div>
        <div className="space-y-2">
          <Label>公司和岗位</Label>
          <div className="min-h-10 rounded-md border border-input px-3 py-2 text-sm text-muted-foreground">
            {selectedApplication ? `${selectedApplication.company} / ${selectedApplication.role}` : "未选择"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="round">面试轮次</Label>
          <Select id="round" name="round" defaultValue={note?.round ?? "firstTechnical"}>
            {interviewRounds.map((round) => (
              <option key={round} value={round}>
                {interviewRoundMeta[round]}
              </option>
            ))}
          </Select>
          <FieldError errors={state.errors?.round} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interviewDate">面试日期</Label>
          <Input id="interviewDate" name="interviewDate" type="date" defaultValue={note?.interviewDate ?? toDateInputValue()} />
          <FieldError errors={state.errors?.interviewDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="result">面试结果</Label>
          <Select id="result" name="result" defaultValue={note?.result ?? "unknown"}>
            {interviewResults.map((result) => (
              <option key={result} value={result}>
                {interviewResultMeta[result]}
              </option>
            ))}
          </Select>
          <FieldError errors={state.errors?.result} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="summary">整体记录</Label>
          <Textarea id="summary" name="summary" defaultValue={note?.summary ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reflection">面后复盘</Label>
          <Textarea id="reflection" name="reflection" defaultValue={note?.reflection ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nextAction">下一步行动</Label>
          <Textarea id="nextAction" name="nextAction" defaultValue={note?.nextAction ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>技术标签</Label>
        <InterviewTagSelector tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
        <FieldError errors={state.errors?.tagIds} />
      </div>

      <InterviewQuestionEditor questions={questions} onChange={setQuestions} />
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          取消
        </Button>
        <SubmitButton editing={Boolean(note)} />
      </div>
    </form>
  );
}
