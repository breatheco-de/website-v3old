/**
 * @migration 001_add_section_ids
 * @description Adds a stable `section_id` to every section in marketing-content that is missing one. Idempotent — safe to re-run, existing IDs are never overwritten.
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";

function generateSectionId(componentType: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${componentType}-${suffix}`;
}

function walkDir(dir: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, results);
    } else if (entry.endsWith(".yml") || entry.endsWith(".yaml")) {
      results.push(fullPath);
    }
  }
  return results;
}

const MARKETING_CONTENT = path.join(process.cwd(), "marketing-content");
const files = walkDir(MARKETING_CONTENT);

let totalFilesChanged = 0;
let totalIdsAdded = 0;

for (const filePath of files) {
  const rawContent = fs.readFileSync(filePath, "utf-8");

  let parsed: Record<string, unknown> | null = null;
  try {
    const result = yaml.load(rawContent.replace(/\{\{[^}]*\}\}/g, "__TPL__"));
    if (result && typeof result === "object" && !Array.isArray(result)) {
      parsed = result as Record<string, unknown>;
    }
  } catch {
    continue;
  }

  if (!parsed) continue;

  const sections = parsed.sections;
  if (!Array.isArray(sections)) continue;

  let fileIdsAdded = 0;
  for (const section of sections) {
    if (section && typeof section === "object") {
      const s = section as Record<string, unknown>;
      if (!s.section_id) {
        s.section_id = generateSectionId((s.type as string) || "section");
        fileIdsAdded++;
        totalIdsAdded++;
      }
    }
  }

  if (fileIdsAdded > 0) {
    const dumped = yaml.dump(parsed, { lineWidth: 120, noRefs: true, sortKeys: false });
    fs.writeFileSync(filePath, dumped, "utf-8");
    totalFilesChanged++;
    console.log(`  Updated: ${path.relative(process.cwd(), filePath)} (+${fileIdsAdded} ids)`);
  }
}

console.log(`\nMigration complete:`);
console.log(`  Files changed: ${totalFilesChanged}`);
console.log(`  Section IDs added: ${totalIdsAdded}`);
if (totalIdsAdded === 0) {
  console.log(`  (All sections already have IDs — nothing to do.)`);
}
