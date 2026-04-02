import pLimit from "p-limit";
import { mediaGallery } from "./media-gallery";
import { processImageBuffer, processImageFromSrc } from "./image-optimizer";
import {
  getPendingExternalImages,
  getPendingOptimizations,
  markExternalImageDone,
  markJobDone,
  markJobFailed,
} from "./image-registry";
import type { Preset } from "./image-optimizer";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

const externalLimit = pLimit(5);
const optimizeLimit = pLimit(3);

// Re-entrancy guard: prevents overlapping tick executions
let tickRunning = false;

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
    console.warn(`[ImageQueueWorker] Blocked fetch to disallowed URL: ${url}`);
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

async function processExternalEntry(entry: { id: string; source_url?: string; tags?: string[] }): Promise<void> {
  const { id, source_url: url } = entry;
  if (!url) return;

  const registry = mediaGallery.getRegistry();
  if (!registry) return;

  const buffer = await fetchWithTimeout(url);
  if (!buffer) {
    markJobFailed(id, `Failed to fetch ${url}`);
    return;
  }

  const presets = registry.presets as Record<string, Preset>;
  const dbName = entry.tags?.[0] ?? "external";

  let result = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
    }
    result = await processImageBuffer(id, buffer, url, entry.tags ?? [dbName], presets);
    if (result) break;
  }

  if (!result) {
    markJobFailed(id, `processImageBuffer failed for ${url}`);
    return;
  }

  const primaryUrl = result.srcset?.[0]?.url ?? url;
  markExternalImageDone(id, primaryUrl, {
    alt: `Image from ${dbName}`,
    tags: entry.tags ?? [dbName],
    source_url: url,
    width: result.width,
    height: result.height,
    preset: result.preset,
    widths_generated: result.widths_generated,
    format: result.format,
    srcset: result.srcset,
    usage_count: 0,
  });

  console.log(`[ImageQueueWorker] Cached external image "${url}" as "${id}"`);
}

async function processOptimizeEntry(entry: { id: string; src: string }): Promise<void> {
  const { id } = entry;
  const registry = mediaGallery.getRegistry();
  if (!registry) return;

  const entryData = registry.images[id];
  if (!entryData) return;

  const presets = registry.presets as Record<string, Preset>;

  try {
    const result = await processImageFromSrc(id, entryData, presets);
    if (result) {
      markJobDone(id, {
        width: result.width,
        height: result.height,
        preset: result.preset,
        widths_generated: result.widths_generated,
        format: result.format,
        srcset: result.srcset,
      });
      console.log(`[ImageQueueWorker] Optimized image "${id}"`);
    } else {
      markJobFailed(id, `processImageFromSrc returned null for "${id}"`);
    }
  } catch (err) {
    markJobFailed(id, String(err));
    console.error(`[ImageQueueWorker] Error optimizing "${id}":`, err);
  }
}

async function tick(): Promise<void> {
  if (tickRunning) {
    console.log("[ImageQueueWorker] Tick skipped — previous tick still running");
    return;
  }

  tickRunning = true;
  try {
    const externalPending = getPendingExternalImages(20);
    const optimizePending = getPendingOptimizations(10);

    if (externalPending.length === 0 && optimizePending.length === 0) return;

    console.log(
      `[ImageQueueWorker] Tick: ${externalPending.length} external, ${optimizePending.length} optimize pending`
    );

    await Promise.allSettled([
      ...externalPending.map((entry) => externalLimit(() => processExternalEntry(entry))),
      ...optimizePending.map((entry) => optimizeLimit(() => processOptimizeEntry(entry))),
    ]);

    mediaGallery.persistRegistry();
  } finally {
    tickRunning = false;
  }
}

export function start(): void {
  console.log("[ImageQueueWorker] Starting background worker (30s interval)");
  setInterval(() => void tick(), 30_000);
  void tick();
}
