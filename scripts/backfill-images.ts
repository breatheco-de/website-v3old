import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { gcs } from "../server/gcs";

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);
const REGISTRY_PATH = path.resolve(__dirname_local, "../marketing-content/image-registry.json");

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

interface SrcsetEntry {
  w: number;
  url: string;
}

interface ImageEntry {
  src: string;
  alt: string;
  focal_point?: string;
  tags?: string[];
  usage_count?: number;
  hash?: string;
  width?: number;
  height?: number;
  preset?: string[];
  widths_generated?: number[];
  format?: string;
  srcset?: SrcsetEntry[];
}

interface Preset {
  aspect_ratio: string | null;
  widths: number[];
  quality: number;
  description: string;
}

interface Registry {
  presets: Record<string, Preset>;
  images: Record<string, ImageEntry>;
}

const TAG_TO_PRESET: Record<string, string> = {
  logo: "logo",
  avatar: "avatar",
  icon: "icon",
  badge: "icon",
  certification: "icon",
  award: "icon",
  hero: "hero-wide",
};

function inferPresets(tags: string[], presets: Record<string, Preset>): string[] {
  const matched = new Set<string>();
  for (const tag of tags) {
    const preset = TAG_TO_PRESET[tag];
    if (preset && presets[preset]) {
      matched.add(preset);
    }
  }
  if (matched.size === 0) {
    matched.add("full");
  }
  return Array.from(matched);
}

function mergeWidths(presetNames: string[], presets: Record<string, Preset>): { widths: number[]; quality: number } {
  const allWidths = new Set<number>();
  let maxQuality = 80;
  for (const name of presetNames) {
    const p = presets[name];
    if (p) {
      for (const w of p.widths) allWidths.add(w);
      if (p.quality > maxQuality) maxQuality = p.quality;
    }
  }
  return {
    widths: Array.from(allWidths).sort((a, b) => a - b),
    quality: maxQuality,
  };
}

function srcExtension(src: string): string {
  try {
    const url = new URL(src);
    return path.extname(url.pathname).toLowerCase();
  } catch {
    return path.extname(src).toLowerCase();
  }
}

function gcsKeyFromSrc(src: string): string | null {
  const prefix = `https://storage.googleapis.com/${gcs.getBucketName()}/`;
  if (src.startsWith(prefix)) {
    return src.slice(prefix.length);
  }
  return null;
}

function variantKey(originalKey: string, width: number, ext: string): string {
  const parsed = path.parse(originalKey);
  const dir = parsed.dir ? `${parsed.dir}/` : "";
  return `${dir}${parsed.name}-${width}w${ext}`;
}

function outputFormat(originalExt: string): { sharpFormat: keyof sharp.FormatEnum; ext: string; registryFormat: "webp" | "avif" } {
  if (originalExt === ".avif") {
    return { sharpFormat: "avif", ext: ".avif", registryFormat: "avif" };
  }
  return { sharpFormat: "webp", ext: ".webp", registryFormat: "webp" };
}

