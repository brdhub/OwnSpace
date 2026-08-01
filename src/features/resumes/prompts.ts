import type { ResumeEntryType } from "@/features/resumes/constants";

export type FormalEntrySummary = {
  id: number;
  type: ResumeEntryType;
  title: string;
  content: Record<string, string>;
};

export type CandidatePromptInput = {
  extractedText: string;
  formalEntries: FormalEntrySummary[];
};

export type JdPromptInput = {
  targetRole: string;
  jdText: string;
  formalEntries: FormalEntrySummary[];
};

export type DeepSeekMessage = {
  role: "system" | "user";
  content: string;
};

export function buildCandidatePrompt(input: CandidatePromptInput): DeepSeekMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是严谨的中文简历信息整理助手。只整理输入文本中明确存在的事实，不补写数字、职责、技能、结果或业务规模。",
        "输出必须是合法 JSON，且只能包含 candidates 数组。每项必须包含 type、title、content、sourceExcerpt、similarEntryId。",
        "type 只能是 profile、education、experience、project、skill。sourceExcerpt 必须逐字来自简历原文。",
        "如与已有正式条目表达同一段经历，将 similarEntryId 设为对应 ID，否则设为 null。",
        "示例 JSON：{\"candidates\":[{\"type\":\"project\",\"title\":\"项目名称\",\"content\":{\"responsibility\":\"原文事实\"},\"sourceExcerpt\":\"原文片段\",\"similarEntryId\":null}]}",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        resumeText: input.extractedText,
        formalEntries: input.formalEntries,
      }),
    },
  ];
}

export function buildJdRecommendationPrompt(input: JdPromptInput): DeepSeekMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是严谨的简历与 JD 匹配助手。只能从给定正式条目中推荐，不修改条目内容，也不得返回列表外的 ID。",
        "输出必须是合法 JSON，且只能包含 recommendations 数组。每项包含 entryId、level、reason。",
        "level 只能是 high、medium、low；reason 必须说明条目与 JD 的具体关联。",
        "示例 JSON：{\"recommendations\":[{\"entryId\":1,\"level\":\"high\",\"reason\":\"直接覆盖岗位要求\"}]}",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        targetRole: input.targetRole,
        jdText: input.jdText,
        formalEntries: input.formalEntries,
      }),
    },
  ];
}
