import * as fs from "fs";
import * as path from "path";
import { contentIndex, MARKETING_CONTENT_PATH as BASE_CONTENT_PATH } from "./content-index";
import { getContentTypeConfig, getLocaleKey, getLocaleSource, getFieldMapping, getFullFieldMapping, resolveUrlPatternWithMapping, getAllConfigs } from "./content-types";
import { getSupportedLocales } from "./settings";
import { applyTransformIfNeeded } from "./transform";

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
  | "template_page"
  | string;

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
          locale,
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

    const url = `${getBaseUrl()}${contentIndex.buildUrl("program", program.locale, program.slug)}`;

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

  // Dynamic location pages
  const locations = getAvailableLocations();
  for (const location of locations) {
    if (!shouldIndex(location.meta.robots)) {
      console.log(
        `[Sitemap] Skipping noindex location: ${location.slug} (${location.locale})`,
      );
      continue;
    }

    const url = `${getBaseUrl()}${contentIndex.buildUrl("location", location.locale, location.slug)}`;

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
      loc: `${getBaseUrl()}${contentIndex.buildUrl("page", page.locale, page.slug)}`,
      lastmod: today,
      changefreq: page.meta.change_frequency || "weekly",
      priority: page.meta.priority || 0.8,
      label: `Page: ${page.title} (${formatLocaleLabel(page.locale)})`,
      type: "template_page",
      locale: page.locale,
    });
  }

  // Blog posts from database cache file (read synchronously)
  try {
    const blogTypeConfig = getContentTypeConfig("blog");
    if (blogTypeConfig?.database?.slug) {
      const dbName = blogTypeConfig.database.slug;
      const localeFieldKey = getLocaleKey("blog");
      const localeSource = getLocaleSource("blog");
      const cachePath = path.join(process.cwd(), ".cache", `db-${dbName}.json`);
      if (fs.existsSync(cachePath)) {
        const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as {
          items: Array<Record<string, unknown>>;
        };
        const urlPatterns = blogTypeConfig.url_pattern;
        const blogFieldMapping = getFullFieldMapping("blog");
        for (const post of cached.items) {
          let locale = "en";
          if (localeFieldKey) {
            const langVal = String(post[localeFieldKey] || "en");
            locale = localeSource ? applyTransformIfNeeded(localeSource, langVal) : langVal;
          }
          const urlPattern = urlPatterns[locale] || urlPatterns["en"];
          const postUrl = `${getBaseUrl()}${resolveUrlPatternWithMapping(urlPattern, post, locale, blogFieldMapping)}`;
          const title = String(post.title || post.slug || "");
          const updatedAt = String(post.updated_at || "");
          entries.push({
            loc: postUrl,
            lastmod: updatedAt ? updatedAt.split("T")[0] : today,
            changefreq: "monthly",
            priority: 0.6,
            label: `Blog: ${title} (${formatLocaleLabel(locale)})`,
            type: "static",
            locale,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[Sitemap] Could not load blog posts for sitemap:", err);
  }

  const handledTypes = new Set(["program", "location", "page", "blog"]);
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
            console.log(`[Sitemap] Skipping noindex ${typeName}: ${slug} (${locale})`);
            continue;
          }

          const url = `${getBaseUrl()}${contentIndex.buildUrl(typeName, locale, (merged.slug as string) || slug)}`;
          const title = meta.page_title || (merged.title as string) || slug;
          const typeLabel = typeName.charAt(0).toUpperCase() + typeName.slice(1);

          entries.push({
            loc: url,
            lastmod: today,
            changefreq: meta.change_frequency || "weekly",
            priority: meta.priority || 0.7,
            label: `${typeLabel}: ${title} (${formatLocaleLabel(locale)})`,
            type: typeName,
            locale,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[Sitemap] Error generating dynamic content type entries:", err);
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

export function getSitemapUrls(): Array<{ loc: string; label: string; locale?: string }> {
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
