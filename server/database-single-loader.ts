import * as fs from "fs";
import * as path from "path";
import { contentIndex } from "./content-index";
import { deepMerge } from "./utils/deepMerge";
import { databaseManager } from "./database";
import {
  getDatabaseName,
  getFolder,
  getLookupKey,
  getFieldMapping,
  getLocaleKey,
  getLocaleSource,
} from "./content-types";
import { resolveFieldValue, applyTransformIfNeeded } from "./transform";
import { fetchMarkdownContent } from "./markdown";
import { applyComponentSectionDefaults } from "./component-registry";
import type { TemplatePage } from "@shared/schema";

const TEMPLATE_EXPR_RE = /\{\{[\s\S]*?\}\}/;

function extractVariableFields(
  obj: unknown,
  prefix = "",
): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof obj !== "object" || obj === null) return result;
  const entries: Array<[string, unknown]> = Array.isArray(obj)
    ? obj.map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(obj as Record<string, unknown>).filter(([k]) => !k.startsWith("_"));
  for (const [key, value] of entries) {
    const dotPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string" && TEMPLATE_EXPR_RE.test(value)) {
      result[dotPath] = value.trim();
    } else if (typeof value === "object" && value !== null) {
      Object.assign(result, extractVariableFields(value, dotPath));
    }
  }
  return result;
}

export async function loadDatabaseSinglePage(
  contentType: string,
  slug: string,
  locale: string,
): Promise<TemplatePage | null> {
  const dbName = getDatabaseName(contentType);
  if (!dbName) return null;
  const folder = getFolder(contentType);

  const templateDir = path.join(process.cwd(), "marketing-content", folder);
  const singleCommonPath = path.join(templateDir, "_common.single.yml");
  const commonPath = path.join(templateDir, "_common.yml");
  const localePath = path.join(templateDir, `single.${locale}.yml`);

  if (!fs.existsSync(localePath)) {
    console.error(
      `[DatabaseSingle] Template not found: single.${locale}.yml for ${contentType}`,
    );
    return null;
  }

  let baseData: Record<string, unknown> = {};
  if (fs.existsSync(singleCommonPath)) {
    const singleRaw = fs.readFileSync(singleCommonPath, "utf-8");
    const parsed = contentIndex.safeYamlLoad(singleRaw);
    if (parsed) baseData = parsed;
  }

  if (fs.existsSync(commonPath)) {
    const commonRaw = fs.readFileSync(commonPath, "utf-8");
    const parsed = contentIndex.safeYamlLoad(commonRaw);
    if (parsed) {
      baseData = Object.keys(baseData).length > 0
        ? deepMerge(baseData, parsed)
        : parsed;
    }
  }

  const localeRaw = fs.readFileSync(localePath, "utf-8");
  const localeData = contentIndex.safeYamlLoad(localeRaw);
  if (!localeData) return null;

  const merged = Object.keys(baseData).length > 0
    ? deepMerge(baseData, localeData)
    : { ...localeData };

  if (!databaseManager.exists(dbName)) {
    console.error(`[DatabaseSingle] Database "${dbName}" not found`);
    return null;
  }

  try {
    const result = await databaseManager.fetchItems(dbName);
    const lookupKey = getLookupKey(contentType) || "slug";
    const fieldMapping = getFieldMapping(contentType);

    let items = result.items as Record<string, unknown>[];

    if (fieldMapping) {
      items = items.map((item) => {
        const mapped: Record<string, unknown> = { ...item };
        const itemSlug = String(item[lookupKey] ?? item.slug ?? "unknown");
        for (const [targetField, sourcePath] of Object.entries(fieldMapping)) {
          const value = resolveFieldValue(sourcePath, item, targetField, {
            contentType,
            slug: itemSlug,
            fieldPath: targetField,
          });
          if (value !== undefined) mapped[targetField] = value;
        }
        return mapped;
      });
    }

    const localeKey = getLocaleKey(contentType);
    const localeSource = getLocaleSource(contentType);
    let matchItem: Record<string, unknown> | undefined;

    if (localeKey) {
      const normalizedLocale = localeSource
        ? applyTransformIfNeeded(localeSource, locale)
        : locale;
      matchItem = items.find((item) => {
        const itemLocale = String(item[localeKey] || "");
        const normalizedItemLocale = localeSource
          ? applyTransformIfNeeded(localeSource, itemLocale)
          : itemLocale;
        return (
          item[lookupKey] === slug && normalizedItemLocale === normalizedLocale
        );
      });
      if (!matchItem) {
        matchItem = items.find((item) => item[lookupKey] === slug);
      }
    } else {
      matchItem = items.find((item) => item[lookupKey] === slug);
    }

    if (!matchItem) {
      console.log(
        `[DatabaseSingle] Item not found: ${lookupKey}=${slug} in ${dbName}`,
      );
      return null;
    }

    let content = (matchItem as any).content || "";
    if (!content && (matchItem as any).content_url) {
      content = await fetchMarkdownContent(
        (matchItem as any).content_url as string,
      );
    }
    if (!content && (matchItem as any).readme_url) {
      content = await fetchMarkdownContent(
        (matchItem as any).readme_url as string,
      );
    }
    const singleItem = { ...matchItem, content };

    const sections = (merged.sections as TemplatePage["sections"]) || [];

    for (const section of sections as unknown[]) {
      const variableFields = extractVariableFields(section);
      if (Object.keys(variableFields).length > 0) {
        (section as Record<string, unknown>)._variableFields = variableFields;
      }
    }

    applyComponentSectionDefaults(sections as unknown[]);

    const page: TemplatePage = {
      slug: (merged.slug as string) || slug,
      title: (merged.title as string) || (singleItem.title as string) || slug,
      meta: (merged.meta as TemplatePage["meta"]) || {},
      sections,
      settings: (merged.settings as TemplatePage["settings"]) || undefined,
      schema: (merged.schema as TemplatePage["schema"]) || undefined,
      singleEntry: singleItem as Record<string, unknown>,
    };

    return page;
  } catch (err) {
    console.error(
      `[DatabaseSingle] Error loading ${contentType}/${slug}:`,
      err,
    );
    return null;
  }
}
