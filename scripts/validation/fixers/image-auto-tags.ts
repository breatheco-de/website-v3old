import type { Fixer, FixerContext, FixerResult } from "./types";

export const imageAutoTagsFixer: Fixer = {
  name: "image-auto-tags",
  description:
    "Auto-classifies all untagged images using heuristics and AI vision, then saves the tags",

  async run(_ctx: FixerContext): Promise<FixerResult> {
    const { mediaGallery } = await import("../../../server/media-gallery");
    const registry = mediaGallery.getRegistry();
    if (!registry) {
      return {
        ok: false,
        message: "Failed to load image registry via MediaGallery",
      };
    }

    const images = registry.images as Record<
      string,
      { src: string; tags?: string[]; [key: string]: unknown }
    >;
    const totalCount = Object.keys(images).length;

    const untaggedIds = Object.entries(images)
      .filter(([_, entry]) => !entry.tags || entry.tags.length === 0)
      .map(([id]) => id);

    if (untaggedIds.length === 0) {
      return {
        ok: true,
        message: "No untagged images found — all images have tags",
        details: { classified: 0, total: totalCount },
      };
    }

    const { classifyAndApply } = await import(
      "../../../server/image-auto-tagger"
    );

    let classified = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const imageId of untaggedIds) {
      try {
        const result = await classifyAndApply(imageId);
        if (result.added.length > 0) {
          classified++;
        }
      } catch (err) {
        failed++;
        errors.push(
          `${imageId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      ok: true,
      message:
        classified > 0
          ? `Auto-tagged ${classified} of ${untaggedIds.length} untagged image(s)`
          : `Processed ${untaggedIds.length} image(s) but no new tags were added`,
      details: {
        untagged: untaggedIds.length,
        classified,
        failed,
        total: totalCount,
        ...(errors.length > 0 ? { errors: errors.slice(0, 10) } : {}),
      },
    };
  },
};
