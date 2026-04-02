import crypto from "crypto";
import type { DatabaseConfig } from "./database";
import { mediaGallery } from "./media-gallery";
import { processImageBuffer } from "./image-optimizer";
import type { ImageEntry } from "@shared/schema";
import type { Preset } from "./image-optimizer";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_FAILED_AFTER_HOURS = 24;

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\./,
  /^localhost$/i,
];

function isSafeUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  for (const pattern of PRIVATE_IP_RANGES) {
    if (pattern.test(host)) return false;
  }
  return true;
}

async function fetchWithTimeout(url: string): Promise<Buffer | null> {
  if (!isSafeUrl(url)) {
    console.warn(`[ExternalImageCacher] Blocked fetch to disallowed URL: ${url}`);
    return null;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

function urlToId(url: string, dbName: string): string {
  const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 8);
  try {
    const parsed = new URL(url);
    const base =
      parsed.pathname
        .split("/")
        .filter(Boolean)
        .pop()
        ?.replace(/\.[^.]+$/, "")
        .replace(/[^a-z0-9_-]/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()
        .slice(0, 40) || "img";
    return `${dbName}-${base}-${hash}`;
  } catch {
    return `${dbName}-img-${hash}`;
  }
}

function lookupBySourceUrl(
  images: Record<string, ImageEntry>,
  url: string
): { id: string; entry: ImageEntry } | null {
  for (const [id, entry] of Object.entries(images)) {
    if (entry.source_url === url) {
      return { id, entry };
    }
  }
  return null;
}

async function cacheOneUrl(url: string, dbName: string): Promise<void> {
  const registry = mediaGallery.getRegistry();
  if (!registry) return;

  const found = lookupBySourceUrl(registry.images, url);
  if (found) {
    if (!found.entry.failed_at) return;
    const failedAt = new Date(found.entry.failed_at).getTime();
    const ageHours = (Date.now() - failedAt) / (1000 * 60 * 60);
    if (ageHours < RETRY_FAILED_AFTER_HOURS) return;
  }

  const id = found?.id ?? urlToId(url, dbName);

  const buffer = await fetchWithTimeout(url);
  if (!buffer) {
    markFailed(id, url, dbName);
    return;
  }

  const presets = registry.presets as Record<string, Preset>;

  let result = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((r) =>
        setTimeout(r, Math.pow(2, attempt - 1) * 1000)
      );
    }
    result = await processImageBuffer(id, buffer, url, [dbName], presets);
    if (result) break;
  }

  if (!result) {
    markFailed(id, url, dbName);
    return;
  }

  const primaryUrl = result.srcset?.[0]?.url ?? url;

  const currentRegistry = mediaGallery.getRegistry();
  if (!currentRegistry) return;

  const newEntry: ImageEntry = {
    src: primaryUrl,
    alt: `Image from ${dbName}`,
    tags: [dbName],
    source_url: url,
    width: result.width,
    height: result.height,
    preset: result.preset,
    widths_generated: result.widths_generated,
    format: result.format,
    srcset: result.srcset,
    usage_count: 0,
  };

  currentRegistry.images[id] = newEntry;
  mediaGallery.persistRegistry();
  console.log(
    `[ExternalImageCacher] Cached "${url}" as "${id}" for db "${dbName}"`
  );
}

function markFailed(id: string, url: string, dbName: string): void {
  try {
    const registry = mediaGallery.getRegistry();
    if (!registry) return;

    const failedEntry: ImageEntry = {
      src: url,
      alt: `Image from ${dbName}`,
      tags: [dbName],
      source_url: url,
      failed_at: new Date().toISOString(),
      usage_count: 0,
    };

    registry.images[id] = failedEntry;
    mediaGallery.persistRegistry();
    console.warn(
      `[ExternalImageCacher] Marked failed for "${url}" (id: "${id}")`
    );
  } catch (err) {
    console.error(
      `[ExternalImageCacher] Failed to mark failed for "${url}":`,
      err
    );
  }
}

function collectCacheableUrls(
  config: DatabaseConfig,
  items: Record<string, unknown>[]
): Set<string> {
  const urls = new Set<string>();
  if (!config.editor) return urls;

  const cacheFields = Object.entries(config.editor)
    .filter(([, hint]) => hint.cache_images === true)
    .map(([field]) => field);

  if (cacheFields.length === 0) return urls;

  for (const item of items) {
    for (const field of cacheFields) {
      const val = item[field];
      if (typeof val === "string" && val.startsWith("http") && isSafeUrl(val)) {
        urls.add(val);
      }
    }
  }

  return urls;
}

const inProgress = new Set<string>();

export const ExternalImageCacher = {
  scheduleItems(
    dbName: string,
    config: DatabaseConfig,
    items: Record<string, unknown>[]
  ): void {
    const urls = collectCacheableUrls(config, items);
    if (urls.size === 0) return;

    const pending = Array.from(urls).filter((url) => !inProgress.has(url));
    if (pending.length === 0) return;

    for (const url of pending) inProgress.add(url);

    console.log(
      `[ExternalImageCacher] Scheduling ${pending.length} URL(s) for db "${dbName}"`
    );

    void Promise.allSettled(
      pending.map((url) =>
        cacheOneUrl(url, dbName).finally(() => inProgress.delete(url))
      )
    );
  },
};
