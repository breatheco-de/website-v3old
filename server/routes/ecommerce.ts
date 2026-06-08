/**
 * Ecommerce REST routes.
 *
 * Thin read-only endpoints that delegate entirely to ecommerceManager.
 * All param validation is done with Zod before any manager calls.
 *
 * GET /api/ecommerce/products          — list all active products
 * GET /api/ecommerce/products/:productId — get a single resolved product
 * GET /api/ecommerce/plans/:planId       — get a single plan
 */

import type { Express } from "express";
import { z } from "zod";
import { ecommerceManager } from "../ecommerce/ecommerce-manager";
import { child } from "../logger";
const log = child({ module: "routes/ecommerce" });



const productIdSchema = z.object({
  productId: z.string().min(1).regex(/^[a-z0-9-_]+$/i),
});

const planIdSchema = z.object({
  planId: z.string().min(1).regex(/^[a-z0-9-_]+$/i),
});

export function registerEcommerceRoutes(app: Express): void {
  /** GET /api/ecommerce/products — returns all active products with resolved plans */
  app.get("/api/ecommerce/products", (_req, res) => {
    try {
      const products = ecommerceManager.getAllProducts().map((p) => ({
        ...p,
        plans: ecommerceManager.resolvePlans(p.plans),
      }));
      res.json({ products, settings: ecommerceManager.getSettings() });
    } catch (err) {
      log.error({ err: err }, "[EcommerceRoutes] GET /api/ecommerce/products:");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /api/ecommerce/products/:productId — returns a single resolved product */
  app.get("/api/ecommerce/products/:productId", (req, res) => {
    const parsed = productIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    try {
      const resolved = ecommerceManager.resolveProduct(parsed.data.productId);
      if (!resolved) {
        return res.status(404).json({ error: `Product "${parsed.data.productId}" not found` });
      }
      res.json({ product: resolved, settings: ecommerceManager.getSettings() });
    } catch (err) {
      log.error({ err: err }, `[EcommerceRoutes] GET /api/ecommerce/products/${parsed.data.productId}:`);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /api/ecommerce/plans/:planId — returns a single plan */
  app.get("/api/ecommerce/plans/:planId", (req, res) => {
    const parsed = planIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid plan ID" });
    }

    try {
      const plan = ecommerceManager.getPlan(parsed.data.planId);
      if (!plan) {
        return res.status(404).json({ error: `Plan "${parsed.data.planId}" not found` });
      }
      res.json({ plan, settings: ecommerceManager.getSettings() });
    } catch (err) {
      log.error({ err: err }, `[EcommerceRoutes] GET /api/ecommerce/plans/${parsed.data.planId}:`);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
