import { z } from "zod";

export const opportunityIdSchema = z.object({
  opportunityId: z.coerce.number().int().positive("企业机会不存在"),
});

export const opportunityFiltersSchema = z.object({
  query: z.string().trim().max(80).optional().default(""),
  companyType: z.string().trim().max(40).optional().default(""),
  city: z.string().trim().max(40).optional().default(""),
  unrestrictedMajor: z.enum(["", "true"]).optional().default(""),
});

export type OpportunityFilters = z.infer<typeof opportunityFiltersSchema>;
