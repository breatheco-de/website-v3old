/**
 * Ecommerce Resolver — CMS bridge.
 *
 * Exports a single enrichWithEcommerceData() function that acts as an optional
 * enrichment step in the CMS content loading pipeline.
 *
 * Resolution order (deep-merge):
 *   ecommerce-settings.yml plans → type-level _ecommerce.yml → entry-level _ecommerce.yml
 *
 * If the loaded entry resolves to an active purchasable product, resolved plan
 * data is injected into the render context under an `ecommerce` key. Plans are
 * also injected directly into any `pricing_plans` sections in the page so
 * section components can read from their own data prop without needing
 * page-level context.
 *
 * This function is non-breaking: it silently returns the unchanged context when
 * no matching product is found.
 */

import { ecommerceManager } from "./ecommerce-manager";
import type { EcommerceRenderContext } from "./types";
import { child } from "../logger";
const log = child({ module: "ecommerce/ecommerce-resolver" });



type RenderContext = Record<string, unknown>;

/**
 * Enriches a CMS render context with ecommerce data.
 *
 * @param contentType   - The CMS content type of the loaded entry
 * @param slug          - The slug of the loaded entry
 * @param renderContext - The mutable render context object (page data)
 * @returns The same renderContext object, possibly mutated with an `ecommerce` key
 */
export function enrichWithEcommerceData(
  contentType: string,
  slug: string,
  renderContext: RenderContext,
): RenderContext {
  try {
    const product = ecommerceManager.findProductByCmsEntry(contentType, slug);
    if (!product) return renderContext;

    const resolvedPlans = ecommerceManager.resolvePlans(product.plans);
    const settings = ecommerceManager.getSettings();

    const ecommerceData: EcommerceRenderContext = {
      product: { ...product, plans: resolvedPlans },
      settings,
    };

    renderContext.ecommerce = ecommerceData;

    // Also inject plans into any pricing_plans sections so section components
    // receive them via their own data prop (no extra page-level context needed).
    if (Array.isArray(renderContext.sections)) {
      for (const section of renderContext.sections as RenderContext[]) {
        if (section && typeof section === "object" && section.type === "pricing_plans") {
          if (!section.plans || !Array.isArray(section.plans) || section.plans.length === 0) {
            section._resolved_plans = resolvedPlans;
            section._ecommerce_settings = settings;
          }
        }
      }
    }
  } catch (err) {
    log.error({ err: err }, `[EcommerceResolver] Error enriching ${contentType}/${slug}:`);
  }

  return renderContext;
}
