/**
 * E-commerce domain types.
 * These are the canonical contracts used by ecommerce-index, ecommerce-manager,
 * ecommerce-resolver, and the REST routes.
 */

export interface EcommercePlan {
  plan_id: string;
  name: string;
  price: number;
  currency: string;
  billing_period: "monthly" | "annual" | "one_time";
  highlighted: boolean;
  badge?: string;
  trial_days?: number;
  features: string[];
}

export interface EcommerceProduct {
  product_id: string;
  name: string;
  content_type: string;
  content_slug: string;
  plans: string[];
  active: boolean;
  description?: string;
}

export interface EcommerceSettings {
  currency: string;
  locale: string;
  tax_inclusive: boolean;
}

/** A product with its plan IDs resolved to full plan objects. */
export interface ResolvedProduct extends Omit<EcommerceProduct, "plans"> {
  plans: EcommercePlan[];
}

/** Shape injected into the CMS render context under the `ecommerce` key. */
export interface EcommerceRenderContext {
  product: ResolvedProduct;
  settings: EcommerceSettings;
}
