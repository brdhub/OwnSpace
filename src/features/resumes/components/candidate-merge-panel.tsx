"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { buildCandidateMerge, candidateFieldLabels, formatCandidateValue, type MergeChoice, type MergeEntry } from '../candidate-merge';
import type { ResumeEntryInput } from '../schema';

export function CandidateMergePanel({ previous, incoming, onApply, onDirty, disabled }: {
  previous: MergeEntry; incoming: MergeEntry; onApply: (entry: ResumeEntryInput) => void; onDirty: () => void; disabled: boolean;
}) {
  const [choices, setChoices] = useState<Record<string, MergeChoice>>({});
  const [error, setError] = useState('');
  // Differences do not depend on applying a choice; use the original fields even when a draft exceeds schema limits.
  const fields = [...new Set(['title', 'tags', ...Object.keys(previous.content), ...Object.keys(incoming.content)])];
  const oldValues: Record<string, unknown> = { title: previous.title, tags: previous.tags, ...previous.content };
  const newValues: Record<string, unknown> = { title: incoming.title, tags: incoming.tags, ...incoming.content };
  function apply() {
    try {
      onApply(buildCandidateMerge(previous, incoming, choices).entry);
      setError('');
    } catch {
      setError('补充结果超过字段长度或数量限制，请保留旧值或选择新值，再手动整理。');
    }
  }
  return <div className="space-y-3 rounded-md border border-amber-200 p-3">
    <p className="text-sm font-medium">核对与“{previous.title}”的差异</p>
    <p className="text-xs text-muted-foreground">请先确认属于同一段经历。默认补齐空字段、合并技术栈与标签，其余差异保留旧值。新简历省略的内容不会自动删除。</p>
    {fields.filter(key => JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])).map(key => <div key={key} className="space-y-2 border-t border-border pt-2">
      <p className="text-xs font-medium">{candidateFieldLabels[key] ?? key}</p>
      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div><p className="text-muted-foreground">已有内容</p><p className="whitespace-pre-wrap break-words">{formatCandidateValue(oldValues[key])}</p></div>
        <div><p className="text-muted-foreground">本次提取</p><p className="whitespace-pre-wrap break-words">{formatCandidateValue(newValues[key])}</p></div>
      </div>
      <Select aria-label={`${candidateFieldLabels[key] ?? key}的补充方式`} disabled={disabled} value={choices[key] ?? ''} onChange={event => {
        const next = { ...choices };
        if (event.target.value) next[key] = event.target.value as MergeChoice;
        else delete next[key];
        setChoices(next);
        onDirty();
      }}>
        <option value="">默认补充规则</option><option value="old">保留已有内容</option><option value="new">采用本次内容</option>
        {['content', 'responsibilities', 'workContent'].includes(key) ? <option value="append">确认无冲突，追加本次内容</option> : null}
      </Select>
    </div>)}
    <Button type="button" size="sm" variant="secondary" onClick={apply} disabled={disabled}>将所选内容载入编辑区</Button>
    <p className="text-xs text-muted-foreground">载入后可继续编辑，再点击“确认补充到原条目”。重新载入会替换编辑区内容。</p>
    {error ? <p className="text-xs text-destructive">{error}</p> : null}
  </div>;
}
