import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效的日期");

export const internshipRecordSchema = z.object({
  companyName: z.string().trim().min(1, "请输入企业名称").max(80, "企业名称不要超过 80 个字符"),
  startDate: dateSchema,
});

export const internshipEntrySchema = z.object({
  internshipRecordId: z.coerce.number().int().positive("实习记录不存在"),
  entryDate: dateSchema,
  title: z.string().trim().min(1, "请输入条目标题").max(120, "条目标题不要超过 120 个字符"),
  content: z.string().trim().max(3000, "条目内容不要超过 3000 个字符").optional().default(""),
});

export const internshipDepartureSchema = z.object({
  id: z.coerce.number().int().positive("实习记录不存在"),
});
