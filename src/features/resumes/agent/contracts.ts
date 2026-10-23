import { z } from 'zod';

export const AGENT_WORKFLOW_VERSION = 'resume-agent-v1';
export const MAX_AGENT_CALLS = 8;
export const MAX_AGENT_CONTEXT_CHARS = 120_000;
export const planSchema = z.array(z.object({
  title: z.string().trim().min(1).max(160),
  status: z.enum(['pending', 'in_progress', 'completed']),
}).strict()).min(1).max(8);
export const evidenceSchema = z.object({
  materialId: z.number().int().positive(),
  source: z.enum(['material', 'user_facts']),
  quote: z.string().trim().min(2).max(1000),
}).strict();
export const questionSchema = z.object({materialId: z.number().int().positive(), question: z.string().trim().min(1).max(500)}).strict();
export const traceSchema = z.object({
  plan: planSchema.or(z.array(z.never()).length(0)),
  events: z.array(z.string().max(600)).max(32),
  evidence: z.array(evidenceSchema).max(600),
  question: questionSchema.nullable(),
  stopReason: z.string().max(300),
});
export type AgentTrace = z.infer<typeof traceSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type ToolCall = {id: string; type: 'function'; function: {name: string; arguments: string}};
export type AgentMessage =
  | {role: 'system' | 'user'; content: string}
  | {role: 'assistant'; content: string | null; tool_calls?: ToolCall[]}
  | {role: 'tool'; tool_call_id: string; content: string};

const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({type: 'object', properties, required, additionalProperties: false});
const id = {type: 'integer', minimum: 1};
const text = {type: 'string'};
const tool = (name: string, description: string, parameters: unknown) => ({type: 'function', function: {name, description, parameters}});
export const agentTools = [
  tool('write_plan', '创建或更新简短行动计划。改写前必须先制定计划。', object({steps: {type: 'array', minItems: 1, maxItems: 8, items: object({title: text, status: {type: 'string', enum: ['pending', 'in_progress', 'completed']}})}})),
  tool('read_materials', '按 ID 批量读取用户已选素材的完整字段。改写前必须读取对应素材。', object({materialIds: {type: 'array', minItems: 1, maxItems: 200, items: id}})),
  tool('request_user_facts', '缺乏必要事实时暂停并向用户提问；最多两次。用户可以跳过，不能编造补全。', object({materialId: id, question: text})),
  tool('propose_changes', '提交一批改写建议并校验；失败会返回错误，可修正。每条附同一素材原文或用户补充中的逐字依据。', object({suggestions: {type: 'array', minItems: 1, maxItems: 200, items: object({materialId: id, proposedContent: {type: 'object', additionalProperties: true}, rationale: text, evidence: {type: 'array', minItems: 1, maxItems: 3, items: object({materialId: id, source: {type: 'string', enum: ['material', 'user_facts']}, quote: text})}})}})),
  tool('finish', '结束任务；未提交有效建议的素材保留原文。', object({})),
];
