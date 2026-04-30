/**
 * Fixer: image-optimization
 *
 * Processes raster images in the registry that need optimization, covering two cases:
 *   1. Images with no srcset yet (first-time optimization).
 *   2. Images whose stored preset does not match what tagDefinitions requires for
 *      their current tags (re-optimization to apply the correct preset/widths).
 *
 * Processing runs in the background; the fixer returns immediately with the count queued.
 */

import type { Fixer, FixerContext, FixerResult } from "./types";
import { mediaGallery } from "../../../server/media-gallery";
import { processImageFromSrc } from "../../../server/image-optimizer";
import type { Preset } from "../../../server/image-optimizer";
import * as path from "path";

const RASTER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);

function getExt(src: string): string {
  try {
    return path.extname(new URL(src).pathname).toLowerCase();
  } catch {
    return path.extname(src).toLowerCase();
  }
}

function expectedPresets(
  tags: string[],
  tagDefinitions: Record<string, { presets?: string[] }>,
): Set<string> {
  const result = new Set<string>();
  for (const tag of tags) {
    const def = tagDefinitions[tag];
    if (def?.presets) {
      for (const p of def.presets) result.add(p);
    }
  }
  return result;
}

function hasPresetMismatch(
  entry: { tags?: string[]; preset?: string[] },
  tagDefinitions: Record<string, { presets?: string[] }>,
): boolean {
  const tags = entry.tags ?? [];
  if (tags.length === 0) return false;
  const expected = expectedPresets(tags, tagDefinitions);
  if (expected.size === 0) return false;
  const stored = new Set(entry.preset ?? []);
  for (const p of Array.from(expected)) {
    if (!stored.has(p)) return true;
  }
  return false;
}

export const imageOptimizationFixer: Fixer = {
  name: "image-optimization",
  description:
    "Optimizes raster images that are missing srcset variants or whose preset does not match their tag definitions",

  async run(_ctx: FixerContext): Promise<FixerResult> {
    const registry = mediaGallery.getRegistry();
    if (!registry) {
      return { ok: false, message: "Failed to load image registry" };
    }

    const presets = registry.presets as Record<string, Preset>;
    const tagDefinitions = (registry.tagDefinitions ?? {}) as Record<
      string,
      { presets?: string[] }
    >;

    let noSrcsetCount = 0;
    let mismatchCount = 0;

    type ImageEntry = { src: string; srcset?: unknown[]; tags?: string[]; preset?: string[] };

    const targetIds = Object.entries(registry.images)
      .filter(([_id, entry]) => {
        const e = entry as ImageEntry;
        if (!RASTER_EXTENSIONS.has(getExt(e.src))) return false;
        const hasSrcset = Array.isArray(e.srcset) && e.srcset.length > 0;
        if (!hasSrcset) {
          noSrcsetCount++;
          return true;
        }
        if (hasPresetMismatch(e, tagDefinitions)) {
          mismatchCount++;
          return true;
        }
        return false;
      })
      .map(([id]) => id);

    if (targetIds.length === 0) {
      return {
        ok: true,
        message: "All raster images are optimized and presets match tag definitions",
        details: { queued: 0, noSrcset: 0, presetMismatch: 0 },
      };
    }

    (async () => {
      let processed = 0;
      let failed = 0;
      for (const id of targetIds) {
        const entry = registry.images[id];
        if (!entry) continue;
        try {
          const result = await processImageFromSrc(id, entry, presets, false, undefined, tagDefinitions);
          if (result) {
            entry.width = result.width;
            entry.height = result.height;
            entry.preset = result.preset;
            entry.widths_generated = result.widths_generated;
            entry.format = result.format;
            entry.srcset = result.srcset;
            processed++;
            if (processed % 10 === 0) {
              mediaGallery.persistRegistry();
              console.log(`[Fixer:image-optimization] Progress: ${processed}/${targetIds.length} processed, ${failed} failed`);
            }
          } else {
            failed++;
          }
        } catch (err) {
          failed++;
          console.error(`[Fixer:image-optimization] Error on ${id}:`, err);
        }
      }
      mediaGallery.persistRegistry();
      console.log(`[Fixer:image-optimization] Complete: ${processed} processed, ${failed} failed of ${targetIds.length} total`);
    })().catch(err => console.error("[Fixer:image-optimization] Background error:", err));

    return {
      ok: true,
      message: `Queued ${targetIds.length} image(s) for background optimization (${noSrcsetCount} without srcset, ${mismatchCount} with preset mismatch)`,
      details: { queued: targetIds.length, noSrcset: noSrcsetCount, presetMismatch: mismatchCount },
    };
  },
};
