/**
 * @deprecated Use the validation framework instead:
 *   - API: POST /api/validation/run with validator "images"
 *   - Fix: POST /api/validation/fix/image-registry-sync
 *   - Canonical script: scripts/admin/ (see image-registry-sync fixer)
 *
 * This script is kept for reference but is no longer the primary entrypoint.
 */

import { scanImageRegistry } from "../server/image-registry-scanner";

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";

function main() {
  console.log(`${BOLD}[Image Registry] Scanning...${RESET}\n`);

  const result = scanImageRegistry();

  console.log(`  Registered images: ${result.registeredCount}`);
  console.log(`  Scanned image files: ${result.scannedImagesCount}\n`);

  if (result.brokenReferences.length > 0) {
    console.log(`${RED}${BOLD}✗ ${result.brokenReferences.length} broken reference(s) found:${RESET}`);
    for (const ref of result.brokenReferences) {
      console.log(`${RED}  - ${ref.yamlFile} → ${ref.missingSrc}${RESET}`);
      console.log(`    field: ${ref.field}`);
    }
    console.log();
  }

  if (result.updatedImages.length > 0) {
    console.log(`${YELLOW}${BOLD}⚠ ${result.updatedImages.length} image(s) with changed extensions:${RESET}`);
    for (const img of result.updatedImages) {
      console.log(`${YELLOW}  - ${img.id}: ${img.oldSrc} → ${img.newSrc}${RESET}`);
    }
    console.log();
  }

  if (result.newImages.length > 0) {
    console.log(`${YELLOW}${BOLD}⚠ ${result.newImages.length} unregistered image(s) in attached_assets/:${RESET}`);
    for (const img of result.newImages) {
      console.log(`${YELLOW}  - ${img.filename} (would be id: ${img.id})${RESET}`);
    }
    console.log();
  }

  if (result.brokenReferences.length === 0 && result.newImages.length === 0 && result.updatedImages.length === 0) {
    console.log(`${GREEN}${BOLD}✓ All image references are valid${RESET}\n`);
  }

  if (result.brokenReferences.length > 0) {
    console.log(`${RED}${BOLD}ERROR: Image registry validation failed (${result.brokenReferences.length} broken reference(s))${RESET}`);
    process.exit(1);
  }

  if (result.newImages.length > 0 || result.updatedImages.length > 0) {
    console.log(`${YELLOW}WARNING: Run POST /api/image-registry/apply or update image-registry.json manually${RESET}`);
  }

  process.exit(0);
}

main();
