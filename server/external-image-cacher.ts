import type { DatabaseConfig } from "./database";
import { enqueueExternalImage } from "./image-registry";
import { mediaGallery } from "./media-gallery";

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

export function isSafeUrl(rawUrl: string): boolean {
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

export const ExternalImageCacher = {
  scheduleItems(
    dbName: string,
    config: DatabaseConfig,
    items: Record<string, unknown>[]
  ): void {
    const urls = collectCacheableUrls(config, items);
    if (urls.size === 0) return;

    let enqueued = 0;
    for (const url of urls) {
      const result = enqueueExternalImage(url, dbName);
      if (result !== null) enqueued++;
    }

    if (enqueued > 0) {
      mediaGallery.persistRegistry();
      console.log(
        `[ExternalImageCacher] Enqueued ${enqueued} new URL(s) for db "${dbName}" (worker will process them)`
      );
    }
  },
};
