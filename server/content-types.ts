import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export interface DatabaseConfig {
  slug: string;
  field_mapping?: Record<string, string>;
}

export interface ContentTypeEntry {
  folder: string;
  url_pattern: Record<string, string>;
  database?: DatabaseConfig;
}

interface ContentTypesRegistry {
  types: Record<string, ContentTypeEntry>;
  folderToType: Map<string, string>;
  allFolders: string[];
  allTypes: string[];
}

let registry: ContentTypesRegistry | null = null;

const CONFIG_PATH = path.join(process.cwd(), "marketing-content", "content-types.yml");

function loadRegistry(): ContentTypesRegistry {
  if (registry) return registry;

  let parsed: Record<string, ContentTypeEntry> = {};

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      parsed = (yaml.load(raw) as Record<string, ContentTypeEntry>) || {};
    } catch (err) {
      console.error("[ContentTypes] Failed to read content-types.yml:", err);
    }
  }

  const folderToType = new Map<string, string>();
  for (const [type, config] of Object.entries(parsed)) {
    if (config.folder) {
      folderToType.set(config.folder, type);
    }
  }

  registry = {
    types: parsed,
    folderToType,
    allFolders: Object.values(parsed).map(c => c.folder),
    allTypes: Object.keys(parsed),
  };

  return registry;
}

export function getFolder(type: string): string {
  const reg = loadRegistry();
  const entry = reg.types[type];
  if (entry?.folder) return entry.folder;
  if (reg.folderToType.has(type)) return type;
  return type;
}

export function getType(folderOrType: string): string {
  const reg = loadRegistry();
  if (reg.types[folderOrType]) return folderOrType;
  const mapped = reg.folderToType.get(folderOrType);
  return mapped || folderOrType;
}

export function isValidType(type: string): boolean {
  const reg = loadRegistry();
  return type in reg.types || reg.folderToType.has(type);
}

export function getAllTypes(): string[] {
  return loadRegistry().allTypes;
}

export function getAllFolders(): string[] {
  return loadRegistry().allFolders;
}

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

export function getFolderMap(): Record<string, string> {
  const reg = loadRegistry();
  const map: Record<string, string> = {};
  for (const [type, config] of Object.entries(reg.types)) {
    map[type] = config.folder;
  }
  return map;
}

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
      filtered[key] = value;
    }
  }
  return Object.keys(filtered).length > 0 ? filtered : null;
}

export function getLocaleKey(type: string): string | null {
  const reg = loadRegistry();
  const singular = getType(type);
  const entry = reg.types[singular];
  return entry?.database?.field_mapping?._locale || null;
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

export function resetRegistry(): void {
  registry = null;
}
