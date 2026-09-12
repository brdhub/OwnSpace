import { entryOptimizationSuggestionSchema, type EntryOptimizationSuggestion } from '../ai-schema';
import type { OptimizationPromptInput } from '../prompts';

export type OptimizationIssue = { materialId: number | null; message: string };

export function failedSuggestionFeedback(output: unknown, failedIds: number[]): unknown {
  let decoded = output;
  if (typeof decoded === 'string') {
    try { decoded = JSON.parse(decoded); } catch { return { error: '上次输出不是合法 JSON。' }; }
  }
  const rows: unknown[] = Array.isArray(decoded) ? decoded
    : decoded && typeof decoded === 'object' && 'suggestions' in decoded && Array.isArray(decoded.suggestions) ? decoded.suggestions : [];
  return { suggestions: rows.filter(row => row && typeof row === 'object' && 'materialId' in row && typeof row.materialId === 'number' && failedIds.includes(row.materialId)) };
}

export function validatePartialSuggestions(input: OptimizationPromptInput, output: unknown) {
  const issues: OptimizationIssue[] = [];
  let decoded = output;
  if (typeof decoded === 'string') {
    try { decoded = JSON.parse(decoded); } catch { decoded = null; }
  }
  const rows: unknown[] = Array.isArray(decoded) ? decoded
    : decoded && typeof decoded === 'object' && 'suggestions' in decoded && Array.isArray(decoded.suggestions) ? decoded.suggestions : [];
  if (!rows.length) issues.push({ materialId: null, message: '输出不是有效的 suggestions 数组。' });
  const knownIds = new Set(input.materials.map(item => item.materialId));
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row && typeof row === 'object' && 'materialId' in row && typeof row.materialId === 'number') {
      counts.set(row.materialId, (counts.get(row.materialId) ?? 0) + 1);
      if (!knownIds.has(row.materialId)) issues.push({ materialId: row.materialId, message: '包含未知素材 ID，已丢弃。' });
    }
  }
  const suggestions: EntryOptimizationSuggestion[] = [];
  const failedMaterialIds: number[] = [];
  for (const original of input.materials) {
    const raw = rows.find(row => row && typeof row === 'object' && 'materialId' in row && row.materialId === original.materialId);
    const parsed = entryOptimizationSuggestionSchema.safeParse(raw);
    let message = counts.get(original.materialId) !== 1 ? '素材缺失或 ID 重复。' : !parsed.success ? '条目结构或字段值不合法。' : '';
    if (!message && parsed.success) {
      const before = original.content as Record<string, unknown>;
      const after = parsed.data.proposedContent as Record<string, unknown>;
      const editable = original.type === 'experience' ? ['responsibilities', 'workContent']
        : original.type === 'project' ? ['content', 'responsibilities'] : ['education', 'skill'].includes(original.type) ? ['content'] : [];
      if (Object.keys(before).sort().join() !== Object.keys(after).sort().join()) message = '条目字段发生变化。';
      else if (Object.keys(before).some(key => (!editable.includes(key) || before[key] === '' || (Array.isArray(before[key]) && before[key].length === 0)) && JSON.stringify(before[key]) !== JSON.stringify(after[key]))) message = '修改了固定事实或填充了空字段。';
    }
    if (message) {
      failedMaterialIds.push(original.materialId);
      issues.push({ materialId: original.materialId, message });
    } else if (parsed.success) suggestions.push(parsed.data);
  }
  return { suggestions, failedMaterialIds, issues };
}
