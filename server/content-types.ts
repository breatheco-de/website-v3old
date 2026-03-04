import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { getSupportedLocales, getDefaultLocale } from "./settings";

export interface DatabaseConfig {
  slug: string;
}

export interface ContentTypeEntry {
  directory: string;
  url_pattern: Record<string, string>;
  field_mapping?: Record<string, string | { source: string; default: string }>;
  indexes?: string[];
  database?: DatabaseConfig;
}

interface ContentTypesRegistry {
  types: Record<string, ContentTypeEntry>;
  directoryToType: Map<string, string>;
  allDirectories: string[];
  allTypes: string[];
}

let registry: ContentTypesRegistry | null = null;

const CONFIG_PATH = path.join(process.cwd(), "marketing-content", "content-types.yml");

const CONFIG_HEADER = `# Content Types Configuration
# ===========================
# Each entry defines a content type with its URL routing, field mapping, and optional database connection.
#
# Required fields:
#   directory: folder inside marketing-content/ where YAML entries live
#   url_pattern: URL routing pattern (must include :slug for unique entry URLs)
#     - Per-locale object: { en: /en/path/:slug, es: /es/ruta/:slug }
#     - Shorthand: { default: /landing/:slug } (same path for all locales)
#
# field_mapping (recommended):
#   Declares which fields are available as {{ single.* }} template variables.
#   For database-backed types: maps content concepts to database column names.
#     Underscore-prefixed fields are mandatory special fields:
#       _slug: DB field containing the entry's unique identifier
#       _locale: DB field containing the entry's language
#   For non-database types: exposes YAML keys from merged content as {{ single.* }} variables.
#     Dot-notation supported for nested keys (e.g., page_title: meta.page_title).
#
# indexes (optional):
#   Fields for filtering when listing entries. Works for DB and non-DB types.
#
# database (optional):
#   slug: database name (matches a db config in marketing-content/db/)
`;

function writeConfigWithHeader(allTypes: Record<string, ContentTypeEntry>): void {
  const yamlBody = yaml.dump(allTypes, { lineWidth: 120, noRefs: true, sortKeys: false });
  fs.writeFileSync(CONFIG_PATH, CONFIG_HEADER + "\n" + yamlBody, "utf-8");
}

function validateUrlPatterns(urlPattern: Record<string, string>): void {
  for (const [locale, pattern] of Object.entries(urlPattern)) {
    if (!pattern.startsWith("/")) {
      throw new Error(`URL pattern for "${locale}" must start with /`);
    }
    if (!pattern.includes(":slug")) {
      throw new Error(`URL pattern for "${locale}" must include :slug`);
    }
  }
}

export function normalizeUrlPattern(raw: string | Record<string, string>): Record<string, string> {
  if (typeof raw === "object" && raw !== null) return raw;
  if (typeof raw !== "string") return {};
  if (raw.includes(":locale")) {
    const result: Record<string, string> = {};
    for (const locale of getSupportedLocales()) {
      result[locale] = raw.replaceAll(":locale", locale);
    }
    return result;
  }
  return { default: raw };
}

function loadRegistry(): ContentTypesRegistry {
  if (registry) return registry;

  let parsed: Record<string, any> = {};

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      parsed = (yaml.load(raw) as Record<string, any>) || {};
    } catch (err) {
      console.error("[ContentTypes] Failed to read content-types.yml:", err);
    }
  }

  for (const config of Object.values(parsed)) {
    if (config?.url_pattern) {
      config.url_pattern = normalizeUrlPattern(config.url_pattern);
    }
    if (config?.folder && !config.directory) {
      config.directory = config.folder;
      delete config.folder;
    }
  }

  const directoryToType = new Map<string, string>();
  for (const [type, config] of Object.entries(parsed)) {
    if ((config as ContentTypeEntry).directory) {
      directoryToType.set((config as ContentTypeEntry).directory, type);
    }
  }

  registry = {
    types: parsed,
    directoryToType,
    allDirectories: Object.values(parsed).map(c => c.directory),
    allTypes: Object.keys(parsed),
  };

  return registry;
}

export function getDirectory(type: string): string {
  const reg = loadRegistry();
  const entry = reg.types[type];
  if (entry?.directory) return entry.directory;
  if (reg.directoryToType.has(type)) return type;
  return type;
}

export const getFolder = getDirectory;

