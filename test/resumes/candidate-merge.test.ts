import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCandidateMerge } from '../../src/features/resumes/candidate-merge';

const old = { type: 'project' as const, title: '项目', tags: ['后端'], content: { projectCategory: '后端', techStack: ['Java'], content: '原来的事实', responsibilities: '' } };
const incoming = { ...old, tags: ['数据库'], content: { projectCategory: '', techStack: ['Java', 'SQL'], content: '新的事实', responsibilities: '负责接口' } };

test('merge fills gaps and unions technology and tags without overwriting conflicting facts', () => {
  const result = buildCandidateMerge(old, incoming);
  assert.deepEqual(result.entry.content, { projectCategory: '后端', techStack: ['Java', 'SQL'], content: '原来的事实', responsibilities: '负责接口' });
  assert.deepEqual(result.entry.tags, ['后端', '数据库']);
  assert.ok(result.differences.some(item => item.key === 'content' && item.conflict));
  assert.equal(old.content.responsibilities, '');
});

test('explicit field choice can replace or supplement narrative but cannot concatenate fixed fields', () => {
  const appended = buildCandidateMerge(old, incoming, { content: 'append' }).entry;
  const replaced = buildCandidateMerge(old, incoming, { content: 'new' }).entry;
  assert.equal(appended.type, 'project');
  assert.equal(replaced.type, 'project');
  if (appended.type !== 'project' || replaced.type !== 'project') throw new Error('wrong type');
  assert.equal(appended.content.content, '原来的事实\n新的事实');
  assert.equal(replaced.content.content, '新的事实');
  assert.throws(() => buildCandidateMerge(old, incoming, { projectCategory: 'append' }));
});

test('merge refuses mismatched types and schema overflow instead of silently truncating', () => {
  assert.throws(() => buildCandidateMerge(old, { type: 'honor', title: '奖', tags: [], content: { award: '一等奖' } }));
  assert.throws(() => buildCandidateMerge(old, { ...incoming, content: { ...incoming.content, content: '新'.repeat(4000) } }, { content: 'append' }));
});
