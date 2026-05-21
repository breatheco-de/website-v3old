#!/usr/bin/env tsx
/**
 * Build-time entry: writes marketing-content/navigation-eager-manifest.json
 * Run via `npm run build` (prebuild) or `npm run generate:navigation-manifest`.
 */

import { regenerateNavigationEagerManifest } from "../../server/navigation-eager-manifest";

regenerateNavigationEagerManifest().catch((err) => {
  console.error("[navigation-manifest] failed:", err);
  process.exit(1);
});
