import * as fs from "fs";
import * as path from "path";
import type { ImageRegistry } from "@shared/schema";
import { mediaGallery } from "./media-gallery";

const REGISTRY_PATH = path.join(process.cwd(), "marketing-content", "image-registry.json");

let registryCache: ImageRegistry | null = null;
let lastModified: number = 0;

export function loadImageRegistry(): ImageRegistry | null {
  try {
    const stats = fs.statSync(REGISTRY_PATH);
    const currentModified = stats.mtimeMs;

    if (registryCache && currentModified === lastModified) {
      return registryCache;
    }

    const content = fs.readFileSync(REGISTRY_PATH, "utf8");
    registryCache = JSON.parse(content) as ImageRegistry;
    lastModified = currentModified;

    console.log(`[Image Registry] Loaded ${Object.keys(registryCache.images).length} images, ${Object.keys(registryCache.presets).length} presets`);
    return registryCache;
  } catch (error) {
    console.error("[Image Registry] Failed to load:", error);
    return null;
  }
}

export function getImage(id: string): { src: string; alt: string } | null {
  const registry = loadImageRegistry();
  if (!registry) return null;

  const entry = registry.images[id];
  if (!entry) return null;

  return {
    src: entry.src,
    alt: entry.alt,
  };
}

export function getPreset(name: string) {
  const registry = loadImageRegistry();
  if (!registry) return null;

  return registry.presets[name] || null;
}

export function listImages() {
  const registry = loadImageRegistry();
  if (!registry) return [];

  return Object.entries(registry.images).map(([id, entry]) => ({
    id,
    ...entry,
  }));
}

export function listPresets() {
  const registry = loadImageRegistry();
  if (!registry) return [];

  return Object.entries(registry.presets).map(([name, preset]) => ({
    name,
    ...preset,
  }));
}

export function resolveBySourceUrl(url: string): string | null {
  const registry = mediaGallery.getRegistry();
  if (!registry) return null;

  for (const entry of Object.values(registry.images)) {
    if (entry.source_url === url && !entry.failed_at) {
      return entry.src;
    }
  }
  return null;
}

export function clearImageRegistryCache() {
  registryCache = null;
  lastModified = 0;
}
