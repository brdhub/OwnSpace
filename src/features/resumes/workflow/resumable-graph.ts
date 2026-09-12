import { Annotation, END, START, StateGraph, interrupt, type BaseCheckpointSaver } from '@langchain/langgraph';
import { z } from 'zod';
import type { EntryOptimizationSuggestion } from '../ai-schema';
import type { OptimizationPromptInput } from '../prompts';
import { failedSuggestionFeedback, validatePartialSuggestions, type OptimizationIssue } from './validation';

export const RESUME_WORKFLOW_VERSION = 'resume-recovery-v1';
export class ModelCallBudgetError extends Error {
  constructor() { super('本次调用次数已用完，未通过校验的条目保留原文。'); this.name = 'ModelCallBudgetError'; }
}
const replace = <T>(fallback: () => T) => Annotation<T>({ reducer: (_previous, next) => next, default: fallback });
const State = Annotation.Root({
  input: Annotation<OptimizationPromptInput>(),
  workflowVersion: replace(() => RESUME_WORKFLOW_VERSION),
  needsFacts: replace(() => false),
  facts: replace(() => ''),
  rawOutput: replace<unknown>(() => null),
  suggestions: replace<EntryOptimizationSuggestion[]>(() => []),
  failedMaterialIds: replace<number[]>(() => []),
  issues: replace<OptimizationIssue[]>(() => []),
  fallbackMaterialIds: replace<number[]>(() => []),
  repairCount: replace(() => 0),
  callCount: replace(() => 0),
  budgetExhausted: replace(() => false),
  inputTokens: replace<number | null>(() => null),
  outputTokens: replace<number | null>(() => null),
});

export type ResumableOptimizationState = typeof State.State;
export type OptimizationFeedback = { previous: unknown; issues: unknown; facts?: string };
export type ResumableGraphOptions = {
  checkpointer: BaseCheckpointSaver;
  generate: (input: OptimizationPromptInput, feedback?: OptimizationFeedback) => Promise<{ output: unknown; inputTokens: number | null; outputTokens: number | null }>;
  beforeCall?: () => Promise<void>;
  onStage?: (stage: string) => Promise<void>;
};

export function createResumableGraph({ checkpointer, generate, beforeCall, onStage }: ResumableGraphOptions) {
  const call = async (state: ResumableOptimizationState, repair: boolean) => {
    if (state.callCount >= 2) throw new Error('本次优化的模型调用次数已用完。');
    await onStage?.(repair ? 'repairing' : 'generating');
    const input = repair ? { ...state.input, materials: state.input.materials.filter(item => state.failedMaterialIds.includes(item.materialId)) } : state.input;
    const feedback = repair || state.facts ? { previous: repair ? failedSuggestionFeedback(state.rawOutput, state.failedMaterialIds) : null, issues: repair ? state.issues : [], facts: state.facts || undefined } : undefined;
    if (JSON.stringify({ input, feedback }).length > 40_000) throw new Error('本次素材较长，请减少选材后重试。不会截断简历内容。');
    try { await beforeCall?.(); } catch (error) {
      if (!(error instanceof ModelCallBudgetError)) throw error;
      return { budgetExhausted: true, repairCount: 1 };
    }
    const response = await generate(input, feedback);
    const sum = (previous: number | null, current: number | null) => state.callCount === 0 ? current : previous === null || current === null ? null : previous + current;
    return { rawOutput: response.output, callCount: state.callCount + 1, repairCount: state.repairCount + Number(repair), inputTokens: sum(state.inputTokens, response.inputTokens), outputTokens: sum(state.outputTokens, response.outputTokens) };
  };
  return new StateGraph(State)
    .addNode('prepare', async state => {
      if (state.workflowVersion !== RESUME_WORKFLOW_VERSION) throw new Error('工作流版本已变化，请重新开始优化。');
      if (JSON.stringify(state.input).length > 40_000) throw new Error('本次素材较长，请减少选材后重试。不会截断简历内容。');
      if (!state.input.materials.length || new Set(state.input.materials.map(item => item.materialId)).size !== state.input.materials.length) throw new Error('素材为空或重复，请重新选材。');
      await onStage?.('preparing'); return {};
    })
    .addNode('awaitFacts', async () => {
      await onStage?.('awaiting_facts');
      const answer = interrupt({ kind: 'facts', question: '请补充这条经历中你实际负责的工作、使用的技术或可核实的结果；没有补充也可以跳过。', maxLength: 4_000 });
      return { facts: z.string().max(4_000).parse(answer).trim() };
    })
    .addNode('generate', state => call(state, false))
    .addNode('validate', async state => {
      await onStage?.('validating');
      if (state.budgetExhausted) return {
        failedMaterialIds: state.input.materials.filter(item => !state.suggestions.some(suggestion => suggestion.materialId === item.materialId)).map(item => item.materialId),
        issues: [{ materialId: null, message: '本次调用次数已用完，保留已经通过校验的条目，其余保留原文。' }],
      };
      const input = state.repairCount ? { ...state.input, materials: state.input.materials.filter(item => state.failedMaterialIds.includes(item.materialId)) } : state.input;
      const validated = validatePartialSuggestions(input, state.rawOutput);
      return { ...validated, suggestions: state.repairCount ? [...state.suggestions, ...validated.suggestions] : validated.suggestions };
    })
    .addNode('repair', state => call(state, true))
    .addNode('finish', async state => {
      await onStage?.('finishing');
      const valid = new Map(state.suggestions.map(item => [item.materialId, item]));
      return { fallbackMaterialIds: state.failedMaterialIds, suggestions: state.input.materials.map(item => valid.get(item.materialId) ?? { materialId: item.materialId, proposedContent: item.content, rationale: '未通过校验，保留原文。请核对后手动调整或重新发起优化。' }) };
    })
    .addEdge(START, 'prepare')
    .addConditionalEdges('prepare', state => state.needsFacts ? 'awaitFacts' : 'generate', ['awaitFacts', 'generate'])
    .addEdge('awaitFacts', 'generate').addEdge('generate', 'validate')
    .addConditionalEdges('validate', state => state.failedMaterialIds.length && state.repairCount === 0 ? 'repair' : 'finish', ['repair', 'finish'])
    .addEdge('repair', 'validate').addEdge('finish', END)
    .compile({ checkpointer });
}
