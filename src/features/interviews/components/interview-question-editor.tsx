"use client";

import { ArrowDown, ArrowUp, ListPlus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type QuestionDraft = { question: string; myAnswer: string; betterAnswer: string };
type Props = { questions: QuestionDraft[]; onChange: (questions: QuestionDraft[]) => void };
const emptyQuestion: QuestionDraft = { question: "", myAnswer: "", betterAnswer: "" };

export function InterviewQuestionEditor({ questions, onChange }: Props) {
  const [batchText, setBatchText] = useState("");
  const [importedCount, setImportedCount] = useState(0);

  function update(index: number, patch: Partial<QuestionDraft>) {
    onChange(questions.map((question, currentIndex) => currentIndex === index ? { ...question, ...patch } : question));
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...questions];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function importQuestions() {
    const imported = batchText.split(/\r?\n/u).map((question) => question.trim()).filter(Boolean)
      .map((question) => ({ ...emptyQuestion, question }));
    if (imported.length === 0) return;
    onChange([...questions, ...imported]);
    setBatchText("");
    setImportedCount(imported.length);
  }

  return <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-foreground">问题条目</h3>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...questions, { ...emptyQuestion }])}>
        <Plus className="h-4 w-4" />新增问题
      </Button>
    </div>
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <Label htmlFor="batch-questions">批量导入</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Textarea id="batch-questions" value={batchText} onChange={(event) => setBatchText(event.target.value)}
          placeholder={"每行输入一个问题，例如：\nJVM 的内存模型是什么？\nRedis 有哪些数据结构？"} className="min-h-20 flex-1" />
        <Button type="button" variant="outline" onClick={importQuestions} disabled={!batchText.trim()}>
          <ListPlus className="h-4 w-4" />导入问题
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">每一行会导入为一个独立的问题条目，行内空格会保留。</p>
      <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">{importedCount ? `已导入 ${importedCount} 个问题条目。` : ""}</p>
    </div>
    {questions.length === 0 ? <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">暂无问题，可手动新增或批量导入。</p> : null}
    {questions.map((question, index) => <div key={index} className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">问题 {index + 1}</div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={() => move(index, -1)} aria-label="上移问题"><ArrowUp className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => move(index, 1)} aria-label="下移问题"><ArrowDown className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(questions.filter((_, i) => i !== index))} aria-label="删除问题"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="space-y-2"><Label>问题内容</Label><Textarea value={question.question} onChange={(event) => update(index, { question: event.target.value })} /></div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2"><Label>当时回答</Label><Textarea value={question.myAnswer} onChange={(event) => update(index, { myAnswer: event.target.value })} /></div>
        <div className="space-y-2"><Label>复盘答案</Label><Textarea value={question.betterAnswer} onChange={(event) => update(index, { betterAnswer: event.target.value })} /></div>
      </div>
    </div>)}
  </div>;
}