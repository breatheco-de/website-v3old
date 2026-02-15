
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export interface ContentEntry {
  slug: string;
  contentType: "pages" | "programs" | "locations" | "landings";
  folder: string;
  files: string[];
  locales: string[];
  title?: string;
}

export interface FindOptions {
  contentType?: ContentEntry["contentType"];
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
  private initialized = false;

  private static instance: ContentIndex;

  static getInstance(): ContentIndex {
    if (!ContentIndex.instance) {
      ContentIndex.instance = new ContentIndex();
    }
    return ContentIndex.instance;
  }

  private constructor() {}

  scan(): void {
    const baseDir = path.join(process.cwd(), "marketing-content");
    const contentTypes: ContentEntry["contentType"][] = ["pages", "programs", "locations", "landings"];

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
            if (parsed && (contentType === "programs" || contentType === "landings")) {
              const locale = file.replace(/\.(yml|yaml)$/, "");
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

  private buildLocaleUrlsInternal(slug: string, contentType: ContentEntry["contentType"]): Record<string, string> {
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

      if (contentType === "programs") {
        urls[locale] = locale === "es"
          ? `/es/programas-de-carrera/${localeSlug}`
          : `/${locale}/career-programs/${localeSlug}`;
      } else if (contentType === "locations") {
        urls[locale] = locale === "es"
          ? `/es/ubicaciones/${localeSlug}`
          : `/${locale}/locations/${localeSlug}`;
      } else if (contentType === "landings") {
        urls[locale] = `/landing/${localeSlug}`;
      } else {
        urls[locale] = `/${locale}/${localeSlug}`;
      }
    }

    return urls;
  }

  private getCanonicalUrl(type: "programs" | "landings", slug: string, locale: string): string {
    if (type === "programs") {
      return locale === "es"
        ? `/es/programas-de-carrera/${slug}`
        : `/en/career-programs/${slug}`;
    }
    return `/landing/${slug}`;
  }

  private extractRedirects(
    parsed: Record<string, unknown>,
    slug: string,
    locale: string,
    contentType: "programs" | "landings",
    filePath: string,
  ): void {
    const meta = parsed.meta as Record<string, unknown> | undefined;
    const redirects = meta?.redirects as unknown[] | undefined;
    if (!Array.isArray(redirects)) return;

    const isCommon = locale === "_common";
    const typeLabel = isCommon
      ? `${contentType === "programs" ? "program" : "landing"}-common`
      : (contentType === "programs" ? "program" : "landing");

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

  findByType(contentType: ContentEntry["contentType"]): ContentEntry[] {
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

  resolveBaseSlug(slug: string, contentType: ContentEntry["contentType"]): string {
    this.ensureInitialized();
    if (this.bySlug.has(slug)) return slug;
    return this.localeSlugMap.get(`${slug}:${contentType}`) || slug;
  }

  getLocaleUrls(slug: string, contentType: ContentEntry["contentType"]): Record<string, string> {
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

      if (contentType === "programs") {
        urls[locale] = locale === "es"
          ? `/es/programas-de-carrera/${localeSlug}`
          : `/${locale}/career-programs/${localeSlug}`;
      } else if (contentType === "locations") {
        urls[locale] = locale === "es"
          ? `/es/ubicaciones/${localeSlug}`
          : `/${locale}/locations/${localeSlug}`;
      } else if (contentType === "landings") {
        urls[locale] = `/landing/${localeSlug}`;
      } else {
        urls[locale] = `/${locale}/${localeSlug}`;
      }
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
