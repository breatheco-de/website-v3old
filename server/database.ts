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

const memoryCache = new Map<string, { data: CacheEntry; expires: number }>();

const VALID_DB_NAME = /^[a-z0-9_-]+$/;

function validateDbName(name: string): void {
  if (!name || !VALID_DB_NAME.test(name)) {
    throw new Error(`Invalid database name "${name}" — only lowercase letters, digits, hyphens, and underscores allowed`);
  }
}

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

export function listDatabases(): { name: string; config: DatabaseConfig }[] {
  if (!fs.existsSync(DB_DIR)) return [];

  const folders = fs.readdirSync(DB_DIR).filter((f) => {
    const full = path.join(DB_DIR, f);
    return (
      fs.statSync(full).isDirectory() &&
      fs.existsSync(path.join(full, "config.yml"))
    );
  });

  return folders.map((folder) => ({
    name: folder,
    config: loadConfig(folder),
  }));
}

export function loadConfig(dbName: string): DatabaseConfig {
  validateDbName(dbName);
  const configPath = path.join(DB_DIR, dbName, "config.yml");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Database "${dbName}" not found`);
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  return yaml.load(raw) as DatabaseConfig;
}

export function saveConfig(dbName: string, config: DatabaseConfig): void {
  validateDbName(dbName);
  const configPath = path.join(DB_DIR, dbName, "config.yml");
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, yaml.dump(config, { lineWidth: 120 }));
}

function getCachePath(dbName: string): string {
  return path.join(CACHE_DIR, `db-${dbName}.json`);
}

function loadFileCache(dbName: string, ttlHours: number): CacheEntry | null {
  const cachePath = getCachePath(dbName);
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

function saveFileCache(dbName: string, entry: CacheEntry): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(getCachePath(dbName), JSON.stringify(entry, null, 2));
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

export async function fetchDatabaseItems(
  dbName: string,
  forceRefresh = false
): Promise<{ items: Record<string, unknown>[]; raw_count: number; fetched_at: string; from_cache: boolean }> {
  const config = loadConfig(dbName);
  const ttl = config.cache?.ttl_hours ?? 24;

  if (!forceRefresh) {
    const memEntry = memoryCache.get(dbName);
    if (memEntry && Date.now() < memEntry.expires) {
      return { ...memEntry.data, from_cache: true };
    }

    const fileEntry = loadFileCache(dbName, ttl);
    if (fileEntry) {
      memoryCache.set(dbName, {
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

  saveFileCache(dbName, entry);
  memoryCache.set(dbName, {
    data: entry,
    expires: Date.now() + ttl * 60 * 60 * 1000,
  });

  return { ...entry, from_cache: false };
}

export async function testDatabaseSource(
  sourceConfig: DatabaseConfig["source"]
): Promise<{ success: boolean; item_count?: number; sample?: unknown; error?: string }> {
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
    return { success: false, error: `Unsupported source type: ${sourceConfig.type}` };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
