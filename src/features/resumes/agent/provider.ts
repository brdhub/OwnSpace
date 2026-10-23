import { z } from 'zod';
import { DeepSeekError, getDeepSeekConfig, type DeepSeekDependencies } from '../deepseek-core';
import { agentTools, type AgentMessage } from './contracts';

const envelopeSchema = z.object({
  choices: z.array(z.object({
    finish_reason: z.enum(['stop', 'tool_calls', 'length']),
    message: z.object({
      content: z.string().nullable().optional(),
      tool_calls: z.array(z.object({id: z.string().min(1), type: z.literal('function'), function: z.object({name: z.string(), arguments: z.string()})})).max(8).optional(),
    }),
  })).length(1),
  usage: z.object({prompt_tokens: z.number().int().nonnegative().optional(), completion_tokens: z.number().int().nonnegative().optional()}).optional(),
});

export async function requestAgentTurn(messages: AgentMessage[], dependencies: DeepSeekDependencies = {}, tools = agentTools) {
  const config = getDeepSeekConfig(dependencies.env);
  let response: Response;
  try {
    response = await (dependencies.fetch ?? fetch)(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json'},
      body: JSON.stringify({model: config.model, messages, tools, tool_choice: 'auto', thinking: {type: 'disabled'}, stream: false, max_tokens: 8000}),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch { throw new DeepSeekError('network_error', 'Agent 请求失败或超时，可从已保存进度继续。', true); }
  if (!response.ok) throw new DeepSeekError('provider_error', `Agent 服务请求失败（HTTP ${response.status}）。`, true);
  const parsed = envelopeSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new DeepSeekError('invalid_response', '模型未返回有效的工具调用响应，请确认配置的模型支持工具调用。', true);
  const choice = parsed.data.choices[0];
  // Truncated tool arguments must never be executed.
  const message: AgentMessage = choice.finish_reason === 'length'
    ? {role: 'assistant', content: '上次输出超出长度限制，请缩小提交批次后重新调用工具。'}
    : {role: 'assistant', content: choice.message.content ?? null, tool_calls: choice.message.tool_calls};
  return {message, inputTokens: parsed.data.usage?.prompt_tokens ?? null, outputTokens: parsed.data.usage?.completion_tokens ?? null};
}
