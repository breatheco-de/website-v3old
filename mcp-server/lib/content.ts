import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export const MARKETING_CONTENT_PATH = path.join(process.cwd(), "marketing-content");
export const COMPONENT_REGISTRY_PATH = path.join(MARKETING_CONTENT_PATH, "component-registry");
export const CONTENT_TYPES_PATH = path.join(MARKETING_CONTENT_PATH, "content-types.yml");

// ─── YAML helpers ─────────────────────────────────────────────────────────────

export function safeLoad(raw: string): Record<string, unknown> | null {
  try {
    return (yaml.load(raw) as Record<string, unknown>) || null;
  } catch {
    return null;
  }
}

export function safeDump(obj: unknown): string {
  return yaml.dump(obj, { lineWidth: -1, noRefs: true, quotingType: '"', forceQuotes: false });
}

export function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      typeof result[k] === "object" &&
      result[k] !== null &&
      !Array.isArray(result[k])
    ) {
      result[k] = deepMerge(result[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ─── Content type helpers ─────────────────────────────────────────────────────

export interface ContentTypeConfig {
  directory?: string;
  url_pattern?: Record<string, string>;
  database?: { slug: string };
  field_mapping?: Record<string, unknown>;
  layout?: unknown;
}

export function loadContentTypes(): Record<string, ContentTypeConfig> {
  if (!fs.existsSync(CONTENT_TYPES_PATH)) return {};
  const raw = fs.readFileSync(CONTENT_TYPES_PATH, "utf-8");
  return (safeLoad(raw) as Record<string, ContentTypeConfig>) || {};
}

export function isDbBacked(config: ContentTypeConfig): boolean {
  return !!config?.database?.slug;
}

export function getDirectory(contentType: string, config: ContentTypeConfig): string {
  return config.directory || contentType;
}

export function resolveContentType(
  slug: string,
  hintContentType?: string,
): { contentType: string; config: ContentTypeConfig } | null {
  const configs = loadContentTypes();
  if (hintContentType) {
    const config = configs[hintContentType];
    if (!config || isDbBacked(config)) return null;
    const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(hintContentType, config), slug);
    if (fs.existsSync(dir)) return { contentType: hintContentType, config };
    return null;
  }
  for (const [ct, config] of Object.entries(configs)) {
    if (isDbBacked(config)) continue;
    const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(ct, config), slug);
    if (fs.existsSync(dir)) return { contentType: ct, config };
  }
  return null;
}

// ─── Page helpers ─────────────────────────────────────────────────────────────

export interface PageEntry {
  slug: string;
  contentType: string;
  directory: string;
  locales: string[];
  title?: string;
}

export function scanPages(): PageEntry[] {
  const configs = loadContentTypes();
  const pages: PageEntry[] = [];

  for (const [contentType, config] of Object.entries(configs)) {
    if (isDbBacked(config)) continue;

    const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(contentType, config));
    if (!fs.existsSync(dir)) continue;

    const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      const files = fs.readdirSync(entryPath).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
      if (files.length === 0) continue;

      const locales = files
        .map(f => f.replace(/\.(yml|yaml)$/, ""))
        .filter(n => /^[a-z]{2}(-[a-z]{2})?$/.test(n));

      let title: string | undefined;
      for (const candidate of ["_common.yml", "_common.yaml", "en.yml", "en.yaml"]) {
        if (files.includes(candidate)) {
          try {
            const parsed = safeLoad(fs.readFileSync(path.join(entryPath, candidate), "utf-8"));
            if (parsed?.title && typeof parsed.title === "string") { title = parsed.title; break; }
            if (parsed?.name && typeof parsed.name === "string") { title = parsed.name; break; }
          } catch {}
        }
      }

      pages.push({
        slug: entry.name,
        contentType,
        directory: `marketing-content/${getDirectory(contentType, config)}/${entry.name}`,
        locales,
        title,
      });
    }
  }
  return pages;
}