export function getType(directoryOrType: string): string {
  const reg = loadRegistry();
  if (reg.types[directoryOrType]) return directoryOrType;
  const mapped = reg.directoryToType.get(directoryOrType);
  return mapped || directoryOrType;
}

export function isValidType(type: string): boolean {
  const reg = loadRegistry();
  return type in reg.types || reg.directoryToType.has(type);
}

export function getAllTypes(): string[] {
  return loadRegistry().allTypes;
}

export function getAllDirectories(): string[] {
  return loadRegistry().allDirectories;
}

export const getAllFolders = getAllDirectories;

export function getUrlPattern(type: string, locale: string): string | null {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  if (!entry?.url_pattern) return null;
  return entry.url_pattern[locale] || entry.url_pattern["default"] || null;
}

export function getContentTypeConfig(type: string): ContentTypeEntry | undefined {
  const reg = loadRegistry();
  const singular = getType(type);
  return reg.types[singular];
}

export function getAllConfigs(): Record<string, ContentTypeEntry> {
  return loadRegistry().types;
}

export function getLabel(type: string): string {
  const singular = getType(type);
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

export function getDirectoryMap(): Record<string, string> {
  const reg = loadRegistry();
  const map: Record<string, string> = {};
  for (const [type, config] of Object.entries(reg.types)) {
    map[type] = config.directory;
  }
  return map;
}

export const getFolderMap = getDirectoryMap;

export function getDatabaseName(type: string): string | null {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  return entry?.database?.slug || null;
}

export function getFullFieldMapping(type: string): Record<string, string> | null {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  const mapping = entry?.field_mapping;
  if (!mapping) return null;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(mapping)) {
    result[key] = typeof value === "object" ? value.source : value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function getFieldMapping(type: string): Record<string, string> | null {
  const full = getFullFieldMapping(type);
  if (!full) return null;
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(full)) {
    if (!key.startsWith("_")) {
      filtered[key] = value;
    }
  }
  return Object.keys(filtered).length > 0 ? filtered : null;
}

export function getSlugField(type: string): string | null {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  const slugConfig = entry?.field_mapping?._slug;
  if (!slugConfig) return null;
  if (typeof slugConfig === "object") return slugConfig.source;
  return slugConfig;
}

export function getLocaleKey(type: string): string | null {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  const localeConfig = entry?.field_mapping?._locale;
  if (!localeConfig) return null;
  const raw = typeof localeConfig === "object" ? localeConfig.source : localeConfig;
  if (raw.startsWith("function:")) {
    const mapping = entry?.field_mapping;
    if (mapping) {
      const localeLikeFields = ["lang", "locale", "language"];
      for (const f of localeLikeFields) {
        if (f in mapping && !f.startsWith("_")) return f;
      }
    }
    return null;
  }
  return raw;
}

export function getLocaleSource(type: string): string | null {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  const localeConfig = entry?.field_mapping?._locale;
  if (!localeConfig) return null;
  if (typeof localeConfig === "object") return localeConfig.source;
  return localeConfig;
}

export function getLocaleDefault(type: string): string {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  const localeConfig = entry?.field_mapping?._locale;
  if (localeConfig && typeof localeConfig === "object" && localeConfig.default) {
    return localeConfig.default;
  }
  return getDefaultLocale();
}

export function getIndexes(type: string): string[] {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  return entry?.indexes || [];
}

export function getDatabaseConfig(type: string): DatabaseConfig | null {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  return entry?.database || null;
}

export function getLookupKey(type: string): string | null {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  if (!entry?.url_pattern) return null;
  const patterns = Object.values(entry.url_pattern);
  if (patterns.length === 0) return null;
  const pattern = patterns[0];
  const params = pattern.match(/:([a-zA-Z_]+)/g);
  if (!params || params.length === 0) return null;
  return params[params.length - 1].slice(1);
}

export function hasDatabaseSingle(type: string): boolean {
  return !!getDatabaseName(type);
}

export function hasFieldMapping(type: string): boolean {
  return !!getFieldMapping(type);
}

export function updateContentTypeConfig(type: string, update: Partial<ContentTypeEntry>): void {
  const reg = loadRegistry();
  const singular = getType(type);
  const existing = reg.types[singular];
  if (!existing) {
    throw new Error(`Content type "${type}" not found`);
  }

  const merged = { ...existing, ...update };
  if (update.database && existing.database) {
    merged.database = { ...existing.database, ...update.database };
  }

  if (merged.url_pattern) {
    validateUrlPatterns(merged.url_pattern);
  }

  if (merged.database && !merged.field_mapping?._slug) {
    throw new Error(`Database-backed content type "${singular}" requires _slug in field_mapping`);
  }

  const allTypes = { ...reg.types, [singular]: merged };
  writeConfigWithHeader(allTypes);
  resetRegistry();
  console.log(`[ContentTypes] Updated config for "${singular}"`);
}

export function addContentType(name: string, config: ContentTypeEntry): void {
  const reg = loadRegistry();
  if (reg.types[name]) {
    throw new Error(`Content type "${name}" already exists`);
  }

  validateUrlPatterns(config.url_pattern);

  if (config.database && !config.field_mapping?._slug) {
    throw new Error(`Database-backed content type "${name}" requires _slug in field_mapping`);
  }

  const allTypes = { ...reg.types, [name]: config };
  writeConfigWithHeader(allTypes);
  registry = null;

  const dirPath = path.join(process.cwd(), "marketing-content", config.directory);
  const isNewDir = !fs.existsSync(dirPath);
  if (isNewDir) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[ContentTypes] Created directory: marketing-content/${config.directory}/`);
  }

  if (isNewDir) {
    const locales = getSupportedLocales();
    const sampleSlug = `sample-${name}`;
    const sampleDir = path.join(dirPath, sampleSlug);
    fs.mkdirSync(sampleDir, { recursive: true });

    const titleCase = name.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    const commonYml = [
      `slug: ${sampleSlug}`,
      `title: ${titleCase}`,
      "",
      "meta:",
      "  robots: index, follow",
      "  priority: 0.9",
      "  change_frequency: weekly",
      "",
      "schema:",
      "  include:",
      "    - organization",
      "    - website",
      "",
    ].join("\n");
    fs.writeFileSync(path.join(sampleDir, "_common.yml"), commonYml);

    for (const locale of locales) {
      const localeYml = [
        `slug: ${sampleSlug}`,
        `title: ${titleCase}`,
        "",
        "meta:",
        `  page_title: "${titleCase} | 4Geeks"`,
        `  description: "Sample ${name} entry for ${locale} locale."`,
        "",
        "sections: []",
        "",
      ].join("\n");
      fs.writeFileSync(path.join(sampleDir, `${locale}.yml`), localeYml);
    }

    console.log(`[ContentTypes] Created sample entry: marketing-content/${config.directory}/${sampleSlug}/ (${locales.length} locale(s))`);
  }

  resetRegistry();
  console.log(`[ContentTypes] Added content type "${name}"`);
}

export function resetRegistry(): void {
  registry = null;
}

function extractDotPath(record: Record<string, unknown>, dotPath: string): unknown {
  const parts = dotPath.split(".");
  let current: unknown = record;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function resolveFieldValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(",");
  if (typeof value === "object" && "slug" in (value as object)) {
    return String((value as Record<string, unknown>).slug || "");
  }
  return String(value);
}

export function resolveUrlPatternWithMapping(
  pattern: string,
  record: Record<string, unknown>,
  locale: string,
  fieldMapping?: Record<string, string | null> | null,
): string {
  let result = pattern.replaceAll(":locale", locale);

  const paramMatches = result.match(/:([a-zA-Z_]+)/g) || [];
  for (const param of paramMatches) {
    const key = param.slice(1);

    let rawValue: unknown;

    const mappingKey = fieldMapping && `_${key}` in fieldMapping ? `_${key}` : key;
    if (fieldMapping && mappingKey in fieldMapping) {
      const sourceField = fieldMapping[mappingKey];
      if (sourceField) {
        rawValue = extractDotPath(record, sourceField);
      }
    }

    if (rawValue === undefined) {
      rawValue = extractDotPath(record, key);
    }

    result = result.replaceAll(param, resolveFieldValue(rawValue));
  }

  result = result.replace(/\/\/+/g, "/");

  return result;
}

export function resolveContentTypeUrl(
  type: string,
  record: Record<string, unknown>,
  locale: string,
): string | null {
  const config = getContentTypeConfig(type);
  if (!config?.url_pattern) return null;
  const pattern = config.url_pattern[locale] || config.url_pattern["default"] || config.url_pattern["en"];
  if (!pattern) return null;
  const mapping = getFullFieldMapping(type);
  return resolveUrlPatternWithMapping(pattern, record, locale, mapping);
}
