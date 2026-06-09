import { contentIndex, MARKETING_CONTENT_PATH as BASE_CONTENT_PATH } from "./content-index";
import { getContentTypeConfig, getLocaleKey, getLocaleSource, getFieldMapping, getFullFieldMapping, resolveUrlPatternWithMapping, getAllConfigs, getDirectory } from "./content-types";
import { getSupportedLocales } from "./settings";
import { applyTransformIfNeeded } from "./transform";
import { getFileLastmod } from "./sync-state";
import { databaseManager } from "./database";
import { child } from "./logger";
const log = child({ module: "sitemap" });



const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getBaseUrl(): string {
  // Use explicit SITE_URL if set
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/$/, ""); // Remove trailing slash
  }

  // Fall back to Replit's domain
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }

  // Development fallback
  return "http://localhost:5000";
}

// ============================================================================
// CANONICAL SITEMAP ENTRY - Single Source of Truth
// ============================================================================

type EntryType =
  | "static"
  | "program"
  | "landing"
  | "location"
  | "template_page"
  | string;

interface CanonicalSitemapEntry {
  loc: string;
  lastmod: string;
  label: string;
  type: EntryType;
  locale?: string;
  contentKey?: string;
}

interface SitemapCache {
  entries: Map<string, CanonicalSitemapEntry>;
  generatedAt: number;
}

let sitemapCache: SitemapCache | null = null;

// ============================================================================
// Content Meta Interfaces
// ============================================================================

interface ContentMeta {
  page_title?: string;
  robots?: string;
  redirects?: string[];
}

interface AvailableProgram {
  slug: string;
  dirSlug: string;
  locale: string;
  title: string;
  meta: ContentMeta;
}

interface AvailableLocation {
  slug: string;
  dirSlug: string;
  locale: string;
  name: string;
  visibility: string;
  meta: ContentMeta;
}

interface AvailableTemplatePage {
  slug: string;
  dirSlug: string;
  locale: string;
  title: string;
  meta: ContentMeta;
}

// ============================================================================
// Data Fetchers - Using shared contentLoader helpers
// ============================================================================

function loadMergedContent(
  contentType: string,
  slug: string,
  localeOrVariant: string,
): Record<string, unknown> | null {
  const { data } = contentIndex.loadMergedContent(contentType, slug, localeOrVariant);
  return data;
}

function getAvailablePrograms(): AvailableProgram[] {
  try {
    const programs: AvailableProgram[] = [];
    const slugs = contentIndex.listContentSlugs("program");

    for (const slug of slugs) {
      const locales = contentIndex.getAvailableLocalesOrVariants("program", slug);

      for (const locale of locales) {
        const merged = loadMergedContent("program", slug, locale);
        if (!merged) continue;

        const meta = (merged.meta as ContentMeta) || {};
        programs.push({
          slug: (merged.slug as string) || slug,
          dirSlug: slug,
          locale,
          title: meta.page_title || (merged.title as string) || slug,
          meta,
        });
      }
    }

    return programs;
  } catch (error) {
    log.error({ err: error }, "Error scanning programs:");
    return [];
  }
}

function getAvailableLocations(): AvailableLocation[] {
  try {
    const locations: AvailableLocation[] = [];
    const slugs = contentIndex.listContentSlugs("location");

    for (const slug of slugs) {
      const locales = contentIndex.getAvailableLocalesOrVariants("location", slug);

      for (const locale of locales) {
        const merged = loadMergedContent("location", slug, locale);
        if (!merged) continue;

        const visibility = (merged.visibility as string) || "listed";
        if (visibility !== "listed") continue;

        const meta = (merged.meta as ContentMeta) || {};
        locations.push({
          slug: (merged.slug as string) || slug,
          dirSlug: slug,
          locale,
          name: meta.page_title || (merged.name as string) || slug,
          visibility,
          meta,
        });
      }
    }

    return locations;
  } catch (error) {
    log.error({ err: error }, "Error scanning locations:");
    return [];
  }
}

