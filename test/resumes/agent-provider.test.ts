import assert from 'node:assert/strict';
import test from 'node:test';
import { requestAgentTurn } from '../../src/features/resumes/agent/provider';

const env = {DEEPSEEK_API_KEY: 'test-key', DEEPSEEK_MODEL: 'test-model'};
test('native tool adapter sends tools and returns call IDs and usage without exposing credentials', async () => {
  const result = await requestAgentTurn([{role: 'user', content: 'test'}], {env, fetch: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'test-model');
    assert.equal(body.tools.length, 5);
    assert.equal(body.response_format, undefined);
    assert.equal(body.thinking.type, 'disabled');
    assert.equal(JSON.stringify(body).includes('test-key'), false);
    return Response.json({choices: [{finish_reason: 'tool_calls', message: {content: null, tool_calls: [{id: 'c1', type: 'function', function: {name: 'finish', arguments: '{}'}}]}}], usage: {prompt_tokens: 20, completion_tokens: 10}});
  }});
  assert.equal(result.message.role, 'assistant');
  if (result.message.role === 'assistant') assert.equal(result.message.tool_calls?.[0].id, 'c1');
  assert.equal(result.inputTokens, 20);
  assert.equal(result.outputTokens, 10);
});
test('truncated responses cannot execute incomplete tool calls', async () => {
  const result = await requestAgentTurn([], {env, fetch: async () => Response.json({choices: [{finish_reason: 'length', message: {content: null, tool_calls: [{id: 'c1', type: 'function', function: {name: 'propose_changes', arguments: '{'}}]}}]})});
  if (result.message.role === 'assistant') assert.equal(result.message.tool_calls, undefined);
  assert.match(result.message.content ?? '', /长度限制/);
});
test('network failures and incompatible provider envelopes remain recoverable errors', async () => {
  await assert.rejects(requestAgentTurn([], {env, fetch: async () => {throw new Error('timeout');}}), /请求失败/);
  await assert.rejects(requestAgentTurn([], {env, fetch: async () => Response.json({choices: []})}), /工具调用/);
});
