#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "yaml";
import { escapeTemplateVars } from "../shared/templateVars";

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);

const MARKETING_CONTENT_DIR = path.resolve(__dirname_local, "../marketing-content");
const REGISTRY_PATH = path.join(MARKETING_CONTENT_DIR, "image-registry.json");

const CONTENT_DIRS = [
  path.join(MARKETING_CONTENT_DIR, "pages"),
  path.join(MARKETING_CONTENT_DIR, "landings"),
  path.join(MARKETING_CONTENT_DIR, "landing-page"),
];

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

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
  srcset?: { w: number; url: string }[];
}

interface Registry {
  presets: Record<string, unknown>;
  images: Record<string, ImageEntry>;
}

interface HeroImageRef {
  src: string;
  field: string;
  file: string;
}

function getAllYamlFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function extractSrcFromImageField(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (value && typeof value === "object" && "src" in (value as Record<string, unknown>)) {
    const src = (value as Record<string, unknown>).src;
    if (typeof src === "string" && src.length > 0) {
      return src;
    }
  }
  return null;
}

function extractHeroImageSrcs(section: Record<string, unknown>, file: string): HeroImageRef[] {
  const refs: HeroImageRef[] = [];

  const singleImageFields = ["image", "background_image", "form_card_image"];
  for (const field of singleImageFields) {
    if (field in section) {
      const src = extractSrcFromImageField(section[field]);
      if (src) {
        refs.push({ src, field, file });
      }
    }
  }

  const arrayImageFields = ["left_images", "right_images"];
  for (const field of arrayImageFields) {
    if (field in section && Array.isArray(section[field])) {
      for (const item of section[field] as unknown[]) {
        const src = extractSrcFromImageField(item);
        if (src) {
          refs.push({ src, field, file });
        }
      }
    }
  }

  if (section.media && typeof section.media === "object") {
    const media = section.media as Record<string, unknown>;
    if (typeof media.src === "string" && media.src.length > 0) {
      refs.push({ src: media.src, field: "media.src", file });
    }
  }

  return refs;
}

const HERO_VARIANT_KEYS = new Set([
  "hero",
  "hero_singleColumn",
  "hero_showcase",
  "hero_productShowcase",
  "hero_simpleTwoColumn",
  "hero_simpleStacked",
  "hero_twoColumn",
  "hero_course",
  "hero_ApplyFormProductShowcase",
]);

function isKeyedHeroSection(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  const firstKey = keys[0];
  return HERO_VARIANT_KEYS.has(firstKey) || firstKey.startsWith("hero");
}

function findHeroSections(parsed: unknown): Record<string, unknown>[] {
  const heroes: Record<string, unknown>[] = [];
  if (!parsed || typeof parsed !== "object") return heroes;

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const section = item as Record<string, unknown>;

      if (section.type === "hero") {
        heroes.push(section);
      } else if (!("type" in section) && isKeyedHeroSection(section)) {
        const firstKey = Object.keys(section)[0];
        const inner = section[firstKey];
        if (inner && typeof inner === "object" && !Array.isArray(inner)) {
          heroes.push(inner as Record<string, unknown>);
        }
      }
    }
    return heroes;
  }

  for (const value of Object.values(parsed as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      heroes.push(...findHeroSections(value));
    }
  }

  return heroes;
}

function isUrl(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://");
}

interface Finding {
  src: string;
  field: string;
  file: string;
  registryId?: string;
}

