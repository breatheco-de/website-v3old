import * as path from "path";
import { fileURLToPath } from "url";
import { mediaGallery } from "../../server/media-gallery";
import { media } from "../../server/media";

const MARKETING_CONTENT_DIR = path.join(process.cwd(), "marketing-content");
const REGISTRY_PATH = path.join(MARKETING_CONTENT_DIR, "image-registry.json");

export async function removeUnusedImages(options: { dryRun?: boolean } = {}): Promise<{
  message: string;
  removedCount: number;
  skippedCount: number;
  results: Array<{ id: string; src: string; status: string }>;
}> {
  const { dryRun = false } = options;
  const registry = mediaGallery.getRegistry();
  if (!registry) {
    return { message: "Failed to load registry", removedCount: 0, skippedCount: 0, results: [] };
  }

  const { imageIds, srcValues } = mediaGallery.collectImageReferences();

  const allImageIds = Object.keys(registry.images);
  const results: Array<{ id: string; src: string; status: string }> = [];
  let removedCount = 0;
  let skippedCount = 0;

  for (const id of allImageIds) {
    const entry = registry.images[id];
    const src = entry?.src || "";

    const referencedById = imageIds.has(id);
    const normalizedSrc = src.startsWith("/") ? src : `/${src}`;
    const normalizedSrcNoSlash = src.startsWith("/") ? src.slice(1) : src;
    const referencedBySrc = srcValues.has(src) || srcValues.has(normalizedSrc) || srcValues.has(normalizedSrcNoSlash);

    if (referencedById || referencedBySrc) {
      continue;
    }

    if (dryRun) {
      results.push({ id, src, status: "would-remove" });
      removedCount++;
      continue;
    }

    try {
      const result = await mediaGallery.unregister(id);
      if (result.success) {
        results.push({ id, src, status: "removed" });
        removedCount++;
      } else {
        results.push({ id, src, status: `skipped: ${result.error || "unknown"}` });
        skippedCount++;
      }
    } catch (err: any) {
      results.push({ id, src, status: `error: ${err.message || "unknown"}` });
      skippedCount++;
    }
  }

  const message = dryRun
    ? `Dry run: ${removedCount} unused image(s) would be removed out of ${allImageIds.length} total`
    : `Removed ${removedCount} unused image(s), skipped ${skippedCount} (${allImageIds.length} total in registry)`;

  return { message, removedCount, skippedCount, results };
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  media.initFromEnv();

  console.log(`Remove unused images${dryRun ? " (DRY RUN)" : ""}`);
  console.log("");

  removeUnusedImages({ dryRun }).then(result => {
    for (const r of result.results) {
      const tag = r.status.startsWith("removed") || r.status.startsWith("would-remove") ? "OK" : "SKIP";
      console.log(`  [${tag}] ${r.id}: ${r.src} — ${r.status}`);
    }
    console.log("");
    console.log(result.message);
  }).catch(err => {
    console.error("Failed:", err);
    process.exit(1);
  });
}
