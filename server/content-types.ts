import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export interface ContentTypeEntry {
  folder: string;
  url_pattern: Record<string, string>;
}

interface ContentTypesRegistry {
  types: Record<string, ContentTypeEntry>;
  folderToType: Map<string, string>;
  allFolders: string[];
  allTypes: string[];
}

let registry: ContentTypesRegistry | null = null;

function loadRegistry(): ContentTypesRegistry {
  if (registry) return registry;

  const configPath = path.join(process.cwd(), "marketing-content", "content-types.yml");
  let parsed: Record<string, ContentTypeEntry> = {};

  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
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

export function resetRegistry(): void {
  registry = null;
}
