import { z } from "zod";
import {
  generatedCandidateResponseSchema,
  entryOptimizationResponseSchema,
  type EntryOptimizationSuggestion,
  jdRecommendationResponseSchema,
  type GeneratedCandidate,
  type JdRecommendation,
} from "@/features/resumes/ai-schema";
import {
  buildCandidatePrompt,
  buildEntryOptimizationPrompt,
  buildJdRecommendationPrompt,
  type CandidatePromptInput,
  type DeepSeekMessage,
  type JdPromptInput,
  type OptimizationPromptInput,
} from "@/features/resumes/prompts";

export type DeepSeekErrorCode =
  | "missing_config"
  | "network_error"
  | "provider_error"
  | "invalid_response";

export class DeepSeekError extends Error {
  constructor(
    public readonly code: DeepSeekErrorCode,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "DeepSeekError";
  }
}

export type DeepSeekConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

export type DeepSeekEnvironment = Readonly<Record<string, string | undefined>>;

const providerEnvelopeSchema = z.object({
  choices: z.array(z.object({
    finish_reason: z.string(),
    message: z.object({ content: z.string().nullable() }),
  })).min(1),
});

export function getDeepSeekConfig(env: DeepSeekEnvironment = process.env): DeepSeekConfig {
  const apiKey = env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new DeepSeekError("missing_config", "尚未配置 DeepSeek API Key，请在本机 .env.local 中设置 DEEPSEEK_API_KEY。", false);
  }

  const baseUrl = (env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash";
  const parsedTimeout = Number(env.DEEPSEEK_TIMEOUT_MS ?? "30000");
  const timeoutMs = Number.isInteger(parsedTimeout) && parsedTimeout >= 1_000 && parsedTimeout <= 120_000
    ? parsedTimeout
    : 30_000;

  return { apiKey, baseUrl, model, timeoutMs };
}

type DeepSeekDependencies = {
  fetch?: typeof fetch;
  env?: DeepSeekEnvironment;
};

async function requestJson(
  messages: DeepSeekMessage[],
  dependencies: DeepSeekDependencies = {},
): Promise<unknown> {
  const config = getDeepSeekConfig(dependencies.env);
  const fetcher = dependencies.fetch ?? fetch;
  let response: Response;

  try {
    response = await fetcher(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        stream: false,
        max_tokens: 4_000,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    if (error instanceof DeepSeekError) throw error;
    throw new DeepSeekError("network_error", "DeepSeek 请求失败或超时，请稍后重试。", true);
  }

  if (!response.ok) {
    throw new DeepSeekError("provider_error", `DeepSeek 服务暂时不可用（HTTP ${response.status}），请稍后重试。`, true);
  }

  let envelope: z.infer<typeof providerEnvelopeSchema>;
  try {
    envelope = providerEnvelopeSchema.parse(await response.json());
  } catch {
    throw new DeepSeekError("invalid_response", "DeepSeek 返回格式异常，请重试。", true);
  }

  const choice = envelope.choices[0];
  if (choice.finish_reason === "length") {
    throw new DeepSeekError("invalid_response", "DeepSeek 返回内容不完整，请重试。", true);
  }
  if (!choice.message.content?.trim()) {
    throw new DeepSeekError("invalid_response", "DeepSeek 未返回可用内容，请重试。", true);
  }

  try {
    return JSON.parse(choice.message.content);
  } catch {
    throw new DeepSeekError("invalid_response", "DeepSeek 返回的 JSON 无法解析，请重试。", true);
  }
}

export async function generateEntryCandidates(
  input: CandidatePromptInput,
  dependencies: DeepSeekDependencies = {},
): Promise<GeneratedCandidate[]> {
  const allowedIds = new Set(input.formalEntries.map((entry) => entry.id));
  const messages = buildCandidatePrompt(input);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await requestJson(messages, dependencies);
    const parsed = generatedCandidateResponseSchema.safeParse(raw);
    if (!parsed.success) continue;
    if (parsed.data.candidates.some((candidate) => candidate.similarEntryId !== null && !allowedIds.has(candidate.similarEntryId))) continue;
    return parsed.data.candidates;
  }

  throw new DeepSeekError("invalid_response", "DeepSeek 连续返回了不符合要求的候选条目，请重试。", true);
}

export async function recommendEntriesForJd(
  input: JdPromptInput,
  dependencies: DeepSeekDependencies = {},
): Promise<JdRecommendation[]> {
  const allowedIds = new Set(input.formalEntries.map((entry) => entry.id));
  const messages = buildJdRecommendationPrompt(input);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await requestJson(messages, dependencies);
    const parsed = jdRecommendationResponseSchema.safeParse(raw);
    if (!parsed.success) continue;

    const returnedIds = new Set(parsed.data.recommendations.map((recommendation) => recommendation.entryId));
    const coversEveryEntry = returnedIds.size === allowedIds.size
      && [...allowedIds].every((entryId) => returnedIds.has(entryId));
    if (!coversEveryEntry) continue;

    return parsed.data.recommendations;
  }

  throw new DeepSeekError("invalid_response", "DeepSeek 连续返回了不完整的 JD 推荐，请重试。", true);
}

export async function optimizeEntriesForJd(
  input: OptimizationPromptInput,
  dependencies: DeepSeekDependencies = {},
): Promise<EntryOptimizationSuggestion[]> {
  const materialById = new Map(input.materials.map((material) => [material.materialId, material]));
  const messages = buildEntryOptimizationPrompt(input);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await requestJson(messages, dependencies);
    const parsed = entryOptimizationResponseSchema.safeParse(raw);
    if (!parsed.success) continue;

    const returnedIds = new Set(parsed.data.suggestions.map((suggestion) => suggestion.materialId));
    const coversEveryMaterial = returnedIds.size === materialById.size
      && [...materialById.keys()].every((materialId) => returnedIds.has(materialId));
    if (!coversEveryMaterial) continue;

    const preservesStructure = parsed.data.suggestions.every((suggestion) => {
      const original = materialById.get(suggestion.materialId);
      if (!original) return false;
      const originalKeys = Object.keys(original.content).sort();
      const proposedKeys = Object.keys(suggestion.proposedContent).sort();
      if (originalKeys.length !== proposedKeys.length
        || originalKeys.some((key, index) => key !== proposedKeys[index])) return false;
      return originalKeys.every((key) => original.content[key] !== "" || suggestion.proposedContent[key] === "");
    });
    if (!preservesStructure) continue;

    return parsed.data.suggestions;
  }

  throw new DeepSeekError("invalid_response", "DeepSeek 连续返回了结构不完整的优化建议，请重试。", true);
}
