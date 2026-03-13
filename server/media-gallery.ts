import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as yaml from "js-yaml";
import { escapeTemplateVars, unescapeObjectVars } from "../shared/templateVars";
import type { ImageRegistry, ImageEntry } from "@shared/schema";
import { media } from "./media";
import { markFileAsModified } from "./sync-state";
import { processImageBuffer } from "./image-optimizer";
import type { Preset } from "./image-optimizer";

const MARKETING_CONTENT_DIR = path.join(process.cwd(), "marketing-content");
const MARKETING_IMAGES_DIR = path.join(MARKETING_CONTENT_DIR, "images");
const REGISTRY_PATH = path.join(MARKETING_CONTENT_DIR, "image-registry.json");
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".avif", ".gif"]);
const OPTIMIZABLE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".ogg", ".m4v"]);
const MEDIA_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);
const SCREENSHOT_PATTERNS = [/^Screenshot_/i, /^Captura_/i, /^Capture_/i, /^Screen[\s_]?Shot/i];
const EXISTENCE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface ScanNewImage {
  id: string;
  src: string;
  filename: string;
}

export interface ScanUpdatedImage {
  id: string;
  oldSrc: string;
  newSrc: string;
}

export interface BrokenReference {
  yamlFile: string;
  field: string;
  missingSrc: string;
}

export interface DuplicateGroup {
  hash: string;
  ids: string[];
  canonical: string;
}

export interface ScanResult {
  newImages: ScanNewImage[];
  updatedImages: ScanUpdatedImage[];
  brokenReferences: BrokenReference[];
  duplicates: DuplicateGroup[];
  hashesComputed: number;
  registeredCount: number;
  scannedImagesCount: number;
  summary: {
    new: number;
    updated: number;
    broken: number;
    duplicates: number;
  };
}

interface ExistenceCache {
  exists: boolean;
  checkedAt: number;
}

