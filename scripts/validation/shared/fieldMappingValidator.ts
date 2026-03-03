import { contentIndex, type ContentType } from "../../../server/content-index";

export interface FieldValidationResult {
  valid: boolean;
  total: number;
  found: number;
  missing: string[];
}

export interface MappingValidationResult {
  results: Record<string, FieldValidationResult>;
  allValid: boolean;
}

export function extractByDotPath(obj: unknown, dotPath: string): unknown {
  let current = obj;
  const segments = dotPath.split(".");
  for (const key of segments) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function isTransformerValue(value: string): boolean {
  return value.startsWith("function:");
}

export function validateFieldSource(
  contentType: string,
  source: string
): FieldValidationResult {
  const slugs = contentIndex.listContentSlugs(contentType as ContentType);

  if (slugs.length === 0) {
    return { valid: true, total: 0, found: 0, missing: [] };
  }

  let found = 0;
  const missing: string[] = [];

  for (const slug of slugs) {
    const locales = contentIndex.getAvailableLocalesOrVariants(
      contentType as ContentType,
      slug
    );
    const locale = locales.includes("en") ? "en" : locales[0];
    if (!locale) {
      missing.push(slug);
      continue;
    }

    const { data } = contentIndex.loadMergedContent(
      contentType,
      slug,
      locale
    );

    if (!data) {
      missing.push(slug);
      continue;
    }

    const value = extractByDotPath(data, source);
    if (value !== undefined) {
      found++;
    } else {
      missing.push(slug);
    }
  }

  return {
    valid: missing.length === 0,
    total: slugs.length,
    found,
    missing,
  };
}

export function validateFieldMapping(
  contentType: string,
  fieldMapping: Record<string, string>
): MappingValidationResult {
  const results: Record<string, FieldValidationResult> = {};
  let allValid = true;

  for (const [key, value] of Object.entries(fieldMapping)) {
    if (key.startsWith("_")) continue;
    if (typeof value !== "string" || !value) continue;
    if (isTransformerValue(value)) continue;

    const result = validateFieldSource(contentType, value);
    results[key] = result;
    if (!result.valid) {
      allValid = false;
    }
  }

  return { results, allValid };
}
