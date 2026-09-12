import { extractCandidatesWithGraph } from "./workflow/candidate-graph";
import { z } from "zod";
import {
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
  type OptimizationFeedback,
} from "@/features/resumes/prompts";

export type DeepSeekErrorCode =
  | "missing_config"
  | "network_error"
  | "provider_error"
  | "invalid_response";

function isOptimizableNarrativeField(type: OptimizationPromptInput["materials"][number]["type"], key: string) {
  switch (type) {
    case "project": return key === "content" || key === "responsibilities";
    case "experience": return key === "responsibilities" || key === "workContent";
    case "education": return key === "content";
    case "skill": return key === "content";
    case "honor": return false;
  }
}

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
    finish_reason: z.enum(["stop", "length"]),
    message: z.object({ content: z.string().nullable() }),
  })).length(1),
  usage: z.unknown().optional(),
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

export type DeepSeekDependencies = {
  fetch?: typeof fetch;
  env?: DeepSeekEnvironment;
};

type DeepSeekRequestOptions = {
  maxTokens?: number;
};

type ProviderResult = {
  output: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
  contentError?: string;
};

const tokenCountSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

function usageCount(value: unknown): number | null {
  const parsed = tokenCountSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function requestCompletion(
  messages: DeepSeekMessage[],
  dependencies: DeepSeekDependencies = {},
  options: DeepSeekRequestOptions = {},
): Promise<ProviderResult> {
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
        max_tokens: options.maxTokens ?? 4_000,
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
  const usage = z.object({ prompt_tokens: z.unknown(), completion_tokens: z.unknown() }).safeParse(envelope.usage);
  const counts = {
    inputTokens: usageCount(usage.success ? usage.data.prompt_tokens : undefined),
    outputTokens: usageCount(usage.success ? usage.data.completion_tokens : undefined),
  };
  const invalidContent = (code: string, message: string): ProviderResult => ({
    output: { diagnostic: { code, message }, raw: (choice.message.content ?? "").slice(0, 8_000) },
    ...counts,
    contentError: message,
  });
  if (choice.finish_reason === "length") {
    return invalidContent("truncated_content", "DeepSeek 返回内容不完整，请重试。");
  }
  if (!choice.message.content?.trim()) {
    return invalidContent("empty_content", "DeepSeek 未返回可用内容，请重试。");
  }

  try {
    return { output: JSON.parse(choice.message.content), ...counts };
  } catch {
    return invalidContent("invalid_json", "DeepSeek 返回的 JSON 无法解析，请重试。");
  }
}

async function requestJson(
  messages: DeepSeekMessage[],
  dependencies: DeepSeekDependencies = {},
  options: DeepSeekRequestOptions = {},
): Promise<unknown> {
  const result = await requestCompletion(messages, dependencies, options);
  if (result.contentError) throw new DeepSeekError("invalid_response", result.contentError, true);
  return result.output;
}

export async function requestOptimizationOnce(
  input: OptimizationPromptInput,
  feedback?: OptimizationFeedback,
  dependencies: DeepSeekDependencies = {},
): Promise<{ output: unknown; inputTokens: number | null; outputTokens: number | null }> {
  const { output, inputTokens, outputTokens } = await requestCompletion(buildEntryOptimizationPrompt(input, feedback), dependencies);
  return { output, inputTokens, outputTokens };
}

export async function generateEntryCandidates(
  input: CandidatePromptInput,
  dependencies: DeepSeekDependencies = {},
): Promise<GeneratedCandidate[]> {
  return (await generateEntryCandidatesDetailed(input, dependencies)).candidates;
}

export async function generateEntryCandidatesDetailed(
  input: CandidatePromptInput,
  dependencies: DeepSeekDependencies = {},
) {
  const result = await extractCandidatesWithGraph(input, feedback =>
    requestCompletion(buildCandidatePrompt(input, feedback), dependencies, { maxTokens: 8_000 }));
  if (!result.candidates.length && result.issues.length) {
    throw new DeepSeekError("invalid_response", `PDF 文本已读取，但候选整理未通过校验：${result.issues.slice(0, 3).map(issue => `${issue.path}：${issue.message}`).join("；")}。已有候选已保留。`, true);
  }
  return result;
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
      const originalContent = original.content as Record<string, string | string[]>;
      const proposedContent = suggestion.proposedContent as Record<string, string | string[]>;
      return originalKeys.every((key) => {
        const originalValue = originalContent[key];
        const proposedValue = proposedContent[key];
        if (Array.isArray(originalValue)) {
          return Array.isArray(proposedValue) && JSON.stringify(originalValue) === JSON.stringify(proposedValue);
        }
        if (!isOptimizableNarrativeField(original.type, key)) return proposedValue === originalValue;
        return originalValue !== "" || proposedValue === "";
      });
    });
    if (!preservesStructure) continue;

    return parsed.data.suggestions;
  }

  throw new DeepSeekError("invalid_response", "DeepSeek 连续返回了结构不完整的优化建议，请重试。", true);
}
