import type { ResumeEntryType } from "@/features/resumes/constants";
import type { ResumeEntryContent } from "@/features/resumes/schema";

export type FormalEntrySummary = {
  id: number;
  type: ResumeEntryType;
  title: string;
  content: ResumeEntryContent;
  tags: string[];
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

export type OptimizationPromptInput = {
  targetRole: string;
  jdText: string;
  materials: Array<Omit<FormalEntrySummary, "id"> & { materialId: number }>;
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
        "输出必须是合法 JSON，且只能包含 candidates 数组。每项必须包含 type、title、content、tags、sourceExcerpt、similarEntryId。",
        "type 只能是 project、experience、education、skill、honor。sourceExcerpt 必须逐字来自简历原文。",
        "project 的 content 只能包含 projectCategory、techStack 数组、content；experience 只能包含 position、techStack 数组、responsibilities、workContent。",
        "education 的 content 只能包含 degree、major、dateRange、content；skill 只能包含 proficiency（了解、熟悉、熟练、精通）与 content；honor 只能包含 award。",
        "project、experience、education 的 tags 根据原文概括；skill 的 tags 只放技能名称；honor 的 tags 为空数组。",
        "如与已有正式条目表达同一段经历，将 similarEntryId 设为对应 ID，否则设为 null。",
        "示例 JSON：{\"candidates\":[{\"type\":\"project\",\"title\":\"项目名称\",\"content\":{\"projectCategory\":\"后端项目\",\"techStack\":[\"Java\"],\"content\":\"原文事实\"},\"tags\":[\"后端\"],\"sourceExcerpt\":\"原文片段\",\"similarEntryId\":null}]}",
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
        "必须逐一评估 formalEntries 中的每个条目，每个 ID 恰好返回一次；即使关联较弱也要返回 low，不能遗漏或添加条目。",
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

export function buildEntryOptimizationPrompt(input: OptimizationPromptInput): DeepSeekMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是严谨的中文简历描述优化助手。根据目标岗位与 JD，改善给定素材的表达，但必须完全保留原始事实边界。",
        "不得新增或猜测数字、技术、职责、业务规模、结果、团队贡献或个人贡献；不得把团队成果写成个人成果。",
        "必须逐一处理 materials 中的每项，每个 materialId 恰好返回一次，不得遗漏或添加 ID。",
        "每项 proposedContent 必须保留原 content 的全部字段键，不能新增、删除或重命名字段；原值为空的字段必须保持为空。",
        "输出必须是合法 JSON，且只能包含 suggestions 数组。每项包含 materialId、proposedContent、rationale。",
        "示例 JSON：{\"suggestions\":[{\"materialId\":1,\"proposedContent\":{\"responsibility\":\"优化后的真实描述\"},\"rationale\":\"突出与 JD 相关的行动\"}]}",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        targetRole: input.targetRole,
        jdText: input.jdText,
        materials: input.materials,
      }),
    },
  ];
}
