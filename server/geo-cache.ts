import fs from "fs";
import path from "path";

const CACHE_FILE = path.resolve("data/geo-cache.json");
const TTL_MS = 24 * 60 * 60 * 1000;
const PRUNE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEBOUNCE_MS = 3000;

interface CacheEntry {
  data: unknown;
  ts: number;
}

const cache = new Map<string, CacheEntry>();

function loadFromDisk(): void {
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    const parsed: Record<string, CacheEntry> = JSON.parse(raw);
    for (const [ip, entry] of Object.entries(parsed)) {
      if (entry && typeof entry.ts === "number") {
        cache.set(ip, entry);
      }
    }
  } catch {
    // corrupt or missing file — start fresh
  }
}

function ensureDataDir(): void {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function flushToDisk(): void {
  try {
    ensureDataDir();
    const now = Date.now();
    const out: Record<string, CacheEntry> = {};
    for (const [ip, entry] of cache.entries()) {
      if (now - entry.ts < PRUNE_AGE_MS) {
        out[ip] = entry;
      }
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(out), "utf-8");
  } catch {
    // best-effort write; ignore errors
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlussh(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    flushToDisk();
  }, DEBOUNCE_MS);
}

export function geoGet(ip: string): unknown | null {
  const entry = cache.get(ip);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    cache.delete(ip);
    return null;
  }
  return entry.data;
}

export function geoSet(ip: string, data: unknown): void {
  cache.set(ip, { data, ts: Date.now() });
  scheduleFlussh();
}

// Load existing cache from disk at startup
loadFromDisk();
