import * as fs from "fs";
import * as path from "path";
import type { Validator, ValidationContext, ValidatorResult, ValidationIssue } from "../shared/types";
import { getAllConfigs } from "../../../server/content-types";
import { databaseManager } from "../../../server/database";

const MARKETING_CONTENT_PATH = path.join(process.cwd(), "marketing-content");
const SINGLE_VAR_PATTERN = /\{\{\s*single\.([a-zA-Z_][a-zA-Z0-9_.]*)\s*(?:\|\s*[^}]*?)?\s*\}\}/g;

function extractSingleVarNames(content: string): string[] {
  const names: string[] = [];
  let match;
  const re = new RegExp(SINGLE_VAR_PATTERN.source, "g");
  while ((match = re.exec(content)) !== null) {
    if (!names.includes(match[1])) {
      names.push(match[1]);
    }
  }
  return names;
}

function getNestedKeys(obj: unknown, prefix = ""): string[] {
  if (!obj || typeof obj !== "object") return [];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key;
    keys.push(full);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...getNestedKeys(value, full));
    }
  }
  return keys;
}

export const databaseSinglesValidator: Validator = {
  name: "database-singles",
  description: "Validates database-backed content type single templates and detects conflicts",
  apiExposed: true,
  estimatedDuration: "medium",
  category: "integrity",

  async run(_context: ValidationContext): Promise<ValidatorResult> {
    const start = Date.now();
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    const configs = getAllConfigs();
    const dbTypes = Object.entries(configs).filter(([, config]) => config.database);

    if (dbTypes.length === 0) {
      return {
        name: this.name,
        description: this.description,
        status: "passed",
        errors: [],
        warnings: [],
        duration: Date.now() - start,
      };
    }

    for (const [contentType, config] of dbTypes) {
      const folder = config.folder || contentType;
      const typeDir = path.join(MARKETING_CONTENT_PATH, folder);
      const dbName = config.database!;

      const locales = Object.keys(config.url_pattern).filter(k => k !== "default");
      if (locales.length === 0) locales.push("en");

      for (const locale of locales) {
        const singlePath = path.join(typeDir, `single.${locale}.yml`);
        if (!fs.existsSync(singlePath)) {
          errors.push({
            type: "error",
            code: "MISSING_SINGLE_TEMPLATE",
            message: `Missing single template: ${folder}/single.${locale}.yml`,
            file: `marketing-content/${folder}/single.${locale}.yml`,
            suggestion: `Create the template file or ensure auto-creation runs on startup`,
          });
        }
      }

      if (!databaseManager.exists(dbName)) {
        errors.push({
          type: "error",
          code: "DATABASE_UNREACHABLE",
          message: `Database "${dbName}" not found for content type "${contentType}"`,
          suggestion: `Add a database configuration at marketing-content/db/${dbName}/config.yml`,
        });
        continue;
      }

      let items: Record<string, unknown>[] = [];
      try {
        const result = await databaseManager.fetchItems(dbName);
        items = result.items as Record<string, unknown>[];
      } catch (err) {
        errors.push({
          type: "error",
          code: "DATABASE_UNREACHABLE",
          message: `Failed to fetch items from database "${dbName}": ${err}`,
          suggestion: `Check database configuration and API connectivity`,
        });
        continue;
      }

      const urlPatterns = Object.values(config.url_pattern);
      const pattern = urlPatterns[0] || "";
      const paramNames = (pattern.match(/:([a-zA-Z_]+)/g) || []).map(p => p.slice(1));
      const lookupKey = paramNames.length > 0 ? paramNames[paramNames.length - 1] : "slug";

      const fieldMapping = config.field_mapping;
      if (fieldMapping) {
        items = items.map((item) => {
          const mapped: Record<string, unknown> = { ...item };
          for (const [targetField, sourcePath] of Object.entries(fieldMapping)) {
            const parts = sourcePath.split(".");
            let current: unknown = item;
            for (const part of parts) {
              if (current == null || typeof current !== "object") { current = undefined; break; }
              current = (current as Record<string, unknown>)[part];
            }
            if (current !== undefined) mapped[targetField] = current;
          }
          return mapped;
        });
      }

      const slugCounts = new Map<string, number>();
      for (const item of items) {
        const key = String(item[lookupKey] || "");
        if (key) {
          slugCounts.set(key, (slugCounts.get(key) || 0) + 1);
        }
      }
      for (const [slug, count] of slugCounts) {
        if (count > 1) {
          warnings.push({
            type: "warning",
            code: "DUPLICATE_DATABASE_SLUG",
            message: `Duplicate ${lookupKey}="${slug}" found ${count} times in database "${dbName}"`,
            suggestion: `Only the first matching item will be used for ${contentType}/${slug}`,
          });
        }
      }

      const diskEntries = fs.existsSync(typeDir)
        ? fs.readdirSync(typeDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name)
        : [];

      for (const diskSlug of diskEntries) {
        if (slugCounts.has(diskSlug)) {
          warnings.push({
            type: "warning",
            code: "DISK_OVERRIDES_DATABASE",
            message: `Disk folder "${folder}/${diskSlug}" overrides database item with ${lookupKey}="${diskSlug}"`,
            file: `marketing-content/${folder}/${diskSlug}/`,
            suggestion: `The disk-based YAML files take priority. Remove the disk folder to use the database item instead.`,
          });
        }
      }

      const sampleItem = items[0];
      if (sampleItem) {
        const availableFields = new Set(getNestedKeys(sampleItem));

        for (const locale of locales) {
          const singlePath = path.join(typeDir, `single.${locale}.yml`);
          if (!fs.existsSync(singlePath)) continue;

          try {
            const content = fs.readFileSync(singlePath, "utf-8");
            const varNames = extractSingleVarNames(content);

            for (const varName of varNames) {
              if (!availableFields.has(varName)) {
                warnings.push({
                  type: "warning",
                  code: "UNRESOLVED_SINGLE_VARS",
                  message: `Template variable "{{ single.${varName} }}" in ${folder}/single.${locale}.yml has no matching field in database items`,
                  file: `marketing-content/${folder}/single.${locale}.yml`,
                  suggestion: `Available fields: ${Array.from(availableFields).slice(0, 15).join(", ")}${availableFields.size > 15 ? "..." : ""}`,
                });
              }
            }
          } catch {}
        }
      }
    }

    const status = errors.length > 0 ? "failed" : warnings.length > 0 ? "warning" : "passed";

    return {
      name: this.name,
      description: this.description,
      status,
      errors,
      warnings,
      duration: Date.now() - start,
    };
  },
};
