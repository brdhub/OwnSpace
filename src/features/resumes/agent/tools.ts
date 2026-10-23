import { z } from 'zod';
import { entryOptimizationSuggestionSchema, type EntryOptimizationSuggestion } from '../ai-schema';
import type { OptimizationPromptInput } from '../prompts';
import { validatePartialSuggestions } from '../workflow/validation';
import { evidenceSchema, planSchema, questionSchema, type AgentTrace, type Evidence, type ToolCall } from './contracts';

export type ToolState = {
  input: OptimizationPromptInput;
  plan: AgentTrace['plan'];
  readIds: number[];
  facts: Record<string, string>;
  questionsAsked: number;
  suggestions: EntryOptimizationSuggestion[];
  evidence: Evidence[];
};
type ToolResult = {
  response: unknown;
  event: string;
  update?: Partial<ToolState>;
  question?: AgentTrace['question'];
  done?: boolean;
};
const submissionSchema = z.object({suggestions: z.array(entryOptimizationSuggestionSchema.extend({evidence: z.array(evidenceSchema).min(1).max(3)})).min(1).max(200)}).strict();
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

// This dispatcher has access only to this run's immutable selected-material snapshot.
export function executeAgentTool(state: ToolState, call: ToolCall): ToolResult {
  try {
    const args: unknown = JSON.parse(call.function.arguments);
    switch (call.function.name) {
      case 'write_plan': {
        const {steps} = z.object({steps: planSchema}).strict().parse(args);
        return {response: {ok: true}, event: '已更新行动计划', update: {plan: steps}};
      }
      case 'read_materials': {
        const {materialIds} = z.object({materialIds: z.array(z.number().int().positive()).min(1).max(200)}).strict().parse(args);
        const selected = materialIds.map(id => {
          const material = state.input.materials.find(item => item.materialId === id);
          if (!material) throw new Error('只能读取本次用户已选素材。');
          return material;
        });
        return {response: {materials: selected}, event: `已读取 ${selected.length} 条已选素材`, update: {readIds: [...new Set([...state.readIds, ...materialIds])]}};
      }
      case 'request_user_facts': {
        const question = questionSchema.parse(args);
        if (!state.readIds.includes(question.materialId)) throw new Error('请先读取对应素材，再提出具体问题。');
        if (state.questionsAsked >= 2) throw new Error('追问次数已用完，请仅依据已有事实改写或保留原文。');
        return {response: null, event: `等待补充素材 #${question.materialId}`, question, update: {questionsAsked: state.questionsAsked + 1}};
      }
      case 'propose_changes': {
        if (!state.plan.length) throw new Error('请先调用 write_plan 制定行动计划。');
        const {suggestions} = submissionSchema.parse(args);
        if (new Set(suggestions.map(item => item.materialId)).size !== suggestions.length) throw new Error('同一批次不能重复提交素材 ID。');
        const accepted: EntryOptimizationSuggestion[] = [];
        const evidence: Evidence[] = [];
        const issues: {materialId: number; message: string}[] = [];
        for (const item of suggestions) {
          const original = state.input.materials.find(material => material.materialId === item.materialId);
          if (!original || !state.readIds.includes(item.materialId)) {
            issues.push({materialId: item.materialId, message: '素材未授权或尚未读取。'});
            continue;
          }
          const sourceTexts = [original.title, ...Object.values(original.content).flat()].filter((value): value is string => typeof value === 'string');
          const hasValidEvidence = item.evidence.every(ref => {
            const sources = ref.source === 'user_facts' ? [state.facts[String(item.materialId)] ?? ''] : sourceTexts;
            return ref.materialId === item.materialId && sources.some(source => normalize(source).includes(normalize(ref.quote)));
          });
          if (!hasValidEvidence) {
            issues.push({materialId: item.materialId, message: '引用必须来自同一素材原文或用户已补充事实，不可把岗位要求当作经历。'});
            continue;
          }
          const suggestion = {materialId: item.materialId, proposedContent: item.proposedContent, rationale: item.rationale};
          const validated = validatePartialSuggestions({...state.input, materials: [original]}, [suggestion]);
          if (validated.failedMaterialIds.length) {
            issues.push(...validated.issues.map(issue => ({materialId: item.materialId, message: issue.message})));
          } else {
            accepted.push(suggestion);
            evidence.push(...item.evidence);
          }
        }
        const replaced = new Set(accepted.map(item => item.materialId));
        return {
          response: {acceptedMaterialIds: [...replaced], issues, instruction: issues.length ? '根据错误修正对应条目后重新提交；不要重复提交已通过条目。' : '已通过结构与引用校验，仍需用户审阅事实。'},
          event: `已校验建议：${accepted.length} 条通过，${issues.length} 条待修正`,
          update: {suggestions: [...state.suggestions.filter(item => !replaced.has(item.materialId)), ...accepted], evidence: [...state.evidence.filter(item => !replaced.has(item.materialId)), ...evidence]},
        };
      }
      case 'finish':
        z.object({}).strict().parse(args);
        return {response: {ok: true}, event: '已结束处理，未通过的条目保留原文', done: true};
      default:
        throw new Error('工具不在允许列表中。');
    }
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.slice(0, 4).map(issue => `${issue.path.join('.')}: ${issue.message}`).join('；')
      : error instanceof SyntaxError ? '参数不是有效 JSON，请重新生成。' : error instanceof Error ? error.message : '工具参数无效。';
    return {response: {error: message, instruction: '请修正后重新调用工具。'}, event: `工具校验未通过：${message}`.slice(0, 600)};
  }
}
