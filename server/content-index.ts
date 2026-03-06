
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import type { ZodSchema } from "zod";
import { escapeTemplateVars, unescapeObjectVars, escapeObjectVars, unescapeYamlDump } from "../shared/templateVars";
import { deepMerge } from "./utils/deepMerge";
import { regenerateSectionIds } from "./utils/regenerateSectionIds";
import { normalizeUrlPattern, getAllConfigs, getFieldMapping } from "./content-types";
import { regenerateSectionIds } from "./utils/regenerateSectionIds";

export const MARKETING_CONTENT_PATH = path.join(process.cwd(), "marketing-content");

function stripNullValues<T>(obj: T): T {
  if (obj === null) {
    return undefined as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj
      .map(item => stripNullValues(item))
      .filter(item => item !== undefined) as unknown as T;
  }
  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null) {
        result[key] = stripNullValues(value);
      }
    }
    return result as T;
  }
  return obj;
}

export type ContentType = string;

export interface LoadContentOptions<T> {
  contentType: ContentType;
  slug: string;
  schema: ZodSchema<T>;
  localeOrVariant: string;
  requireCommon?: boolean;
}

export type LoadContentResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ContentTypeConfig {
  directory: string;
  url_pattern: Record<string, string>;
  database?: {
    slug: string;
    field_mapping?: Record<string, string | { source: string; default: string }>;
    indexes?: string[];
  };
}

export interface ContentEntry {
  slug: string;
  contentType: string;
  directory: string;
  files: string[];
  locales: string[];
  title?: string;
}

export interface FindOptions {
  contentType?: string;
}

export interface RedirectEntry {
  from: string;
  to: string | Record<string, string>;
  type: string;
  source: string;
  status: number;
  priority?: "before" | "fallback";
}

export interface SeoEntry {
  slug: string;
  contentType: string;
  intent?: string;
  pillar?: string;
  focusFeatures?: string[];
  file: string;
}

export interface CommonFieldInfo {
  common: string[];
  partial: { key: string; count: number; total: number }[];
}

class ContentIndex {
  private entries: ContentEntry[] = [];
  private bySlug: Map<string, ContentEntry[]> = new Map();
  private byPath: Map<string, ContentEntry> = new Map();
  private imageUsage: Map<string, Set<string>> = new Map();
  private variableUsage: Map<string, Set<string>> = new Map();
  private redirectEntries: RedirectEntry[] = [];
  private localeSlugMap: Map<string, string> = new Map();
  private contentTypeConfigs: Record<string, ContentTypeConfig> = {};
  private commonFieldsCache: Map<string, CommonFieldInfo> = new Map();
  private menuUsage: Map<string, { contentType: string; slug: string; source: string; position: "top" | "bottom" }[]> = new Map();
  private seoIndex: Map<string, SeoEntry> = new Map();
  private clusterIndex: Map<string, string[]> = new Map();
  private initialized = false;

  private static instance: ContentIndex;

  static getInstance(): ContentIndex {
    if (!ContentIndex.instance) {
      ContentIndex.instance = new ContentIndex();
    }
    return ContentIndex.instance;
  }

  private constructor() {}

