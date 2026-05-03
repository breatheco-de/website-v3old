/**
 * Fixer: image-optimization
 *
 * Processes raster images in the registry that need optimization, covering three cases:
 *   1. Images with no srcset yet (first-time optimization).
 *   2. Images whose stored preset does not match what tagDefinitions requires for
 *      their current tags (re-optimization to apply the correct preset/widths).
 *   3. Images whose widths_generated is a strict subset of the widths defined by
 *      their current preset(s) — i.e. new widths were added to the preset after
 *      the image was last optimized.
 *
 * Processing runs in the background; the fixer returns immediately with the count queued.
 */

import type { Fixer, FixerContext, FixerResult } from "./types";
import { mediaGallery } from "../../../server/media-gallery";
import { processImageFromSrc, mergeWidths } from "../../../server/image-optimizer";
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

function hasWidthsOutdated(
  entry: { preset?: string[]; widths_generated?: number[]; width?: number },
  presets: Record<string, Preset>,
): boolean {
  const presetNames = entry.preset ?? [];
  if (presetNames.length === 0) return false;
  const storedWidths = new Set(entry.widths_generated ?? []);
  const intrinsicWidth = entry.width ?? Infinity;
  const { widths: expectedWidths } = mergeWidths(presetNames, presets);
  const filtered = expectedWidths.filter(w => w <= intrinsicWidth);
  return filtered.some(w => !storedWidths.has(w));
}

export const imageOptimizationFixer: Fixer = {
  name: "image-optimization",
  description:
    "Optimizes raster images that are missing srcset variants, whose preset does not match their tag definitions, or whose srcset is missing widths added to their preset",

  async run(ctx: FixerContext): Promise<FixerResult> {
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
    let widthsOutdatedCount = 0;

    type ImageEntry = {
      src: string;
      srcset?: unknown[];
      tags?: string[];
      preset?: string[];
      widths_generated?: number[];
      width?: number;
    };

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
        if (hasWidthsOutdated(e, presets)) {
          widthsOutdatedCount++;
          return true;
        }
        return false;
      })
      .map(([id]) => id);

    if (targetIds.length === 0) {
      return {
        ok: true,
        message: "All raster images are optimized and presets match tag definitions",
        details: { queued: 0, noSrcset: 0, presetMismatch: 0, widthsOutdated: 0 },
      };
    }

    ctx.onProgress?.({ type: "start", total: targetIds.length });
    let optimized = 0;
    let skipped = 0;
    let failed = 0;
    for (const id of targetIds) {
      // Always re-read registry after each persist, because persistRegistry() clears MediaGallery cache.
      const currentRegistry = mediaGallery.getRegistry();
      const entry = currentRegistry?.images[id];
      if (!currentRegistry || !entry) {
        ctx.onProgress?.({
          type: "item",
          id,
          status: "skipped",
          message: "image entry missing in registry",
        });
        continue;
      }
      try {
        const result = await processImageFromSrc(id, entry, presets, false, undefined, tagDefinitions);
        if (result) {
          entry.width = result.width;
          entry.height = result.height;
          entry.preset = result.preset;
          entry.widths_generated = result.widths_generated;
          entry.format = result.format;
          entry.srcset = result.srcset;
          if (result.widths_generated.length > 0) {
            optimized++;
            ctx.onProgress?.({
              type: "item",
              id,
              status: "ok",
              message: `optimized: preset=${result.preset.join("/")}, widths=${result.widths_generated.join("/")}`,
            });
          } else {
            skipped++;
            ctx.onProgress?.({
              type: "item",
              id,
              status: "skipped",
              message: `skipped: cannot determine storage key for src: ${entry.src}`,
            });
          }
          if (optimized % 10 === 0 && optimized > 0) {
            mediaGallery.persistRegistry();
            console.log(`[Fixer:image-optimization] Progress: ${optimized} optimized, ${skipped} skipped, ${failed} failed of ${targetIds.length}`);
          }
        } else {
          skipped++;
          ctx.onProgress?.({
            type: "item",
            id,
            status: "skipped",
            message: "skipped: external URL or unsupported image source",
          });
        }
      } catch (err) {
        failed++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        ctx.onProgress?.({
          type: "item",
          id,
          status: "failed",
          message: `failed: ${errorMessage}`,
        });
        console.error(`[Fixer:image-optimization] Error on ${id}:`, err);
      }
    }
    mediaGallery.persistRegistry();
    console.log(`[Fixer:image-optimization] Complete: ${optimized} optimized, ${skipped} skipped, ${failed} failed of ${targetIds.length} total`);

    return {
      ok: failed === 0,
      message:
        failed > 0
          ? `Optimized ${optimized} image(s), skipped ${skipped}, failed ${failed} (${noSrcsetCount} without srcset, ${mismatchCount} with preset mismatch, ${widthsOutdatedCount} with outdated widths)`
          : `Optimized ${optimized} image(s), skipped ${skipped} (${noSrcsetCount} without srcset, ${mismatchCount} with preset mismatch, ${widthsOutdatedCount} with outdated widths)`,
      details: {
        queued: targetIds.length,
        optimized,
        skipped,
        failed,
        noSrcset: noSrcsetCount,
        presetMismatch: mismatchCount,
        widthsOutdated: widthsOutdatedCount,
      },
    };
  },
};