function main() {
  const args = process.argv.slice(2);
  const fixMode = args.includes("--fix");

  console.log(`${BOLD}[Audit Hero Tags] Scanning hero sections for image tag issues${RESET}`);
  console.log(`  Mode: ${fixMode ? "FIX (will write changes)" : "DRY RUN (report only)"}`);
  console.log();

  const raw = fs.readFileSync(REGISTRY_PATH, "utf-8");
  const registry: Registry = JSON.parse(raw);

  const srcToId: Record<string, string> = {};
  for (const [id, entry] of Object.entries(registry.images)) {
    srcToId[entry.src] = id;
  }

  const allYamlFiles: string[] = [];
  for (const dir of CONTENT_DIRS) {
    allYamlFiles.push(...getAllYamlFiles(dir));
  }

  console.log(`  YAML files found: ${allYamlFiles.length}`);

  const heroImageRefs: HeroImageRef[] = [];
  let heroSectionCount = 0;

  for (const file of allYamlFiles) {
    try {
      const rawContent = fs.readFileSync(file, "utf-8");
      const { escaped } = escapeTemplateVars(rawContent);
      const parsed = yaml.parse(escaped);
      const heroes = findHeroSections(parsed);
      heroSectionCount += heroes.length;

      for (const hero of heroes) {
        const refs = extractHeroImageSrcs(hero, path.relative(MARKETING_CONTENT_DIR, file));
        heroImageRefs.push(...refs);
      }
    } catch (err) {
      console.warn(`${YELLOW}  Warning: could not parse ${path.relative(MARKETING_CONTENT_DIR, file)}: ${(err as Error).message}${RESET}`);
    }
  }

  console.log(`  Hero sections found: ${heroSectionCount}`);
  console.log(`  Image references in hero sections: ${heroImageRefs.length}`);
  console.log();

  const uniqueSrcs = new Map<string, HeroImageRef>();
  for (const ref of heroImageRefs) {
    if (!uniqueSrcs.has(ref.src)) {
      uniqueSrcs.set(ref.src, ref);
    }
  }

  const missingFromRegistry: Finding[] = [];
  const missingHeroTag: Finding[] = [];
  const wrongPreset: Finding[] = [];

  for (const [src, ref] of uniqueSrcs) {
    let registryId: string | undefined;

    if (!isUrl(src) && registry.images[src]) {
      registryId = src;
    } else if (srcToId[src]) {
      registryId = srcToId[src];
    }

    if (!registryId) {
      missingFromRegistry.push({ src, field: ref.field, file: ref.file });
      continue;
    }

    const entry = registry.images[registryId];
    const tags = entry.tags || [];
    const hasHeroTag = tags.includes("hero");
    const presets = entry.preset || [];
    const hasHeroPreset = presets.includes("hero-wide");

    if (!hasHeroTag) {
      missingHeroTag.push({ src, field: ref.field, file: ref.file, registryId });
    } else if (!hasHeroPreset) {
      wrongPreset.push({ src, field: ref.field, file: ref.file, registryId });
    }
  }

  const totalIssues = missingFromRegistry.length + missingHeroTag.length + wrongPreset.length;

  if (missingFromRegistry.length > 0) {
    console.log(`${RED}${BOLD}(a) ${missingFromRegistry.length} image(s) in hero sections with NO registry entry:${RESET}`);
    for (const f of missingFromRegistry) {
      console.log(`${RED}  - ${f.src}${RESET}`);
      console.log(`${DIM}    field: ${f.field} | file: ${f.file}${RESET}`);
    }
    console.log();
  }

  if (missingHeroTag.length > 0) {
    console.log(`${YELLOW}${BOLD}(b) ${missingHeroTag.length} registry entry(ies) in hero sections MISSING the "hero" tag:${RESET}`);
    for (const f of missingHeroTag) {
      console.log(`${YELLOW}  - ${f.registryId}${RESET}`);
      console.log(`${DIM}    src: ${f.src}${RESET}`);
      console.log(`${DIM}    field: ${f.field} | file: ${f.file}${RESET}`);
    }
    console.log();
  }

  if (wrongPreset.length > 0) {
    console.log(`${YELLOW}${BOLD}(c) ${wrongPreset.length} registry entry(ies) with "hero" tag but missing "hero-wide" preset:${RESET}`);
    for (const f of wrongPreset) {
      const entry = registry.images[f.registryId!];
      console.log(`${YELLOW}  - ${f.registryId} (current presets: ${(entry.preset || []).join(", ") || "none"})${RESET}`);
      console.log(`${DIM}    field: ${f.field} | file: ${f.file}${RESET}`);
    }
    console.log();
  }

  if (totalIssues === 0) {
    console.log(`${GREEN}${BOLD}All hero images have correct tags and presets.${RESET}`);
    process.exit(0);
  }

  console.log(`${BOLD}Summary:${RESET}`);
  console.log(`  Missing from registry: ${missingFromRegistry.length} (report only, not auto-fixable)`);
  console.log(`  Missing "hero" tag:    ${missingHeroTag.length} ${fixMode ? "(will fix)" : "(fixable with --fix)"}`);
  console.log(`  Wrong preset:          ${wrongPreset.length} (report only — re-run backfill after tag fix)`);
  console.log();

  if (fixMode && missingHeroTag.length > 0) {
    let fixed = 0;
    for (const f of missingHeroTag) {
      const entry = registry.images[f.registryId!];
      if (!entry.tags) {
        entry.tags = [];
      }
      if (!entry.tags.includes("hero")) {
        entry.tags.push("hero");
        fixed++;
      }
    }

    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
    console.log(`${GREEN}${BOLD}Fixed ${fixed} registry entry(ies) — added "hero" tag.${RESET}`);
    console.log(`${GREEN}Registry updated: ${REGISTRY_PATH}${RESET}`);
    console.log();
    console.log(`${YELLOW}Next step: run backfill-images.ts to regenerate variants with the hero-wide preset.${RESET}`);
  } else if (!fixMode && missingHeroTag.length > 0) {
    console.log(`${YELLOW}Run with --fix to auto-add the "hero" tag to ${missingHeroTag.length} entry(ies).${RESET}`);
  }

  process.exit(missingHeroTag.length > 0 ? 1 : 0);
}

main();