function getAvailableTemplatePages(): AvailableTemplatePage[] {
  try {
    const pages: AvailableTemplatePage[] = [];
    const slugs = contentIndex.listContentSlugs("page");

    for (const dirSlug of slugs) {
      const locales = contentIndex.getAvailableLocalesOrVariants("page", dirSlug);

      for (const locale of locales) {
        // Only process locale files (en, es)
        if (!getSupportedLocales().includes(locale)) continue;

        const merged = loadMergedContent("page", dirSlug, locale);
        if (!merged) continue;

        const meta = (merged.meta as ContentMeta) || {};
        pages.push({
          slug: (merged.slug as string) || dirSlug,
          dirSlug,
          locale,
          title: meta.page_title || (merged.title as string) || dirSlug,
          meta,
        });
      }
    }

    return pages;
  } catch (error) {
    log.error({ err: error }, "Error scanning template pages:");
    return [];
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function shouldIndex(robots?: string): boolean {
  if (!robots) return true;
  return !robots.toLowerCase().includes("noindex");
}

function getCurrentDate(): string {
  return new Date().toISOString().split("T")[0];
}

function formatLocaleLabel(locale: string): string {
  return locale === "es" ? "ES" : "EN";
}

/**
 * Get the best lastmod date for a YML-based content entry.
 * Resolves the content file path and delegates to getFileLastmod from sync-state.
 * Falls back to today's date when no sync data exists.
 */
function getYmlFileLastmod(contentType: string, dirSlug: string, locale: string): string {
  const directory = getDirectory(contentType);
  const filePath = `marketing-content/${directory}/${dirSlug}/${locale}.yml`;
  return getFileLastmod(filePath);
}

/**
 * Compute the map key for a canonical sitemap entry.
 * Uses `${contentKey}:${locale}` when both are present, otherwise falls back to `loc` URL.
 */
function buildMapKey(entry: CanonicalSitemapEntry): string {
  if (entry.contentKey && entry.locale) {
    return `${entry.contentKey}:${entry.locale}`;
  }
  return entry.loc;
}

// ============================================================================
// CANONICAL BUILDER - Single Source of Truth
// ============================================================================

function buildCanonicalSitemapEntries(): Map<string, CanonicalSitemapEntry> {
  const today = getCurrentDate();
  const entriesMap = new Map<string, CanonicalSitemapEntry>();

  const addEntry = (entry: CanonicalSitemapEntry) => {
    entriesMap.set(buildMapKey(entry), entry);
  };

  // Static pages (no YML file — use today as fallback)
  const staticPages: Array<{ path: string; label: string }> = [
    { path: "/", label: "Home" },
  ];

  for (const page of staticPages) {
    addEntry({
      loc: `${getBaseUrl()}${page.path}`,
      lastmod: today,
      label: page.label,
      type: "static",
    });
  }

  // Dynamic career program pages
  const programs = getAvailablePrograms();
  for (const program of programs) {
    if (!shouldIndex(program.meta.robots)) {
      log.info(
        `[Sitemap] Skipping noindex program: ${program.slug} (${program.locale})`,
      );
      continue;
    }

    const url = `${getBaseUrl()}${contentIndex.buildUrl("program", program.locale, program.slug)}`;

    addEntry({
      loc: url,
      lastmod: getYmlFileLastmod("program", program.dirSlug, program.locale),
      label: `${program.title} (${formatLocaleLabel(program.locale)})`,
      type: "program",
      locale: program.locale,
      contentKey: `program:${program.dirSlug}`,
    });
  }

  // Dynamic location pages
  const locations = getAvailableLocations();
  for (const location of locations) {
    if (!shouldIndex(location.meta.robots)) {
      log.info(
        `[Sitemap] Skipping noindex location: ${location.slug} (${location.locale})`,
      );
      continue;
    }

    const url = `${getBaseUrl()}${contentIndex.buildUrl("location", location.locale, location.slug)}`;

    addEntry({
      loc: url,
      lastmod: getYmlFileLastmod("location", location.dirSlug, location.locale),
      label: `Location: ${location.name} (${formatLocaleLabel(location.locale)})`,
      type: "location",
      locale: location.locale,
      contentKey: `location:${location.dirSlug}`,
    });
  }

  // Dynamic template pages
  const templatePages = getAvailableTemplatePages();
  for (const page of templatePages) {
    if (!shouldIndex(page.meta.robots)) {
      log.info(
        `[Sitemap] Skipping noindex template page: ${page.slug} (${page.locale})`,
      );
      continue;
    }

    addEntry({
      loc: `${getBaseUrl()}${contentIndex.buildUrl("page", page.locale, page.slug)}`,
      lastmod: getYmlFileLastmod("page", page.dirSlug, page.locale),
      label: `Page: ${page.title} (${formatLocaleLabel(page.locale)})`,
      type: "template_page",
      locale: page.locale,
      contentKey: `page:${page.dirSlug}`,
    });
  }

  // DB-backed content types — read synchronously from the SQLite cache
  try {
    const allTypeConfigs = getAllConfigs();
    for (const [typeName, typeConfig] of Object.entries(allTypeConfigs)) {
      if (!typeConfig.database?.slug) continue;
      const dbName = typeConfig.database.slug;
      const items = databaseManager.getMappedItems(dbName);
      if (!items || items.length === 0) {
        log.warn(`[Sitemap] No cached items for DB-backed type "${typeName}" (db: ${dbName}) — skipping`);
        continue;
      }
      const localeFieldKey = getLocaleKey(typeName);
      const localeSource = getLocaleSource(typeName);
      const urlPatterns = typeConfig.url_pattern;
      const fieldMapping = getFullFieldMapping(typeName);
      const typeLabel = typeName.charAt(0).toUpperCase() + typeName.slice(1);
      for (const item of items) {
        let locale = "en";
        if (localeFieldKey) {
          const resolvedLocaleField = (fieldMapping && localeFieldKey in fieldMapping)
            ? fieldMapping[localeFieldKey]
            : localeFieldKey;
          const langVal = String(item[resolvedLocaleField] || item[localeFieldKey] || "en");
          locale = localeSource ? applyTransformIfNeeded(localeSource, langVal) : langVal;
        }
        const urlPattern = urlPatterns[locale] || urlPatterns["en"];
        if (!urlPattern) continue;
        const itemUrl = `${getBaseUrl()}${resolveUrlPatternWithMapping(urlPattern, item, locale, fieldMapping)}`;
        const title = String(item.title || item.slug || item.id || "");
        const updatedAt = String(item.updated_at || "");
        const itemSlug = String(item.slug || item.id || "");
        addEntry({
          loc: itemUrl,
          lastmod: updatedAt ? updatedAt.split("T")[0] : today,
          label: `${typeLabel}: ${title} (${formatLocaleLabel(locale)})`,
          type: "static",
          locale,
          contentKey: itemSlug ? `${typeName}:${itemSlug}` : undefined,
        });
      }
    }
  } catch (err) {
    log.warn("[Sitemap] Could not load DB-backed content types for sitemap:", err);
  }

  const handledTypes = new Set(["program", "location", "page"]);
  try {
    const allTypeConfigs = getAllConfigs();
    for (const [typeName, typeConfig] of Object.entries(allTypeConfigs)) {
      if (handledTypes.has(typeName)) continue;
      if (typeConfig.database) continue;

      const slugs = contentIndex.listContentSlugs(typeName);
      for (const slug of slugs) {
        const locales = contentIndex.getAvailableLocalesOrVariants(typeName, slug);
        for (const locale of locales) {
          if (!getSupportedLocales().includes(locale)) continue;

          const merged = loadMergedContent(typeName, slug, locale);
          if (!merged) continue;

          const meta = (merged.meta as ContentMeta) || {};
          if (!shouldIndex(meta.robots)) {
            log.info(`[Sitemap] Skipping noindex ${typeName}: ${slug} (${locale})`);
            continue;
          }

          const url = `${getBaseUrl()}${contentIndex.buildUrl(typeName, locale, (merged.slug as string) || slug)}`;
          const title = meta.page_title || (merged.title as string) || slug;
          const typeLabel = typeName.charAt(0).toUpperCase() + typeName.slice(1);

          addEntry({
            loc: url,
            lastmod: getYmlFileLastmod(typeName, slug, locale),
            label: `${typeLabel}: ${title} (${formatLocaleLabel(locale)})`,
            type: typeName,
            locale,
            contentKey: `${typeName}:${slug}`,
          });
        }
      }
    }
  } catch (err) {
    log.warn("[Sitemap] Error generating dynamic content type entries:", err);
  }

  return entriesMap;
}

// ============================================================================
// Output Transformers - Derive from Canonical Source
// ============================================================================

function buildAlternatesMap(entries: CanonicalSitemapEntry[]): Map<string, Map<string, string>> {
  const groups = new Map<string, Map<string, string>>();

  for (const entry of entries) {
    if (!entry.contentKey || !entry.locale) continue;
    if (!groups.has(entry.contentKey)) {
      groups.set(entry.contentKey, new Map());
    }
    groups.get(entry.contentKey)!.set(entry.locale, entry.loc);
  }

  const alternatesMap = new Map<string, Map<string, string>>();
  for (const [, localeMap] of groups) {
    if (localeMap.size < 2) continue;
    for (const [, loc] of localeMap) {
      alternatesMap.set(loc, localeMap);
    }
  }

  return alternatesMap;
}

function entriesToXml(entries: CanonicalSitemapEntry[]): string {
  const alternatesMap = buildAlternatesMap(entries);

  const urlEntries = entries
    .map((entry) => {
      const localeMap = alternatesMap.get(entry.loc);
      let alternateLines = "";
      if (localeMap) {
        const lines: string[] = [];
        for (const [locale, href] of localeMap) {
          lines.push(`    <xhtml:link rel="alternate" hreflang="${locale}" href="${href}" />`);
        }
        const defaultHref = localeMap.get("en") || localeMap.values().next().value;
        if (defaultHref) {
          lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${defaultHref}" />`);
        }
        alternateLines = "\n" + lines.join("\n");
      }
      return `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>${alternateLines}
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries}
</urlset>`;
}

function entriesToHumanReadable(
  entries: CanonicalSitemapEntry[],
): Array<{ loc: string; label: string; locale?: string }> {
  return entries.map((entry) => ({
    loc: entry.loc,
    label: entry.label,
    ...(entry.locale ? { locale: entry.locale } : {}),
  }));
}

// ============================================================================
// Cached Access - Both outputs derive from same canonical data
// ============================================================================

function getCanonicalEntries(): Map<string, CanonicalSitemapEntry> {
  const now = Date.now();

  // Check if cache exists and is still valid
  if (sitemapCache && now - sitemapCache.generatedAt < CACHE_TTL_MS) {
    log.info("[Sitemap] Serving from cache");
    return sitemapCache.entries;
  }

  // Generate fresh entries
  log.info("[Sitemap] Generating fresh sitemap entries");
  const entriesMap = buildCanonicalSitemapEntries();

  sitemapCache = {
    entries: entriesMap,
    generatedAt: now,
  };

  return entriesMap;
}

// ============================================================================
// Public API
// ============================================================================

export function getSitemap(): string {
  const entriesMap = getCanonicalEntries();
  return entriesToXml(Array.from(entriesMap.values()));
}

export function getSitemapUrls(): Array<{ loc: string; label: string; locale?: string }> {
  const entriesMap = getCanonicalEntries();
  return entriesToHumanReadable(Array.from(entriesMap.values()));
}

export function clearSitemapCache(): { success: boolean; message: string } {
  if (sitemapCache) {
    const age = Date.now() - sitemapCache.generatedAt;
    const ageMinutes = Math.round(age / 1000 / 60);
    sitemapCache = null;
    log.info("[Sitemap] Cache cleared");
    return {
      success: true,
      message: `Cache cleared. Previous cache was ${ageMinutes} minutes old.`,
    };
  }

  return {
    success: true,
    message: "No cache to clear.",
  };
}

export function getSitemapCacheStatus(): {
  cached: boolean;
  generatedAt: number | null;
  ageMinutes: number | null;
  expiresInMinutes: number | null;
  entryCount: number | null;
} {
  if (!sitemapCache) {
    return {
      cached: false,
      generatedAt: null,
      ageMinutes: null,
      expiresInMinutes: null,
      entryCount: null,
    };
  }

  const now = Date.now();
  const ageMs = now - sitemapCache.generatedAt;
  const expiresInMs = CACHE_TTL_MS - ageMs;

  return {
    cached: true,
    generatedAt: sitemapCache.generatedAt,
    ageMinutes: Math.round(ageMs / 1000 / 60),
    expiresInMinutes: Math.max(0, Math.round(expiresInMs / 1000 / 60)),
    entryCount: sitemapCache.entries.size,
  };
}

// ============================================================================
// Targeted cache mutation API
// ============================================================================

/**
 * Remove exactly one entry from the cache by its composite map key.
 * Key format: `${contentKey}:${locale}` (or `loc` URL for static/keyless entries).
 * No-op when cache is cold.
 */
export function invalidateSitemapEntry(mapKey: string): void {
  if (!sitemapCache) return;
  sitemapCache.entries.delete(mapKey);
  log.info(`[Sitemap] Invalidated entry: ${mapKey}`);
}

/**
 * Remove all entries whose `contentKey` field equals the given value.
 * Covers all locales of a single piece of content, and clears stale URL
 * entries produced by slug-field edits.
 * No-op when cache is cold.
 */
export function invalidateSitemapEntriesByContentKey(contentKey: string): void {
  if (!sitemapCache) return;
  let removed = 0;
  for (const [key, entry] of sitemapCache.entries) {
    if (entry.contentKey === contentKey) {
      sitemapCache.entries.delete(key);
      removed++;
    }
  }
  if (removed > 0) {
    log.info(`[Sitemap] Invalidated ${removed} entr${removed === 1 ? "y" : "ies"} for contentKey: ${contentKey}`);
  }
}

/**
 * Insert or replace one entry in the cache.
 * No-op when cache is cold (avoids creating a partial single-entry cache).
 */
export function upsertSitemapEntry(entry: CanonicalSitemapEntry): void {
  if (!sitemapCache) return;
  const key = buildMapKey(entry);
  sitemapCache.entries.set(key, entry);
  log.info(`[Sitemap] Upserted entry: ${key} → ${entry.loc}`);
}

/**
 * Build a single CanonicalSitemapEntry for one locale of a YAML-driven content
 * type. Returns null when the content is not found, not indexable, or filtered
 * out by type-specific rules (e.g. location visibility).
 * Blog posts are DB-backed and are not handled here.
 */
function buildSingleEntry(type: string, dirSlug: string, locale: string): CanonicalSitemapEntry | null {
  const merged = loadMergedContent(type, dirSlug, locale);
  if (!merged) return null;

  const meta = (merged.meta as ContentMeta) || {};
  if (!shouldIndex(meta.robots)) return null;

  if (type === "location") {
    const visibility = (merged.visibility as string) || "listed";
    if (visibility !== "listed") return null;
  }

  const urlSlug = (merged.slug as string) || dirSlug;
  const url = `${getBaseUrl()}${contentIndex.buildUrl(type, locale, urlSlug)}`;
  const title = meta.page_title || (merged.title as string) || (merged.name as string) || dirSlug;

  let entryType: EntryType = type;
  let label: string;

  if (type === "program") {
    label = `${title} (${formatLocaleLabel(locale)})`;
  } else if (type === "location") {
    label = `Location: ${title} (${formatLocaleLabel(locale)})`;
  } else if (type === "page") {
    entryType = "template_page";
    label = `Page: ${title} (${formatLocaleLabel(locale)})`;
  } else {
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    label = `${typeLabel}: ${title} (${formatLocaleLabel(locale)})`;
  }

  return {
    loc: url,
    lastmod: getYmlFileLastmod(type, dirSlug, locale),
    label,
    type: entryType,
    locale,
    contentKey: `${type}:${dirSlug}`,
  };
}

/**
 * Targeted update for one locale of a YAML-driven content entry.
 *
 * Only removes the exact map entry for this type+dirSlug+locale triple
 * (key: `${type}:${dirSlug}:${locale}`), then re-reads the source YAML
 * and upserts if `shouldIndex()` is true.
 *
 * Because the map key is stable and does not include the URL, slug-field
 * changes in the YAML are handled correctly: the stale URL entry is removed
 * and the new URL is inserted at the same key — without affecting sibling
 * locales.
 *
 * No-op for DB-backed content types and unsupported locales.
 * Safe to call when cache is cold — invalidation is a no-op and no partial
 * cache is created.
 */
export function refreshSitemapEntry(type: string, dirSlug: string, locale: string): void {
  // DB-backed types are not handled via YAML refresh
  if (getContentTypeConfig(type)?.database) return;

  // Only process supported locales
  if (!getSupportedLocales().includes(locale)) return;

  // Remove only this locale's entry — does not affect sibling locales
  invalidateSitemapEntry(`${type}:${dirSlug}:${locale}`);

  // If cache isn't warm, don't pre-populate a partial cache
  if (!sitemapCache) return;

  const entry = buildSingleEntry(type, dirSlug, locale);
  if (entry) {
    upsertSitemapEntry(entry);
  }
}

/**
 * Targeted update for multiple locales of a YAML-driven content entry in a
 * single pass.
 *
 * Invalidates the content key once (covering stale URLs from slug-field edits
 * and noindex transitions), then re-reads and upserts each valid locale.
 * This avoids the re-invalidation problem that would occur if `refreshSitemapEntry`
 * were called per-locale in a loop: each call would purge the locales added by
 * previous calls.
 *
 * Use this for edits that affect all locales simultaneously (e.g. `_common.yml`
 * saves or `edit-common` requests where no locale is specified).
 *
 * No-op for DB-backed content types.
 * Safe to call when cache is cold.
 */
export function refreshSitemapEntriesForContentKey(type: string, dirSlug: string, locales: string[]): void {
  // Purge all stale entries for this content key once
  invalidateSitemapEntriesByContentKey(`${type}:${dirSlug}`);

  // If cache isn't warm, don't pre-populate a partial cache
  if (!sitemapCache) return;

  // DB-backed types are not handled via YAML refresh
  if (getContentTypeConfig(type)?.database) return;

  const supported = getSupportedLocales();
  for (const locale of locales) {
    if (!supported.includes(locale)) continue;
    const entry = buildSingleEntry(type, dirSlug, locale);
    if (entry) {
      upsertSitemapEntry(entry);
    }
  }
}
