import { z } from 'zod';
import { MAX_FILE_BYTES, parseRepositoryUrl, type RepositorySnapshot, type SourceFile } from './contracts';

// Only regular, small text files in the user-selected repository can reach the model.
export function allowedPath(path: string) {
  return path.length <= 300 && !path.split('/').some(part => ['..', '.', 'node_modules', 'vendor', '.git', 'dist', 'build', '.next', 'coverage'].includes(part))
    && !/(^|\/)(\.env[^/]*|[^/]*(?:secret|credential|private.?key)[^/]*|(?:package-lock|pnpm-lock|yarn\.lock|bun\.lock)[^/]*)$/i.test(path)
    && /\.(?:md|txt|json|ya?ml|toml|xml|ts|tsx|js|jsx|mjs|py|java|go|rs|sql|prisma|c|cpp|h|cs|rb|php|vue|svelte)$/i.test(path);
}
export function isImplementation(path: string) {return /\.(?:ts|tsx|js|jsx|mjs|py|java|go|rs|sql|prisma|c|cpp|h|cs|rb|php|vue|svelte)$/i.test(path);}

export function createGithubClient(reserveRequest: () => void, fetcher: typeof fetch = fetch) {
  async function get(path: string, maxBytes: number): Promise<unknown> {
    reserveRequest();
    const response = await fetcher(`https://api.github.com${path}`, {headers: {Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}, redirect: 'error', signal: AbortSignal.timeout(20_000), cache: 'no-store'});
    if (!response.ok) throw new Error(response.status === 404 ? '仓库不存在或不是公开仓库。' : response.status === 403 || response.status === 429 ? 'GitHub 请求额度不足，请稍后手动恢复。' : `GitHub 读取失败（${response.status}），可稍后恢复。`);
    if (!response.body) throw new Error('GitHub 返回空响应。');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > maxBytes) {await reader.cancel(); throw new Error('仓库内容超过本次读取大小限制。');}
        chunks.push(part.value);
      }
    } finally {reader.releaseLock();}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  return {
    async inspect(url: string): Promise<RepositorySnapshot> {
      const repository = parseRepositoryUrl(url);
      const root = `/repos/${repository.owner}/${repository.repo}`;
      const meta = z.object({private: z.literal(false), default_branch: z.string(), description: z.string().nullable()}).parse(await get(root, 100_000));
      const commit = z.object({sha: z.string().regex(/^[a-f0-9]{40}$/)}).parse(await get(`${root}/commits/${encodeURIComponent(meta.default_branch)}`, 1_000_000));
      const tree = z.object({truncated: z.boolean(), tree: z.array(z.object({path: z.string(), mode: z.string(), type: z.string(), sha: z.string().regex(/^[a-f0-9]{40}$/), size: z.number().optional()}))}).parse(await get(`${root}/git/trees/${commit.sha}?recursive=1`, 8_000_000));
      if (tree.truncated) throw new Error('仓库目录过大，无法完整分析；请使用较小的独立项目仓库。');
      const eligible = tree.tree.filter(item => item.type === 'blob' && item.mode === '100644' && (item.size ?? Infinity) <= MAX_FILE_BYTES && allowedPath(item.path));
      if (eligible.length > 1500) throw new Error('可读取文件超过 1500 个，请选择较小的独立项目仓库。');
      return {...repository, commit: commit.sha, description: meta.description?.slice(0, 1000) ?? '', files: eligible.map(item => ({path: item.path, sha: item.sha, size: item.size!})), omitted: tree.tree.filter(item => item.type === 'blob').length - eligible.length};
    },
    async read(repository: RepositorySnapshot, path: string): Promise<SourceFile> {
      const file = repository.files.find(item => item.path === path);
      if (!file || !allowedPath(path)) throw new Error('只能读取当前仓库目录中允许的文件。');
      const blob = z.object({encoding: z.literal('base64'), content: z.string(), size: z.number().max(MAX_FILE_BYTES)}).parse(await get(`/repos/${repository.owner}/${repository.repo}/git/blobs/${file.sha}`, MAX_FILE_BYTES * 2 + 5000));
      const bytes = Buffer.from(blob.content, 'base64');
      if (bytes.length > MAX_FILE_BYTES || bytes.includes(0)) throw new Error('文件过大或为二进制文件，已跳过。');
      const text = new TextDecoder('utf-8', {fatal: true}).decode(bytes).replace(/\r\n/g, '\n');
      if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,}|\bsk-[A-Za-z0-9]{24,}/.test(text)) throw new Error('文件疑似含密钥，已阻止读取。');
      return {path, text};
    },
  };
}
export type GithubClient = ReturnType<typeof createGithubClient>;
