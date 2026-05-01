import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { getContentTypeConfig, getLocaleKey, getFieldMapping } from "./content-types";
import { getValueByPath, resolveFieldValue } from "./transform";
import { ExternalImageCacher } from "./external-image-cacher";
import { resolveBySourceUrl } from "./image-registry";

const DB_DIR = path.join(process.cwd(), "marketing-content", "db");
const CACHE_DIR = path.join(process.cwd(), ".cache");

export interface DatabaseConfig {
  name: string;
  description?: string;
  source: {
    type: "api" | "csv" | "yaml" | "local" | "remote";
    api?: {
      endpoint: string;
      params?: Record<string, unknown>;
      results_path?: string;
      auth?: {
        token_env_var?: string;
        prefix?: string;
      };
      headers?: Record<string, string>;
    };
    local?: {
      filename: string;
      results_path?: string;
    };
    remote?: {
      url: string;
      results_path?: string;
    };
  };
  cache?: {
    ttl_hours?: number;
  };
  field_mapping?: Record<string, string>;
  editor?: Record<string, { type?: string; options?: string[]; populate_options?: boolean; cache_images?: boolean }>;
}

interface CacheEntry {
  fetched_at: string;
  items: Record<string, unknown>[];
  raw_count: number;
}

const VALID_DB_NAME = /^[a-z0-9_-]+$/;

function setValueByPath(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
  const parts = dotPath.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === null || current[part] === undefined || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function applyFieldMapping(
  item: Record<string, unknown>,
  mapping: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [normalizedKey, sourcePath] of Object.entries(mapping)) {
    if (sourcePath === null || sourcePath === undefined) {
      result[normalizedKey] = null;
    } else {
      result[normalizedKey] = getValueByPath(item, sourcePath);
    }
  }
  return result;
}

function collectAllPaths(obj: unknown, prefix: string, keys: Set<string>): void {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const fullPath = prefix ? `${prefix}.${k}` : k;
    keys.add(fullPath);
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      collectAllPaths(v, fullPath, keys);
    }
  }
}

const DATASET_EXTENSIONS = [".json", ".csv", ".yaml", ".yml"];

function parseFileContent(content: string, ext: string, resultsPath?: string): unknown[] {
  let data: unknown;
  if (ext === ".json") {
    data = JSON.parse(content);
  } else if (ext === ".yaml" || ext === ".yml") {
    data = yaml.load(content);
  } else if (ext === ".csv") {
    const lines = content.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    data = lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, unknown> = {};
      headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
      return row;
    });
  } else {
    throw new Error(`Unsupported file extension: ${ext}`);
  }

  if (resultsPath) {
    const items = getValueByPath(data, resultsPath);
    if (!Array.isArray(items)) {
      throw new Error(`results_path "${resultsPath}" did not resolve to an array`);
    }
    return items;
  }
  if (Array.isArray(data)) return data;
  // Auto-detect: if the root is an object, find top-level keys whose value is an array
  if (data && typeof data === "object") {
    const arrayKeys = Object.keys(data as Record<string, unknown>).filter(
      (k) => Array.isArray((data as Record<string, unknown>)[k])
    );
    if (arrayKeys.length === 1) {
      return (data as Record<string, unknown>)[arrayKeys[0]] as unknown[];
    }
    if (arrayKeys.length > 1) {
      throw new Error(
        `File contains multiple array keys: ${arrayKeys.map((k) => `"${k}"`).join(", ")}. ` +
        `Set the Results Path field to one of these.`
      );
    }
  }
  throw new Error("File content is not an array and no results_path configured");
}

async function fetchFromLocal(
  dbSlug: string,
  localConfig: NonNullable<DatabaseConfig["source"]["local"]>
): Promise<unknown[]> {
  const filePath = path.join(DB_DIR, dbSlug, localConfig.filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Local file not found: marketing-content/db/${dbSlug}/${localConfig.filename}`
    );
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(localConfig.filename).toLowerCase();
  if (!DATASET_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file extension "${ext}". Allowed: ${DATASET_EXTENSIONS.join(", ")}`);
  }
  return parseFileContent(content, ext, localConfig.results_path);
}

