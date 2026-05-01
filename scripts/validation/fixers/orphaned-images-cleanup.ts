/**
 * Fixer: orphaned-images-cleanup
 *
 * Removes unused image registry entries (and physical files) using the
 * same logic as the admin remove-unused script.
 */
import type { Fixer, FixerContext, FixerResult } from "./types";
import { removeUnusedImages } from "../../admin/remove-unused-images";

export const orphanedImagesCleanupFixer: Fixer = {
  name: "orphaned-images-cleanup",
  description: "Removes orphaned image entries that are not referenced by content",

  async run(ctx: FixerContext): Promise<FixerResult> {
    const dryRun = Boolean(ctx.dryRun);
    const result = await removeUnusedImages({ dryRun, onProgress: ctx.onProgress });

    return {
      ok: true,
      message: result.message,
      details: {
        removedCount: result.removedCount,
        skippedCount: result.skippedCount,
        cleanupErrorCount: result.cleanupErrorCount,
        externalSkippedCount: result.externalSkippedCount,
        totalScanned: result.results.length,
        dryRun,
      },
    };
  },
};
