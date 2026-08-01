import { z } from "zod";
import { planningEndDate, planningEventStatuses, planningEventTypes, planningStartDate } from "@/features/planning/constants";
import { isEventInPlanningRange } from "@/features/planning/utils";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效日期")
  .refine((value) => value >= planningStartDate && value <= planningEndDate && isEventInPlanningRange(value), `日期需要在 ${planningStartDate} 到 ${planningEndDate} 之间`);

export const planningEventFormSchema = z.object({
  title: z.string().trim().min(1, "请输入节点标题").max(100, "标题不要超过 100 个字符"),
  description: z.string().trim().max(1000, "说明不要超过 1000 个字符").optional().default(""),
  eventDate: dateSchema,
  eventType: z.enum(planningEventTypes, { required_error: "请选择节点类型" }),
  status: z.enum(planningEventStatuses, { required_error: "请选择状态" }).default("todo"),
});

export const planningEventIdSchema = z.object({
  id: z.coerce.number().int().positive("规划节点不存在"),
});

export const updatePlanningEventSchema = planningEventIdSchema.merge(planningEventFormSchema);
export type PlanningEventFormValues = z.infer<typeof planningEventFormSchema>;
