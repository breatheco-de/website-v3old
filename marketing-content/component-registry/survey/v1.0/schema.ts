import { z } from "zod";
import { ctaButtonSchema } from "../../_common/schema";

const surveyActionSchema = z.object({
  url: z.string().optional(),
  message: z.string().optional(),
  next_question: z.union([z.string(), z.number()]).optional(),
});

export const surveyOptionSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  value: z.number().optional(),
  action: surveyActionSchema.optional(),
});

export const surveyQuestionSchema = z.object({
  id: z.string().optional(),
  subtitle: z.string().optional(),
  text: z.string(),
  options: z.array(surveyOptionSchema),
});

const ctaBlockSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  banner: z.boolean().optional(),
  buttons: z.array(ctaButtonSchema),
});

export const surveyDefaultSchema = z.object({
  aggregation_method: z.enum(["concat", "sum"]).optional().default("concat"),
  badge_text: z.string().optional(),
  title: z.string(),
  title_highlight: z.string().optional(),
  subtitle: z.string().optional(),
  icon: z.string().optional(),
  back_label: z.string().optional().default("Back"),
  restart_label: z.string().optional().default("Start over"),
  step_label: z.string().optional(),
  step_of_label: z.string().optional(),
  questions: z.array(surveyQuestionSchema),
  routes: z.unknown().optional(),
});

export type SurveyDefault = z.infer<typeof surveyDefaultSchema>;
