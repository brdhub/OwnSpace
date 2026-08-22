import { z } from "zod";
import { applicationStatuses } from "@/config/application-status";
import { companySizes, internshipTypes } from "@/features/applications/constants";

export const applicationFormSchema = z.object({
  opportunityId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().positive("企业机会不存在").optional(),
  ),
  company: z.string().trim().min(1, "请输入公司名称").max(80, "公司名称不要超过 80 个字符"),
  role: z.string().trim().min(1, "请输入岗位名称").max(100, "岗位名称不要超过 100 个字符"),
  source: z.string().trim().min(1, "请输入投递渠道").max(80, "投递渠道不要超过 80 个字符"),
  status: z.enum(applicationStatuses, { required_error: "请选择当前状态" }),
  internshipType: z.enum(internshipTypes, { required_error: "请选择实习类型" }).default("daily"),
  companySize: z.enum(companySizes, { required_error: "请选择厂型" }).default("medium"),
  appliedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效的投递日期"),
  interviewTime: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "请选择有效的面试时间").optional(),
  ),
  applicationUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .trim()
      .url("请输入有效的网址")
      .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "网址需要以 http:// 或 https:// 开头")
      .optional(),
  ),
  jobDescription: z.string().trim().max(20_000, "岗位描述不要超过 20000 个字符").optional().default(""),
  notes: z.string().trim().max(1000, "备注不要超过 1000 个字符").optional().default(""),
});

export const applicationIdSchema = z.object({
  id: z.coerce.number().int().positive("记录不存在"),
});

export const updateApplicationSchema = applicationIdSchema.merge(applicationFormSchema);

export const updateApplicationStatusSchema = applicationIdSchema.merge(
  z.object({
    status: z.enum(applicationStatuses, { required_error: "请选择当前状态" }),
  }),
);

export type ApplicationFormValues = z.infer<typeof applicationFormSchema>;