function filenameToId(filename: string): string {
  const name = path.parse(filename).name;
  return name
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getIdBase(filename: string): string {
  const name = path.parse(filename).name;
  const withoutTimestamp = name.replace(/_\d{13,}$/, "");
  return withoutTimestamp
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function extractTimestamp(filename: string): number {
  const name = path.parse(filename).name;
  const match = name.match(/_(\d{13,})$/);
  return match ? parseInt(match[1], 10) : 0;
}

function isScreenshot(filename: string): boolean {
  return SCREENSHOT_PATTERNS.some(pattern => pattern.test(filename));
}

class MediaGallery {
  private registryCache: ImageRegistry | null = null;
  private lastModified: number = 0;
  private existenceCache: Map<string, ExistenceCache> = new Map();
  private contentIndex: any = null;

  setContentIndex(ci: any): void {
    this.contentIndex = ci;
  }

  getRegistry(): ImageRegistry | null {
    try {
      const stats = fs.statSync(REGISTRY_PATH);
      const currentModified = stats.mtimeMs;

      if (this.registryCache && currentModified === this.lastModified) {
        return this.registryCache;
      }

      const content = fs.readFileSync(REGISTRY_PATH, "utf8");
      this.registryCache = JSON.parse(content) as ImageRegistry;
      this.lastModified = currentModified;

      console.log(`[MediaGallery] Loaded ${Object.keys(this.registryCache.images).length} images, ${Object.keys(this.registryCache.presets).length} presets`);
      return this.registryCache;
    } catch (error) {
      console.error("[MediaGallery] Failed to load registry:", error);
      return null;
    }
  }

  clearCache(): void {
    this.registryCache = null;
    this.lastModified = 0;
  }

  getImage(id: string): { src: string; alt: string } | null {
    const registry = this.getRegistry();
    if (!registry) return null;
    const entry = registry.images[id];
    if (!entry) return null;
    return { src: entry.src, alt: entry.alt };
  }

  getPreset(name: string): any | null {
    const registry = this.getRegistry();
    if (!registry) return null;
    return registry.presets[name] || null;
  }

  listImages() {
    const registry = this.getRegistry();
    if (!registry) return [];
    return Object.entries(registry.images).map(([id, entry]) => ({ id, ...entry }));
  }

  listPresets() {
    const registry = this.getRegistry();
    if (!registry) return [];
    return Object.entries(registry.presets).map(([name, preset]) => ({ name, ...preset }));
  }

  getUsage(imageId: string, imageSrc?: string, srcsetUrls?: string[]): string[] {
    if (!this.contentIndex) return [];
    return this.contentIndex.getImageUsage(imageId, imageSrc, srcsetUrls);
  }

  private async checkExists(src: string): Promise<boolean> {
    const cached = this.existenceCache.get(src);
    const now = Date.now();
    if (cached && (now - cached.checkedAt) < EXISTENCE_CACHE_TTL_MS) {
      return cached.exists;
    }

    const exists = await media.exists(src);
    this.existenceCache.set(src, { exists, checkedAt: now });
    return exists;
  }

  private scanLocalImageDirectory(baseDir: string, urlPrefix: string, skipScreenshots: boolean): Map<string, string> {
    const imageFiles = new Map<string, string>();
    if (!fs.existsSync(baseDir)) return imageFiles;

    function walkDir(dir: string, prefix: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          walkDir(path.join(dir, entry.name), `${prefix}${entry.name}/`);
        } else {
          if (skipScreenshots && isScreenshot(entry.name)) continue;
          const ext = path.extname(entry.name).toLowerCase();
          if (IMAGE_EXTENSIONS.has(ext)) {
            const relPath = `${prefix}${entry.name}`;
            imageFiles.set(relPath, `${urlPrefix}${relPath}`);
          }
        }
      }
    }

    walkDir(baseDir, "");
    return imageFiles;
  }

  private scanAllLocalImages(): Map<string, string> {
    const attachedAssets = this.scanLocalImageDirectory(
      path.join(process.cwd(), "attached_assets"), "/attached_assets/", true
    );
    const marketingImages = this.scanLocalImageDirectory(MARKETING_IMAGES_DIR, "/marketing-content/images/", false);
    const combined = new Map<string, string>();
    attachedAssets.forEach((src, key) => combined.set(key, src));
    marketingImages.forEach((src, key) => combined.set(key, src));
    return combined;
  }

  private findImageRefsInValue(
    value: any,
    currentPath: string,
    results: Array<{ field: string; src: string }>
  ): void {
    if (typeof value === "string") {
      if (value.startsWith("/attached_assets/") || value.startsWith("attached_assets/") ||
          value.startsWith("/marketing-content/images/") || value.startsWith("marketing-content/images/") ||
          value.startsWith("https://storage.googleapis.com/")) {
        results.push({ field: currentPath, src: value });
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        this.findImageRefsInValue(item, `${currentPath}[${index}]`, results);
      });
    } else if (value && typeof value === "object") {
      for (const [key, val] of Object.entries(value)) {
        this.findImageRefsInValue(val, currentPath ? `${currentPath}.${key}` : key, results);
      }
    }
  }

  private scanYamlFiles(): Array<{ yamlFile: string; field: string; src: string }> {
    const refs: Array<{ yamlFile: string; field: string; src: string }> = [];

    const walkDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")) {
          try {
            const content = fs.readFileSync(fullPath, "utf8");
            const { escaped, map } = escapeTemplateVars(content);
            const rawParsed = yaml.load(escaped);
            const parsed = rawParsed ? unescapeObjectVars(rawParsed, map) : rawParsed;
            if (parsed && typeof parsed === "object") {
              const fileRefs: Array<{ field: string; src: string }> = [];
              this.findImageRefsInValue(parsed, "", fileRefs);
              const relPath = path.relative(process.cwd(), fullPath);
              for (const ref of fileRefs) {
                refs.push({ yamlFile: relPath, field: ref.field, src: ref.src });
              }
            }
          } catch {
            // skip unparseable YAML
          }
        }
      }
    };

    walkDir(MARKETING_CONTENT_DIR);
    return refs;
  }

  private computeFileHash(filePath: string): string | null {
    try {
      const data = fs.readFileSync(filePath);
      return crypto.createHash("sha256").update(data).digest("hex");
    } catch {
      return null;
    }
  }

  computeBufferHash(data: Buffer): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  private resolveLocalPath(src: string): string | null {
    const normalizedSrc = src.startsWith("/") ? src : `/${src}`;
    const diskPath = path.join(process.cwd(), normalizedSrc);
    if (fs.existsSync(diskPath)) return diskPath;
    return null;
  }

  findByHash(hash: string): { id: string; entry: ImageEntry } | null {
    const registry = this.getRegistry();
    if (!registry) return null;
    for (const [id, entry] of Object.entries(registry.images)) {
      if (entry.hash === hash) return { id, entry };
    }
    return null;
  }

  async scan(): Promise<ScanResult> {
    const registry = this.getRegistry() || { presets: {}, images: {} };
    const allImages = this.scanAllLocalImages();
    const marketingOnly = this.scanLocalImageDirectory(MARKETING_IMAGES_DIR, "/marketing-content/images/", false);
    const yamlRefs = this.scanYamlFiles();

    const existingSrcSet = new Set<string>();
    const existingIdByBase = new Map<string, { id: string; src: string } | null>();

    for (const [id, entry] of Object.entries(registry.images)) {
      existingSrcSet.add(entry.src);
      const filename = entry.src.split("/").pop() || "";
      const base = getIdBase(filename);
      if (base) {
        if (existingIdByBase.has(base)) {
          existingIdByBase.set(base, null);
        } else {
          existingIdByBase.set(base, { id, src: entry.src });
        }
      }
    }

    const newImages: ScanNewImage[] = [];
    const updatedImages: ScanUpdatedImage[] = [];

    marketingOnly.forEach((src, filename) => {
      if (existingSrcSet.has(src)) return;

      const base = getIdBase(filename);
      const existing = existingIdByBase.get(base) ?? undefined;

      if (existing) {
        const oldFile = existing.src.split("/").pop() || "";
        const oldExt = path.extname(oldFile).toLowerCase();
        const newExt = path.extname(filename).toLowerCase();
        if (oldExt !== newExt) {
          const oldTs = extractTimestamp(oldFile);
          const newTs = extractTimestamp(filename);
          if (newTs >= oldTs) {
            updatedImages.push({
              id: existing.id,
              oldSrc: existing.src,
              newSrc: src,
            });
          }
        }
      } else {
        const basename = path.basename(filename);
        const id = filenameToId(basename);
        if (id && !registry.images[id]) {
          newImages.push({ id, src, filename });
        }
      }
    });

    const brokenReferences: BrokenReference[] = [];
    const checkedSrcs = new Set<string>();

    for (const ref of yamlRefs) {
      const isRemote = ref.src.startsWith("http://") || ref.src.startsWith("https://");
      const displaySrc = isRemote ? ref.src : (ref.src.startsWith("/") ? ref.src : `/${ref.src}`);
      const cacheKey = `${ref.yamlFile}:${displaySrc}`;
      if (checkedSrcs.has(cacheKey)) continue;
      checkedSrcs.add(cacheKey);

      const exists = await this.checkExists(ref.src);
      if (!exists) {
        brokenReferences.push({
          yamlFile: ref.yamlFile,
          field: ref.field,
          missingSrc: displaySrc,
        });
      }
    }

    for (const [id, entry] of Object.entries(registry.images)) {
      const src = entry.src;
      if (!src || typeof src !== "string") continue;

      const exists = await this.checkExists(src);
      if (!exists) {
        const isRemote = src.startsWith("http://") || src.startsWith("https://");
        const displaySrc = isRemote ? src : (src.startsWith("/") ? src : `/${src}`);
        brokenReferences.push({
          yamlFile: `image-registry.json (id: ${id})`,
          field: "src",
          missingSrc: displaySrc,
        });
      }
    }

    let hashesComputed = 0;
    let registryDirty = false;
    for (const [id, entry] of Object.entries(registry.images)) {
      if (entry.hash) continue;
      const isLocal = !entry.src.startsWith("http://") && !entry.src.startsWith("https://");
      if (!isLocal) continue;
      const localPath = this.resolveLocalPath(entry.src);
      if (!localPath) continue;
      const hash = this.computeFileHash(localPath);
      if (hash) {
        (registry.images[id] as any).hash = hash;
        hashesComputed++;
        registryDirty = true;
      }
    }
    if (registryDirty) {
      this.saveRegistry(registry);
    }

    const hashGroups = new Map<string, string[]>();
    for (const [id, entry] of Object.entries(registry.images)) {
      if (!entry.hash) continue;
      const group = hashGroups.get(entry.hash) || [];
      group.push(id);
      hashGroups.set(entry.hash, group);
    }

    const duplicates: DuplicateGroup[] = [];
    for (const [hash, ids] of hashGroups) {
      if (ids.length < 2) continue;
      const sorted = [...ids].sort((a, b) => a.length - b.length || a.localeCompare(b));
      duplicates.push({ hash, ids: sorted, canonical: sorted[0] });
    }

    return {
      newImages,
      updatedImages,
      brokenReferences,
      duplicates,
      hashesComputed,
      registeredCount: Object.keys(registry.images).length,
      scannedImagesCount: allImages.size,
      summary: {
        new: newImages.length,
        updated: updatedImages.length,
        broken: brokenReferences.length,
        duplicates: duplicates.length,
      },
    };
  }

  private replacePathsInYamlFiles(oldSrc: string, newSrc: string): string[] {
    const updatedFiles: string[] = [];

    function walkDir(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")) {
          const content = fs.readFileSync(fullPath, "utf8");
          if (content.includes(oldSrc)) {
            const updated = content.split(oldSrc).join(newSrc);
            fs.writeFileSync(fullPath, updated, "utf8");
            updatedFiles.push(path.relative(process.cwd(), fullPath));
          }
        }
      }
    }

    walkDir(MARKETING_CONTENT_DIR);
    return updatedFiles;
  }

  applyChanges(scanResult: ScanResult): { added: number; updated: number; yamlFilesUpdated: string[] } {
    const registry = this.getRegistry() || { presets: {}, images: {} };
    const allYamlFilesUpdated: string[] = [];

    for (const img of scanResult.newImages) {
      (registry.images as Record<string, any>)[img.id] = {
        src: img.src,
        alt: `TODO: Add alt text for ${img.filename}`,
        focal_point: "center",
        tags: [],
        usage_count: 0,
      };
    }

    for (const img of scanResult.updatedImages) {
      if (registry.images[img.id]) {
        (registry.images[img.id] as any).src = img.newSrc;
      }
      const files = this.replacePathsInYamlFiles(img.oldSrc, img.newSrc);
      allYamlFilesUpdated.push(...files);
    }

    this.saveRegistry(registry);
    this.existenceCache.clear();

    return {
      added: scanResult.newImages.length,
      updated: scanResult.updatedImages.length,
      yamlFilesUpdated: Array.from(new Set(allYamlFilesUpdated)),
    };
  }

  register(id: string, entry: Partial<ImageEntry> & { src: string; alt: string }): void {
    const registry = this.getRegistry();
    if (!registry) throw new Error("Failed to load registry");

    (registry.images as Record<string, any>)[id] = {
      src: entry.src,
      alt: entry.alt,
      focal_point: entry.focal_point || "center",
      tags: entry.tags || [],
      usage_count: entry.usage_count || 0,
      ...(entry.hash ? { hash: entry.hash } : {}),
    };

    this.saveRegistry(registry);
  }

  private async deletePhysicalFiles(imageEntry: ImageEntry): Promise<string[]> {
    const errors: string[] = [];
    try {
      await media.delete(imageEntry.src);
    } catch (err) {
      const msg = `Failed to delete primary file ${imageEntry.src}: ${err instanceof Error ? err.message : String(err)}`;
      console.warn(`[MediaGallery] ${msg}`);
      errors.push(msg);
    }
    if (imageEntry.srcset) {
      for (const entry of imageEntry.srcset) {
        try {
          await media.delete(entry.url);
        } catch (err) {
          const msg = `Failed to delete srcset variant ${entry.url}: ${err instanceof Error ? err.message : String(err)}`;
          console.warn(`[MediaGallery] ${msg}`);
          errors.push(msg);
        }
      }
    }
    return errors;
  }

  private getSrcsetUrls(imageEntry: ImageEntry): string[] {
    if (!imageEntry.srcset) return [];
    return imageEntry.srcset.map(e => e.url);
  }

  async unregister(id: string): Promise<{ success: boolean; error?: string; usedIn?: string[]; cleanupErrors?: string[] }> {
    const registry = this.getRegistry();
    if (!registry) return { success: false, error: "Failed to load registry" };

    const imageEntry = registry.images[id];
    if (!imageEntry) return { success: false, error: `Image "${id}" not found in registry` };

    const srcsetUrls = this.getSrcsetUrls(imageEntry);
    const usedIn = this.getUsage(id, imageEntry.src, srcsetUrls);
    if (usedIn.length > 0) {
      return {
        success: false,
        error: `Cannot delete "${id}" because it is referenced in ${usedIn.length} file(s)`,
        usedIn,
      };
    }

    delete (registry.images as Record<string, any>)[id];
    this.saveRegistry(registry);

    const cleanupErrors = await this.deletePhysicalFiles(imageEntry);
    return { success: true, ...(cleanupErrors.length > 0 ? { cleanupErrors } : {}) };
  }

  async bulkUnregister(ids: string[]): Promise<{ results: Array<{ id: string; success: boolean; message: string }>; deletedCount: number }> {
    const registry = this.getRegistry();
    if (!registry) {
      return {
        results: ids.map(id => ({ id, success: false, message: "Failed to load registry" })),
        deletedCount: 0,
      };
    }

    const resultMap = new Map<string, { id: string; success: boolean; message: string }>();
    let deletedCount = 0;
    const entriesToDelete: Array<{ id: string; entry: ImageEntry }> = [];

    for (const imageId of ids) {
      const imageEntry = registry.images[imageId];
      if (!imageEntry) {
        resultMap.set(imageId, { id: imageId, success: false, message: "Not found in registry" });
        continue;
      }

      const srcsetUrls = this.getSrcsetUrls(imageEntry);
      const usedIn = this.getUsage(imageId, imageEntry.src, srcsetUrls);
      if (usedIn.length > 0) {
        resultMap.set(imageId, {
          id: imageId,
          success: false,
          message: `Referenced in ${usedIn.length} file(s): ${usedIn.join(", ")}`,
        });
        continue;
      }

      entriesToDelete.push({ id: imageId, entry: imageEntry });
      delete (registry.images as Record<string, any>)[imageId];
      deletedCount++;
    }

    if (deletedCount > 0) {
      this.saveRegistry(registry);
    }

    for (const { id: imageId, entry } of entriesToDelete) {
      const cleanupErrors = await this.deletePhysicalFiles(entry);
      if (cleanupErrors.length > 0) {
        resultMap.set(imageId, { id: imageId, success: true, message: `Deleted (file cleanup issues: ${cleanupErrors.join("; ")})` });
      } else {
        resultMap.set(imageId, { id: imageId, success: true, message: "Deleted" });
      }
    }

    const results = ids.map(id => resultMap.get(id)!);
    return { results, deletedCount };
  }

  private toDestKey(sourceKey: string, prefix?: string): string {
    let relative = sourceKey;
    const localPrefixes = ["/marketing-content/images/", "/attached_assets/", "marketing-content/images/", "attached_assets/"];
    for (const p of localPrefixes) {
      if (relative.startsWith(p)) {
        relative = relative.slice(p.length);
        break;
      }
    }
    return prefix ? `${prefix}/${relative}` : relative;
  }

  private static MIME_MAP: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".svg": "image/svg+xml", ".avif": "image/avif", ".gif": "image/gif",
  };

  private async readSourceData(from: import("./media/types").StorageProvider, key: string): Promise<Buffer | null> {
    if (from.name === "local") {
      const normalizedKey = key.startsWith("/") ? key : `/${key}`;
      const diskPath = path.join(process.cwd(), normalizedKey);
      if (!fs.existsSync(diskPath)) return null;
      return fs.readFileSync(diskPath);
    }
    return null;
  }

  async migrate(
    fromProvider: string,
    toProvider: string,
    options: { dryRun?: boolean; prefix?: string } = {}
  ): Promise<Array<{ id: string; oldSrc: string; newSrc: string; status: string }>> {
    const registry = this.getRegistry();
    if (!registry) throw new Error("Failed to load registry");

    const from = media.getProvider(fromProvider as any);
    const to = media.getProvider(toProvider as any);
    if (!from) throw new Error(`Provider "${fromProvider}" not configured. Available: ${media.getAllProviderNames().join(", ")}`);
    if (!to) throw new Error(`Provider "${toProvider}" not configured. Available: ${media.getAllProviderNames().join(", ")}`);

    const results: Array<{ id: string; oldSrc: string; newSrc: string; status: string }> = [];

    for (const [id, entry] of Object.entries(registry.images)) {
      if (!from.owns(entry.src)) continue;

      const sourceKey = from.extractKey(entry.src);
      if (!sourceKey) {
        results.push({ id, oldSrc: entry.src, newSrc: "", status: "skipped: could not extract key" });
        continue;
      }

      const destKey = this.toDestKey(sourceKey, options.prefix);

      if (options.dryRun) {
        results.push({ id, oldSrc: entry.src, newSrc: to.getPublicUrl(destKey), status: "dry-run" });
        continue;
      }

      try {
        const data = await this.readSourceData(from, sourceKey);
        if (!data) {
          results.push({ id, oldSrc: entry.src, newSrc: "", status: "skipped: source file not found" });
          continue;
        }

        const ext = path.extname(sourceKey).toLowerCase();
        const contentType = MediaGallery.MIME_MAP[ext] || "application/octet-stream";

        const newSrc = await to.upload(destKey, data, contentType);

        (registry.images[id] as any).src = newSrc;
        this.replacePathsInYamlFiles(entry.src, newSrc);
        results.push({ id, oldSrc: entry.src, newSrc, status: "migrated" });
      } catch (err: any) {
        results.push({ id, oldSrc: entry.src, newSrc: "", status: `error: ${err.message}` });
      }
    }

    if (!options.dryRun && results.some(r => r.status === "migrated")) {
      this.saveRegistry(registry);
      this.existenceCache.clear();
    }

    return results;
  }

  async uploadAndRegister(
    filename: string,
    data: Buffer,
    contentType: string,
    opts?: { alt?: string; tags?: string[] }
  ): Promise<{ id: string; src: string; alt: string; duplicate?: boolean; existingId?: string }> {
    const registry = this.getRegistry();
    if (!registry) throw new Error("Failed to load registry");

    const ext = path.extname(filename).toLowerCase();
    if (!MEDIA_EXTENSIONS.has(ext)) {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    const hash = this.computeBufferHash(data);
    const existing = this.findByHash(hash);
    if (existing) {
      return {
        id: existing.id,
        src: existing.entry.src,
        alt: existing.entry.alt,
        duplicate: true,
        existingId: existing.id,
      };
    }

    const sanitized = filename
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const id = filenameToId(sanitized);
    if (!id) throw new Error("Could not derive a valid ID from filename");

    let uniqueId = id;
    let counter = 1;
    while (registry.images[uniqueId]) {
      uniqueId = `${id}-${counter}`;
      counter++;
    }

    const defaultProvider = media.getDefaultProvider();
    let src: string;

    if (defaultProvider.name === "local") {
      const destDir = MARKETING_IMAGES_DIR;
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      const destPath = path.join(destDir, sanitized);
      fs.writeFileSync(destPath, data);
      src = `/marketing-content/images/${sanitized}`;
    } else {
      const key = sanitized;
      src = await defaultProvider.upload(key, data, contentType);
    }

    const alt = opts?.alt || `Image: ${path.parse(filename).name}`;
    this.register(uniqueId, {
      src,
      alt,
      tags: opts?.tags || [],
      hash,
    });

    this.existenceCache.clear();

    if (OPTIMIZABLE_EXTENSIONS.has(ext)) {
      this.optimizeInBackground(uniqueId, data, src, opts?.tags || []);
    }

    return { id: uniqueId, src, alt };
  }

  private optimizeInBackground(id: string, buffer: Buffer, src: string, tags: string[]): void {
    const registry = this.getRegistry();
    if (!registry) return;

    const presets = registry.presets as Record<string, Preset>;

    processImageBuffer(id, buffer, src, tags, presets)
      .then((result) => {
        if (!result) {
          console.log(`[MediaGallery] Background optimization produced no variants for "${id}"`);
          return;
        }

        const currentRegistry = this.getRegistry();
        if (!currentRegistry) return;

        const existing = currentRegistry.images[id];
        if (!existing) {
          console.log(`[MediaGallery] Image "${id}" no longer in registry, skipping optimization update`);
          return;
        }

        (currentRegistry.images as Record<string, any>)[id] = {
          ...existing,
          width: result.width,
          height: result.height,
          preset: result.preset,
          widths_generated: result.widths_generated,
          format: result.format,
          srcset: result.srcset,
        };

        this.saveRegistry(currentRegistry);
        console.log(
          `[MediaGallery] Optimized "${id}": ${result.width}x${result.height} → ${result.srcset.length} variant(s) [${result.preset.join(", ")}]`
        );
      })
      .catch((err) => {
        console.error(`[MediaGallery] Background optimization failed for "${id}":`, err);
      });
  }

  removeDuplicates(duplicateGroups: DuplicateGroup[]): {
    removedCount: number;
    yamlFilesUpdated: string[];
    results: Array<{ id: string; status: string; rewrittenTo?: string }>;
  } {
    const registry = this.getRegistry();
    if (!registry) throw new Error("Failed to load registry");

    const results: Array<{ id: string; status: string; rewrittenTo?: string }> = [];
    const allYamlFilesUpdated: string[] = [];
    let removedCount = 0;

    for (const group of duplicateGroups) {
      const canonical = group.canonical;
      const canonicalEntry = registry.images[canonical];
      if (!canonicalEntry) continue;

      for (const id of group.ids) {
        if (id === canonical) {
          results.push({ id, status: "kept" });
          continue;
        }

        const entry = registry.images[id];
        if (!entry) {
          results.push({ id, status: "not_found" });
          continue;
        }

        if (entry.src !== canonicalEntry.src) {
          const files = this.replacePathsInYamlFiles(entry.src, canonicalEntry.src);
          allYamlFilesUpdated.push(...files);
        }

        delete (registry.images as Record<string, any>)[id];
        removedCount++;
        results.push({ id, status: "removed", rewrittenTo: canonical });
      }
    }

    if (removedCount > 0) {
      this.saveRegistry(registry);
      this.existenceCache.clear();
    }

    return {
      removedCount,
      yamlFilesUpdated: Array.from(new Set(allYamlFilesUpdated)),
      results,
    };
  }

  findRedundantImages(): Array<{ id: string; cloudUrl: string; localPath: string }> {
    const registry = this.getRegistry();
    if (!registry) return [];

    const ATTACHED_ASSETS_DIR = path.join(process.cwd(), "attached_assets");
    const redundant: Array<{ id: string; cloudUrl: string; localPath: string }> = [];

    for (const [id, entry] of Object.entries(registry.images)) {
      if (!entry.src.startsWith("http")) continue;

      const filename = entry.src.split("/").pop();
      if (!filename) continue;

      const inImages = path.join(MARKETING_IMAGES_DIR, filename);
      const inAssets = path.join(ATTACHED_ASSETS_DIR, filename);

      if (fs.existsSync(inImages)) {
        redundant.push({ id, cloudUrl: entry.src, localPath: `/marketing-content/images/${filename}` });
      } else if (fs.existsSync(inAssets)) {
        redundant.push({ id, cloudUrl: entry.src, localPath: `/attached_assets/${filename}` });
      }
    }

    return redundant;
  }

  async resolveRedundancy(
    action: "delete-local" | "delete-cloud",
    ids?: string[],
  ): Promise<{ resolved: number; errors: string[] }> {
    const registry = this.getRegistry();
    if (!registry) throw new Error("Failed to load registry");

    const ATTACHED_ASSETS_DIR = path.join(process.cwd(), "attached_assets");
    const all = this.findRedundantImages();
    const targets = ids && ids.length > 0 ? all.filter(r => ids.includes(r.id)) : all;

    let resolved = 0;
    const errors: string[] = [];

    for (const item of targets) {
      try {
        if (action === "delete-local") {
          const localDiskPath = path.join(process.cwd(), item.localPath);
          if (fs.existsSync(localDiskPath)) {
            fs.unlinkSync(localDiskPath);
          }
          resolved++;
        } else {
          await media.delete(item.cloudUrl);
          const localDiskPath = path.join(process.cwd(), item.localPath);
          const fileExists = fs.existsSync(localDiskPath);
          if (fileExists) {
            const entry = registry.images[item.id];
            if (entry) {
              (registry.images as Record<string, ImageEntry>)[item.id] = {
                ...entry,
                src: item.localPath,
              };
            }
          }
          resolved++;
        }
      } catch (err: any) {
        errors.push(`[${item.id}] ${err.message || String(err)}`);
      }
    }

    if (action === "delete-cloud" && resolved > 0) {
      this.saveRegistry(registry);
    }

    return { resolved, errors };
  }

  persistRegistry(): void {
    const registry = this.getRegistry();
    if (registry) {
      this.saveRegistry(registry);
    }
  }

  private saveRegistry(registry: ImageRegistry): void {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n", "utf8");
    markFileAsModified("marketing-content/image-registry.json");
    this.clearCache();
  }
}

export const mediaGallery = new MediaGallery();
