import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { deepMerge } from "./utils/deepMerge";
import { escapeTemplateVars, unescapeObjectVars } from "@shared/templateVars";
import {
  listContentSlugs,
  getAvailableLocalesOrVariants,
  loadCommonData,
  MARKETING_CONTENT_PATH as BASE_CONTENT_PATH,
} from "./utils/contentLoader";
import { contentIndex } from "./content-index";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function safeYamlLoad(yamlStr: string): unknown {
  const { escaped, map } = escapeTemplateVars(yamlStr);
  const parsed = yaml.load(escaped);
  return unescapeObjectVars(parsed, map);
}

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

type ChangeFreq =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";
type EntryType =
  | "static"
  | "program"
  | "landing"
  | "location"
  | "template_page";

interface CanonicalSitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: ChangeFreq;
  priority: number;
  label: string;
  type: EntryType;
  locale?: string;
}

interface SitemapCache {
  entries: CanonicalSitemapEntry[];
  generatedAt: number;
}

let sitemapCache: SitemapCache | null = null;

// ============================================================================
// Content Meta Interfaces
// ============================================================================

interface ContentMeta {
  page_title?: string;
  robots?: string;
  priority?: number;
  change_frequency?: ChangeFreq;
  redirects?: string[];
}

interface AvailableProgram {
  slug: string;
  locale: string;
  title: string;
  meta: ContentMeta;
}

interface AvailableLanding {
  slug: string;
  locale: string;
  title: string;
  meta: ContentMeta;
}

interface AvailableLocation {
  slug: string;
  locale: string;
  name: string;
  visibility: string;
  meta: ContentMeta;
}

interface AvailableTemplatePage {
  slug: string;
  locale: string;
  template: string;
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
  const contentDir = path.join(BASE_CONTENT_PATH, contentType, slug);
  const commonPath = path.join(contentDir, "_common.yml");
  const contentPath = path.join(contentDir, `${localeOrVariant}.yml`);

  if (!fs.existsSync(contentPath)) {
    return null;
  }

  try {
    let commonData: Record<string, unknown> = {};
    if (fs.existsSync(commonPath)) {
      const commonContent = fs.readFileSync(commonPath, "utf-8");
      commonData = safeYamlLoad(commonContent) as Record<string, unknown>;
    }

    const content = fs.readFileSync(contentPath, "utf-8");
    const contentData = safeYamlLoad(content) as Record<string, unknown>;

    return deepMerge(commonData, contentData) as Record<string, unknown>;
  } catch (error) {
    console.error(
      `Error loading ${contentType}/${slug}/${localeOrVariant}:`,
      error,
    );
    return null;
  }
}

function getAvailablePrograms(): AvailableProgram[] {
  try {
    const programs: AvailableProgram[] = [];
    const slugs = listContentSlugs("programs");

    for (const slug of slugs) {
      const locales = getAvailableLocalesOrVariants("programs", slug);

      for (const locale of locales) {
        const merged = loadMergedContent("programs", slug, locale);
        if (!merged) continue;

        const meta = (merged.meta as ContentMeta) || {};
        programs.push({
          slug: (merged.slug as string) || slug,
          locale,
          title: meta.page_title || (merged.title as string) || slug,
          meta,
        });
      }
    }

    return programs;
  } catch (error) {
    console.error("Error scanning programs:", error);
    return [];
  }
}

function getAvailableLandings(): AvailableLanding[] {
  try {
    const landings: AvailableLanding[] = [];
    const slugs = listContentSlugs("landings");

    for (const slug of slugs) {
      // For landings, we use "promoted" as the content file
      // and get locale from _common.yml
      const merged = loadMergedContent("landings", slug, "promoted");
      if (!merged) {
        // Fallback: try to load en.yml for backward compatibility
        const legacyMerged = loadMergedContent("landings", slug, "en");
        if (legacyMerged) {
          const meta = (legacyMerged.meta as ContentMeta) || {};
          landings.push({
            slug: (legacyMerged.slug as string) || slug,
            locale: "en",
            title: meta.page_title || (legacyMerged.title as string) || slug,
            meta,
          });
        }
        continue;
      }

      // Get locale from _common.yml
      const commonData = loadCommonData("landings", slug);
      const locale = (commonData?.locale as string) || "en";
      const meta = (merged.meta as ContentMeta) || {};

      landings.push({
        slug: (merged.slug as string) || slug,
        locale,
        title: meta.page_title || (merged.title as string) || slug,
        meta,
      });
    }

    return landings;
  } catch (error) {
    console.error("Error scanning landings:", error);
    return [];
  }
}

