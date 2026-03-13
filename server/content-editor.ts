import fs from "fs";
import yaml from "js-yaml";
import { escapeObjectVars, unescapeYamlDump } from "@shared/templateVars";
import { generateSectionId } from "./utils/generateSectionId";

function safeYamlDump(obj: unknown, opts?: yaml.DumpOptions): string {
  const { escaped, map } = escapeObjectVars(obj);
  const dumped = yaml.dump(escaped, opts);
  return unescapeYamlDump(dumped, map);
}
import type { EditOperation } from "@shared/schema";
import { normalizeLocale } from "./settings";
import { markFileAsModified } from "./sync-state";
import { contentIndex } from "./content-index";
import { deepMerge } from "./utils/deepMerge";

interface ContentEditRequest {
  contentType: string;
  slug: string;
  locale: string;
  operations: EditOperation[];
  variant?: string;
  version?: number;
  author?: string;
}

function getValueAtPath(obj: Record<string, unknown>, pathStr: string): unknown {
  const parts = pathStr.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

function setValueAtPath(obj: Record<string, unknown>, pathStr: string, value: unknown): void {
  const parts = pathStr.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current: Record<string, unknown> = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined) {
      // Create intermediate object or array
      const nextPart = parts[i + 1];
      current[part] = /^\d+$/.test(nextPart) ? [] : {};
    }
    current = current[part] as Record<string, unknown>;
  }
  
  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

function applyOperation(content: Record<string, unknown>, operation: EditOperation): void {
  switch (operation.action) {
    case "update_field": {
      setValueAtPath(content, operation.path, operation.value);
      break;
    }
    
    case "reorder_sections": {
      const sections = content.sections as unknown[];
      if (!Array.isArray(sections)) throw new Error("sections is not an array");
      if (operation.from < 0 || operation.from >= sections.length) throw new Error("Invalid from index");
      if (operation.to < 0 || operation.to >= sections.length) throw new Error("Invalid to index");
      
      const [moved] = sections.splice(operation.from, 1);
      sections.splice(operation.to, 0, moved);
      break;
    }
    
    case "add_item": {
      const arr = getValueAtPath(content, operation.path) as unknown[];
      if (!Array.isArray(arr)) throw new Error(`Path ${operation.path} is not an array`);
      
      let insertedIndex: number;
      if (operation.index !== undefined && operation.index >= 0 && operation.index <= arr.length) {
        arr.splice(operation.index, 0, operation.item);
        insertedIndex = operation.index;
      } else {
        arr.push(operation.item);
        insertedIndex = arr.length - 1;
      }
      if (operation.path === "sections") {
        const inserted = arr[insertedIndex] as Record<string, unknown>;
        if (inserted && typeof inserted === "object" && !inserted.section_id) {
          inserted.section_id = generateSectionId((inserted.type as string) || "section");
        }
      }
      break;
    }
    
    case "remove_item": {
      const arr = getValueAtPath(content, operation.path) as unknown[];
      if (!Array.isArray(arr)) throw new Error(`Path ${operation.path} is not an array`);
      if (operation.index < 0 || operation.index >= arr.length) throw new Error("Invalid index");
      
      arr.splice(operation.index, 1);
      break;
    }
    
    case "update_section": {
      const sections = content.sections as unknown[];
      if (!Array.isArray(sections)) throw new Error("sections is not an array");
      if (operation.index < 0 || operation.index >= sections.length) throw new Error("Invalid section index");
      
      const sectionToSave = operation.section as Record<string, unknown>;
      if (sectionToSave && typeof sectionToSave === "object" && sectionToSave.dynamic_entries) {
        delete sectionToSave.items;
        delete sectionToSave._dynamic_meta;
      }
      const existingId = (sections[operation.index] as Record<string, unknown>)?.section_id;
      sections[operation.index] = sectionToSave;
      if (existingId && !sectionToSave.section_id) {
        (sections[operation.index] as Record<string, unknown>).section_id = existingId;
      }
      break;
    }
    
    case "replace_all_sections": {
      if (!Array.isArray(operation.sections)) throw new Error("sections must be an array");
      content.sections = (operation.sections as Record<string, unknown>[]).map((sec) => {
        if (sec && typeof sec === "object" && sec.dynamic_entries) {
          const { items: _items, _dynamic_meta: _meta, ...authored } = sec;
          if (!authored.section_id) authored.section_id = generateSectionId((authored.type as string) || "section");
          return authored;
        }
        if (!sec.section_id) sec.section_id = generateSectionId((sec.type as string) || "section");
        return sec;
      });
      break;
    }
  }
}

