import { z } from "zod";
import { ctaButtonSchema } from "../../_common/schema";

// ─── Shared sub-schemas ────────────────────────────────────────────────────────

const trustNoteSchema = z.object({
  image_id: z.string().optional(),
  initials: z.string(),
  message: z.string(),
});

const summaryRowSchema = z.object({
  label: z.string(),
  value: z.string().optional(),
  show_dynamic_program: z.boolean().optional(),
  show_dynamic_date: z.boolean().optional(),
});

export const enrollmentSummarySchema = z.object({
  price_label: z.string(),
  price_amount: z.string(),
  price_period: z.string().optional(),
  price_sub: z.string().optional(),
  rows: z.array(summaryRowSchema).default([]),
  cta: ctaButtonSchema,
  trust_note: trustNoteSchema.optional(),
});

const benefitSchema = z.object({
  icon: z.string().optional(),
  title: z.string(),
  desc: z.string(),
});

const unlockSchema = z.object({
  icon: z.string().optional(),
  text: z.string(),
});

const selectionCardSchema = z.object({
  name: z.string(),
  duration: z.string(),
  badge: z.string().optional(),
  icon: z.string().optional(),
});

// ─── Date configuration ────────────────────────────────────────────────────────

const staticDateItemSchema = z.object({
  date_iso: z.string(),
  label: z.string().optional(),
  year: z.string().optional(),
  note: z.string().optional(),
  /** Querystring-only URL like "?cohort=sept-2026" merged into the current page URL on click */
  url: z.string().optional(),
});

const staticDatesSchema = z.object({
  mode: z.literal("static"),
  items: z.array(staticDateItemSchema),
});

const intervalDatesSchema = z.object({
  mode: z.literal("interval"),
  start_date_iso: z.string(),
  interval: z.number(),
  interval_unit: z.enum(["days", "weeks", "months"]),
  /** Querystring-only URL like "?cohort=rolling" merged into the current page URL on click */
  url: z.string().optional(),
});

export const enrollmentDatesSchema = z.discriminatedUnion("mode", [
  staticDatesSchema,
  intervalDatesSchema,
]);

// ─── Plan ─────────────────────────────────────────────────────────────────────

export const enrollmentPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string().optional(),
  currency: z.string(),
  amount: z.string(),
  period: z.string(),
  billing_note: z.string().optional(),
  tag: z.string().optional(),
  featured: z.boolean().optional(),
  summary: enrollmentSummarySchema,
  benefits: z.array(benefitSchema).optional(),
  unlocks: z.array(unlockSchema).optional(),
});

// ─── Program ──────────────────────────────────────────────────────────────────

export const enrollmentProgramSchema = z.object({
  id: z.string(),
  selection_card: selectionCardSchema,
  summary: enrollmentSummarySchema,
  benefits: z.array(benefitSchema).default([]),
  unlocks: z.array(unlockSchema).default([]),
  dates: enrollmentDatesSchema.optional(),
  plans: z.array(enrollmentPlanSchema).optional(),
});

// ─── Root schema ──────────────────────────────────────────────────────────────

export const enrollmentSelectorDefaultSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  choose_program_label: z.string().optional(),
  choose_date_label: z.string().optional(),
  choose_plan_label: z.string().optional(),
  included_label: z.string().optional(),
  programs: z.array(enrollmentProgramSchema),
});

// ─── Section schema (adds type/version/variant for SectionRenderer union) ─────

export const enrollmentSelectorSectionSchema = enrollmentSelectorDefaultSchema.extend({
  type: z.literal("enrollment_selector"),
  version: z.string().optional().default("1.0"),
  variant: z.enum(["default"]).optional().default("default"),
});

export type EnrollmentSelectorDefault = z.infer<typeof enrollmentSelectorDefaultSchema>;
export type EnrollmentSelectorSection = z.infer<typeof enrollmentSelectorSectionSchema>;
export type EnrollmentSelectorProgram = z.infer<typeof enrollmentProgramSchema>;
export type EnrollmentSelectorPlan = z.infer<typeof enrollmentPlanSchema>;
export type EnrollmentSummary = z.infer<typeof enrollmentSummarySchema>;
