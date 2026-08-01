import { z } from "zod";
import { journalEnergyOptions, journalMoodOptions } from "@/features/journal/constants";

const optionalText = (max: number, message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max, message).optional(),
  );

export const journalEntryFormSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效日期"),
  content: z.string().trim().min(1, "写下一句话也可以，正文不能为空").max(20000, "正文不要超过 20000 个字符"),
  mood: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(journalMoodOptions).optional(),
  ),
  energyLevel: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(journalEnergyOptions).optional(),
  ),
  completedToday: optionalText(1000, "今天完成了什么不要超过 1000 个字符"),
  tomorrowMinimumAction: optionalText(500, "明天最小行动不要超过 500 个字符"),
});

export const journalEntryDeleteSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效日期"),
});

export type JournalEntryFormValues = z.infer<typeof journalEntryFormSchema>;