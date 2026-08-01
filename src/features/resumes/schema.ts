import { z } from "zod";

export const resumeEntrySchema = z.object({
  type: z.enum(["profile", "education", "experience", "project", "skill"]),
  title: z.string().trim().min(1).max(120),
  content: z.record(z.string()),
});
