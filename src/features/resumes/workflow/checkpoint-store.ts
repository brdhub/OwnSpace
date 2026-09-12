import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';

export function openCheckpointStore(path: string): SqliteSaver {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const saver = SqliteSaver.fromConnString(path);
  saver.db.pragma('journal_mode = WAL');
  saver.db.pragma('busy_timeout = 5000');
  return saver;
}

const globalStore = globalThis as typeof globalThis & { resumeCheckpointStore?: SqliteSaver };

export function getCheckpointStore(): SqliteSaver {
  if (typeof window !== 'undefined') throw new Error('检查点仅可在服务端访问。');
  return globalStore.resumeCheckpointStore ??= openCheckpointStore(join(process.cwd(), 'data', 'langgraph-checkpoints.db'));
}
