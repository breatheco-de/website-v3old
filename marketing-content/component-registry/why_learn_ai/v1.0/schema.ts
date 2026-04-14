/**
 * Why Learn AI Component Schemas - v1.0
 */
import { z } from "zod";
import { ctaButtonSchema } from "../../_common/schema";

export const whyLearnAISectionSchema = z.object({
  type: z.literal("why_learn_ai"),
  variant: z.enum(["default", "laptop-edge"]).optional(),
  title: z.string(),
  subtitle: z.string(),
  description: z.string(),
  cta: ctaButtonSchema.optional(),
  mobile_see_more: z.boolean().optional(),
  mobile_see_more_label: z.string().optional(),
});

export type WhyLearnAISection = z.infer<typeof whyLearnAISectionSchema>;
