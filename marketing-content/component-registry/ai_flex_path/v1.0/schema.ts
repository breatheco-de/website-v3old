import { z } from "zod";
import { ctaButtonSchema } from "../../_common/schema";

const skillSchema = z.object({
  name: z.string(),
  skill_percentage: z.number(),
});

export const aiFlexPathCourseSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  hrs: z.string(),
  tools: z.array(z.string()),
  skills: z.array(skillSchema),
});

const ctaBlockSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  banner: z.boolean().optional(),
  buttons: z.array(ctaButtonSchema),
});

export const aiFlexPathDefaultSchema = z.object({
  ready_label: z.string().optional().default("Your path is ready"),
  path_name: z.string(),
  tagline: z.string().optional(),
  results_subtitle: z.string().optional(),
  counter_label: z.string().optional().default("selected"),
  max_selections: z.number().optional().default(4),
  skills_breakdown_label: z.string().optional().default("Skills breakdown"),
  tools_label: z.string().optional().default("Tools in this path"),
  tools_marquee: z.boolean().optional(),
  icon: z.string().optional(),
  default_courses: z.array(z.string()),
  courses: z.array(aiFlexPathCourseSchema),
  cta: ctaBlockSchema,
});

export type AiFlexPathDefault = z.infer<typeof aiFlexPathDefaultSchema>;
