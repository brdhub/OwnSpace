import { z } from "zod";
import { interviewResults, interviewRounds } from "@/features/interviews/constants";

const questionInputSchema = z.object({
  question: z.string().trim().min(1, "请输入问题内容").max(1000, "问题内容不要超过 1000 个字符"),
  myAnswer: z.string().trim().max(4000, "回答不要超过 4000 个字符").optional().default(""),
  betterAnswer: z.string().trim().max(4000, "复盘答案不要超过 4000 个字符").optional().default(""),
});

export const interviewNoteInputSchema = z.object({
  applicationId: z.coerce.number().int().positive("请选择关联投递记录"),
  round: z.enum(interviewRounds, { required_error: "请选择面试轮次" }),
  interviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效的面试日期"),
  result: z.enum(interviewResults, { required_error: "请选择面试结果" }),
  summary: z.string().trim().max(4000, "整体记录不要超过 4000 个字符").optional().default(""),
  reflection: z.string().trim().max(4000, "复盘不要超过 4000 个字符").optional().default(""),
  nextAction: z.string().trim().max(1000, "下一步行动不要超过 1000 个字符").optional().default(""),
  tagIds: z.array(z.coerce.number().int().positive()).default([]),
  questions: z.array(questionInputSchema).default([]),
});

export const updateInterviewNoteInputSchema = interviewNoteInputSchema.extend({
  id: z.coerce.number().int().positive("面经记录不存在"),
});

export const interviewIdSchema = z.object({
  id: z.coerce.number().int().positive("面经记录不存在"),
});

export type InterviewNoteInput = z.infer<typeof interviewNoteInputSchema>;