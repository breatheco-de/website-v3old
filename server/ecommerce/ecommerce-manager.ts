/**
 * Ecommerce Manager — singleton query API.
 *
 * Wraps the in-memory maps from ecommerce-index.ts and exposes a clean query API.
 * Zero filesystem I/O in any method — all reads are from in-memory maps.
 *
 * Follows the singleton pattern used by DatabaseManager in server/database.ts.
 */

import { productMap, planMap, ecommerceSettings } from "./ecommerce-index";
import type { EcommerceProduct, EcommercePlan, EcommerceSettings, ResolvedProduct } from "./types";

class EcommerceManager {
  private static instance: EcommerceManager;

  static getInstance(): EcommerceManager {
    if (!EcommerceManager.instance) {
      EcommerceManager.instance = new EcommerceManager();
    }
    return EcommerceManager.instance;
  }

  private constructor() {}

  /** Returns a single product by product_id, or undefined if not found. */
  getProduct(productId: string): EcommerceProduct | undefined {
    return productMap.get(productId);
  }

  /** Returns all active products. */
  getAllProducts(): EcommerceProduct[] {
    return Array.from(productMap.values()).filter((p) => p.active);
  }

  /**
   * Reverse lookup: find a product whose content_type and content_slug match.
   * Returns the first matching active product, or undefined.
   */
  findProductByCmsEntry(contentType: string, slug: string): EcommerceProduct | undefined {
    for (const product of productMap.values()) {
      if (product.active && product.content_type === contentType && product.content_slug === slug) {
        return product;
      }
    }
    return undefined;
  }

  /**
   * Resolves an array of plan IDs to full plan objects.
   * Plan IDs that don't exist in the map are silently skipped.
   */
  resolvePlans(planIds: string[]): EcommercePlan[] {
    const result: EcommercePlan[] = [];
    for (const id of planIds) {
      const plan = planMap.get(id);
      if (plan) result.push(plan);
    }
    return result;
  }

  /** Returns a single plan by plan_id, or undefined if not found. */
  getPlan(planId: string): EcommercePlan | undefined {
    return planMap.get(planId);
  }

  /** Returns all plans. */
  getAllPlans(): EcommercePlan[] {
    return Array.from(planMap.values());
  }

  /** Returns current global ecommerce settings. */
  getSettings(): EcommerceSettings {
    return { ...ecommerceSettings };
  }

  /**
   * Resolves a product with its full plan objects.
   * Returns null if the product is not found.
   */
  resolveProduct(productId: string): ResolvedProduct | null {
    const product = this.getProduct(productId);
    if (!product) return null;
    return {
      ...product,
      plans: this.resolvePlans(product.plans),
    };
  }
}

export const ecommerceManager = EcommerceManager.getInstance();
