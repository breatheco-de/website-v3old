import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { escapeTemplateVars, escapeObjectVars, unescapeObjectVars, unescapeYamlDump } from "@shared/templateVars";
import { z } from "zod";

function safeYamlLoad(yamlStr: string): unknown {
  const { escaped, map } = escapeTemplateVars(yamlStr);
  const parsed = yaml.load(escaped);
  return unescapeObjectVars(parsed, map);
}

function safeYamlDump(obj: unknown, opts?: yaml.DumpOptions): string {
  const { escaped, map } = escapeObjectVars(obj);
  const dumped = yaml.dump(escaped, opts);
  return unescapeYamlDump(dumped, map);
}
import type { EditOperation } from "@shared/schema";
import { landingPageSchema, careerProgramSchema, templatePageSchema, locationPageSchema } from "@shared/schema";
import { normalizeLocale } from "@shared/locale";
import { contentIndex } from "./content-index";
import { deepMerge } from "./utils/deepMerge";
import { markFileAsModified } from "./sync-state";
import { getFolder } from "./content-types";

const CONTENT_BASE_PATH = path.join(process.cwd(), "marketing-content");

function getContentFolder(contentType: string, slug: string, locale?: string): string {
  const folder = getFolder(contentType);
  const resolved = contentIndex.resolveBaseSlug(slug, contentType);
  return path.join(CONTENT_BASE_PATH, folder, resolved);
}

/**
 * Recursively strip null values from an object, converting them to undefined.
 * This is needed because YAML files may have explicit null values, but Zod
 * schemas use .optional() which only accepts undefined, not null.
 * For arrays, null elements are removed entirely (not replaced with undefined),
 * since arrays with embedded undefined can fail Zod validation.
 */
