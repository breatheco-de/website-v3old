import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { escapeTemplateVars, unescapeObjectVars } from "../../shared/templateVars";
import { mediaGallery } from "../../server/media-gallery";
import { media } from "../../server/media";

const MARKETING_CONTENT_DIR = path.join(process.cwd(), "marketing-content");
const REGISTRY_PATH = path.join(MARKETING_CONTENT_DIR, "image-registry.json");

function loadRegistry(): { presets: Record<string, any>; images: Record<string, any> } {
  try {
    const content = fs.readFileSync(REGISTRY_PATH, "utf8");
    return JSON.parse(content);
  } catch {
    return { presets: {}, images: {} };
  }
}

function collectReferencesFromYaml(): { imageIds: Set<string>; srcValues: Set<string> } {
  const imageIds = new Set<string>();
  const srcValues = new Set<string>();

  function extractRefs(obj: any, keyPath: string) {
    if (obj === null || obj === undefined) return;
    if (typeof obj === "string") {
      if (/image_id(?:\[\d+\])?$/.test(keyPath)) {
        imageIds.add(obj);
      }
      srcValues.add(obj);
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => extractRefs(item, `${keyPath}[${i}]`));
      return;
    }
    if (typeof obj === "object") {
      for (const [key, val] of Object.entries(obj)) {
        extractRefs(val, keyPath ? `${keyPath}.${key}` : key);
      }
    }
  }

  function walkDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")) {
        try {
          const content = fs.readFileSync(fullPath, "utf8");
          const { escaped, map } = escapeTemplateVars(content);
          const rawParsed = yaml.load(escaped);
          const parsed = rawParsed ? unescapeObjectVars(rawParsed, map) : rawParsed;
          if (parsed && typeof parsed === "object") {
            extractRefs(parsed, "");
          }
        } catch {
        }
      }
    }
  }

  walkDir(MARKETING_CONTENT_DIR);
  return { imageIds, srcValues };
}

export async function removeUnusedImages(options: { dryRun?: boolean } = {}): Promise<{
  message: string;
  removedCount: number;
  skippedCount: number;
  results: Array<{ id: string; src: string; status: string }>;
}> {
  const { dryRun = false } = options;
  const registry = loadRegistry();
  const { imageIds, srcValues } = collectReferencesFromYaml();

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

if (require.main === module) {
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
