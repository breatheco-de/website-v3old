/**
 * Generic YAML Content Loader
 * 
 * Provides a unified way to load content from the marketing-content directory.
 * Supports two loading patterns:
 * 
 * 1. Locale-based (programs, pages, locations):
 *    - _common.yml + {locale}.yml (e.g., en.yml, es.yml)
 *    
 * 2. Variant-based (landings):
 *    - _common.yml + promoted.yml (locale defined in _common.yml)
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import type { ZodSchema } from "zod";
import { deepMerge } from "./deepMerge";

/**
 * Recursively strip null values from an object, converting them to undefined.
 * This is needed because YAML files may have explicit null values, but Zod
 * schemas use .optional() which only accepts undefined, not null.
 */
function stripNullValues<T>(obj: T): T {
  if (obj === null) {
    return undefined as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => stripNullValues(item)) as unknown as T;
  }
  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null) {
        result[key] = stripNullValues(value);
      }
      // If value is null, we simply don't include the key, making it undefined
    }
    return result as T;
  }
  return obj;
}

const MARKETING_CONTENT_PATH = path.join(process.cwd(), "marketing-content");

export type ContentType = "programs" | "pages" | "locations" | "landings";

export interface LoadContentOptions<T> {
  contentType: ContentType;
  slug: string;
  schema: ZodSchema<T>;
  /**
   * For locale-based content (programs, pages, locations): the locale code (en, es)
   * For variant-based content (landings): the variant filename without .yml (e.g., "promoted")
   */
  localeOrVariant: string;
  /**
   * Whether _common.yml is required (default: false - optional)
   */
  requireCommon?: boolean;
}

export type LoadContentResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Load YAML content by merging _common.yml with a locale/variant file.
 */
export function loadContent<T>(options: LoadContentOptions<T>): LoadContentResult<T> {
  const { contentType, slug, schema, localeOrVariant, requireCommon = false } = options;

  try {
    const contentDir = path.join(MARKETING_CONTENT_PATH, contentType, slug);
    const commonPath = path.join(contentDir, "_common.yml");
    const contentPath = path.join(contentDir, `${localeOrVariant}.yml`);

    // Check if content file exists
    if (!fs.existsSync(contentPath)) {
      return { success: false, error: `Content file not found: ${contentPath}` };
    }

    // Check if _common.yml is required and missing
    if (requireCommon && !fs.existsSync(commonPath)) {
      return { success: false, error: `Required _common.yml not found: ${commonPath}` };
    }

    // Load _common.yml if it exists
    let commonData: Record<string, unknown> = {};
    if (fs.existsSync(commonPath)) {
      const commonContent = fs.readFileSync(commonPath, "utf8");
      commonData = yaml.load(commonContent) as Record<string, unknown>;
    }

    // Load content file
    const contentContent = fs.readFileSync(contentPath, "utf8");
    const contentData = yaml.load(contentContent) as Record<string, unknown>;

    // Deep merge: common data as base, content data overrides
    const mergedData = deepMerge(commonData, contentData);

    // Strip null values from merged data (YAML null -> undefined for Zod .optional())
    const cleanedData = stripNullValues(mergedData);

    // Validate against schema
    const result = schema.safeParse(cleanedData);
    if (!result.success) {
      return { 
        success: false, 
        error: `Invalid YAML structure for ${contentType}/${slug}/${localeOrVariant}: ${result.error.message}` 
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return { 
      success: false, 
      error: `Error loading ${contentType}/${slug}/${localeOrVariant}: ${error}` 
    };
  }
}

/**
 * List all content directories for a given content type.
 */
export function listContentSlugs(contentType: ContentType): string[] {
  const contentDir = path.join(MARKETING_CONTENT_PATH, contentType);

  if (!fs.existsSync(contentDir)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(contentDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch (error) {
    console.error(`Error listing ${contentType}:`, error);
    return [];
  }
}

/**
 * Get available locales/variants for a content slug.
 * Returns filenames without .yml extension, excluding _common.yml and experiments.yml
 */
export function getAvailableLocalesOrVariants(contentType: ContentType, slug: string): string[] {
  const contentDir = path.join(MARKETING_CONTENT_PATH, contentType, slug);

  if (!fs.existsSync(contentDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(contentDir);
    return files
      .filter(f => 
        f.endsWith(".yml") && 
        !f.startsWith("_") && 
        f !== "experiments.yml" &&
        !f.includes(".v") // Exclude variant version files like "variant.v1.en.yml"
      )
      .map(f => f.replace(".yml", ""));
  } catch (error) {
    console.error(`Error getting locales for ${contentType}/${slug}:`, error);
    return [];
  }
}

/**
 * Load _common.yml data only (for getting locale from landings, etc.)
 */
export function loadCommonData(contentType: ContentType, slug: string): Record<string, unknown> | null {
  const commonPath = path.join(MARKETING_CONTENT_PATH, contentType, slug, "_common.yml");

  if (!fs.existsSync(commonPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(commonPath, "utf8");
    return yaml.load(content) as Record<string, unknown>;
  } catch (error) {
    console.error(`Error loading common data for ${contentType}/${slug}:`, error);
    return null;
  }
}

export { MARKETING_CONTENT_PATH };