import assert from 'node:assert/strict';
import test from 'node:test';
import { runOptimizationGraph, assertPromptBudget } from '../../src/features/resumes/workflow/optimization-graph';

const input = { targetRole: '后端开发', jdText: '维护接口', materials: [{ materialId: 1, type: 'project' as const, title: '服务', tags: [], content: { projectCategory: '后端', techStack: ['Java'], content: '实现接口' } }] };

test('optimization workflow uses one generation and returns validated suggestions', async () => {
  let calls = 0;
  const result = await runOptimizationGraph(input, async () => {
    calls += 1;
    return [{ materialId: 1, proposedContent: input.materials[0].content, rationale: '保持事实' }];
  });
  assert.equal(calls, 1);
  assert.equal(result[0].materialId, 1);
});

test('optimization workflow rejects IDs and factual metadata absent from its input', async () => {
  await assert.rejects(runOptimizationGraph(input, async () => [{ materialId: 2, proposedContent: input.materials[0].content, rationale: '错误' }]));
  await assert.rejects(runOptimizationGraph(input, async () => [{ materialId: 1, proposedContent: { ...input.materials[0].content, techStack: ['Redis'] }, rationale: '错误' }]));
});

test('oversized prompt is rejected before model execution and network failure is not retried by graph', async () => {
  assert.throws(() => assertPromptBudget({ text: '中'.repeat(60_000) }), /素材/);
  let calls = 0;
  await assert.rejects(runOptimizationGraph(input, async () => { calls++; throw new Error('timeout'); }), /timeout/);
  assert.equal(calls, 1);
});
