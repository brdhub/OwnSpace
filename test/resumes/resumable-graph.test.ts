import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Command } from '@langchain/langgraph';
import { createResumableGraph, ModelCallBudgetError } from '../../src/features/resumes/workflow/resumable-graph';
import { openCheckpointStore } from '../../src/features/resumes/workflow/checkpoint-store';
import type { OptimizationPromptInput } from '../../src/features/resumes/prompts';
import { validatePartialSuggestions } from '../../src/features/resumes/workflow/validation';

const input: OptimizationPromptInput = { targetRole: '后端', jdText: 'Java', materials: [1, 2].map(materialId => ({ materialId, type: 'project', title: '项目', tags: [], content: { projectCategory: '后端', techStack: ['Java'], content: `原文${materialId}` } })) };
const suggestion = (materialId: number) => ({ materialId, proposedContent: { ...input.materials[materialId - 1].content, content: `优化${materialId}` }, rationale: '表达更清晰' });
const result = (output: unknown) => ({ output, inputTokens: 10, outputTokens: 5 });
const config = { configurable: { thread_id: 'run' }, durability: 'sync' as const };
const initial = { input, workflowVersion: 'resume-recovery-v1', needsFacts: false };

test('SQLite reopen preserves generated output after validation interruption', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'resume-graph-'));
  let store = openCheckpointStore(join(dir, 'checkpoints.db'));
  let calls = 0;
  try {
    const generate = async () => { calls++; return result({ suggestions: [suggestion(1), suggestion(2)] }); };
    const graph = createResumableGraph({ checkpointer: store, generate, onStage: async stage => { if (stage === 'validating') throw new Error('process stopped'); } });
    await assert.rejects(graph.invoke(initial, config), /process stopped/);
    store.db.close();
    store = openCheckpointStore(join(dir, 'checkpoints.db'));
    const restored = await createResumableGraph({ checkpointer: store, generate }).invoke(null, config);
    assert.deepEqual(restored.suggestions, [suggestion(1), suggestion(2)]);
    assert.equal(calls, 1);
    assert.equal(restored.inputTokens, 10);
  } finally { store.db.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('facts interrupt persists through reopen and forwards only approved facts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'resume-facts-'));
  let store = openCheckpointStore(join(dir, 'checkpoints.db'));
  let calls = 0;
  try {
    const generate: Parameters<typeof createResumableGraph>[0]['generate'] = async (_input, feedback) => {
      calls++; assert.equal(feedback?.facts, '负责接口'); return result({ suggestions: [suggestion(1), suggestion(2)] });
    };
    const graph = createResumableGraph({ checkpointer: store, generate });
    await graph.invoke({ ...initial, needsFacts: true }, config);
    assert.equal(calls, 0);
    assert.ok((await graph.getState(config)).tasks[0].interrupts.length);
    store.db.close(); store = openCheckpointStore(join(dir, 'checkpoints.db'));
    const resumed = await createResumableGraph({ checkpointer: store, generate }).invoke(new Command({ resume: '负责接口' }), config);
    assert.equal(resumed.facts, '负责接口'); assert.equal(calls, 1);
  } finally { store.db.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('repairs only invalid items and preserves successful items and nullable usage', async () => {
  const store = openCheckpointStore(':memory:'); let calls = 0;
  try {
    const graph = createResumableGraph({ checkpointer: store, generate: async (requested, feedback) => {
      calls++;
      if (calls === 1) return result({ suggestions: [suggestion(1), { ...suggestion(2), proposedContent: { ...suggestion(2).proposedContent, techStack: ['Rust'] } }] });
      assert.deepEqual(requested.materials.map(item => item.materialId), [2]);
      assert.ok(feedback?.issues);
      assert.deepEqual((feedback?.previous as { suggestions: { materialId: number }[] }).suggestions.map(item => item.materialId), [2]);
      return { output: { suggestions: [suggestion(2)] }, inputTokens: null, outputTokens: 3 };
    } });
    const output = await graph.invoke(initial, config);
    assert.deepEqual(output.suggestions, [suggestion(1), suggestion(2)]);
    assert.equal(output.repairCount, 1); assert.equal(calls, 2);
    assert.equal(output.inputTokens, null); assert.equal(output.outputTokens, 8);
  } finally { store.db.close(); }
});

test('malformed output has one repair then original fallback', async () => {
  const store = openCheckpointStore(':memory:'); let calls = 0;
  try {
    const output = await createResumableGraph({ checkpointer: store, generate: async () => { calls++; return result('not JSON'); } }).invoke(initial, config);
    assert.equal(calls, 2); assert.deepEqual(output.fallbackMaterialIds, [1, 2]);
    assert.deepEqual(output.suggestions.map(item => item.proposedContent), input.materials.map(item => item.content));
    assert.match(output.suggestions[0].rationale, /未通过校验，保留原文/);
  } finally { store.db.close(); }
});

test('durable budget callback blocks a third request after recovery', async () => {
  const store = openCheckpointStore(':memory:'); let attempts = 0; let reservations = 0;
  try {
    const graph = createResumableGraph({ checkpointer: store, beforeCall: async () => { if (reservations >= 2) throw new Error('budget exhausted'); reservations++; }, generate: async () => { attempts++; throw new Error('network failed'); } });
    await assert.rejects(graph.invoke(initial, config), /network failed/);
    await assert.rejects(graph.invoke(null, config), /network failed/);
    await assert.rejects(graph.invoke(null, config), /budget exhausted/);
    assert.equal(attempts, 2);
  } finally { store.db.close(); }
});

test('duplicate and unknown IDs cannot replace valid output, and empty fields remain empty', () => {
  const validated = validatePartialSuggestions(input, { suggestions: [suggestion(1), suggestion(1), suggestion(2), { ...suggestion(1), materialId: 99 }] });
  assert.deepEqual(validated.failedMaterialIds, [1]);
  assert.deepEqual(validated.suggestions, [suggestion(2)]);
  assert.ok(validated.issues.some(issue => issue.materialId === 99));
  const empty: OptimizationPromptInput = { ...input, materials: [{ ...input.materials[0], content: { projectCategory: '后端', techStack: ['Java'], content: '' } }] };
  assert.deepEqual(validatePartialSuggestions(empty, { suggestions: [suggestion(1)] }).failedMaterialIds, [1]);
});

test('skip facts generates normally and excessive facts cannot reach the model', async () => {
  const store = openCheckpointStore(':memory:'); let calls = 0;
  try {
    const graph = createResumableGraph({ checkpointer: store, generate: async () => { calls++; return result({ suggestions: [suggestion(1), suggestion(2)] }); } });
    await graph.invoke({ ...initial, needsFacts: true }, config);
    await assert.rejects(graph.invoke(new Command({ resume: 'x'.repeat(4_001) }), config));
    assert.equal(calls, 0);
    const skipConfig = { ...config, configurable: { thread_id: 'skip' } };
    await graph.invoke({ ...initial, needsFacts: true }, skipConfig);
    const output = await graph.invoke(new Command({ resume: ' ' }), skipConfig);
    assert.equal(output.facts, ''); assert.equal(calls, 1);
  } finally { store.db.close(); }
});

test('exhausted durable budget finishes fallback after interrupted repair without losing good items', async () => {
  const store = openCheckpointStore(':memory:'); let calls = 0; let reservations = 0;
  try {
    const graph = createResumableGraph({ checkpointer: store, beforeCall: async () => { if (reservations >= 2) throw new ModelCallBudgetError(); reservations++; }, generate: async () => {
      calls++;
      if (calls === 1) return result({ suggestions: [suggestion(1)] });
      throw new Error('network failed');
    } });
    await assert.rejects(graph.invoke(initial, config), /network failed/);
    const recovered = await graph.invoke(null, config);
    assert.equal(calls, 2);
    assert.deepEqual(recovered.fallbackMaterialIds, [2]);
    assert.deepEqual(recovered.suggestions[0], suggestion(1));
    assert.deepEqual(recovered.suggestions[1].proposedContent, input.materials[1].content);
  } finally { store.db.close(); }
});

test('oversized prompt is rejected before any budget reservation', async () => {
  const store = openCheckpointStore(':memory:'); let calls = 0;
  try {
    const graph = createResumableGraph({ checkpointer: store, beforeCall: async () => { calls++; }, generate: async () => result(null) });
    await assert.rejects(graph.invoke({ ...initial, input: { ...input, jdText: 'x'.repeat(40_001) } }, config), /素材较长/);
    assert.equal(calls, 0);
  } finally { store.db.close(); }
});

test('completed checkpoint can be reconciled without repeating the model call', async () => {
  const store=openCheckpointStore(':memory:');
  let calls=0;
  try {
    const graph=createResumableGraph({checkpointer:store,generate:async()=>{calls++;return result({suggestions:[suggestion(1),suggestion(2)]});}});
    await graph.invoke(initial,config);
    const recovered=await graph.invoke(null,config);
    assert.equal(calls,1);
    assert.deepEqual(recovered.suggestions,[suggestion(1),suggestion(2)]);
  } finally {store.db.close();}
});
