/**
 * @deprecated Use the validation framework instead:
 *   - API: POST /api/validation/run with validator "image-optimization"
 *   - Fix: POST /api/validation/fix/image-optimization
 *   - Media Gallery UI: Admin → Media Gallery → Scan & Optimize
 *
 * This script is kept for reference but is no longer the primary entrypoint.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gcs } from "../server/gcs";
import {
  processImageFromSrc,
  type Preset,
  type SrcsetEntry,
} from "../server/image-optimizer";

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);
const REGISTRY_PATH = path.resolve(__dirname_local, "../marketing-content/image-registry.json");

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

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

interface Registry {
  presets: Record<string, Preset>;
  images: Record<string, ImageEntry>;
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
      const result = await processImageFromSrc(id, entry, registry.presets, dryRun);
      if (result) {
        registry.images[id] = {
          ...entry,
          width: result.width,
          height: result.height,
          preset: result.preset,
          widths_generated: result.widths_generated,
          format: result.format,
          srcset: result.srcset,
        };
        processed++;
        console.log(
          `${GREEN}OK${RESET} ${result.width}x${result.height} → ${result.srcset.length} variant(s) [${result.preset.join(", ")}]`
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
