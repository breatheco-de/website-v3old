
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import type { ZodSchema } from "zod";
import { escapeTemplateVars, unescapeObjectVars } from "../shared/templateVars";
import { deepMerge } from "./utils/deepMerge";
import { normalizeUrlPattern } from "./content-types";

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

class ContentIndex {
  private entries: ContentEntry[] = [];
  private bySlug: Map<string, ContentEntry[]> = new Map();
  private byPath: Map<string, ContentEntry> = new Map();
  private imageUsage: Map<string, Set<string>> = new Map();
  private variableUsage: Map<string, Set<string>> = new Map();
  private redirectEntries: RedirectEntry[] = [];
  private localeSlugMap: Map<string, string> = new Map();
  private contentTypeConfigs: Record<string, ContentTypeConfig> = {};
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
            const locale = file.replace(/\.(yml|yaml)$/, "");
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

    this.initialized = true;
    const imageRefCount = this.imageUsage.size;
    const variableRefCount = this.variableUsage.size;
    console.log(`[ContentIndex] Scanned ${this.entries.length} content entries, ${imageRefCount} image references tracked, ${variableRefCount} variable references tracked, ${this.redirectEntries.length} redirects`);
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

  private autoCreateSingleTemplates(baseDir: string): void {
    for (const [contentType, config] of Object.entries(this.contentTypeConfigs)) {
      if (!config.database?.slug) continue;

      const folder = config.directory || contentType;
      const typeDir = path.join(baseDir, folder);

      if (!fs.existsSync(typeDir)) {
        fs.mkdirSync(typeDir, { recursive: true });
        console.log(`[ContentIndex] Auto-created folder: marketing-content/${folder}/`);
      }

      const commonPath = path.join(typeDir, "_common.yml");
      if (!fs.existsSync(commonPath)) {
        fs.writeFileSync(commonPath, "# Common data shared across all locales\n");
        console.log(`[ContentIndex] Auto-created: marketing-content/${folder}/_common.yml`);
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

  private extractTitle(folderPath: string, files: string[], contentType: string): string | undefined {
    const candidates = contentType === "landing"
      ? ["_common.yml", "_common.yaml"]
      : ["en.yml", "en.yaml"];
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

  private extractLocales(files: string[], contentType: string): string[] {
    if (contentType === "landing") {
      return files
        .filter(f => f !== "_common.yml" && f !== "_common.yaml")
        .map(f => f.replace(/\.(yml|yaml)$/, ""));
    }
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
      if (entry.contentType === "landing") {
        candidates.unshift("_common.yml", "_common.yaml");
      }
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

    if (contentType === "landing") {
      return path.join(folder, "promoted.yml");
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
      commonPath = path.join(MARKETING_CONTENT_PATH, this.getFolderName(contentType), "_common.yml");
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

      const contentFolder = this.getContentFolderPath(contentType, slug);
      const commonPath = path.join(contentFolder, "_common.yml");
      let commonData: Record<string, unknown> = {};
      if (fs.existsSync(commonPath)) {
        const commonContent = fs.readFileSync(commonPath, "utf-8");
        commonData = this.safeYamlLoad(commonContent) as Record<string, unknown>;
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      const localeData = this.safeYamlLoad(raw) as Record<string, unknown>;

      const merged = Object.keys(commonData).length > 0
        ? deepMerge(commonData, localeData)
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

      let commonData: Record<string, unknown> = {};
      if (fs.existsSync(commonPath)) {
        const commonContent = fs.readFileSync(commonPath, "utf8");
        commonData = this.safeYamlLoad(commonContent) as Record<string, unknown>;
      }

      const contentContent = fs.readFileSync(contentPath, "utf8");
      const contentData = this.safeYamlLoad(contentContent) as Record<string, unknown>;

      const mergedData = deepMerge(commonData, contentData);
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
}

export { stripNullValues };

export const contentIndex = ContentIndex.getInstance();