async function fetchFromRemote(
  remoteConfig: NonNullable<DatabaseConfig["source"]["remote"]>
): Promise<unknown[]> {
  const response = await fetch(remoteConfig.url);
  if (!response.ok) {
    throw new Error(`Remote URL returned ${response.status}: ${await response.text().catch(() => "")}`);
  }
  const contentType = response.headers.get("content-type") || "";
  const url = new URL(remoteConfig.url);
  const ext = path.extname(url.pathname).toLowerCase() || ".json";

  let content: string;
  if (ext === ".json" || contentType.includes("json")) {
    content = await response.text();
    return parseFileContent(content, ".json", remoteConfig.results_path);
  } else if (ext === ".yaml" || ext === ".yml" || contentType.includes("yaml")) {
    content = await response.text();
    return parseFileContent(content, ".yaml", remoteConfig.results_path);
  } else if (ext === ".csv" || contentType.includes("csv")) {
    content = await response.text();
    return parseFileContent(content, ".csv", remoteConfig.results_path);
  } else {
    content = await response.text();
    return parseFileContent(content, ".json", remoteConfig.results_path);
  }
}

async function fetchFromApi(
  apiConfig: NonNullable<DatabaseConfig["source"]["api"]>
): Promise<unknown[]> {
  const url = new URL(apiConfig.endpoint);
  if (apiConfig.params) {
    for (const [key, value] of Object.entries(apiConfig.params)) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(apiConfig.headers || {}),
  };

  if (apiConfig.auth?.token_env_var) {
    const token = process.env[apiConfig.auth.token_env_var];
    if (token) {
      const prefix = apiConfig.auth.prefix || "Bearer";
      headers["Authorization"] = `${prefix} ${token}`;
    }
  }

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(
      `API returned ${response.status}: ${await response.text().catch(() => "")}`
    );
  }

  const data = await response.json();

  if (apiConfig.results_path) {
    const items = getValueByPath(data, apiConfig.results_path);
    if (!Array.isArray(items)) {
      throw new Error(
        `results_path "${apiConfig.results_path}" did not resolve to an array`
      );
    }
    return items;
  }

  if (Array.isArray(data)) return data;
  // Auto-detect: if the root is an object, find top-level keys whose value is an array
  if (data && typeof data === "object") {
    const arrayKeys = Object.keys(data as Record<string, unknown>).filter(
      (k) => Array.isArray((data as Record<string, unknown>)[k])
    );
    if (arrayKeys.length === 1) {
      return (data as Record<string, unknown>)[arrayKeys[0]] as unknown[];
    }
    if (arrayKeys.length > 1) {
      throw new Error(
        `Response contains multiple array keys: ${arrayKeys.map((k) => `"${k}"`).join(", ")}. ` +
        `Set the Results Path field to one of these.`
      );
    }
  }
  throw new Error("API response is not an array and no results_path configured");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

function applyContentTypeMapping(
  items: Record<string, unknown>[],
  mapping: Record<string, string>,
  contentType?: string,
): Record<string, unknown>[] {
  return items.map((src, idx) => {
    const mapped: Record<string, unknown> = { ...src };
    const itemSlug = String(src.slug ?? src.id ?? idx);

    for (const [targetKey, sourcePath] of Object.entries(mapping)) {
      const value = resolveFieldValue(sourcePath, src, targetKey, contentType ? {
        contentType,
        slug: itemSlug,
        fieldPath: targetKey,
      } : undefined);
      if (value !== undefined) {
        mapped[targetKey] = value;
      }
    }

    if (!mapped.slug && mapped.title && typeof mapped.title === "string") {
      mapped.slug = slugify(mapped.title);
    }

    if (mapped.category !== undefined && typeof mapped.category === "string") {
      mapped.category = { slug: mapped.category };
    } else if (mapped.category === undefined || mapped.category === null) {
      if (mapping.category) {
        mapped.category = { slug: "uncategorized" };
      }
    }


    if (!mapped.id) mapped.id = idx;

    return mapped;
  });
}

export class DatabaseManager {
  private configs = new Map<string, DatabaseConfig>();
  private memoryCache = new Map<string, { data: CacheEntry; expires: number }>();

  constructor() {
    this.reload();
  }

  reload(): void {
    this.configs.clear();
    if (!fs.existsSync(DB_DIR)) return;

    const folders = fs.readdirSync(DB_DIR).filter((f) => {
      const full = path.join(DB_DIR, f);
      return (
        fs.statSync(full).isDirectory() &&
        fs.existsSync(path.join(full, "config.yml"))
      );
    });

    for (const folder of folders) {
      try {
        const configPath = path.join(DB_DIR, folder, "config.yml");
        const raw = fs.readFileSync(configPath, "utf-8");
        this.configs.set(folder, yaml.load(raw) as DatabaseConfig);
      } catch (err) {
        console.error(`[DatabaseManager] Failed to load config for "${folder}":`, err);
      }
    }

    console.log(`[DatabaseManager] Loaded ${this.configs.size} database(s)`);
  }

