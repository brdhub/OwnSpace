import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { entryOptimizationResponseSchema, type EntryOptimizationSuggestion } from '../ai-schema';
import type { OptimizationPromptInput } from '../prompts';
import { optimizeEntriesForJd } from '../deepseek-core';

// Conservative character budget: accommodates Chinese text without silently truncating entries.
export function assertPromptBudget(input: unknown) {
  if (JSON.stringify(input).length > 40_000) throw new Error('本次素材较长，请减少选材后重试。不会截断简历内容。');
}

export function validateOptimizationSuggestions(input: OptimizationPromptInput, suggestions: unknown) {
  const parsed = entryOptimizationResponseSchema.parse({ suggestions }).suggestions;
  const originals = new Map(input.materials.map(item => [item.materialId, item]));
  if (parsed.length !== originals.size) throw new Error('优化结果不完整，请重试。');
  for (const suggestion of parsed) {
    const original = originals.get(suggestion.materialId);
    if (!original) throw new Error('优化结果包含未知素材。');
    const before = original.content as Record<string, unknown>;
    const after = suggestion.proposedContent as Record<string, unknown>;
    const editable = original.type === 'experience' ? ['responsibilities', 'workContent']
      : original.type === 'project' ? ['content', 'responsibilities'] : ['education', 'skill'].includes(original.type) ? ['content'] : [];
    if (Object.keys(before).sort().join() !== Object.keys(after).sort().join()) throw new Error('优化结果字段发生变化。');
    for (const key of Object.keys(before)) {
      if ((!editable.includes(key) || before[key] === '') && JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        throw new Error('优化结果修改了固定事实字段。');
      }
    }
  }
  return parsed;
}

const State = Annotation.Root({
  input: Annotation<OptimizationPromptInput>(),
  suggestions: Annotation<EntryOptimizationSuggestion[]>(),
});

export async function runOptimizationGraph(
  input: OptimizationPromptInput,
  generate: (input: OptimizationPromptInput) => Promise<EntryOptimizationSuggestion[]> = optimizeEntriesForJd,
): Promise<EntryOptimizationSuggestion[]> {
  const graph = new StateGraph(State)
    .addNode('prepare', state => { assertPromptBudget(state.input); return {}; })
    .addNode('generate', async state => ({ suggestions: await generate(state.input) }))
    .addNode('validate', state => ({ suggestions: validateOptimizationSuggestions(state.input, state.suggestions) }))
    .addEdge(START, 'prepare').addEdge('prepare', 'generate').addEdge('generate', 'validate').addEdge('validate', END)
    .compile();
  const result = await graph.invoke({ input, suggestions: [] }, { recursionLimit: 6 });
  return result.suggestions;
}
