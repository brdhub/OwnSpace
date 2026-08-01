import { z } from "zod";
import { studyCategories } from "@/features/study/constants";

const optionalInteger = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().int("请输入整数").min(0, "不能小于 0").optional(),
);

const optionalText = (max: number, message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max, message).optional(),
  );

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效日期");

export const studyCheckinSchema = z.object({
  checkinDate: dateSchema,
  category: z.enum(studyCategories),
  isCompleted: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean()),
  durationMinutes: optionalInteger,
  quantity: optionalInteger,
  title: optionalText(120, "主题不要超过 120 个字符"),
  notes: optionalText(1200, "笔记不要超过 1200 个字符"),
  sourceUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .trim()
      .url("请输入有效来源链接")
      .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "链接需要以 http:// 或 https:// 开头")
      .optional(),
  ),
});

export const studyQuickToggleSchema = z.object({
  checkinDate: dateSchema,
  category: z.enum(studyCategories),
  isCompleted: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean()),
});

export const studyCheckinDeleteSchema = z.object({
  checkinDate: dateSchema,
  category: z.enum(studyCategories),
});
