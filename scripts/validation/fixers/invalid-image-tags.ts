/**
 * Fixer: invalid-image-tags
 *
 * Removes tags from registry image entries that are not present in tagDefinitions.
 * These tags are typically assigned incorrectly by the auto-tagger. Since tagDefinitions
 * is the authoritative contract of valid tags, any tag outside it is considered invalid
 * and safe to remove automatically.
 */

import * as fs from "fs";
import * as path from "path";
import type { Fixer, FixerContext, FixerResult } from "./types";
import { mediaGallery } from "../../../server/media-gallery";

const REGISTRY_PATH = path.join(process.cwd(), "marketing-content", "image-registry.json");

export const invalidImageTagsFixer: Fixer = {
  name: "invalid-image-tags",
  description: "Removes tags from images that are not defined in tagDefinitions",

  async run(_ctx: FixerContext): Promise<FixerResult> {
    let registry: { tagDefinitions?: Record<string, unknown>; images: Record<string, { tags?: string[]; [key: string]: unknown }> };
    try {
      registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    } catch (err) {
      return { ok: false, message: `Failed to load registry: ${err instanceof Error ? err.message : String(err)}` };
    }

    const canonicalTags = new Set(Object.keys(registry.tagDefinitions ?? {}));
    if (canonicalTags.size === 0) {
      return { ok: false, message: "No tagDefinitions found in registry — cannot determine valid tags" };
    }

    let removedCount = 0;
    let affectedImages = 0;

    for (const [_id, entry] of Object.entries(registry.images)) {
      const before = entry.tags ?? [];
      const after = before.filter((t) => canonicalTags.has(t));
      if (after.length < before.length) {
        entry.tags = after;
        removedCount += before.length - after.length;
        affectedImages++;
      }
    }

    if (removedCount === 0) {
      return { ok: true, message: "No invalid tags found — all image tags are in tagDefinitions", details: { removedCount: 0, affectedImages: 0 } };
    }

    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
    mediaGallery.clearCache();

    return {
      ok: true,
      message: `Removed ${removedCount} invalid tag(s) from ${affectedImages} image(s)`,
      details: { removedCount, affectedImages },
    };
  },
};
