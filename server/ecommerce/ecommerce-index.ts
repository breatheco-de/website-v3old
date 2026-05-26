/**
 * Ecommerce Index — startup scanner.
 *
 * Reads all YAML files under marketing-content/ecommerce/products/ and plans/,
 * builds two in-memory maps, and exposes a scanEcommerceContent() function.
 *
 * A file-watcher keeps the maps fresh when YAML files change without a server restart.
 * Zero filesystem I/O occurs at request time — all data is read from in-memory maps.
 */

import fs from "fs";
import path from "path";
import { contentIndex } from "../content-index";
import type { EcommerceProduct, EcommercePlan, EcommerceSettings } from "./types";

export const ECOMMERCE_DIR = path.join(process.cwd(), "marketing-content", "ecommerce");

const DEFAULTS_SETTINGS: EcommerceSettings = {
  currency: "USD",
  locale: "en-US",
  tax_inclusive: false,
};

export const productMap = new Map<string, EcommerceProduct>();
export const planMap = new Map<string, EcommercePlan>();
export let ecommerceSettings: EcommerceSettings = { ...DEFAULTS_SETTINGS };

function loadSettings(): EcommerceSettings {
  const settingsPath = path.join(ECOMMERCE_DIR, "settings.yml");
  if (!fs.existsSync(settingsPath)) return { ...DEFAULTS_SETTINGS };
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const parsed = contentIndex.safeYamlLoad(raw) as Record<string, unknown> | null;
    if (!parsed) return { ...DEFAULTS_SETTINGS };
    return {
      currency: typeof parsed.currency === "string" ? parsed.currency : DEFAULTS_SETTINGS.currency,
      locale: typeof parsed.locale === "string" ? parsed.locale : DEFAULTS_SETTINGS.locale,
      tax_inclusive: typeof parsed.tax_inclusive === "boolean" ? parsed.tax_inclusive : DEFAULTS_SETTINGS.tax_inclusive,
    };
  } catch (err) {
    console.error("[EcommerceIndex] Failed to parse settings.yml:", err);
    return { ...DEFAULTS_SETTINGS };
  }
}

function loadProduct(filePath: string): EcommerceProduct | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = contentIndex.safeYamlLoad(raw) as Record<string, unknown> | null;
    if (!parsed) return null;

    const product_id = typeof parsed.product_id === "string" ? parsed.product_id : null;
    const name = typeof parsed.name === "string" ? parsed.name : null;
    const content_type = typeof parsed.content_type === "string" ? parsed.content_type : null;
    const content_slug = typeof parsed.content_slug === "string" ? parsed.content_slug : null;

    if (!product_id || !name || !content_type || !content_slug) {
      console.warn(`[EcommerceIndex] Skipping product ${filePath} — missing required fields`);
      return null;
    }

    const plans = Array.isArray(parsed.plans)
      ? (parsed.plans as unknown[]).filter((p): p is string => typeof p === "string")
      : [];

    return {
      product_id,
      name,
      content_type,
      content_slug,
      plans,
      active: typeof parsed.active === "boolean" ? parsed.active : true,
      description: typeof parsed.description === "string" ? parsed.description : undefined,
    };
  } catch (err) {
    console.error(`[EcommerceIndex] Failed to parse product ${filePath}:`, err);
    return null;
  }
}

function loadPlan(filePath: string): EcommercePlan | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = contentIndex.safeYamlLoad(raw) as Record<string, unknown> | null;
    if (!parsed) return null;

    const plan_id = typeof parsed.plan_id === "string" ? parsed.plan_id : null;
    const name = typeof parsed.name === "string" ? parsed.name : null;
    const price = typeof parsed.price === "number" ? parsed.price : null;
    const currency = typeof parsed.currency === "string" ? parsed.currency : ecommerceSettings.currency;
    const billing_period = typeof parsed.billing_period === "string"
      ? (parsed.billing_period as EcommercePlan["billing_period"])
      : "monthly";

    if (!plan_id || !name || price === null) {
      console.warn(`[EcommerceIndex] Skipping plan ${filePath} — missing required fields`);
      return null;
    }

    const features = Array.isArray(parsed.features)
      ? (parsed.features as unknown[]).filter((f): f is string => typeof f === "string")
      : [];

    return {
      plan_id,
      name,
      price,
      currency,
      billing_period,
      highlighted: typeof parsed.highlighted === "boolean" ? parsed.highlighted : false,
      badge: typeof parsed.badge === "string" ? parsed.badge : undefined,
      trial_days: typeof parsed.trial_days === "number" ? parsed.trial_days : undefined,
      features,
    };
  } catch (err) {
    console.error(`[EcommerceIndex] Failed to parse plan ${filePath}:`, err);
    return null;
  }
}

function scanDirectory<T>(
  dir: string,
  loader: (filePath: string) => T | null,
  map: Map<string, T>,
  idKey: keyof T,
  label: string,
): void {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  for (const file of files) {
    const filePath = path.join(dir, file);
    const item = loader(filePath);
    if (item) {
      const id = item[idKey] as unknown as string;
      map.set(id, item);
    }
  }
  console.log(`[EcommerceIndex] Scanned ${map.size} ${label}`);
}

export function scanEcommerceContent(): void {
  productMap.clear();
  planMap.clear();

  ecommerceSettings = loadSettings();

  scanDirectory(
    path.join(ECOMMERCE_DIR, "plans"),
    loadPlan,
    planMap,
    "plan_id",
    "plans",
  );

  scanDirectory(
    path.join(ECOMMERCE_DIR, "products"),
    loadProduct,
    productMap,
    "product_id",
    "products",
  );
}

let watcherStarted = false;

export function startEcommerceWatcher(): void {
  if (watcherStarted || !fs.existsSync(ECOMMERCE_DIR)) return;
  watcherStarted = true;

  fs.watch(ECOMMERCE_DIR, { recursive: true }, (event, filename) => {
    if (!filename) return;
    if (!filename.endsWith(".yml") && !filename.endsWith(".yaml")) return;
    console.log(`[EcommerceIndex] File changed: ${filename} — rescanning`);
    try {
      scanEcommerceContent();
    } catch (err) {
      console.error("[EcommerceIndex] Error during rescan:", err);
    }
  });
}
