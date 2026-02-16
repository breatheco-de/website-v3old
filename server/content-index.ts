
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export interface ContentTypeConfig {
  url_pattern: Record<string, string>;
}

export interface ContentEntry {
  slug: string;
  contentType: string;
  folder: string;
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
}

class ContentIndex {
  private entries: ContentEntry[] = [];
  private bySlug: Map<string, ContentEntry[]> = new Map();
  private byPath: Map<string, ContentEntry> = new Map();
  private imageUsage: Map<string, Set<string>> = new Map();
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
      const parsed = yaml.load(raw) as Record<string, ContentTypeConfig> | null;
      return parsed || {};
    } catch (err) {
      console.error("[ContentIndex] Failed to read content-types.yml:", err);
      return {};
    }
  }

  buildUrl(contentType: string, locale: string, slug: string): string {
    const config = this.contentTypeConfigs[contentType];
    if (!config?.url_pattern) {
      return `/${locale}/${slug}`;
    }

    const pattern = config.url_pattern[locale] || config.url_pattern["default"] || `/${locale}/${slug}`;
    return pattern.replace(":slug", slug);
  }

  getContentTypes(): string[] {
    this.ensureInitialized();
    return Object.keys(this.contentTypeConfigs);
  }

  getContentTypeConfig(contentType: string): ContentTypeConfig | undefined {
    this.ensureInitialized();
    return this.contentTypeConfigs[contentType];
  }

  scan(): void {
    const baseDir = path.join(process.cwd(), "marketing-content");
    this.contentTypeConfigs = this.loadContentTypes();
    const contentTypes = Object.keys(this.contentTypeConfigs);

    this.entries = [];
    this.bySlug = new Map();
    this.byPath = new Map();
    this.imageUsage = new Map();
    this.redirectEntries = [];
    this.localeSlugMap = new Map();

    for (const contentType of contentTypes) {
      const typeDir = path.join(baseDir, contentType);
      if (!fs.existsSync(typeDir)) continue;

      const folders = fs.readdirSync(typeDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const folderName of folders) {
        const folderPath = path.join(typeDir, folderName);
        const relFolder = `marketing-content/${contentType}/${folderName}`;
        const files = fs.readdirSync(folderPath)
          .filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));

        if (files.length === 0) continue;

        const slug = this.extractSlug(folderPath, folderName, files);
        const locales = this.extractLocales(files, contentType);
        const title = this.extractTitle(folderPath, files, contentType);

        const entry: ContentEntry = {
          slug,
          contentType,
          folder: relFolder,
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
            const parsed = yaml.load(raw) as Record<string, unknown> | null;
            this.extractImageReferences(parsed, relFilePath);
            const locale = file.replace(/\.(yml|yaml)$/, "");
            if (parsed && this.contentTypeHasRedirects(contentType)) {
              this.extractRedirects(parsed, slug, locale, contentType, relFilePath);
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

    this.initialized = true;
    const imageRefCount = this.imageUsage.size;
    console.log(`[ContentIndex] Scanned ${this.entries.length} content entries, ${imageRefCount} image references tracked, ${this.redirectEntries.length} redirects`);
  }

  private contentTypeHasRedirects(contentType: string): boolean {
    return contentType === "programs" || contentType === "landings";
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

    const basePath = path.join(process.cwd(), entry.folder);
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
            const parsed = yaml.load(raw) as Record<string, unknown>;
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
  ): void {
    const meta = parsed.meta as Record<string, unknown> | undefined;
    const redirects = meta?.redirects as unknown[] | undefined;
    if (!Array.isArray(redirects)) return;

    const isCommon = locale === "_common";
    const singularType = contentType === "programs" ? "program" : contentType === "landings" ? "landing" : contentType;
    const typeLabel = isCommon ? `${singularType}-common` : singularType;

    let targetTo: string | Record<string, string>;
    if (isCommon) {
      targetTo = this.buildLocaleUrlsInternal(slug, contentType);
      if (Object.keys(targetTo).length === 0) {
        targetTo = this.getCanonicalUrl(contentType, slug, "en");
      }
    } else {
      targetTo = this.getCanonicalUrl(contentType, slug, locale);
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
      const parsed = yaml.load(raw) as { redirects?: unknown[] } | null;
      if (!parsed || !Array.isArray(parsed.redirects)) return;

      for (const entry of parsed.redirects) {
        if (typeof entry !== "object" || entry === null || !("from" in entry) || !("to" in entry)) continue;
        const obj = entry as { from: string; to: string; status?: number };

        let normalizedFrom = obj.from.startsWith("/") ? obj.from : `/${obj.from}`;
        normalizedFrom = normalizedFrom.toLowerCase();
        if (normalizedFrom.length > 1 && normalizedFrom.endsWith("/")) {
          normalizedFrom = normalizedFrom.slice(0, -1);
        }

        const status = obj.status && [301, 302].includes(obj.status) ? obj.status : 301;

        this.redirectEntries.push({
          from: normalizedFrom,
          to: obj.to,
          type: "custom",
          source: "marketing-content/custom-redirects.yml",
          status,
        });
      }
    } catch (err) {
      console.error("[ContentIndex] Failed to read custom-redirects.yml:", err);
    }
  }

  private extractSlug(folderPath: string, folderName: string, files: string[]): string {
    const candidates = ["en.yml", "en.yaml", "_common.yml", "_common.yaml"];
    for (const candidate of candidates) {
      if (files.includes(candidate)) {
        try {
          const content = fs.readFileSync(path.join(folderPath, candidate), "utf-8");
          const parsed = yaml.load(content) as Record<string, unknown>;
          if (parsed?.slug && typeof parsed.slug === "string") {
            return parsed.slug;
          }
        } catch {}
      }
    }
    return folderName;
  }

  private extractTitle(folderPath: string, files: string[], contentType: string): string | undefined {
    const candidates = contentType === "landings"
      ? ["_common.yml", "_common.yaml"]
      : ["en.yml", "en.yaml"];
    for (const candidate of candidates) {
      if (files.includes(candidate)) {
        try {
          const content = fs.readFileSync(path.join(folderPath, candidate), "utf-8");
          const parsed = yaml.load(content) as Record<string, unknown>;
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
    if (contentType === "landings") {
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
      return matches.filter(e => e.contentType === opts.contentType);
    }
    return matches;
  }

  findByPath(folderPath: string): ContentEntry | undefined {
    this.ensureInitialized();
    return this.byPath.get(folderPath);
  }

  findByType(contentType: string): ContentEntry[] {
    this.ensureInitialized();
    return this.entries.filter(e => e.contentType === contentType);
  }

  listAll(): ContentEntry[] {
    this.ensureInitialized();
    return [...this.entries];
  }

  getFileContent(slug: string, locale: string, opts?: FindOptions): { content: string; filePath: string } | null {
    const matches = this.findBySlug(slug, opts);
    if (matches.length === 0) return null;

    for (const entry of matches) {
      const basePath = path.join(process.cwd(), entry.folder);
      const candidates = [
        `${locale}.yml`,
        `${locale}.yaml`,
      ];
      if (entry.contentType === "landings") {
        candidates.unshift("_common.yml", "_common.yaml");
      }
      for (const candidate of candidates) {
        const filePath = path.join(basePath, candidate);
        if (fs.existsSync(filePath)) {
          return {
            content: fs.readFileSync(filePath, "utf-8"),
            filePath: `${entry.folder}/${candidate}`,
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
      const basePath = path.join(process.cwd(), entry.folder);
      for (const file of entry.files) {
        const fullPath = path.join(basePath, file);
        try {
          results.push({
            filePath: `${entry.folder}/${file}`,
            content: fs.readFileSync(fullPath, "utf-8"),
          });
        } catch {}
      }
    }
    return results;
  }

  resolveBaseSlug(slug: string, contentType: string): string {
    this.ensureInitialized();
    if (this.bySlug.has(slug)) return slug;
    return this.localeSlugMap.get(`${slug}:${contentType}`) || slug;
  }

  getLocaleUrls(slug: string, contentType: string): Record<string, string> {
    this.ensureInitialized();
    const entries = this.findBySlug(slug, { contentType });
    if (entries.length === 0) return {};

    const entry = entries[0];
    const basePath = path.join(process.cwd(), entry.folder);
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
            const parsed = yaml.load(raw) as Record<string, unknown>;
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
}

export const contentIndex = ContentIndex.getInstance();
