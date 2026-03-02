import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { SUPPORTED_LOCALES } from "@shared/locale";

export interface DatabaseConfig {
  slug: string;
  field_mapping?: Record<string, string | { source: string; default: string }>;
  indexes?: string[];
}

export interface ContentTypeEntry {
  directory: string;
  url_pattern: Record<string, string>;
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

export function normalizeUrlPattern(raw: string | Record<string, string>): Record<string, string> {
  if (typeof raw === "object" && raw !== null) return raw;
  if (typeof raw !== "string") return {};
  if (raw.includes(":locale")) {
    const result: Record<string, string> = {};
    for (const locale of SUPPORTED_LOCALES) {
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

export function getFieldMapping(type: string): Record<string, string> | null {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  const mapping = entry?.database?.field_mapping;
  if (!mapping) return null;
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(mapping)) {
    if (!key.startsWith("_")) {
      filtered[key] = typeof value === "object" ? value.source : value;
    }
  }
  return Object.keys(filtered).length > 0 ? filtered : null;
}

export function getLocaleKey(type: string): string | null {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  const localeConfig = entry?.database?.field_mapping?._locale;
  if (!localeConfig) return null;
  if (typeof localeConfig === "object") return localeConfig.source;
  return localeConfig;
}

export function getLocaleDefault(type: string): string {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  const localeConfig = entry?.database?.field_mapping?._locale;
  if (localeConfig && typeof localeConfig === "object" && localeConfig.default) {
    return localeConfig.default;
  }
  return "en";
}

export function getIndexes(type: string): string[] {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  return entry?.database?.indexes || [];
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

  const allTypes = { ...reg.types, [singular]: merged };

  const yamlBody = yaml.dump(allTypes, { lineWidth: 120, noRefs: true, sortKeys: false });
  fs.writeFileSync(CONFIG_PATH, yamlBody, "utf-8");
  resetRegistry();
  console.log(`[ContentTypes] Updated config for "${singular}"`);
}

export function addContentType(name: string, config: ContentTypeEntry): void {
  const reg = loadRegistry();
  if (reg.types[name]) {
    throw new Error(`Content type "${name}" already exists`);
  }

  const allTypes = { ...reg.types, [name]: config };
  const yamlBody = yaml.dump(allTypes, { lineWidth: 120, noRefs: true, sortKeys: false });
  fs.writeFileSync(CONFIG_PATH, yamlBody, "utf-8");

  const dirPath = path.join(process.cwd(), "marketing-content", config.directory);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[ContentTypes] Created directory: marketing-content/${config.directory}/`);
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

    if (fieldMapping && key in fieldMapping) {
      const sourceField = fieldMapping[key];
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
  const mapping = getFieldMapping(type);
  return resolveUrlPatternWithMapping(pattern, record, locale, mapping);
}
