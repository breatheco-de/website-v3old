/**
 * Generates marketing-content/navigation-eager-manifest.json from content + menus.
 * Regenerated during `vite build` (client pass) via vite.config.ts plugin.
 * Server only reads the file (readNavigationEagerManifest) for SSR initial data.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { contentIndex } from "./content-index";
import { resolvePageQuery } from "./initial-data-middleware";

const OUT_FILE = path.join(
  process.cwd(),
  "marketing-content",
  "navigation-eager-manifest.json",
);

const DEFAULT_EAGER_COUNT = 3;
const HREF_KEYS = new Set(["href", "cta_url", "link", "url"]);
const EMBEDDED_PATH_RE = /(?:^|\s)(\/[^\s"'<>#?]*)/g;

type EagerTuple = [string, string];

interface ManifestEntry {
  eager: EagerTuple[];
  leadForm?: boolean;
}

function normalizePath(href: string): string {
  const raw = href.split("?")[0].split("#")[0].trim();
  if (!raw || raw === "/") return "/";
  if (raw !== "/" && raw.endsWith("/")) return raw.slice(0, -1);
  return raw;
}

function isCollectibleInternalPath(value: string): boolean {
  const s = value.trim();
  if (!s.startsWith("/")) return false;
  if (s.startsWith("//")) return false;
  if (s.startsWith("#")) return false;
  return true;
}

function addPath(paths: Set<string>, candidate: string | undefined): void {
  if (!candidate || !isCollectibleInternalPath(candidate)) return;
  paths.add(normalizePath(candidate));
}

function walkForPaths(obj: unknown, paths: Set<string>): void {
  if (obj == null) return;

  if (typeof obj === "string") {
    if (isCollectibleInternalPath(obj)) addPath(paths, obj);
    let match: RegExpExecArray | null;
    EMBEDDED_PATH_RE.lastIndex = 0;
    while ((match = EMBEDDED_PATH_RE.exec(obj)) !== null) {
      addPath(paths, match[1]);
    }
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) walkForPaths(item, paths);
    return;
  }

  if (typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string" && HREF_KEYS.has(key)) addPath(paths, value);
      walkForPaths(value, paths);
    }
  }
}

function collectPathsFromContent(): Set<string> {
  const paths = new Set<string>();
  for (const entry of contentIndex.listAll()) {
    for (const locale of entry.locales) {
      if (locale.startsWith("_") || locale.includes(".")) continue;
      const merged = contentIndex.loadMergedContent(entry.contentType, entry.slug, locale);
      if (merged.data) walkForPaths(merged.data, paths);
    }
  }
  return paths;
}

function collectPathsFromMenus(
  menusDir = path.join(process.cwd(), "marketing-content", "menus"),
): Set<string> {
  const paths = new Set<string>();
  if (!fs.existsSync(menusDir)) return paths;

  for (const file of fs.readdirSync(menusDir)) {
    if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
    try {
      const raw = fs.readFileSync(path.join(menusDir, file), "utf-8");
      walkForPaths(yaml.load(raw), paths);
    } catch {
      // skip unreadable menu files
    }
  }
  return paths;
}

function collectAllInternalPaths(): Set<string> {
  const paths = new Set<string>();
  for (const p of Array.from(collectPathsFromContent())) paths.add(p);
  for (const p of Array.from(collectPathsFromMenus())) paths.add(p);
  addPath(paths, "/en");
  addPath(paths, "/es");
  return paths;
}

function isLeadFormConfig(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function objectHasFormKey(obj: unknown, maxDepth = 4, depth = 0): boolean {
  if (!obj || typeof obj !== "object" || depth > maxDepth) return false;
  if (Array.isArray(obj)) {
    return obj.some((item) => objectHasFormKey(item, maxDepth, depth + 1));
  }
  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key === "form" && isLeadFormConfig(value)) return true;
    if (typeof value === "object" && value !== null && objectHasFormKey(value, maxDepth, depth + 1)) {
      return true;
    }
  }
  return false;
}

function getEagerCountFromPageData(data: unknown): number {
  if (!data || typeof data !== "object") return DEFAULT_EAGER_COUNT;
  const settings = (data as Record<string, unknown>).settings as
    | Record<string, unknown>
    | undefined;
  const loading = settings?.loading as Record<string, unknown> | undefined;
  const count = loading?.eager_count;
  return typeof count === "number" && count >= 0 ? count : DEFAULT_EAGER_COUNT;
}

function eagerFromPageData(data: unknown): ManifestEntry | null {
  if (!data || typeof data !== "object") return null;
  const sections = (data as Record<string, unknown>).sections;
  if (!Array.isArray(sections)) return null;

  const eagerCount = getEagerCountFromPageData(data);
  const eager: EagerTuple[] = [];
  const seen = new Set<string>();
  let leadForm = false;

  for (const section of sections.slice(0, eagerCount)) {
    if (!section || typeof section !== "object" || !("type" in section)) continue;
    const s = section as { type: string; variant?: string; load?: string };
    if (s.load === "lazy") continue;
    const variant = s.variant ?? "default";
    const key = `${s.type}::${variant}`;
    if (!seen.has(key)) {
      seen.add(key);
      eager.push([s.type, variant]);
    }
    if (objectHasFormKey(section)) leadForm = true;
  }

  if (eager.length === 0) return null;
  return leadForm ? { eager, leadForm: true } : { eager };
}

function buildManifestPayload(
  paths: Record<string, ManifestEntry>,
  generatedAt: string,
): Record<string, unknown> {
  const sortedPaths = Object.fromEntries(
    Object.entries(paths).sort(([a], [b]) => a.localeCompare(b)),
  );
  return {
    version: 1,
    generatedAt,
    defaultEagerCount: DEFAULT_EAGER_COUNT,
    paths: sortedPaths,
  };
}

/** Writes navigation-eager-manifest.json for client hover prefetch. */
export async function regenerateNavigationEagerManifest(): Promise<void> {
  const candidates = collectAllInternalPaths();
  const sorted = Array.from(candidates).sort();
  const paths: Record<string, ManifestEntry> = {};

  let resolved = 0;
  let skipped = 0;

  for (const pagePath of sorted) {
    const result = await resolvePageQuery(pagePath);
    if (!result?.data) {
      skipped++;
      continue;
    }
    const entry = eagerFromPageData(result.data);
    if (!entry) {
      skipped++;
      continue;
    }
    paths[pagePath] = entry;
    resolved++;
  }

  const generatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const payload = buildManifestPayload(paths, generatedAt);
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

  console.log(
    `[NavigationManifest] wrote ${OUT_FILE} (${resolved} paths, ${skipped} skipped, ${sorted.length} candidates)`,
  );
}

export type NavigationEagerManifestPayload = ReturnType<typeof buildManifestPayload>;

/** Reads marketing-content/navigation-eager-manifest.json (server-side, like theme.json). */
export function readNavigationEagerManifest(): NavigationEagerManifestPayload | null {
  try {
    if (!fs.existsSync(OUT_FILE)) return null;
    return JSON.parse(fs.readFileSync(OUT_FILE, "utf-8")) as NavigationEagerManifestPayload;
  } catch {
    return null;
  }
}

