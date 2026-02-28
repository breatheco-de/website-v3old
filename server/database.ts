import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const DB_DIR = path.join(process.cwd(), "marketing-content", "db");
const CACHE_DIR = path.join(process.cwd(), ".cache");

export interface DatabaseConfig {
  name: string;
  description?: string;
  source: {
    type: "api" | "csv" | "yaml";
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
  };
  cache?: {
    ttl_hours?: number;
  };
  field_mapping?: Record<string, string>;
}

interface CacheEntry {
  fetched_at: string;
  items: Record<string, unknown>[];
  raw_count: number;
}

const VALID_DB_NAME = /^[a-z0-9_-]+$/;

function getValueByPath(obj: unknown, dotPath: string): unknown {
  const parts = dotPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
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
  throw new Error("API response is not an array and no results_path configured");
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
        return { ...memEntry.data, from_cache: true };
      }

      const fileEntry = this.loadFileCache(name, ttl);
      if (fileEntry) {
        this.memoryCache.set(name, {
          data: fileEntry,
          expires: Date.now() + ttl * 60 * 60 * 1000,
        });
        return { ...fileEntry, from_cache: true };
      }
    }

    let rawItems: unknown[];

    if (config.source.type === "api") {
      if (!config.source.api) throw new Error("API source config missing");
      rawItems = await fetchFromApi(config.source.api);
    } else {
      throw new Error(`Unsupported source type: ${config.source.type}`);
    }

    const items = config.field_mapping
      ? rawItems.map((item) =>
          applyFieldMapping(
            item as Record<string, unknown>,
            config.field_mapping!
          )
        )
      : (rawItems as Record<string, unknown>[]);

    const entry: CacheEntry = {
      fetched_at: new Date().toISOString(),
      items,
      raw_count: rawItems.length,
    };

    this.saveFileCache(name, entry);
    this.memoryCache.set(name, {
      data: entry,
      expires: Date.now() + ttl * 60 * 60 * 1000,
    });

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
    sourceConfig: DatabaseConfig["source"]
  ): Promise<{
    success: boolean;
    item_count?: number;
    sample?: unknown;
    error?: string;
  }> {
    try {
      if (sourceConfig.type === "api") {
        if (!sourceConfig.api) throw new Error("API config missing");
        const items = await fetchFromApi(sourceConfig.api);
        return {
          success: true,
          item_count: items.length,
          sample: items[0] || null,
        };
      }
      return {
        success: false,
        error: `Unsupported source type: ${sourceConfig.type}`,
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

  private loadFileCache(
    dbName: string,
    ttlHours: number
  ): CacheEntry | null {
    const cachePath = path.join(CACHE_DIR, `db-${dbName}.json`);
    if (!fs.existsSync(cachePath)) return null;

    try {
      const raw = fs.readFileSync(cachePath, "utf-8");
      const entry = JSON.parse(raw) as CacheEntry;
      const age =
        (Date.now() - new Date(entry.fetched_at).getTime()) / (1000 * 60 * 60);
      if (age > ttlHours) return null;
      return entry;
    } catch {
      return null;
    }
  }

  private saveFileCache(dbName: string, entry: CacheEntry): void {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(
      path.join(CACHE_DIR, `db-${dbName}.json`),
      JSON.stringify(entry, null, 2)
    );
  }
}

export const databaseManager = new DatabaseManager();
