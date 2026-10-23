import { z } from 'zod';

export const MAX_MODEL_CALLS = 10;
export const MAX_GITHUB_REQUESTS = 20;
export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 24_000;
export const MAX_TOTAL_CHARS = 80_000;
export const WORKFLOW_VERSION = 'github-resume-v1';

export function parseRepositoryUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) throw new Error('请填写 https://github.com/作者/仓库 格式的公开仓库地址。');
  const match = /^\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/?$/.exec(url.pathname);
  if (!match || /^\.+$/.test(match[2])) throw new Error('请填写仓库主页地址，不包含文件或分支路径。');
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  if (!repo || /^\.+$/.test(repo)) throw new Error('仓库名称无效。');
  return {owner, repo, url: `https://github.com/${owner}/${repo}`};
}

export const startSchema = z.object({
  repositoryUrl: z.string().trim().max(300).refine(value => {try {parseRepositoryUrl(value); return true;} catch {return false;}}, '请输入公开 GitHub 仓库主页地址。'),
  targetRole: z.string().trim().min(1, '请填写目标岗位。').max(120),
  jdText: z.string().trim().max(20_000),
  consent: z.literal('on', {errorMap: () => ({message: '请确认读取仓库并将选定代码发送给模型。'})}),
});
export type GithubInput = z.infer<typeof startSchema>;
export type RepositorySnapshot = {owner: string; repo: string; url: string; commit: string; description: string; files: {path: string; sha: string; size: number}[]; omitted: number};
export type SourceFile = {path: string; text: string};
export const evidenceSchema = z.object({
  path: z.string().min(1).max(300), startLine: z.number().int().positive(), endLine: z.number().int().positive(), quote: z.string().min(4).max(2000),
}).strict();
export const draftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  projectCategory: z.string().trim().min(1).max(200),
  techStack: z.array(z.string().trim().min(1).max(80)).max(20),
  bullets: z.array(z.object({text: z.string().trim().min(1).max(800), evidence: z.array(evidenceSchema).min(1).max(3)}).strict()).min(1).max(4),
  rationale: z.string().trim().min(1).max(1000),
}).strict();
export type GithubDraft = z.infer<typeof draftSchema>;
export type GithubView = {repository: RepositorySnapshot | null; files: SourceFile[]; plan: string[]; events: string[]; question: string | null; facts: string; draft: GithubDraft | null};

const object = (properties: object, required = Object.keys(properties)) => ({type: 'object', properties, required, additionalProperties: false});
const string = {type: 'string'};
const evidence = object({path: string, startLine: {type: 'integer'}, endLine: {type: 'integer'}, quote: string});
const tool = (name: string, description: string, parameters: unknown) => ({type: 'function', function: {name, description, parameters}});
export const githubTools = [
  tool('write_plan', '制定简短的项目分析计划。读取代码前先规划。', object({steps: {type: 'array', items: string, minItems: 1, maxItems: 5}})),
  tool('read_repository_files', '从目录中选择文件批量读取；每批最多3个，总计最多10个。只读取与JD有关的说明、依赖和实现代码。', object({paths: {type: 'array', items: string, minItems: 1, maxItems: 3}})),
  tool('request_user_facts', '读取实现代码后，询问用户实际贡献与可确认成果。提交草稿前必须询问一次，最多两次。', object({question: string})),
  tool('propose_resume_entry', '提交项目草稿。每条描述引用已读取文件的完整连续原文行，行号从1开始。个人职责由系统另行保存用户原话，不得把项目实现等同于个人贡献。', object({title: string, projectCategory: string, techStack: {type: 'array', items: string}, bullets: {type: 'array', items: object({text: string, evidence: {type: 'array', items: evidence}})}, rationale: string})),
];

export function validateDraft(raw: unknown, files: SourceFile[]): GithubDraft {
  const draft = draftSchema.parse(raw);
  for (const bullet of draft.bullets) for (const ref of bullet.evidence) {
    const file = files.find(item => item.path === ref.path);
    const lines = file?.text.split('\n');
    if (!lines || ref.endLine < ref.startLine || ref.endLine > lines.length || ref.endLine - ref.startLine > 60 || lines.slice(ref.startLine - 1, ref.endLine).join('\n').trim() !== ref.quote.trim()) throw new Error('引用必须准确对应已读取文件的连续原文行，请核对路径、行号与原文。');
  }
  return draft;
}

export function sourceUrl(repository: RepositorySnapshot, path: string, start: number, end: number) {
  return `${repository.url}/blob/${repository.commit}/${path.split('/').map(encodeURIComponent).join('/')}#L${start}-L${end}`;
}
