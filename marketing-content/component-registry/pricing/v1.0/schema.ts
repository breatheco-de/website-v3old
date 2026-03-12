/**
 * Pricing Component Schemas - v1.0
 */
import { z } from "zod";
import { ctaButtonSchema } from "../../_common/schema";

export const pricingFeatureSchema = z.object({
  icon: z.string().optional(),
  text: z.string(),
  use_rigobot_icon: z.boolean().optional(),
});

export const pricingPlanSchema = z.object({
  discount_badge: z.string(),
  price: z.string(),
  period: z.string(),
  original_price: z.string().optional(),
  savings_badge: z.string().optional(),
});

// Default variant - monthly/yearly pricing toggle
export const pricingDefaultSchema = z.object({
  type: z.literal("pricing"),
  version: z.string().optional(),
  variant: z.literal("default").optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  monthly: pricingPlanSchema,
  yearly: pricingPlanSchema,
  tech_icons: z.array(z.string()).optional(),
  static_icons: z.boolean().optional(),
  features_title: z.string().optional(),
  features: z.array(pricingFeatureSchema),
  cta: ctaButtonSchema,
});

// Product variant - financing focused pricing
export const pricingProductSchema = z.object({
  type: z.literal("pricing"),
  version: z.string().optional(),
  variant: z.literal("product"),
  title: z.string(),
  subtitle: z.string().optional(),
  discount_text: z.string().optional(),
  financing_text: z.string().optional(),
  financing_amount: z.string().optional(),
  financing_period: z.string().optional(),
  tech_icons: z.array(z.string()).optional(),
  static_icons: z.boolean().optional(),
  features_title: z.string().optional(),
  features: z.array(pricingFeatureSchema),
  cta: ctaButtonSchema,
});

// Union of all pricing variants
export const pricingSectionSchema = z.union([
  pricingDefaultSchema,
  pricingProductSchema,
]);

export type PricingFeature = z.infer<typeof pricingFeatureSchema>;
export type PricingPlan = z.infer<typeof pricingPlanSchema>;
export type PricingSection = z.infer<typeof pricingSectionSchema>;