  private validateName(name: string): void {
    if (!name || !VALID_DB_NAME.test(name)) {
      throw new Error(
        `Invalid database name "${name}" — only lowercase letters, digits, hyphens, and underscores allowed`
      );
    }
  }

  list(): { name: string; config: DatabaseConfig }[] {
    return Array.from(this.configs.entries()).map(([name, config]) => ({
      name,
      config,
    }));
  }

  get(name: string): DatabaseConfig {
    this.validateName(name);
    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`Database "${name}" not found`);
    }
    return config;
  }

  exists(name: string): boolean {
    return this.configs.has(name);
  }

  create(name: string, config: DatabaseConfig): void {
    this.validateName(name);
    if (this.configs.has(name)) {
      throw new Error(`Database "${name}" already exists`);
    }
    this.writeToDisk(name, config);
    this.configs.set(name, config);
  }

  update(name: string, config: DatabaseConfig): void {
    this.validateName(name);
    this.writeToDisk(name, config);
    this.configs.set(name, config);
    this.memoryCache.delete(name);
  }

  delete(name: string): void {
    this.validateName(name);
    const dir = path.join(DB_DIR, name);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
    this.configs.delete(name);
    this.memoryCache.delete(name);
    const cachePath = path.join(CACHE_DIR, `db-${name}.json`);
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
    const rawCachePath = path.join(CACHE_DIR, `db-${name}-raw.json`);
    if (fs.existsSync(rawCachePath)) {
      fs.unlinkSync(rawCachePath);
    }
  }

  async fetchItems(
    name: string,
    forceRefresh = false
  ): Promise<{
    items: Record<string, unknown>[];
    raw_count: number;
    fetched_at: string;
    from_cache: boolean;
  }> {
    const config = this.get(name);
    const ttl = config.cache?.ttl_hours ?? 24;

    if (!forceRefresh) {
      const memEntry = this.memoryCache.get(name);
      if (memEntry && Date.now() < memEntry.expires) {
        ExternalImageCacher.scheduleItems(name, config, memEntry.data.items);
        return { ...memEntry.data, from_cache: true };
      }

      const fileEntry = this.loadFileCache(name, ttl);
      if (fileEntry) {
        this.memoryCache.set(name, {
          data: fileEntry,
          expires: Date.now() + ttl * 60 * 60 * 1000,
        });
        ExternalImageCacher.scheduleItems(name, config, fileEntry.items);
        return { ...fileEntry, from_cache: true };
      }
    }

    let rawItems: unknown[];

    if (config.source.type === "api") {
      if (!config.source.api) throw new Error("API source config missing");
      rawItems = await fetchFromApi(config.source.api);
    } else if (config.source.type === "local") {
      if (!config.source.local) throw new Error("Local source config missing");
      rawItems = await fetchFromLocal(name, config.source.local);
    } else if (config.source.type === "remote") {
      if (!config.source.remote) throw new Error("Remote source config missing");
      rawItems = await fetchFromRemote(config.source.remote);
    } else {
      throw new Error(`Unsupported source type: ${config.source.type}`);
    }

    const fetchedAt = new Date().toISOString();

    const rawEntry: CacheEntry = {
      fetched_at: fetchedAt,
      items: rawItems as Record<string, unknown>[],
      raw_count: rawItems.length,
    };
    this.saveFileCache(name, rawEntry, true);

    const items = config.field_mapping
      ? rawItems.map((item) =>
          applyFieldMapping(
            item as Record<string, unknown>,
            config.field_mapping!
          )
        )
      : (rawItems as Record<string, unknown>[]);

    const entry: CacheEntry = {
      fetched_at: fetchedAt,
      items,
      raw_count: rawItems.length,
    };

    this.saveFileCache(name, entry);
    this.memoryCache.set(name, {
      data: entry,
      expires: Date.now() + ttl * 60 * 60 * 1000,
    });

    ExternalImageCacher.scheduleItems(name, config, items);

    return { ...entry, from_cache: false };
  }

  async warmup(): Promise<void> {
    const names = Array.from(this.configs.keys());
    if (names.length === 0) return;

    const toWarm = names.filter((name) => {
      const config = this.configs.get(name)!;
      const ttl = config.cache?.ttl_hours ?? 24;
      return !this.loadFileCache(name, ttl);
    });

    if (toWarm.length === 0) {
      console.log(`[DatabaseManager] Warmup: all ${names.length} database(s) already cached`);
      return;
    }

    console.log(`[DatabaseManager] Warmup: pre-fetching ${toWarm.length} database(s): ${toWarm.join(", ")}`);

    for (const name of toWarm) {
      try {
        await this.fetchItems(name);
        console.log(`[DatabaseManager] Warmup: "${name}" cached successfully`);
      } catch (err) {
        console.error(`[DatabaseManager] Warmup: failed to fetch "${name}":`, err);
      }
    }

    console.log(`[DatabaseManager] Warmup complete`);
  }

  async test(
    sourceConfig: DatabaseConfig["source"],
    dbSlug?: string
  ): Promise<{
    success: boolean;
    item_count?: number;
    sample?: unknown;
    error?: string;
  }> {
    try {
      let items: unknown[];
      if (sourceConfig.type === "api") {
        if (!sourceConfig.api) throw new Error("API config missing");
        items = await fetchFromApi(sourceConfig.api);
      } else if (sourceConfig.type === "local") {
        if (!sourceConfig.local) throw new Error("Local source config missing");
        if (!dbSlug) throw new Error("Database slug required for local source testing");
        items = await fetchFromLocal(dbSlug, sourceConfig.local);
      } else if (sourceConfig.type === "remote") {
        if (!sourceConfig.remote) throw new Error("Remote source config missing");
        items = await fetchFromRemote(sourceConfig.remote);
      } else {
        return {
          success: false,
          error: `Unsupported source type: ${sourceConfig.type}`,
        };
      }
      return {
        success: true,
        item_count: items.length,
        sample: items[0] || null,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private writeToDisk(name: string, config: DatabaseConfig): void {
    const configPath = path.join(DB_DIR, name, "config.yml");
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, yaml.dump(config, { lineWidth: 120 }));
  }

  getFieldCount(name: string): number {
    const config = this.configs.get(name);
    if (!config) return 0;

    const memEntry = this.memoryCache.get(name);
    const items = memEntry?.data?.items;
    if (items && items.length > 0) {
      const keys = new Set<string>();
      for (const item of items) {
        for (const k of Object.keys(item)) keys.add(k);
      }
      return keys.size;
    }

    const ttl = config.cache?.ttl_hours ?? 24;
    const fileEntry = this.loadFileCache(name, ttl);
    if (fileEntry && fileEntry.items.length > 0) {
      const keys = new Set<string>();
      for (const item of fileEntry.items) {
        for (const k of Object.keys(item)) keys.add(k);
      }
      return keys.size;
    }

    if (config.field_mapping) {
      return Object.keys(config.field_mapping).length;
    }
    return 0;
  }

  async fetchMappedItems(
    contentType: string,
    forceRefresh = false,
  ): Promise<Record<string, unknown>[]> {
    const ctConfig = getContentTypeConfig(contentType);
    if (!ctConfig?.database?.slug) {
      console.warn(`[DatabaseManager] No database configured for content type "${contentType}"`);
      return [];
    }

    const dbName = ctConfig.database.slug;
    if (!this.exists(dbName)) {
      console.warn(`[DatabaseManager] Database "${dbName}" not found for content type "${contentType}"`);
      return [];
    }

    try {
      const result = await this.fetchItems(dbName, forceRefresh);
      let rawItems = result.items;

      const dbConfig = this.get(dbName);
      if (dbConfig.editor) {
        const cacheFields = Object.entries(dbConfig.editor)
          .filter(([, hint]) => hint.cache_images === true)
          .map(([field]) => field);
        if (cacheFields.length > 0) {
          rawItems = rawItems.map((item) => {
            const updated = { ...item };
            for (const field of cacheFields) {
              const val = item[field];
              if (typeof val === "string" && val.startsWith("http")) {
                const resolved = resolveBySourceUrl(val);
                if (resolved) updated[field] = resolved;
              }
            }
            return updated;
          });
        }
      }

      const ctMapping = getFieldMapping(contentType);
      if (!ctMapping || Object.keys(ctMapping).length === 0) {
        return rawItems;
      }
      return applyContentTypeMapping(rawItems, ctMapping, contentType);
    } catch (err) {
      console.error(`[DatabaseManager] Failed to fetch mapped items for "${contentType}":`, err);
      return [];
    }
  }

  getCacheInfo(name: string): { fetched_at: string; item_count: number } | null {
    const memEntry = this.memoryCache.get(name);
    if (memEntry && Date.now() < memEntry.expires) {
      return {
        fetched_at: memEntry.data.fetched_at,
        item_count: memEntry.data.items.length,
      };
    }

    const config = this.configs.get(name);
    if (!config) return null;
    const ttl = config.cache?.ttl_hours ?? 24;
    const fileEntry = this.loadFileCache(name, ttl);
    if (fileEntry) {
      return {
        fetched_at: fileEntry.fetched_at,
        item_count: fileEntry.items.length,
      };
    }
    return null;
  }

  getRawItems(name: string): Record<string, unknown>[] | null {
    const config = this.configs.get(name);
    if (!config) return null;
    const ttl = config.cache?.ttl_hours ?? 24;
    const rawEntry = this.loadFileCache(name, ttl, true);
    if (rawEntry) return rawEntry.items;
    const mappedEntry = this.loadFileCache(name, ttl);
    if (mappedEntry) return mappedEntry.items;
    return null;
  }

  getRawFields(name: string): string[] {
    const rawItems = this.getRawItems(name);
    if (!rawItems || rawItems.length === 0) return [];
    const keys = new Set<string>();
    const sample = rawItems.slice(0, 5);
    for (const item of sample) {
      collectAllPaths(item, "", keys);
    }
    return Array.from(keys).sort();
  }

  clearCache(name: string): void {
    this.memoryCache.delete(name);
    const cachePath = path.join(CACHE_DIR, `db-${name}.json`);
    if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
    const rawCachePath = path.join(CACHE_DIR, `db-${name}-raw.json`);
    if (fs.existsSync(rawCachePath)) fs.unlinkSync(rawCachePath);
  }

  private loadFileCache(
    dbName: string,
    ttlHours: number,
    raw = false
  ): CacheEntry | null {
    const suffix = raw ? "-raw" : "";
    const cachePath = path.join(CACHE_DIR, `db-${dbName}${suffix}.json`);
    if (!fs.existsSync(cachePath)) return null;

    try {
      const content = fs.readFileSync(cachePath, "utf-8");
      const entry = JSON.parse(content) as CacheEntry;
      const age =
        (Date.now() - new Date(entry.fetched_at).getTime()) / (1000 * 60 * 60);
      if (age > ttlHours) return null;
      return entry;
    } catch {
      return null;
    }
  }

  patchDbEntry(
    dbName: string,
    lookupKey: string,
    slugValue: string,
    mappedUpdates: Record<string, unknown>,
    fieldMapping: Record<string, string> | null = null
  ): boolean {
    try {
      const readCache = (raw: boolean): CacheEntry | null => {
        const suffix = raw ? "-raw" : "";
        const cachePath = path.join(CACHE_DIR, `db-${dbName}${suffix}.json`);
        if (!fs.existsSync(cachePath)) return null;
        try {
          return JSON.parse(fs.readFileSync(cachePath, "utf-8")) as CacheEntry;
        } catch {
          return null;
        }
      };

      let patchedIdx = -1;

      const mappedEntry = readCache(false);
      if (mappedEntry) {
        const idx = mappedEntry.items.findIndex(
          (i) => String(i[lookupKey]) === String(slugValue)
        );
        if (idx !== -1) {
          patchedIdx = idx;
          Object.assign(mappedEntry.items[idx], mappedUpdates);
          this.saveFileCache(dbName, mappedEntry, false);
        }
      }

      if (fieldMapping && patchedIdx !== -1) {
        const rawEntry = readCache(true);
        if (rawEntry && rawEntry.items[patchedIdx]) {
          for (const [templateKey, newValue] of Object.entries(mappedUpdates)) {
            const rawPath = fieldMapping[templateKey];
            if (rawPath) {
              setValueByPath(
                rawEntry.items[patchedIdx] as Record<string, unknown>,
                rawPath,
                newValue
              );
            }
          }
          this.saveFileCache(dbName, rawEntry, true);
        }
      }

      this.memoryCache.delete(dbName);
      return patchedIdx !== -1;
    } catch {
      return false;
    }
  }

  private saveFileCache(dbName: string, entry: CacheEntry, raw = false): void {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const suffix = raw ? "-raw" : "";
    fs.writeFileSync(
      path.join(CACHE_DIR, `db-${dbName}${suffix}.json`),
      JSON.stringify(entry, null, 2)
    );
  }
}

export const databaseManager = new DatabaseManager();