function getAvailableLocations(): AvailableLocation[] {
  try {
    const locations: AvailableLocation[] = [];
    const slugs = listContentSlugs("locations");

    for (const slug of slugs) {
      const locales = getAvailableLocalesOrVariants("locations", slug);

      for (const locale of locales) {
        const merged = loadMergedContent("locations", slug, locale);
        if (!merged) continue;

        const visibility = (merged.visibility as string) || "listed";
        if (visibility !== "listed") continue;

        const meta = (merged.meta as ContentMeta) || {};
        locations.push({
          slug: (merged.slug as string) || slug,
          locale,
          name: meta.page_title || (merged.name as string) || slug,
          visibility,
          meta,
        });
      }
    }

    return locations;
  } catch (error) {
    console.error("Error scanning locations:", error);
    return [];
  }
}

function getAvailableTemplatePages(): AvailableTemplatePage[] {
  try {
    const pages: AvailableTemplatePage[] = [];
    const slugs = listContentSlugs("pages");

    for (const dirSlug of slugs) {
      const locales = getAvailableLocalesOrVariants("pages", dirSlug);

      for (const locale of locales) {
        // Only process locale files (en, es)
        if (!["en", "es"].includes(locale)) continue;

        const merged = loadMergedContent("pages", dirSlug, locale);
        if (!merged) continue;

        const meta = (merged.meta as ContentMeta) || {};
        pages.push({
          slug: (merged.slug as string) || dirSlug,
          locale,
          template: (merged.template as string) || dirSlug.replace(/-/g, "_"),
          title: meta.page_title || (merged.title as string) || dirSlug,
          meta,
        });
      }
    }

    return pages;
  } catch (error) {
    console.error("Error scanning template pages:", error);
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

function resolveTemplatePageUrl(slug: string, locale: string): string {
  // Use slug directly for URL path
  return locale === "es"
    ? `${getBaseUrl()}/es/${slug}`
    : `${getBaseUrl()}/en/${slug}`;
}

function formatLocaleLabel(locale: string): string {
  return locale === "es" ? "ES" : "EN";
}

// ============================================================================
// CANONICAL BUILDER - Single Source of Truth
// ============================================================================

function buildCanonicalSitemapEntries(): CanonicalSitemapEntry[] {
  const today = getCurrentDate();
  const entries: CanonicalSitemapEntry[] = [];

  // Static pages
  const staticPages: Array<{
    path: string;
    label: string;
    changefreq: ChangeFreq;
    priority: number;
  }> = [{ path: "/", label: "Home", changefreq: "weekly", priority: 1.0 }];

  for (const page of staticPages) {
    entries.push({
      loc: `${getBaseUrl()}${page.path}`,
      lastmod: today,
      changefreq: page.changefreq,
      priority: page.priority,
      label: page.label,
      type: "static",
    });
  }

  // Dynamic career program pages
  const programs = getAvailablePrograms();
  for (const program of programs) {
    if (!shouldIndex(program.meta.robots)) {
      console.log(
        `[Sitemap] Skipping noindex program: ${program.slug} (${program.locale})`,
      );
      continue;
    }

    const url = `${getBaseUrl()}${contentIndex.buildUrl("programs", program.locale, program.slug)}`;

    entries.push({
      loc: url,
      lastmod: today,
      changefreq: program.meta.change_frequency || "weekly",
      priority: program.meta.priority || 0.8,
      label: `${program.title} (${formatLocaleLabel(program.locale)})`,
      type: "program",
      locale: program.locale,
    });
  }

  // Dynamic landing pages (deduplicated by slug)
  const landings = getAvailableLandings();
  const processedLandingSlugs = new Set<string>();

  for (const landing of landings) {
    if (processedLandingSlugs.has(landing.slug)) continue;
    if (!shouldIndex(landing.meta.robots)) {
      console.log(`[Sitemap] Skipping noindex landing: ${landing.slug}`);
      continue;
    }

    processedLandingSlugs.add(landing.slug);

    entries.push({
      loc: `${getBaseUrl()}${contentIndex.buildUrl("landings", landing.locale || "en", landing.slug)}`,
      lastmod: today,
      changefreq: landing.meta.change_frequency || "weekly",
      priority: landing.meta.priority || 0.8,
      label: `Landing: ${landing.title}`,
      type: "landing",
    });
  }

  // Dynamic location pages
  const locations = getAvailableLocations();
  for (const location of locations) {
    if (!shouldIndex(location.meta.robots)) {
      console.log(
        `[Sitemap] Skipping noindex location: ${location.slug} (${location.locale})`,
      );
      continue;
    }

    const url = `${getBaseUrl()}${contentIndex.buildUrl("locations", location.locale, location.slug)}`;

    entries.push({
      loc: url,
      lastmod: today,
      changefreq: location.meta.change_frequency || "monthly",
      priority: location.meta.priority || 0.8,
      label: `Location: ${location.name} (${formatLocaleLabel(location.locale)})`,
      type: "location",
      locale: location.locale,
    });
  }

  // Dynamic template pages
  const templatePages = getAvailableTemplatePages();
  for (const page of templatePages) {
    if (!shouldIndex(page.meta.robots)) {
      console.log(
        `[Sitemap] Skipping noindex template page: ${page.slug} (${page.locale})`,
      );
      continue;
    }

    entries.push({
      loc: resolveTemplatePageUrl(page.slug, page.locale),
      lastmod: today,
      changefreq: page.meta.change_frequency || "weekly",
      priority: page.meta.priority || 0.8,
      label: `Page: ${page.title} (${formatLocaleLabel(page.locale)})`,
      type: "template_page",
      locale: page.locale,
    });
  }

  return entries;
}

// ============================================================================
// Output Transformers - Derive from Canonical Source
// ============================================================================

function entriesToXml(entries: CanonicalSitemapEntry[]): string {
  const urlEntries = entries
    .map(
      (entry) => `  <url>
          <loc>${entry.loc}</loc>
          <lastmod>${entry.lastmod}</lastmod>
          <changefreq>${entry.changefreq}</changefreq>
          <priority>${entry.priority}</priority>
        </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${urlEntries}
      </urlset>`;
}

function entriesToHumanReadable(
  entries: CanonicalSitemapEntry[],
): Array<{ loc: string; label: string }> {
  return entries.map((entry) => ({
    loc: entry.loc,
    label: entry.label,
  }));
}

// ============================================================================
// Cached Access - Both outputs derive from same canonical data
// ============================================================================

function getCanonicalEntries(): CanonicalSitemapEntry[] {
  const now = Date.now();

  // Check if cache exists and is still valid
  if (sitemapCache && now - sitemapCache.generatedAt < CACHE_TTL_MS) {
    console.log("[Sitemap] Serving from cache");
    return sitemapCache.entries;
  }

  // Generate fresh entries
  console.log("[Sitemap] Generating fresh sitemap entries");
  const entries = buildCanonicalSitemapEntries();

  sitemapCache = {
    entries,
    generatedAt: now,
  };

  return entries;
}

// ============================================================================
// Public API
// ============================================================================

export function getSitemap(): string {
  const entries = getCanonicalEntries();
  return entriesToXml(entries);
}

export function getSitemapUrls(): Array<{ loc: string; label: string }> {
  const entries = getCanonicalEntries();
  return entriesToHumanReadable(entries);
}

export function clearSitemapCache(): { success: boolean; message: string } {
  if (sitemapCache) {
    const age = Date.now() - sitemapCache.generatedAt;
    const ageMinutes = Math.round(age / 1000 / 60);
    sitemapCache = null;
    console.log("[Sitemap] Cache cleared");
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
    entryCount: sitemapCache.entries.length,
  };
}
