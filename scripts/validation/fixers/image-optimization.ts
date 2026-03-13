/**
 * Fixer: image-optimization
 *
 * Queues all unoptimized raster images in the registry for srcset/dimensions
 * generation via the shared image-optimizer module. Processing runs in the
 * background; the fixer returns immediately with the count queued.
 */

import type { Fixer, FixerContext, FixerResult } from "./types";
import { mediaGallery } from "../../server/media-gallery";
import { processImageFromSrc } from "../../server/image-optimizer";
import type { Preset } from "../../server/image-optimizer";
import * as path from "path";

const RASTER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);

function getExt(src: string): string {
  try {
    return path.extname(new URL(src).pathname).toLowerCase();
  } catch {
    return path.extname(src).toLowerCase();
  }
}

export const imageOptimizationFixer: Fixer = {
  name: "image-optimization",
  description: "Queues unoptimized raster images for background srcset generation",

  async run(_ctx: FixerContext): Promise<FixerResult> {
    const registry = mediaGallery.getRegistry();
    if (!registry) {
      return { ok: false, message: "Failed to load image registry" };
    }

    const presets = registry.presets as Record<string, Preset>;

    const targetIds = Object.entries(registry.images)
      .filter(([_id, entry]) => {
        if (!RASTER_EXTENSIONS.has(getExt(entry.src))) return false;
        return !(Array.isArray(entry.srcset) && entry.srcset.length > 0);
      })
      .map(([id]) => id);

    if (targetIds.length === 0) {
      return { ok: true, message: "All raster images are already optimized", details: { queued: 0 } };
    }

    (async () => {
      let processed = 0;
      let failed = 0;
      for (const id of targetIds) {
        const entry = registry.images[id];
        if (!entry) continue;
        try {
          const result = await processImageFromSrc(id, entry, presets);
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
      message: `Queued ${targetIds.length} image(s) for background optimization`,
      details: { queued: targetIds.length },
    };
  },
};
