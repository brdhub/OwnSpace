import { resumeEntrySchema, type ResumeEntryInput } from './schema';

export type MergeChoice = 'old' | 'new' | 'append';
export type MergeEntry = Pick<ResumeEntryInput, 'type' | 'title' | 'content' | 'tags'>;
export const candidateFieldLabels: Record<string, string> = {
  title: '标题', tags: '标签', projectCategory: '项目分类', techStack: '技术栈', content: '内容',
  responsibilities: '个人职责', position: '岗位', workContent: '工作内容', projects: '实习项目',
  degree: '学历', major: '专业', dateRange: '就读时间', proficiency: '掌握程度', award: '奖项',
};
const narrative = new Set(['content', 'responsibilities', 'workContent']);
const empty = (value: unknown) => value === undefined || value === '' || (Array.isArray(value) && !value.length);
export function formatCandidateValue(value: unknown): string {
  if (empty(value)) return '（空）';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : `${item.name}\n${item.content}\n${item.responsibilities}`).join('\n');
  return String(value);
}

export function buildCandidateMerge(
  old: MergeEntry,
  incoming: MergeEntry,
  choices: Record<string, MergeChoice> = {},
) {
  if (old.type !== incoming.type) throw new Error('只能补充到同类型条目。');
  const previous: Record<string, unknown> = { title: old.title, tags: old.tags, ...old.content };
  const next: Record<string, unknown> = { title: incoming.title, tags: incoming.tags, ...incoming.content };
  const merged = { ...previous };
  const differences: Array<{ key: string; oldValue: unknown; newValue: unknown; conflict: boolean; canAppend: boolean }> = [];
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    const before = previous[key];
    const after = next[key];
    const canAppend = narrative.has(key);
    if (choices[key] === 'append' && !canAppend) throw new Error('该字段不支持拼接。');
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    differences.push({ key, oldValue: before, newValue: after, conflict: !empty(before) && !empty(after), canAppend });
    if (choices[key] === 'old') continue;
    if (choices[key] === 'new') merged[key] = after;
    else if (choices[key] === 'append') merged[key] = [...new Set([before, after].filter(value => !empty(value)))].join('\n');
    else if ((key === 'techStack' || key === 'tags') && Array.isArray(before) && Array.isArray(after)) merged[key] = [...new Set([...before, ...after])];
    else if (empty(before) && !empty(after)) merged[key] = after;
  }
  const { title, tags, ...content } = merged;
  return { entry: resumeEntrySchema.parse({ type: old.type, title, tags, content }), differences };
}
