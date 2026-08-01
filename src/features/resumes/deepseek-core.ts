import { z } from "zod";
import {
  generatedCandidateResponseSchema,
  jdRecommendationResponseSchema,
  type GeneratedCandidate,
  type JdRecommendation,
} from "@/features/resumes/ai-schema";
import {
  buildCandidatePrompt,
  buildJdRecommendationPrompt,
  type CandidatePromptInput,
  type DeepSeekMessage,
  type JdPromptInput,
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

const providerEnvelopeSchema = z.object({
  choices: z.array(z.object({
    finish_reason: z.string(),
    message: z.object({ content: z.string().nullable() }),
  })).min(1),
});

export function getDeepSeekConfig(env: NodeJS.ProcessEnv = process.env): DeepSeekConfig {
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
  env?: NodeJS.ProcessEnv;
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
  const raw = await requestJson(buildCandidatePrompt(input), dependencies);
  const parsed = generatedCandidateResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DeepSeekError("invalid_response", "DeepSeek 返回的候选条目不符合要求，请重试。", true);
  }

  const allowedIds = new Set(input.formalEntries.map((entry) => entry.id));
  if (parsed.data.candidates.some((candidate) => candidate.similarEntryId !== null && !allowedIds.has(candidate.similarEntryId))) {
    throw new DeepSeekError("invalid_response", "DeepSeek 返回了不存在的重复条目，请重试。", true);
  }

  return parsed.data.candidates;
}

export async function recommendEntriesForJd(
  input: JdPromptInput,
  dependencies: DeepSeekDependencies = {},
): Promise<JdRecommendation[]> {
  const raw = await requestJson(buildJdRecommendationPrompt(input), dependencies);
  const parsed = jdRecommendationResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DeepSeekError("invalid_response", "DeepSeek 返回的 JD 推荐不符合要求，请重试。", true);
  }

  const allowedIds = new Set(input.formalEntries.map((entry) => entry.id));
  if (parsed.data.recommendations.some((recommendation) => !allowedIds.has(recommendation.entryId))) {
    throw new DeepSeekError("invalid_response", "DeepSeek 返回了不存在的简历条目，请重试。", true);
  }

  return parsed.data.recommendations;
}