async function downloadImage(src: string): Promise<Buffer | null> {
  const key = gcsKeyFromSrc(src);
  if (key) {
    return gcs.download(key);
  }
  try {
    const resp = await fetch(src);
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

function contentTypeForExt(ext: string): string {
  const map: Record<string, string> = {
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };
  return map[ext] || "application/octet-stream";
}

async function processImage(
  id: string,
  entry: ImageEntry,
  presets: Record<string, Preset>,
  dryRun: boolean,
): Promise<ImageEntry | null> {
  const buffer = await downloadImage(entry.src);
  if (!buffer) {
    console.error(`${RED}  [ERR] ${id}: failed to download ${entry.src}${RESET}`);
    return null;
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (err) {
    console.error(`${RED}  [ERR] ${id}: sharp metadata failed: ${(err as Error).message}${RESET}`);
    return null;
  }

  const intrinsicWidth = metadata.width || 0;
  const intrinsicHeight = metadata.height || 0;

  if (!intrinsicWidth || !intrinsicHeight) {
    console.error(`${RED}  [ERR] ${id}: could not determine dimensions${RESET}`);
    return null;
  }

  const tags = entry.tags || [];
  const presetNames = inferPresets(tags, presets);
  const { widths, quality } = mergeWidths(presetNames, presets);

  const filteredWidths = widths.filter(w => w <= intrinsicWidth);
  if (filteredWidths.length === 0) {
    filteredWidths.push(intrinsicWidth);
  }

  const origExt = srcExtension(entry.src);
  const { sharpFormat, ext: outExt, registryFormat } = outputFormat(origExt);
  const originalKey = gcsKeyFromSrc(entry.src);

  if (!originalKey && !dryRun && !gcs.available) {
    console.error(`${RED}  [ERR] ${id}: cannot derive GCS key from ${entry.src}${RESET}`);
    return null;
  }

  const srcset: SrcsetEntry[] = [];
  const widthsGenerated: number[] = [];

  for (const w of filteredWidths) {
    const vKey = originalKey ? variantKey(originalKey, w, outExt) : `media/${id}-${w}w${outExt}`;

    if (dryRun) {
      const vUrl = gcs.getPublicUrl(vKey);
      srcset.push({ w, url: vUrl });
      widthsGenerated.push(w);
      continue;
    }

    try {
      const { data: resized, info } = await sharp(buffer)
        .resize({ width: w, withoutEnlargement: true })
        .toFormat(sharpFormat, { quality })
        .toBuffer({ resolveWithObject: true });

      const actualWidth = info.width;
      const vUrl = await gcs.upload(vKey, resized, contentTypeForExt(outExt));
      srcset.push({ w: actualWidth, url: vUrl });
      widthsGenerated.push(actualWidth);
    } catch (err) {
      console.error(`${RED}  [ERR] ${id}: failed to process ${w}w: ${(err as Error).message}${RESET}`);
    }
  }

  if (srcset.length === 0) {
    return null;
  }

  return {
    ...entry,
    width: intrinsicWidth,
    height: intrinsicHeight,
    preset: presetNames,
    widths_generated: widthsGenerated,
    format: registryFormat,
    srcset,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find(a => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;
  const forceArg = args.includes("--force");

  console.log(`${BOLD}[Backfill] Image optimization backfill script${RESET}`);
  console.log(`  Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  if (limit < Infinity) console.log(`  Limit: ${limit} images`);
  if (forceArg) console.log(`  Force: re-process already-processed entries`);
  console.log();

  gcs.initFromEnv();
  if (!gcs.available) {
    console.error(`${RED}[Backfill] GCS not available. Set GCS_BUCKET_NAME and credentials.${RESET}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(REGISTRY_PATH, "utf-8");
  const registry: Registry = JSON.parse(raw);

  const ids = Object.keys(registry.images);
  console.log(`  Total images in registry: ${ids.length}`);
  console.log();

  let processed = 0;
  let skipped = 0;
  let errored = 0;
  let count = 0;

  for (const id of ids) {
    if (count >= limit) break;

    const entry = registry.images[id];

    if (!forceArg && entry.srcset && entry.srcset.length > 0) {
      skipped++;
      continue;
    }

    count++;
    const num = `[${count}/${Math.min(ids.length, limit)}]`;
    process.stdout.write(`${DIM}${num}${RESET} ${id}... `);

    try {
      const updated = await processImage(id, entry, registry.presets, dryRun);
      if (updated) {
        registry.images[id] = updated;
        processed++;
        console.log(
          `${GREEN}OK${RESET} ${updated.width}x${updated.height} → ${updated.srcset!.length} variant(s) [${updated.preset!.join(", ")}]`
        );
      } else {
        errored++;
        console.log(`${RED}FAILED${RESET}`);
      }
    } catch (err) {
      errored++;
      console.log(`${RED}ERROR: ${(err as Error).message}${RESET}`);
    }
  }

  console.log();
  console.log(`${BOLD}Results:${RESET}`);
  console.log(`  ${GREEN}Processed: ${processed}${RESET}`);
  console.log(`  ${YELLOW}Skipped (already done): ${skipped}${RESET}`);
  console.log(`  ${RED}Errors: ${errored}${RESET}`);
  console.log(`  Total: ${ids.length}`);

  if (processed > 0 && !dryRun) {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
    console.log(`\n${GREEN}Registry updated: ${REGISTRY_PATH}${RESET}`);
  } else if (dryRun && processed > 0) {
    console.log(`\n${YELLOW}Dry run complete — no changes written${RESET}`);
  }
}

main().catch(err => {
  console.error(`${RED}[Backfill] Fatal error: ${err.message}${RESET}`);
  process.exit(1);
});