  private loadContentTypes(): Record<string, ContentTypeConfig> {
    const configPath = path.join(process.cwd(), "marketing-content", "content-types.yml");
    if (!fs.existsSync(configPath)) {
      console.warn("[ContentIndex] content-types.yml not found, using empty config");
      return {};
    }
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = this.safeYamlLoad(raw) as Record<string, any> | null;
      if (!parsed) return {};
      for (const config of Object.values(parsed)) {
        if (config?.url_pattern) {
          config.url_pattern = normalizeUrlPattern(config.url_pattern);
        }
      }
      return parsed as Record<string, ContentTypeConfig>;
    } catch (err) {
      console.error("[ContentIndex] Failed to read content-types.yml:", err);
      return {};
    }
  }

  buildUrl(contentType: string, locale: string, slug: string, params?: Record<string, string>): string {
    const normalized = this.normalizeType(contentType);
    const config = this.contentTypeConfigs[normalized];
    if (!config?.url_pattern) {
      return `/${locale}/${slug}`;
    }

    let url = config.url_pattern[locale] || config.url_pattern["default"] || `/${locale}/${slug}`;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url = url.replace(`:${key}`, value);
      }
    }
    url = url.replace(/:([a-zA-Z_]+)/g, (_m, paramName) => {
      if (paramName === "slug") return slug;
      return "";
    });
    return url;
  }

  getContentTypes(): string[] {
    this.ensureInitialized();
    return Object.keys(this.contentTypeConfigs);
  }

  getContentTypeConfig(contentType: string): ContentTypeConfig | undefined {
    this.ensureInitialized();
    const normalized = this.normalizeType(contentType);
    return this.contentTypeConfigs[normalized];
  }

  normalizeType(typeOrFolder: string): string {
    const config = this.contentTypeConfigs[typeOrFolder];
    if (config) return typeOrFolder;
    for (const [type, cfg] of Object.entries(this.contentTypeConfigs)) {
      if (cfg.directory === typeOrFolder) return type;
    }
    return typeOrFolder;
  }

  getFolderName(type: string): string {
    const config = this.contentTypeConfigs[type];
    if (config?.directory) return config.directory;
    for (const [, cfg] of Object.entries(this.contentTypeConfigs)) {
      if (cfg.directory === type) return type;
    }
    return type;
  }

  scan(): void {
    const baseDir = path.join(process.cwd(), "marketing-content");
    this.contentTypeConfigs = this.loadContentTypes();
    const contentTypes = Object.keys(this.contentTypeConfigs);

    this.entries = [];
    this.bySlug = new Map();
    this.byPath = new Map();
    this.imageUsage = new Map();
    this.variableUsage = new Map();
    this.redirectEntries = [];
    this.localeSlugMap = new Map();
    this.commonFieldsCache = new Map();
    this.menuUsage = new Map();
    this.seoIndex = new Map();
    this.clusterIndex = new Map();

    for (const contentType of contentTypes) {
      const diskFolder = this.contentTypeConfigs[contentType]?.directory || contentType;
      const typeDir = path.join(baseDir, diskFolder);
      if (!fs.existsSync(typeDir)) continue;

      const folders = fs.readdirSync(typeDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const folderName of folders) {
        const folderPath = path.join(typeDir, folderName);
        const relFolder = `marketing-content/${diskFolder}/${folderName}`;
        const files = fs.readdirSync(folderPath)
          .filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));

        if (files.length === 0) continue;

        const slug = this.extractSlug(folderPath, folderName, files);
        const locales = this.extractLocales(files, contentType);
        const title = this.extractTitle(folderPath, files, contentType);

        const entry: ContentEntry = {
          slug,
          contentType,
          directory: relFolder,
          files,
          locales,
          title,
        };

        this.entries.push(entry);

        const existing = this.bySlug.get(slug) || [];
        existing.push(entry);
        this.bySlug.set(slug, existing);

        this.byPath.set(relFolder, entry);

        for (const file of files) {
          const filePath = path.join(folderPath, file);
          const relFilePath = `${relFolder}/${file}`;
          try {
            const raw = fs.readFileSync(filePath, "utf-8");
            this.extractVariableReferences(raw, relFilePath);
            const parsed = this.safeYamlLoad(raw);
            this.extractImageReferences(parsed, relFilePath);
            this.extractMenuReferences(parsed, contentType, folderName, file);
            const locale = file.replace(/\.(yml|yaml)$/, "");
            if (locale !== "_common" && !locale.startsWith("_")) {
              this.extractSeoData(parsed, slug, contentType, relFilePath);
            }
            if (parsed && this.contentTypeHasRedirects(contentType)) {
              const localeSlugForRedirect = (parsed.slug && typeof parsed.slug === "string") ? parsed.slug : slug;
              this.extractRedirects(parsed, slug, locale, contentType, relFilePath, localeSlugForRedirect);
            }
            if (parsed?.slug && typeof parsed.slug === "string") {
              const localeSlug = parsed.slug;
              if (localeSlug !== slug) {
                this.localeSlugMap.set(`${localeSlug}:${contentType}`, slug);
              }
            }
          } catch {}
        }
      }
    }

    this.scanCustomRedirects(baseDir);
    this.autoCreateSingleTemplates(baseDir);

    this.warnMissingSlugMappings();

    this.initialized = true;
    const imageRefCount = this.imageUsage.size;
    const variableRefCount = this.variableUsage.size;
    const menuRefCount = this.menuUsage.size;
    const seoEntryCount = this.seoIndex.size;
    console.log(`[ContentIndex] Scanned ${this.entries.length} content entries, ${imageRefCount} image references tracked, ${variableRefCount} variable references tracked, ${menuRefCount} menu references tracked, ${this.redirectEntries.length} redirects, ${seoEntryCount} seo entries tracked`);
  }

  safeYamlLoad(raw: string): Record<string, unknown> | null {
    const { escaped, map } = escapeTemplateVars(raw);
    const parsed = yaml.load(escaped) as Record<string, unknown> | null;
    if (!parsed) return null;
    return unescapeObjectVars(parsed, map) as Record<string, unknown>;
  }

  private contentTypeHasRedirects(contentType: string): boolean {
    return contentType === "program" || contentType === "landing" || contentType === "page" || contentType === "location";
  }

  private addImageRef(ref: string, filePath: string): void {
    if (!ref || typeof ref !== "string") return;
    const existing = this.imageUsage.get(ref);
    if (existing) {
      existing.add(filePath);
    } else {
      this.imageUsage.set(ref, new Set([filePath]));
    }
  }

  private addVariableRef(varName: string, filePath: string): void {
    if (!varName || typeof varName !== "string") return;
    const existing = this.variableUsage.get(varName);
    if (existing) {
      existing.add(filePath);
    } else {
      this.variableUsage.set(varName, new Set([filePath]));
    }
  }

  private extractVariableReferences(rawContent: string, filePath: string): void {
    const regex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\|[^}]*)?\}\}/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rawContent)) !== null) {
      this.addVariableRef(match[1], filePath);
    }
  }

  private addMenuRef(menuId: string, contentType: string, slug: string, source: string, position: "top" | "bottom"): void {
    if (!menuId || typeof menuId !== "string") return;
    const existing = this.menuUsage.get(menuId) || [];
    existing.push({ contentType, slug, source, position });
    this.menuUsage.set(menuId, existing);
  }

  private extractMenuReferences(parsed: Record<string, unknown> | null, contentType: string, slug: string, fileName: string): void {
    if (!parsed) return;
    const layout = parsed.layout as { menu?: { top?: string | null; bottom?: string | null } } | undefined;
    if (!layout?.menu) return;
    if (layout.menu.top && typeof layout.menu.top === "string") {
      this.addMenuRef(layout.menu.top, contentType, slug, fileName, "top");
    }
    if (layout.menu.bottom && typeof layout.menu.bottom === "string") {
      this.addMenuRef(layout.menu.bottom, contentType, slug, fileName, "bottom");
    }
  }

  getMenuUsageByMenuId(menuId: string): { contentType: string; slug: string; source: string; position: "top" | "bottom" }[] {
    this.ensureInitialized();
    return this.menuUsage.get(menuId) || [];
  }

  getAllMenuUsage(): Map<string, { contentType: string; slug: string; source: string; position: "top" | "bottom" }[]> {
    this.ensureInitialized();
    return this.menuUsage;
  }

  private extractSeoData(parsed: Record<string, unknown> | null, slug: string, contentType: string, filePath: string): void {
    if (!parsed) return;
    const seo = parsed.seo as Record<string, unknown> | undefined;
    if (!seo || typeof seo !== "object") return;

    const intent = typeof seo.intent === "string" ? seo.intent : undefined;
    const pillar = typeof seo.pillar === "string" && seo.pillar ? seo.pillar : undefined;
    const focusFeatures = Array.isArray(seo.focus_features)
      ? (seo.focus_features as unknown[]).filter((f): f is string => typeof f === "string")
      : undefined;

    const key = `${slug}:${contentType}`;
    const existing = this.seoIndex.get(key);
    const entry: SeoEntry = {
      slug,
      contentType,
      intent: intent ?? existing?.intent,
      pillar: pillar ?? existing?.pillar,
      focusFeatures: focusFeatures ?? existing?.focusFeatures,
      file: filePath,
    };
    this.seoIndex.set(key, entry);

    if (pillar) {
      const cluster = this.clusterIndex.get(pillar) || [];
      if (!cluster.includes(slug)) {
        cluster.push(slug);
        this.clusterIndex.set(pillar, cluster);
      }
    }
  }

  getSeoEntry(slug: string, contentType: string): SeoEntry | undefined {
    this.ensureInitialized();
    return this.seoIndex.get(`${slug}:${contentType}`);
  }

  getCluster(pillarUrl: string): string[] {
    this.ensureInitialized();
    return this.clusterIndex.get(pillarUrl) || [];
  }

  getAllSeoEntries(): SeoEntry[] {
    this.ensureInitialized();
    return Array.from(this.seoIndex.values());
  }

  private extractImageReferences(obj: unknown, filePath: string): void {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.extractImageReferences(item, filePath);
      }
      return;
    }

    const record = obj as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string" && value.trim()) {
        if (key === "image_id") {
          this.addImageRef(value, filePath);
        } else if (
          (key === "image" || key === "src" || key === "background_image" || key === "logo" || key === "icon_image") &&
          (value.startsWith("/attached_assets/") || value.startsWith("/marketing-content/images/") || value.startsWith("http://") || value.startsWith("https://"))
        ) {
          this.addImageRef(value, filePath);
        }
      } else if (typeof value === "object" && value !== null) {
        this.extractImageReferences(value, filePath);
      }
    }
  }

  private buildLocaleUrlsInternal(slug: string, contentType: string): Record<string, string> {
    const matches = this.bySlug.get(slug) || [];
    const entry = matches.find(e => e.contentType === contentType);
    if (!entry) return {};

    const basePath = path.join(process.cwd(), entry.directory);
    const urls: Record<string, string> = {};

    for (const locale of entry.locales) {
      if (locale.startsWith("_") || locale.includes(".")) continue;

      let localeSlug = slug;
      const candidates = [`${locale}.yml`, `${locale}.yaml`];
      for (const candidate of candidates) {
        const filePath = path.join(basePath, candidate);
        if (fs.existsSync(filePath)) {
          try {
            const raw = fs.readFileSync(filePath, "utf-8");
            const parsed = this.safeYamlLoad(raw);
            if (parsed?.slug && typeof parsed.slug === "string") {
              localeSlug = parsed.slug;
            }
          } catch {}
          break;
        }
      }

      urls[locale] = this.buildUrl(contentType, locale, localeSlug);
    }

    return urls;
  }

  private getCanonicalUrl(contentType: string, slug: string, locale: string): string {
    return this.buildUrl(contentType, locale, slug);
  }

  private extractRedirects(
    parsed: Record<string, unknown>,
    slug: string,
    locale: string,
    contentType: string,
    filePath: string,
    localeSlug?: string,
  ): void {
    const meta = parsed.meta as Record<string, unknown> | undefined;
    const redirects = meta?.redirects as unknown[] | undefined;
    if (!Array.isArray(redirects)) return;

    const isCommon = locale === "_common";
    const typeLabel = isCommon ? `${contentType}-common` : contentType;

    let targetTo: string | Record<string, string>;
    if (isCommon) {
      targetTo = this.buildLocaleUrlsInternal(slug, contentType);
      if (Object.keys(targetTo).length === 0) {
        targetTo = this.getCanonicalUrl(contentType, slug, "en");
      }
    } else {
      const effectiveSlug = localeSlug || slug;
      targetTo = this.getCanonicalUrl(contentType, effectiveSlug, locale);
    }

    for (const redirect of redirects) {
      let rawPath: string;
      let status = 301;

      if (typeof redirect === "string") {
        rawPath = redirect;
      } else if (typeof redirect === "object" && redirect !== null && "path" in redirect) {
        const obj = redirect as { path: string; status?: number };
        rawPath = obj.path;
        if (obj.status && [301, 302].includes(obj.status)) {
          status = obj.status;
        }
      } else {
        continue;
      }

      let normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
      normalized = normalized.toLowerCase();
      if (normalized.length > 1 && normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
      }
      this.redirectEntries.push({
        from: normalized,
        to: targetTo,
        type: typeLabel,
        source: filePath,
        status,
      });
    }
  }

  private scanCustomRedirects(baseDir: string): void {
    const customFile = path.join(baseDir, "custom-redirects.yml");
    if (!fs.existsSync(customFile)) return;

    try {
      const raw = fs.readFileSync(customFile, "utf-8");
      const parsed = this.safeYamlLoad(raw) as { redirects?: unknown[] } | null;
      if (!parsed || !Array.isArray(parsed.redirects)) return;

      for (const entry of parsed.redirects) {
        if (typeof entry !== "object" || entry === null || !("from" in entry) || !("to" in entry)) continue;
        const obj = entry as { from: string; to: string; status?: number; priority?: string };

        let normalizedFrom = obj.from.startsWith("/") ? obj.from : `/${obj.from}`;
        normalizedFrom = normalizedFrom.toLowerCase();
        if (normalizedFrom.length > 1 && normalizedFrom.endsWith("/")) {
          normalizedFrom = normalizedFrom.slice(0, -1);
        }

        const status = obj.status && [301, 302].includes(obj.status) ? obj.status : 301;
        const priority = obj.priority === "fallback" ? "fallback" : "before";

        this.redirectEntries.push({
          from: normalizedFrom,
          to: obj.to,
          type: "custom",
          source: "marketing-content/custom-redirects.yml",
          status,
          priority,
        });
      }
    } catch (err) {
      console.error("[ContentIndex] Failed to read custom-redirects.yml:", err);
    }
  }

  private warnMissingSlugMappings(): void {
    try {
      const configs = getAllConfigs();
      for (const [typeName, config] of Object.entries(configs)) {
        if (config.database && !config.field_mapping?._slug) {
          console.warn(`[ContentIndex] WARNING: Database-backed content type "${typeName}" is missing _slug in field_mapping. This is required for URL resolution.`);
        }
        if (config.database && !config.field_mapping?._locale) {
          console.warn(`[ContentIndex] WARNING: Database-backed content type "${typeName}" is missing _locale in field_mapping. This is required for locale resolution.`);
        }
      }
    } catch {}
  }

  private autoCreateSingleTemplates(baseDir: string): void {
    for (const [contentType, config] of Object.entries(this.contentTypeConfigs)) {
      if (!config.database?.slug) continue;

      const folder = config.directory || contentType;
      const typeDir = path.join(baseDir, folder);

      if (!fs.existsSync(typeDir)) {
        fs.mkdirSync(typeDir, { recursive: true });
        console.log(`[ContentIndex] Auto-created folder: marketing-content/${folder}/`);
      }

      const commonPath = path.join(typeDir, "_common.single.yml");
      if (!fs.existsSync(commonPath)) {
        fs.writeFileSync(commonPath, "# Common data shared across all single (database-backed) entries\n");
        console.log(`[ContentIndex] Auto-created: marketing-content/${folder}/_common.single.yml`);
      }

      const locales = Object.keys(config.url_pattern).filter(k => k !== "default");
      if (locales.length === 0) locales.push("en");

      for (const locale of locales) {
        const singlePath = path.join(typeDir, `single.${locale}.yml`);
        if (!fs.existsSync(singlePath)) {
          const template = [
            "meta:",
            '  page_title: "{{ single.title }}"',
            '  description: "{{ single.description }}"',
            "sections: []",
            "",
          ].join("\n");
          fs.writeFileSync(singlePath, template);
          console.log(`[ContentIndex] Auto-created single template: marketing-content/${folder}/single.${locale}.yml`);
        }
      }
    }
  }

  private extractSlug(_folderPath: string, folderName: string, _files: string[]): string {
    return folderName;
  }

  private extractTitle(folderPath: string, files: string[], _contentType: string): string | undefined {
    const candidates = ["_common.yml", "_common.yaml", "en.yml", "en.yaml"];
    for (const candidate of candidates) {
      if (files.includes(candidate)) {
        try {
          const content = fs.readFileSync(path.join(folderPath, candidate), "utf-8");
          const parsed = this.safeYamlLoad(content);
          if (parsed?.title && typeof parsed.title === "string") {
            return parsed.title;
          }
          if (parsed?.name && typeof parsed.name === "string") {
            return parsed.name;
          }
        } catch {}
      }
    }
    return undefined;
  }

  private extractLocales(files: string[], _contentType: string): string[] {
    return files
      .map(f => f.replace(/\.(yml|yaml)$/, ""))
      .filter(name => /^[a-z]{2}$/.test(name));
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.scan();
    }
  }

  findBySlug(slug: string, opts?: FindOptions): ContentEntry[] {
    this.ensureInitialized();
    const matches = this.bySlug.get(slug) || [];
    if (opts?.contentType) {
      const normalized = this.normalizeType(opts.contentType);
      return matches.filter(e => e.contentType === normalized);
    }
    return matches;
  }

  findByPath(folderPath: string): ContentEntry | undefined {
    this.ensureInitialized();
    return this.byPath.get(folderPath);
  }

  findByType(contentType: string): ContentEntry[] {
    this.ensureInitialized();
    const normalized = this.normalizeType(contentType);
    return this.entries.filter(e => e.contentType === normalized);
  }

  listAll(): ContentEntry[] {
    this.ensureInitialized();
    return [...this.entries];
  }

  getFileContent(slug: string, locale: string, opts?: FindOptions): { content: string; filePath: string } | null {
    const matches = this.findBySlug(slug, opts);
    if (matches.length === 0) return null;

    for (const entry of matches) {
      const basePath = path.join(process.cwd(), entry.directory);
      const candidates = [
        `${locale}.yml`,
        `${locale}.yaml`,
      ];
      candidates.push("_common.yml", "_common.yaml");
      for (const candidate of candidates) {
        const filePath = path.join(basePath, candidate);
        if (fs.existsSync(filePath)) {
          return {
            content: fs.readFileSync(filePath, "utf-8"),
            filePath: `${entry.directory}/${candidate}`,
          };
        }
      }
    }
    return null;
  }

  getAllFiles(slug: string, opts?: FindOptions): { filePath: string; content: string }[] {
    const matches = this.findBySlug(slug, opts);
    const results: { filePath: string; content: string }[] = [];

    for (const entry of matches) {
      const basePath = path.join(process.cwd(), entry.directory);
      for (const file of entry.files) {
        const fullPath = path.join(basePath, file);
        try {
          results.push({
            filePath: `${entry.directory}/${file}`,
            content: fs.readFileSync(fullPath, "utf-8"),
          });
        } catch {}
      }
    }
    return results;
  }

  resolveBaseSlug(slug: string, contentType: string): string {
    this.ensureInitialized();
    const normalized = this.normalizeType(contentType);
    if (this.bySlug.has(slug)) return slug;
    return this.localeSlugMap.get(`${slug}:${normalized}`) || slug;
  }

  getLocaleSlug(baseSlug: string, contentType: string, locale: string): string {
    this.ensureInitialized();
    try {
      const normalized = this.normalizeType(contentType);
      const folderPath = this.getContentFolderPath(normalized, baseSlug);
      const localeFile = path.join(folderPath, `${locale}.yml`);
      if (fs.existsSync(localeFile)) {
        const raw = fs.readFileSync(localeFile, "utf-8");
        const parsed = this.safeYamlLoad(raw);
        if (parsed?.slug && typeof parsed.slug === "string") {
          return parsed.slug;
        }
      }
    } catch {}
    return baseSlug;
  }

  getLocaleUrls(slug: string, contentType: string): Record<string, string> {
    this.ensureInitialized();
    const entries = this.findBySlug(slug, { contentType });
    if (entries.length === 0) return {};

    const entry = entries[0];
    const basePath = path.join(process.cwd(), entry.directory);
    const urls: Record<string, string> = {};

    for (const locale of entry.locales) {
      if (locale.startsWith("_") || locale.includes(".")) continue;

      let localeSlug = slug;
      const candidates = [`${locale}.yml`, `${locale}.yaml`];
      for (const candidate of candidates) {
        const filePath = path.join(basePath, candidate);
        if (fs.existsSync(filePath)) {
          try {
            const raw = fs.readFileSync(filePath, "utf-8");
            const parsed = this.safeYamlLoad(raw);
            if (parsed?.slug && typeof parsed.slug === "string") {
              localeSlug = parsed.slug;
            }
          } catch {}
          break;
        }
      }

      urls[locale] = this.buildUrl(contentType, locale, localeSlug);
    }

    return urls;
  }

  getImageUsage(imageId: string, imageSrc?: string): string[] {
    this.ensureInitialized();
    const files = new Set<string>();
    const byId = this.imageUsage.get(imageId);
    if (byId) {
      byId.forEach(f => files.add(f));
    }
    if (imageSrc) {
      const bySrc = this.imageUsage.get(imageSrc);
      if (bySrc) {
        bySrc.forEach(f => files.add(f));
      }
    }
    return Array.from(files);
  }

  getVariableUsage(variableName: string): string[] {
    this.ensureInitialized();
    const refs = this.variableUsage.get(variableName);
    return refs ? Array.from(refs) : [];
  }

  getRedirects(): RedirectEntry[] {
    this.ensureInitialized();
    return [...this.redirectEntries];
  }

  getAllValidUrls(): Set<string> {
    this.ensureInitialized();
    const urls = new Set<string>();
    for (const entry of this.entries) {
      for (const locale of entry.locales) {
        if (locale.startsWith("_") || locale.includes(".")) continue;
        const localeUrls = this.getLocaleUrls(entry.slug, entry.contentType);
        for (const url of Object.values(localeUrls)) {
          urls.add(url);
        }
        break;
      }
    }
    return urls;
  }

  private extractUrlParams(pattern: string, url: string): Record<string, string> | null {
    const paramNames: string[] = [];
    const regexStr = "^" + pattern.replace(/:([a-zA-Z_]+)/g, (_m, name) => {
      paramNames.push(name);
      return "([^/]+)";
    }) + "$";
    const match = url.match(new RegExp(regexStr));
    if (!match) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = match[i + 1];
    }
    return params;
  }

  private getLastParamValue(params: Record<string, string>, pattern: string): string {
    const paramNames = (pattern.match(/:([a-zA-Z_]+)/g) || []).map(p => p.slice(1));
    if (paramNames.length === 0) return "";
    return params[paramNames[paramNames.length - 1]] || "";
  }

  parseContentUrl(url: string): { contentType: string; slug: string; locale: string; params?: Record<string, string> } | null {
    this.ensureInitialized();
    const cleanUrl = url.split("?")[0].split("#")[0];

    const allTypes = Object.keys(this.contentTypeConfigs);
    const allFolders = allTypes.map(t => this.contentTypeConfigs[t]?.directory || t);
    const combined = allTypes.concat(allFolders);
    const allAccepted = combined.filter((v, i) => combined.indexOf(v) === i);
    const previewRegex = new RegExp(`^\\/private\\/preview\\/(${allAccepted.join("|")})\\/([^/?]+)`);
    const previewMatch = cleanUrl.match(previewRegex);
    if (previewMatch) {
      return { contentType: this.normalizeType(previewMatch[1]), slug: previewMatch[2], locale: "en" };
    }

    for (const [contentType, config] of Object.entries(this.contentTypeConfigs)) {
      if (!config?.url_pattern) continue;
      for (const [locale, pattern] of Object.entries(config.url_pattern)) {
        const params = this.extractUrlParams(pattern, cleanUrl);
        if (params) {
          const slug = this.getLastParamValue(params, pattern);
          const effectiveLocale = locale === "default" ? "en" : locale;
          return { contentType, slug, locale: effectiveLocale, params };
        }

        if (locale !== "default") {
          const strippedPattern = pattern.replace(/^\/(en|es)\//, "/");
          if (strippedPattern !== pattern) {
            const strippedParams = this.extractUrlParams(strippedPattern, cleanUrl);
            if (strippedParams) {
              const slug = this.getLastParamValue(strippedParams, strippedPattern);
              return { contentType, slug, locale, params: strippedParams };
            }
          }
        }
      }
    }

    const bareMatch = cleanUrl.match(/^\/([^/]+)$/);
    if (bareMatch) {
      return { contentType: "page", slug: bareMatch[1], locale: "en" };
    }

    return null;
  }

  resolveUrl(url: string): { contentType: string; slug: string; entry: ContentEntry; fromDatabase?: boolean; params?: Record<string, string>; patternLocale?: string } | null {
    this.ensureInitialized();
    const cleanUrl = url.split("?")[0].split("#")[0];

    for (const [contentType, config] of Object.entries(this.contentTypeConfigs)) {
      if (!config?.url_pattern) continue;
      for (const [localeKey, pattern] of Object.entries(config.url_pattern)) {
        const params = this.extractUrlParams(pattern, cleanUrl);
        if (params) {
          const slug = this.getLastParamValue(params, pattern);

          const found = this.findBySlug(slug, { contentType });
          if (found.length > 0) return { contentType, slug, entry: found[0], params, patternLocale: localeKey };

          const resolvedSlug = this.resolveBaseSlug(slug, contentType);
          if (resolvedSlug !== slug) {
            const foundResolved = this.findBySlug(resolvedSlug, { contentType });
            if (foundResolved.length > 0) return { contentType, slug: resolvedSlug, entry: foundResolved[0], params, patternLocale: localeKey };
          }

          if (config.database?.slug) {
            return {
              contentType,
              slug,
              entry: { slug, contentType, directory: `marketing-content/${config.directory}`, files: [], locales: [] },
              fromDatabase: true,
              params,
              patternLocale: localeKey,
            };
          }

          return null;
        }
      }
    }
    return null;
  }

  resolveListingUrl(url: string): { contentType: string; locale: string } | null {
    this.ensureInitialized();
    const cleanUrl = url.split("?")[0].split("#")[0].replace(/\/$/, "");

    for (const [contentType, config] of Object.entries(this.contentTypeConfigs)) {
      if (!config?.url_pattern || !config?.database?.slug) continue;
      for (const [localeKey, pattern] of Object.entries(config.url_pattern)) {
        const staticPrefix = pattern.replace(/\/:[^/]+.*$/, "");
        if (staticPrefix && cleanUrl === staticPrefix) {
          return { contentType, locale: localeKey === "default" ? "en" : localeKey };
        }
      }
    }
    return null;
  }

  isKnownUrl(url: string): boolean {
    return this.resolveUrl(url) !== null;
  }

  refresh(): void {
    this.scan();
  }

  getStats(): { total: number; byType: Record<string, number> } {
    this.ensureInitialized();
    const byType: Record<string, number> = {};
    for (const entry of this.entries) {
      byType[entry.contentType] = (byType[entry.contentType] || 0) + 1;
    }
    return { total: this.entries.length, byType };
  }

  isDatabaseBacked(contentType: string): boolean {
    const config = this.getContentTypeConfig(contentType);
    return !!config?.database?.slug;
  }

  getContentFolderPath(contentType: string, slug: string): string {
    const folder = this.getFolderName(contentType);
    const resolved = this.resolveBaseSlug(slug, contentType);
    const slugDir = path.join(MARKETING_CONTENT_PATH, folder, resolved);
    if (fs.existsSync(slugDir)) return slugDir;
    if (this.isDatabaseBacked(contentType)) {
      return path.join(MARKETING_CONTENT_PATH, folder);
    }
    return slugDir;
  }

  getCommonFilePath(contentType: string, slug: string): string {
    const folder = this.getContentFolderPath(contentType, slug);
    return path.join(folder, "_common.yml");
  }

  getContentFilePath(
    contentType: string,
    slug: string,
    locale: string,
    variant?: string,
    version?: number
  ): string {
    const folder = this.getContentFolderPath(contentType, slug);

    if (variant && variant !== "default" && version !== undefined) {
      return path.join(folder, `${variant}.v${version}.${locale}.yml`);
    }


    const perSlugPath = path.join(folder, `${locale}.yml`);
    if (fs.existsSync(perSlugPath)) return perSlugPath;

    if (this.isDatabaseBacked(contentType)) {
      const typeRoot = path.join(MARKETING_CONTENT_PATH, this.getFolderName(contentType));
      const singlePath = path.join(typeRoot, `single.${locale}.yml`);
      if (fs.existsSync(singlePath)) return singlePath;
    }

    return perSlugPath;
  }

  loadLocaleData(
    contentType: string,
    slug: string,
    locale: string,
    variant?: string,
    version?: number
  ): { data: Record<string, unknown> | null; filePath: string; error?: string; isSharedTemplate?: boolean } {
    try {
      const filePath = this.getContentFilePath(contentType, slug, locale, variant, version);
      if (!fs.existsSync(filePath)) {
        return { data: null, filePath, error: `Content file not found: ${filePath}` };
      }
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = this.safeYamlLoad(raw) as Record<string, unknown>;
      const isSharedTemplate = path.basename(filePath).startsWith("single.");
      return { data, filePath, isSharedTemplate };
    } catch (error) {
      return { data: null, filePath: "", error: `Error loading locale data: ${error}` };
    }
  }

  loadCommonData(contentType: ContentType, slug: string): Record<string, unknown> | null {
    const resolved = this.resolveBaseSlug(slug, contentType);
    let commonPath = path.join(MARKETING_CONTENT_PATH, this.getFolderName(contentType), resolved, "_common.yml");

    if (!fs.existsSync(commonPath) && this.isDatabaseBacked(contentType)) {
      commonPath = path.join(MARKETING_CONTENT_PATH, this.getFolderName(contentType), "_common.single.yml");
    }

    if (!fs.existsSync(commonPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(commonPath, "utf8");
      return this.safeYamlLoad(content) as Record<string, unknown>;
    } catch (error) {
      console.error(`Error loading common data for ${contentType}/${slug}:`, error);
      return null;
    }
  }

  loadMergedContent(
    contentType: string,
    slug: string,
    locale: string,
    variant?: string,
    version?: number
  ): { data: Record<string, unknown> | null; filePath: string; error?: string; isSharedTemplate?: boolean } {
    try {
      const filePath = this.getContentFilePath(contentType, slug, locale, variant, version);
      if (!fs.existsSync(filePath)) {
        return { data: null, filePath, error: `Content file not found: ${filePath}` };
      }

      const folder = this.getFolderName(contentType);
      const singleCommonPath = path.join(MARKETING_CONTENT_PATH, folder, "_common.single.yml");
      let baseData: Record<string, unknown> = {};
      if (fs.existsSync(singleCommonPath)) {
        const singleCommonContent = fs.readFileSync(singleCommonPath, "utf-8");
        baseData = this.safeYamlLoad(singleCommonContent) as Record<string, unknown>;
      }

      const contentFolder = this.getContentFolderPath(contentType, slug);
      const commonPath = path.join(contentFolder, "_common.yml");
      if (fs.existsSync(commonPath)) {
        const commonContent = fs.readFileSync(commonPath, "utf-8");
        const commonData = this.safeYamlLoad(commonContent) as Record<string, unknown>;
        baseData = Object.keys(baseData).length > 0
          ? deepMerge(baseData, commonData)
          : commonData;
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      const localeData = this.safeYamlLoad(raw) as Record<string, unknown>;

      const merged = Object.keys(baseData).length > 0
        ? deepMerge(baseData, localeData)
        : localeData;

      const isSharedTemplate = path.basename(filePath).startsWith("single.");
      return { data: merged, filePath, isSharedTemplate };
    } catch (error) {
      return { data: null, filePath: "", error: `Error loading merged content: ${error}` };
    }
  }

  loadContent<T>(options: LoadContentOptions<T>): LoadContentResult<T> {
    const { contentType, slug, schema, localeOrVariant, requireCommon = false } = options;

    try {
      const folder = this.getFolderName(contentType);
      let resolvedSlug = slug;
      const initialDir = path.join(MARKETING_CONTENT_PATH, folder, slug);
      if (!fs.existsSync(initialDir)) {
        resolvedSlug = this.resolveBaseSlug(slug, contentType);
      }

      const contentDir = path.join(MARKETING_CONTENT_PATH, folder, resolvedSlug);
      const commonPath = path.join(contentDir, "_common.yml");
      const contentPath = path.join(contentDir, `${localeOrVariant}.yml`);

      if (!fs.existsSync(contentPath)) {
        return { success: false, error: `Content file not found: ${contentPath}` };
      }

      if (requireCommon && !fs.existsSync(commonPath)) {
        return { success: false, error: `Required _common.yml not found: ${commonPath}` };
      }

      const singleCommonPath = path.join(MARKETING_CONTENT_PATH, folder, "_common.single.yml");
      let baseData: Record<string, unknown> = {};
      if (fs.existsSync(singleCommonPath)) {
        const singleCommonContent = fs.readFileSync(singleCommonPath, "utf-8");
        baseData = this.safeYamlLoad(singleCommonContent) as Record<string, unknown>;
      }

      if (fs.existsSync(commonPath)) {
        const commonContent = fs.readFileSync(commonPath, "utf8");
        const commonData = this.safeYamlLoad(commonContent) as Record<string, unknown>;
        baseData = Object.keys(baseData).length > 0
          ? deepMerge(baseData, commonData)
          : commonData;
      }

      const contentContent = fs.readFileSync(contentPath, "utf8");
      const contentData = this.safeYamlLoad(contentContent) as Record<string, unknown>;

      const mergedData = deepMerge(baseData, contentData);
      const cleanedData = stripNullValues(mergedData);

      const result = schema.safeParse(cleanedData);
      if (!result.success) {
        return {
          success: false,
          error: `Invalid YAML structure for ${contentType}/${slug}/${localeOrVariant}: ${result.error.message}`
        };
      }

      return { success: true, data: result.data };
    } catch (error) {
      return {
        success: false,
        error: `Error loading ${contentType}/${slug}/${localeOrVariant}: ${error}`
      };
    }
  }

  listContentSlugs(contentType: ContentType): string[] {
    const contentDir = path.join(MARKETING_CONTENT_PATH, this.getFolderName(contentType));

    if (!fs.existsSync(contentDir)) {
      return [];
    }

    try {
      const entries = fs.readdirSync(contentDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error) {
      console.error(`Error listing ${contentType}:`, error);
      return [];
    }
  }

  getAvailableLocalesOrVariants(contentType: ContentType, slug: string): string[] {
    const contentDir = path.join(MARKETING_CONTENT_PATH, this.getFolderName(contentType), slug);

    if (!fs.existsSync(contentDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(contentDir);
      return files
        .filter(f =>
          f.endsWith(".yml") &&
          !f.startsWith("_") &&
          f !== "experiments.yml" &&
          !f.includes(".v")
        )
        .map(f => f.replace(".yml", ""));
    } catch (error) {
      console.error(`Error getting locales for ${contentType}/${slug}:`, error);
      return [];
    }
  }

  private collectDotPaths(obj: unknown, prefix: string, maxDepth: number, depth: number = 0): string[] {
    if (depth >= maxDepth || obj == null || typeof obj !== "object" || Array.isArray(obj)) {
      return [];
    }
    const paths: string[] = [];
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key.startsWith("_")) continue;
      const dotPath = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string" && (value.includes("{{") || value.startsWith("function:"))) continue;
      paths.push(dotPath);
      if (value != null && typeof value === "object" && !Array.isArray(value)) {
        paths.push(...this.collectDotPaths(value, dotPath, maxDepth, depth + 1));
      }
    }
    return paths;
  }

  private computeCommonFields(contentType: string): CommonFieldInfo {
    const slugs = this.listContentSlugs(contentType as ContentType);
    if (slugs.length === 0) {
      return { common: [], partial: [] };
    }

    const keyCounts = new Map<string, number>();
    let total = 0;

    for (const slug of slugs) {
      const locales = this.getAvailableLocalesOrVariants(contentType as ContentType, slug);
      const locale = locales.includes("en") ? "en" : locales[0];
      if (!locale) continue;

      const { data } = this.loadMergedContent(contentType, slug, locale);
      if (!data) continue;

      total++;
      const paths = this.collectDotPaths(data, "", 2);
      for (const p of paths) {
        keyCounts.set(p, (keyCounts.get(p) || 0) + 1);
      }
    }

    const common: string[] = [];
    const partial: { key: string; count: number; total: number }[] = [];

    for (const [key, count] of keyCounts) {
      if (count === total) {
        common.push(key);
      } else {
        partial.push({ key, count, total });
      }
    }

    common.sort();
    partial.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

    return { common, partial };
  }

  getCommonFields(contentType: string): CommonFieldInfo {
    this.ensureInitialized();
    const normalized = this.normalizeType(contentType);
    let cached = this.commonFieldsCache.get(normalized);
    if (!cached) {
      cached = this.computeCommonFields(normalized);
      this.commonFieldsCache.set(normalized, cached);
    }
    return cached;
  }

  invalidateCommonFields(contentType: string): void {
    const normalized = this.normalizeType(contentType);
    this.commonFieldsCache.delete(normalized);
  }

  duplicateWithTypeChange(opts: {
    sourceDir: string;
    sourceType: string;
    targetType: string;
    targetDir: string;
    newSlugs: { en?: string; es?: string };
    title: string;
    skipLocales: string[];
    localeTitles?: Record<string, string>;
  }): { copiedFiles: string[]; strippedFields: string[]; replacedVars: number } {
    this.ensureInitialized();

    const { sourceDir, sourceType, targetType, targetDir, newSlugs, title, skipLocales, localeTitles } = opts;

    const sourceFieldMapping = getFieldMapping(sourceType) || {};
    const targetFieldMapping = getFieldMapping(targetType) || {};

    const sourceKeys = Object.keys(sourceFieldMapping);
    const targetKeySet: Record<string, boolean> = {};
    for (const k of Object.keys(targetFieldMapping)) targetKeySet[k] = true;
    const universalKeys: Record<string, boolean> = { slug: true, title: true };
    const keysToStrip = sourceKeys.filter(k => !targetKeySet[k] && !universalKeys[k]);

    const sourceSlug = path.basename(sourceDir);
    const mergedByLocale: Record<string, Record<string, unknown>> = {};
    const locales = ["en", "es"];
    for (const locale of locales) {
      if (skipLocales.includes(locale)) continue;
      const { data } = this.loadMergedContent(sourceType, sourceSlug, locale);
      if (data) {
        mergedByLocale[locale] = data;
      }
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const copiedFiles: string[] = [];
    const parsedFiles: Array<{ file: string; parsed: Record<string, unknown> }> = [];
    const strippedFields: string[] = [...keysToStrip];
    let replacedVars = 0;

    const absSourceDir = path.isAbsolute(sourceDir) ? sourceDir : path.join(process.cwd(), sourceDir);
    if (!fs.existsSync(absSourceDir)) {
      return { copiedFiles, strippedFields, replacedVars };
    }

    const sourceFiles = fs.readdirSync(absSourceDir).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));

    // First pass: parse all files, strip IDs, apply slug/title — collect for regeneration
    const parsedFiles: Array<{ file: string; parsed: Record<string, unknown> }> = [];

    for (const file of sourceFiles) {
      if (file === "_common.single.yml" || file.startsWith("single.")) continue;

      const fileLocale = file.replace(/\.(yml|yaml)$/, "");
      if (fileLocale !== "_common" && skipLocales.includes(fileLocale)) continue;

      const sourceFilePath = path.join(absSourceDir, file);
      let raw = fs.readFileSync(sourceFilePath, "utf-8");

      const locale = fileLocale === "_common" ? "en" : fileLocale;
      const mergedData = mergedByLocale[locale] || mergedByLocale["en"] || {};

      const varResult = this.replaceTemplateVars(raw, mergedData, sourceFieldMapping);
      raw = varResult.content;
      replacedVars += varResult.count;

      const parsed = this.safeYamlLoad(raw);
      if (parsed) {
        for (const key of keysToStrip) {
          delete parsed[key];
        }

        delete parsed.redirects;
        if (parsed.meta && typeof parsed.meta === "object") {
          delete (parsed.meta as Record<string, unknown>).redirects;
        }

        this.stripSectionIds(parsed);

        if (fileLocale === "_common") {
          parsed.slug = Object.values(newSlugs).find(Boolean) || path.basename(targetDir);
          parsed.title = title;
          for (const targetKey of Object.keys(targetFieldMapping)) {
            if (!parsed[targetKey] && !sourceKeys.includes(targetKey)) {
              if (targetKey === "locale") {
                const activeLocales = locales.filter(l => !skipLocales.includes(l));
                parsed.locale = activeLocales[0] || "en";
              }
            }
          }
        } else if (newSlugs[fileLocale as keyof typeof newSlugs]) {
          parsed.slug = newSlugs[fileLocale as keyof typeof newSlugs];
          parsed.title = localeTitles?.[fileLocale] ?? title;
        }

        parsedFiles.push({ file, parsed });
      }
    }

    const allParsed = parsedFiles.map(f => f.parsed);
    const { objs: regenerated } = regenerateSectionIds(allParsed);

    const absTargetDir = path.isAbsolute(targetDir) ? targetDir : path.join(process.cwd(), targetDir);
    if (!fs.existsSync(absTargetDir)) {
      fs.mkdirSync(absTargetDir, { recursive: true });
    }
    for (let i = 0; i < parsedFiles.length; i++) {
      const { file } = parsedFiles[i];
      const outputPath = path.join(absTargetDir, file);
      const { escaped, map } = escapeObjectVars(regenerated[i]);
      const dumped = yaml.dump(escaped, { lineWidth: 120, noRefs: true, sortKeys: false });
      const yamlStr = unescapeYamlDump(dumped, map);
      fs.writeFileSync(outputPath, yamlStr, "utf-8");
      copiedFiles.push(file);
    }

    return { copiedFiles, strippedFields, replacedVars };
  }

  private replaceTemplateVars(
    content: string,
    mergedData: Record<string, unknown>,
    fieldMapping: Record<string, string>
  ): { content: string; count: number } {
    let count = 0;

    const dynamicEntriesRegex = /dynamic_entries\s*:[\s\S]*?item_template\s*:[\s\S]*?(?=\n\S|\n\s*-\s+type\s*:|\s*$)/g;
    const dynamicRanges: { start: number; end: number }[] = [];
    let dynMatch: RegExpExecArray | null;
    while ((dynMatch = dynamicEntriesRegex.exec(content)) !== null) {
      dynamicRanges.push({ start: dynMatch.index, end: dynMatch.index + dynMatch[0].length });
    }

    const isInDynamicRange = (pos: number): boolean => {
      for (const range of dynamicRanges) {
        if (pos >= range.start && pos < range.end) return true;
      }
      return false;
    };

    const singleVarRegex = /\{\{\s*single\.([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\|\s*([^}]*))?\s*\}\}/g;
    let result = "";
    let lastIndex = 0;
    let varMatch: RegExpExecArray | null;

    while ((varMatch = singleVarRegex.exec(content)) !== null) {
      if (isInDynamicRange(varMatch.index)) continue;

      const fieldName = varMatch[1];
      const fallback = varMatch[2]?.trim();

      let replacement: string | undefined;
      if (fallback !== undefined && fallback !== "") {
        replacement = fallback;
      } else {
        const mappedKey = fieldMapping[fieldName] || fieldName;
        const value = this.extractDotPathValue(mergedData, mappedKey);
        if (value !== undefined && value !== null) {
          replacement = String(value);
        }
      }

      if (replacement !== undefined) {
        result += content.slice(lastIndex, varMatch.index) + replacement;
        lastIndex = varMatch.index + varMatch[0].length;
        count++;
      }
    }

    result += content.slice(lastIndex);
    return { content: result, count };
  }

  private extractDotPathValue(obj: Record<string, unknown>, dotPath: string): unknown {
    const parts = dotPath.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private stripSectionIds(parsed: Record<string, unknown>): void {
    const sections = parsed.sections;
    if (Array.isArray(sections)) {
      for (const section of sections) {
        if (section && typeof section === "object") {
          delete (section as Record<string, unknown>).section_id;
        }
      }
    }
  }
}

export { stripNullValues };

export const contentIndex = ContentIndex.getInstance();