export async function editContent(request: ContentEditRequest): Promise<{ success: boolean; error?: string; warning?: string; updatedSections?: unknown[] }> {
  const { contentType, slug, locale: rawLocale, operations, variant, version } = request;
  
  // Normalize locale to prevent es-ES, en-US etc from causing file lookup failures
  const locale = normalizeLocale(rawLocale);
  
  // Validate variant/version are used together and version is valid
  const hasVariant = variant !== undefined && variant !== null && variant !== "";
  const hasValidVersion = version !== undefined && version !== null && Number.isFinite(version);
  if (hasVariant !== hasValidVersion) {
    return { success: false, error: "Both variant and version must be provided together" };
  }
  
  try {
    const { data: localeData, filePath, error: loadError } = contentIndex.loadLocaleData(contentType, slug, locale, variant, version);
    if (!localeData || loadError) {
      return { success: false, error: loadError || `Content file not found` };
    }
    
    // Apply all operations to the locale data (this is what gets saved)
    for (const operation of operations) {
      applyOperation(localeData, operation);
    }

    // Write locale data back to file (without _common.yml content)
    const updatedYaml = safeYamlDump(localeData, {
      lineWidth: -1, // Don't wrap lines
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
    });
    
    fs.writeFileSync(filePath, updatedYaml, "utf-8");
    
    // Track who modified this file for sync purposes
    markFileAsModified(filePath, request.author);
    
    // Note: GitHub commits are now handled manually via /api/github/commit endpoint
    // Changes are saved locally and users commit when ready
    
    // Return updated sections for immediate UI update (from merged content for full view)
    const updatedSections = (content.sections as unknown[]) || [];
    return { success: true, updatedSections };
  } catch (error) {
    console.error("Content edit error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

interface CommonEditRequest {
  contentType: string;
  slug: string;
  operations: Array<{ action: "update_field"; path: string; value: unknown }>;
  author?: string;
}

export function editCommonContent(request: CommonEditRequest): { success: boolean; error?: string } {
  const { contentType, slug, operations, author } = request;

  try {
    const commonPath = contentIndex.getCommonFilePath(contentType, slug);
    if (!fs.existsSync(commonPath)) {
      return { success: false, error: `_common.yml not found for ${contentType}/${slug}` };
    }

    const raw = fs.readFileSync(commonPath, "utf-8");
    const commonData = (yaml.load(raw) as Record<string, unknown>) || {};

    for (const op of operations) {
      if (op.action !== "update_field") {
        return { success: false, error: `Unsupported operation: ${op.action}` };
      }
      if (op.value === undefined) {
        delete commonData[op.path];
      } else {
        setValueAtPath(commonData, op.path, op.value);
      }
    }

    const updatedYaml = safeYamlDump(commonData, {
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
    });

    fs.writeFileSync(commonPath, updatedYaml, "utf-8");
    markFileAsModified(commonPath, author);

    return { success: true };
  } catch (error) {
    console.error("Common content edit error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export function getContentForEdit(
  contentType: string,
  slug: string,
  rawLocale: string,
  variant?: string,
  version?: number
): { content: Record<string, unknown> | null; error?: string } {
  const locale = normalizeLocale(rawLocale);
  
  const hasVariant = variant !== undefined && variant !== null && variant !== "";
  const hasValidVersion = version !== undefined && version !== null && Number.isFinite(version);
  if (hasVariant !== hasValidVersion) {
    return { content: null, error: "Both variant and version must be provided together" };
  }
  
  try {
    const { data: localeData, error: loadError } = contentIndex.loadLocaleData(contentType, slug, locale, variant, version);
    if (!localeData || loadError) {
      return { content: null, error: loadError || `Content file not found` };
    }

    const commonData = contentIndex.loadCommonData(contentType, slug);
    const content = commonData
      ? deepMerge(commonData, localeData)
      : localeData;

    return { content };
  } catch (error) {
    console.error("Error reading content:", error);
    return { content: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
