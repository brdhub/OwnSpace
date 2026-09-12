import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { generatedCandidateSchema, type GeneratedCandidate } from '../ai-schema';
import type { CandidatePromptInput, OptimizationFeedback } from '../prompts';
import { resumeEntryFingerprint } from '../dedupe';

type Issue = { path: string; message: string };
export type CandidateExtractionResult = { candidates: GeneratedCandidate[]; issues: Issue[]; callCount: number };
type Response = { output: unknown; contentError?: string };
const replace = <T>(fallback: () => T) => Annotation<T>({ reducer: (_old, next) => next, default: fallback });
const State = Annotation.Root({
  candidates: replace<GeneratedCandidate[]>(() => []),
  issues: replace<Issue[]>(() => []),
  failed: replace<unknown[]>(() => []),
  raw: replace<unknown>(() => null),
  contentError: replace(() => ''),
  callCount: replace(() => 0),
});

export async function extractCandidatesWithGraph(
  input: CandidatePromptInput,
  generate: (feedback?: OptimizationFeedback) => Promise<Response>,
): Promise<CandidateExtractionResult> {
  const source = input.extractedText.replace(/\s+/gu, ' ').trim();
  const request = async (state: typeof State.State) => {
    try {
      const response = await generate(state.callCount ? {
        previous: state.failed.length ? { candidates: state.failed } : state.raw,
        issues: state.issues,
      } : undefined);
      return { raw: response.output, contentError: response.contentError ?? '', callCount: state.callCount + 1 };
    } catch (error) {
      if (!state.candidates.length) throw error;
      return { raw: null, contentError: '修正请求失败，已保留本次通过校验的候选。', callCount: state.callCount + 1 };
    }
  };
  const graph = new StateGraph(State)
    .addNode('generate', request)
    .addNode('validate', state => {
      const envelope = z.object({ candidates: z.array(z.unknown()).max(100) }).safeParse(state.raw);
      if (state.contentError || !envelope.success) return {
        issues: [{ path: '$', message: state.contentError || '返回结果必须包含 candidates 数组（最多 100 条）。' }],
      };
      const candidates = [...state.candidates];
      const fingerprints = new Set(candidates.map(resumeEntryFingerprint));
      const issues: Issue[] = [];
      const failed: unknown[] = [];
      if (state.callCount > 1 && state.failed.length && envelope.data.candidates.length > state.failed.length) {
        return { issues: [{ path: 'candidates', message: '修正返回了额外条目，已保留此前合格项，请核对原文。' }] };
      }
      if (state.callCount > 1 && state.failed.length && envelope.data.candidates.length !== state.failed.length) {
        issues.push({ path: 'candidates', message: '修正条目数量与失败条目数量不一致，请核对原文是否遗漏。' });
      }
      envelope.data.candidates.forEach((raw, index) => {
        const parsed = generatedCandidateSchema.safeParse(raw);
        const local: Issue[] = [];
        if (!parsed.success) {
          local.push(...parsed.error.issues.map(issue => ({ path: `candidates.${failed.length}.${issue.path.join('.')}`, message: issue.message })));
        } else {
          const candidate = parsed.data;
          const entry = input.formalEntries.find(entry => entry.id === candidate.similarEntryId);
          if (candidate.similarEntryId !== null && (!entry || entry.type !== candidate.type)) {
            local.push({ path: `candidates.${failed.length}.similarEntryId`, message: '必须是 formalEntries 中同类型条目的 ID 或 null。' });
          }
          if (!source.includes(candidate.sourceExcerpt.replace(/\s+/gu, ' ').trim())) {
            local.push({ path: `candidates.${failed.length}.sourceExcerpt`, message: '引用必须来自 resumeText 的连续原文（仅允许空白差异），不可概括或拼接。' });
          }
          if (!local.length) {
            const fingerprint = resumeEntryFingerprint(candidate);
            if (state.callCount > 1 && fingerprints.has(fingerprint)) {
              local.push({ path: `candidates.${failed.length}`, message: '修正重复返回已合格条目，原失败项仍需核对。' });
            } else if (!fingerprints.has(fingerprint)) candidates.push(candidate);
            fingerprints.add(fingerprint);
          }
        }
        if (local.length) {
          failed.push(raw);
          issues.push(...local.map(issue => ({ ...issue, message: `第 ${index + 1} 条：${issue.message}` })));
        }
      });
      return { candidates, issues, failed };
    })
    .addNode('repair', request)
    .addEdge(START, 'generate').addEdge('generate', 'validate')
    .addConditionalEdges('validate', state => state.issues.length && state.callCount < 2 ? 'repair' : END, ['repair', END])
    .addEdge('repair', 'validate').compile();
  const result = await graph.invoke({});
  return { candidates: result.candidates, issues: result.issues, callCount: result.callCount };
}