export function loadPage(
  contentType: string,
  slug: string,
  locale: string,
): { data: Record<string, unknown>; filePath: string } | null {
  const configs = loadContentTypes();
  const config = configs[contentType];
  if (!config || isDbBacked(config)) return null;

  const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(contentType, config), slug);
  if (!fs.existsSync(dir)) return null;

  const commonPath = path.join(dir, "_common.yml");
  const localePath = path.join(dir, `${locale}.yml`);

  let commonData: Record<string, unknown> = {};
  if (fs.existsSync(commonPath)) {
    commonData = safeLoad(fs.readFileSync(commonPath, "utf-8")) || {};
  }

  if (!fs.existsSync(localePath)) return null;
  const localeData = safeLoad(fs.readFileSync(localePath, "utf-8")) || {};

  return {
    data: deepMerge(commonData, localeData),
    filePath: localePath,
  };
}

export function getValueAtPath(obj: Record<string, unknown>, pathStr: string): unknown {
  const parts = pathStr.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setValueAtPath(obj: Record<string, unknown>, pathStr: string, value: unknown): void {
  const parts = pathStr.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || typeof current[part] !== "object") {
      current[part] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

// ─── Component registry helpers ───────────────────────────────────────────────

export interface ComponentInfo {
  type: string;
  version: string;
  name?: string;
  description?: string;
  variants?: string[];
}

export function listComponents(): ComponentInfo[] {
  if (!fs.existsSync(COMPONENT_REGISTRY_PATH)) return [];
  const components: ComponentInfo[] = [];

  const entries = fs
    .readdirSync(COMPONENT_REGISTRY_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith("_"));

  for (const entry of entries) {
    const componentPath = path.join(COMPONENT_REGISTRY_PATH, entry.name);
    const versionDirs = fs
      .readdirSync(componentPath, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^v\d/.test(d.name));

    for (const vDir of versionDirs) {
      const schemaYml = path.join(componentPath, vDir.name, "schema.yml");
      let name: string | undefined;
      let description: string | undefined;
      let variants: string[] | undefined;

      if (fs.existsSync(schemaYml)) {
        const parsed = safeLoad(fs.readFileSync(schemaYml, "utf-8"));
        if (parsed) {
          name = typeof parsed.name === "string" ? parsed.name : undefined;
          description = typeof parsed.description === "string" ? parsed.description : undefined;
          if (parsed.variants && typeof parsed.variants === "object" && !Array.isArray(parsed.variants)) {
            variants = Object.keys(parsed.variants as Record<string, unknown>);
          } else if (Array.isArray(parsed.variants)) {
            variants = (parsed.variants as unknown[]).map(String);
          }
        }
      }

      components.push({ type: entry.name, version: vDir.name, name, description, variants });
    }
  }

  return components.sort((a, b) => a.type.localeCompare(b.type));
}

export function getComponentSchema(
  componentType: string,
): { schema: Record<string, unknown> | null; examples: Record<string, string> } {
  const componentPath = path.join(COMPONENT_REGISTRY_PATH, componentType);
  if (!fs.existsSync(componentPath)) return { schema: null, examples: {} };

  const versionDirs = fs
    .readdirSync(componentPath, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^v\d/.test(d.name))
    .sort((a, b) => b.name.localeCompare(a.name));

  if (versionDirs.length === 0) return { schema: null, examples: {} };

  const latestVersion = versionDirs[0].name;
  const versionPath = path.join(componentPath, latestVersion);

  let schema: Record<string, unknown> | null = null;
  const schemaYml = path.join(versionPath, "schema.yml");
  if (fs.existsSync(schemaYml)) {
    schema = safeLoad(fs.readFileSync(schemaYml, "utf-8"));
  }

  const examples: Record<string, string> = {};
  const examplesPath = path.join(versionPath, "examples");
  if (fs.existsSync(examplesPath)) {
    const exampleFiles = fs
      .readdirSync(examplesPath)
      .filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
    for (const exFile of exampleFiles) {
      try {
        const raw = fs.readFileSync(path.join(examplesPath, exFile), "utf-8");
        const parsed = safeLoad(raw);
        const exampleName = exFile.replace(/\.(yml|yaml)$/, "");
        examples[exampleName] = parsed?.yaml && typeof parsed.yaml === "string" ? parsed.yaml : raw;
      } catch {}
    }
  }

  return { schema, examples };
}
