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
import { contentIndex } from "../content-index";
import { escapeTemplateVars, unescapeObjectVars } from "@shared/templateVars";
import { getFolder } from "../content-types";

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
    return obj
      .map(item => stripNullValues(item))
      .filter(item => item !== undefined) as unknown as T;
  }
  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null) {
        result[key] = stripNullValues(value);
      }
    }
    return result as T;
  }
  return obj;
}

const MARKETING_CONTENT_PATH = path.join(process.cwd(), "marketing-content");

function safeYamlLoad(yamlStr: string): unknown {
  const { escaped, map } = escapeTemplateVars(yamlStr);
  const parsed = yaml.load(escaped);
  return unescapeObjectVars(parsed, map);
}

export type ContentType = string;

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
    const folder = getFolder(contentType);
    let resolvedSlug = slug;
    const initialDir = path.join(MARKETING_CONTENT_PATH, folder, slug);
    if (!fs.existsSync(initialDir)) {
      resolvedSlug = contentIndex.resolveBaseSlug(slug, contentType);
    }

    const contentDir = path.join(MARKETING_CONTENT_PATH, folder, resolvedSlug);
    const commonPath = path.join(contentDir, "_common.yml");
    const contentPath = path.join(contentDir, `${localeOrVariant}.yml`);

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
      commonData = safeYamlLoad(commonContent) as Record<string, unknown>;
    }

    // Load content file
    const contentContent = fs.readFileSync(contentPath, "utf8");
    const contentData = safeYamlLoad(contentContent) as Record<string, unknown>;

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
  const contentDir = path.join(MARKETING_CONTENT_PATH, getFolder(contentType));

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
  const contentDir = path.join(MARKETING_CONTENT_PATH, getFolder(contentType), slug);

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
  const commonPath = path.join(MARKETING_CONTENT_PATH, getFolder(contentType), slug, "_common.yml");

  if (!fs.existsSync(commonPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(commonPath, "utf8");
    return safeYamlLoad(content) as Record<string, unknown>;
  } catch (error) {
    console.error(`Error loading common data for ${contentType}/${slug}:`, error);
    return null;
  }
}

/**
 * Resolve the content folder path for a given content type and slug.
 * Handles slug aliasing via contentIndex.resolveBaseSlug.
 */
export function getContentFolderPath(contentType: string, slug: string): string {
  const folder = getFolder(contentType);
  const resolved = contentIndex.resolveBaseSlug(slug, contentType);
  return path.join(MARKETING_CONTENT_PATH, folder, resolved);
}

/**
 * Resolve the content file path for a given content type, slug, and locale.
 * Supports variant/version files and landing special-casing (promoted.yml).
 */
export function getContentFilePath(
  contentType: string,
  slug: string,
  locale: string,
  variant?: string,
  version?: number
): string {
  const folder = getContentFolderPath(contentType, slug);

  if (variant && variant !== "default" && version !== undefined) {
    return path.join(folder, `${variant}.v${version}.${locale}.yml`);
  }

  if (contentType === "landing") {
    return path.join(folder, "promoted.yml");
  }

  return path.join(folder, `${locale}.yml`);
}

/**
 * Load only the locale-specific YAML data (no _common.yml merge).
 * Use this when you need to write back to the locale file without polluting it
 * with _common.yml content.
 */
export function loadLocaleData(
  contentType: string,
  slug: string,
  locale: string,
  variant?: string,
  version?: number
): { data: Record<string, unknown> | null; filePath: string; error?: string } {
  try {
    const filePath = getContentFilePath(contentType, slug, locale, variant, version);
    if (!fs.existsSync(filePath)) {
      return { data: null, filePath, error: `Content file not found: ${filePath}` };
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = safeYamlLoad(raw) as Record<string, unknown>;
    return { data, filePath };
  } catch (error) {
    return { data: null, filePath: "", error: `Error loading locale data: ${error}` };
  }
}

/**
 * Load the merged content (_common.yml + locale file).
 * Use this for validation and display where the full page structure is needed.
 */
export function loadMergedContent(
  contentType: string,
  slug: string,
  locale: string,
  variant?: string,
  version?: number
): { data: Record<string, unknown> | null; filePath: string; error?: string } {
  try {
    const filePath = getContentFilePath(contentType, slug, locale, variant, version);
    if (!fs.existsSync(filePath)) {
      return { data: null, filePath, error: `Content file not found: ${filePath}` };
    }

    const contentFolder = getContentFolderPath(contentType, slug);
    const commonPath = path.join(contentFolder, "_common.yml");
    let commonData: Record<string, unknown> = {};
    if (fs.existsSync(commonPath)) {
      const commonContent = fs.readFileSync(commonPath, "utf-8");
      commonData = safeYamlLoad(commonContent) as Record<string, unknown>;
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const localeData = safeYamlLoad(raw) as Record<string, unknown>;

    const merged = Object.keys(commonData).length > 0
      ? deepMerge(commonData, localeData)
      : localeData;

    return { data: merged, filePath };
  } catch (error) {
    return { data: null, filePath: "", error: `Error loading merged content: ${error}` };
  }
}

export { MARKETING_CONTENT_PATH, safeYamlLoad, stripNullValues };