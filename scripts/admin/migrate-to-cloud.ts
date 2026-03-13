/**
 * Admin script: migrate-to-cloud
 *
 * Migrates images between media providers (e.g. local → GCS or GCS → local).
 *
 * Usage:
 *   npx tsx scripts/admin/migrate-to-cloud.ts <from> <to> [--dry-run] [--prefix=<path>]
 *
 * Examples:
 *   npx tsx scripts/admin/migrate-to-cloud.ts local gcs --dry-run
 *   npx tsx scripts/admin/migrate-to-cloud.ts local gcs --prefix=marketing-content/images
 *   npx tsx scripts/admin/migrate-to-cloud.ts gcs local
 *
 * Available providers: local, gcs
 */

import { media } from "../../server/media";
import { mediaGallery } from "../../server/media-gallery";

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith("--")));
const positional = args.filter(a => !a.startsWith("--"));

const from = positional[0] || "local";
const to = positional[1] || "gcs";
const dryRun = flags.has("--dry-run");
const prefix = args.find(a => a.startsWith("--prefix="))?.split("=")[1];

if (!positional[0] || !positional[1]) {
  console.log("Usage: npx tsx scripts/admin/migrate-to-cloud.ts <from> <to> [--dry-run] [--prefix=images]");
  console.log("");
  console.log("Examples:");
  console.log("  npx tsx scripts/admin/migrate-to-cloud.ts local gcs --dry-run");
  console.log("  npx tsx scripts/admin/migrate-to-cloud.ts local gcs --prefix=marketing-content/images");
  console.log("  npx tsx scripts/admin/migrate-to-cloud.ts gcs local");
  console.log("");
  console.log("Available providers: local, gcs");
  process.exit(1);
}

async function main() {
  media.initFromEnv();

  const providers = media.getAllProviderNames();
  if (!providers.includes(from)) {
    console.error(`Provider "${from}" is not configured. Available: ${providers.join(", ")}`);
    process.exit(1);
  }
  if (!providers.includes(to)) {
    console.error(`Provider "${to}" is not configured. Available: ${providers.join(", ")}`);
    process.exit(1);
  }

  console.log(`Migrating images from "${from}" to "${to}"${dryRun ? " (DRY RUN)" : ""}${prefix ? ` with prefix "${prefix}"` : ""}`);
  console.log("");

  const results = await mediaGallery.migrate(from, to, { dryRun, prefix });

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const r of results) {
    if (r.status === "migrated" || r.status === "dry-run") {
      migrated++;
      console.log(`  [OK] ${r.id}: ${r.oldSrc} -> ${r.newSrc}`);
    } else if (r.status.startsWith("skipped")) {
      skipped++;
      console.log(`  [SKIP] ${r.id}: ${r.status}`);
    } else {
      errors++;
      console.log(`  [ERR] ${r.id}: ${r.status}`);
    }
  }

  console.log("");
  console.log(`Done. ${migrated} migrated, ${skipped} skipped, ${errors} errors (total: ${results.length})`);
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