function stripNullValues<T>(obj: T): T {
  if (obj === null) {
    return undefined as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj
      .map((item) => stripNullValues(item))
      .filter((item) => item !== undefined) as unknown as T;
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

interface ContentEditRequest {
  contentType: "program" | "landing" | "location" | "page";
  slug: string;
  locale: string;
  operations: EditOperation[];
  variant?: string;
  version?: number;
  author?: string;  // Who made this edit (for sync tracking)
}

function getContentPath(contentType: string, slug: string, locale: string, variant?: string, version?: number): string {
  const typeFolder = getFolder(contentType);
  const resolved = contentIndex.resolveBaseSlug(slug, contentType);
  const folder = path.join(CONTENT_BASE_PATH, typeFolder, resolved);
  
  // If variant and version are specified, use variant file path
  // "default" variant means base content, not a variant file
  if (variant && variant !== "default" && version !== undefined) {
    return path.join(folder, `${variant}.v${version}.${locale}.yml`);
  }
  
  // Landings use promoted.yml instead of {locale}.yml
  if (contentType === "landing") {
    return path.join(folder, "promoted.yml");
  }
  
  return path.join(folder, `${locale}.yml`);
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
      
      if (operation.index !== undefined && operation.index >= 0 && operation.index <= arr.length) {
        arr.splice(operation.index, 0, operation.item);
      } else {
        arr.push(operation.item);
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
      
      sections[operation.index] = operation.section;
      break;
    }
    
    case "replace_all_sections": {
      if (!Array.isArray(operation.sections)) throw new Error("sections must be an array");
      content.sections = operation.sections;
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
    const filePath = getContentPath(contentType, slug, locale, variant, version);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `Content file not found: ${filePath}` };
    }
    
    // Load _common.yml if it exists
    const contentFolder = getContentFolder(contentType, slug, locale);
    const commonPath = path.join(contentFolder, "_common.yml");
    let commonData: Record<string, unknown> = {};
    if (fs.existsSync(commonPath)) {
      const commonContent = fs.readFileSync(commonPath, "utf-8");
      commonData = safeYamlLoad(commonContent) as Record<string, unknown>;
    }
    
    // Read current content from locale file
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const localeData = safeYamlLoad(fileContent) as Record<string, unknown>;
    
    // Merge _common.yml with locale file (locale data overrides common)
    const content = deepMerge(commonData, localeData);
    
    // Apply all operations
    for (const operation of operations) {
      applyOperation(content, operation);
    }
    
    // Validate content against the appropriate full schema
    const validationErrors: string[] = [];
    
    // Get the appropriate schema based on content type
    let schema: z.ZodTypeAny;
    switch (contentType) {
      case "landing":
        schema = landingPageSchema;
        break;
      case "program":
        schema = careerProgramSchema;
        break;
      case "page":
        schema = templatePageSchema;
        break;
      case "location":
        schema = locationPageSchema;
        break;
      default:
        schema = landingPageSchema; // fallback
    }
    
    // Strip null values before validation (Zod .optional() expects undefined, not null)
    const cleanedContent = stripNullValues(content);
    
    const result = schema.safeParse(cleanedContent);
    
    if (!result.success) {
      // Parse the error to provide user-friendly messages
      for (const issue of result.error.issues.slice(0, 5)) {
        const pathStr = issue.path.join(".");
        
        // Check if this is a section validation error (union error)
        if (issue.code === "invalid_union" && pathStr.startsWith("sections.")) {
          const sectionIndex = parseInt(issue.path[1] as string, 10);
          const sections = content.sections as Record<string, unknown>[] | undefined;
          const sectionType = sections?.[sectionIndex]?.type || "unknown";
          
          // Check union errors for type mismatches
          const unionErrors = (issue as { unionErrors?: z.ZodError[] }).unionErrors;
          if (unionErrors && unionErrors.length > 0) {
            // If all union branches fail on 'type', it's an unknown section type
            const allTypeErrors = unionErrors.every(ue => 
              ue.issues.some(i => i.path[0] === "type" && (i.code === "invalid_literal" || i.code === "invalid_enum_value"))
            );
            if (allTypeErrors) {
              validationErrors.push(`Section ${sectionIndex + 1}: Unknown section type "${sectionType}". Check spelling or use a valid section type.`);
              continue;
            }
            
            // Find the matching schema branch by checking all discriminator fields
            const sectionVariant = sections?.[sectionIndex]?.variant as string | undefined;
            const sectionDataForMatch = sections?.[sectionIndex] as Record<string, unknown> | undefined;
            const topDiscriminators = ["type", "variant", "style", "layout"];
            const matchingBranch = unionErrors.find(ue => {
              for (const disc of topDiscriminators) {
                const dataVal = sectionDataForMatch?.[disc];
                if (dataVal === undefined) continue;
                const hasMismatch = ue.issues.some(i =>
                  i.path[0] === disc && (i.code === "invalid_literal" || i.code === "invalid_enum_value")
                );
                if (hasMismatch) return false;
              }
              return true;
            });
            
            if (matchingBranch && matchingBranch.issues.length > 0) {
              const findBestNestedBranch = (unionErrors: z.ZodError[], sectionData: Record<string, unknown>): z.ZodError | undefined => {
                const discriminators = ["type", "variant", "style", "layout"];
                return unionErrors.find(ue => {
                  for (const disc of discriminators) {
                    const dataVal = sectionData?.[disc];
                    if (dataVal === undefined) continue;
                    const hasMismatch = ue.issues.some(i =>
                      i.path[0] === disc && (i.code === "invalid_literal" || i.code === "invalid_enum_value")
                    );
                    if (hasMismatch) return false;
                  }
                  return true;
                });
              };

              const extractFieldErrors = (issues: z.ZodIssue[], sectionData?: Record<string, unknown>): string[] => {
                const errors: string[] = [];
                const discriminators = new Set(["type", "variant", "style", "layout"]);
                for (const i of issues) {
                  if (i.code === "invalid_union") {
                    const nestedUnionErrors = (i as { unionErrors?: z.ZodError[] }).unionErrors;
                    if (nestedUnionErrors) {
                      const bestBranch = sectionData
                        ? findBestNestedBranch(nestedUnionErrors, sectionData)
                        : undefined;
                      if (bestBranch) {
                        errors.push(...extractFieldErrors(bestBranch.issues, sectionData));
                      } else {
                        const nonDiscriminatorErrors: string[] = [];
                        for (const nue of nestedUnionErrors) {
                          for (const ni of nue.issues) {
                            if (ni.path.length > 0 && !(
                              (ni.code === "invalid_literal" || ni.code === "invalid_enum_value") &&
                              discriminators.has(String(ni.path[0]))
                            )) {
                              if (ni.code === "invalid_type" && ni.message === "Required") {
                                nonDiscriminatorErrors.push(`  - "${ni.path.join(".")}" is required`);
                              } else {
                                nonDiscriminatorErrors.push(`  - ${ni.path.join(".")}: ${ni.message}`);
                              }
                            }
                          }
                        }
                        const unique = Array.from(new Set(nonDiscriminatorErrors));
                        if (unique.length > 0) {
                          errors.push(...unique.slice(0, 3));
                        } else {
                          errors.push(`  - Invalid section configuration`);
                        }
                      }
                    }
                  } else if (i.path.length > 0) {
                    if ((i.code === "invalid_literal" || i.code === "invalid_enum_value") && discriminators.has(String(i.path[0]))) {
                      continue;
                    }
                    const fieldPath = i.path.join(".");
                    if (i.code === "invalid_type" && i.message === "Required") {
                      errors.push(`  - "${fieldPath}" is required`);
                    } else {
                      errors.push(`  - ${fieldPath}: ${i.message}`);
                    }
                  } else if (i.message !== "Invalid input") {
                    errors.push(`  - ${i.message}`);
                  }
                }
                return errors;
              };

              const sectionData = sections?.[sectionIndex] as Record<string, unknown> | undefined;
              const detailedErrors = Array.from(new Set(extractFieldErrors(matchingBranch.issues, sectionData))).slice(0, 5);
              if (detailedErrors.length > 0) {
                const variantInfo = sectionVariant ? `, variant: ${sectionVariant}` : "";
                validationErrors.push(`Section ${sectionIndex + 1} (${sectionType}${variantInfo}):\n${detailedErrors.join("\n")}`);
                continue;
              }
            }
          }
          validationErrors.push(`Section ${sectionIndex + 1} (${sectionType}): Invalid structure`);
        } else if (issue.code === "invalid_type" && issue.message === "Required") {
          validationErrors.push(`Missing required field: ${pathStr}`);
        } else {
          validationErrors.push(`${pathStr}: ${issue.message}`);
        }
      }
    }
    
    if (validationErrors.length > 0) {
      return { 
        success: false, 
        error: `Cannot save - validation failed:\n${validationErrors.join("\n")}` 
      };
    }
    
    // Write back to file
    const updatedYaml = safeYamlDump(content, {
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
    
    // Return updated sections for immediate UI update
    const updatedSections = (content.sections as unknown[]) || [];
    return { success: true, updatedSections };
  } catch (error) {
    console.error("Content edit error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export function getContentForEdit(
  contentType: "program" | "landing" | "location",
  slug: string,
  rawLocale: string,
  variant?: string,
  version?: number
): { content: Record<string, unknown> | null; error?: string } {
  // Normalize locale to prevent es-ES, en-US etc from causing file lookup failures
  const locale = normalizeLocale(rawLocale);
  
  // Validate variant/version are used together and version is valid
  const hasVariant = variant !== undefined && variant !== null && variant !== "";
  const hasValidVersion = version !== undefined && version !== null && Number.isFinite(version);
  if (hasVariant !== hasValidVersion) {
    return { content: null, error: "Both variant and version must be provided together" };
  }
  
  try {
    const filePath = getContentPath(contentType, slug, locale, variant, version);
    
    if (!fs.existsSync(filePath)) {
      return { content: null, error: `Content file not found` };
    }
    
    // Load _common.yml if it exists
    const contentFolder = getContentFolder(contentType, slug, locale);
    const commonPath = path.join(contentFolder, "_common.yml");
    let commonData: Record<string, unknown> = {};
    if (fs.existsSync(commonPath)) {
      const commonContent = fs.readFileSync(commonPath, "utf-8");
      commonData = safeYamlLoad(commonContent) as Record<string, unknown>;
    }
    
    // Read locale file content
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const localeData = safeYamlLoad(fileContent) as Record<string, unknown>;
    
    // Merge _common.yml with locale file (locale data overrides common)
    const content = deepMerge(commonData, localeData);
    
    return { content };
  } catch (error) {
    console.error("Error reading content:", error);
    return { content: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
