import * as fs from "fs";
import * as path from "path";
import { databaseManager } from "./database";
import {
  getContentTypeConfig,
  getLocaleKey,
  resolveUrlPatternWithMapping,
} from "./content-types";

export interface BlogConfig {
  database: string;
  url_pattern: Record<string, string>;
  categories: Record<string, string>;
  field_mapping?: Record<string, string | null>;
}

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  lang: string;
  category: { slug: string };
  status: string;
  visibility: string;
  url: string;
  readme_url: string;
  description: string;
  duration: number;
  preview: string;
  author: { id: number; first_name: string; last_name: string; profile?: { avatar_url?: string } } | null;
  published_at: string;
  created_at: string;
  updated_at: string;
  cluster: string | null;
  cluster_slug: string | null;
  tags: string[];
  [key: string]: unknown;
}

export function resolveUrlPattern(pattern: string, post: BlogPost, locale: string): string {
  return resolveUrlPatternWithMapping(pattern, post as unknown as Record<string, unknown>, locale, null);
}

let configCache: BlogConfig | null = null;

function loadConfig(): BlogConfig {
  if (configCache) return configCache;

  const ctConfig = getContentTypeConfig("blog");
  if (!ctConfig?.database?.slug) {
    throw new Error("[Blog] No blog configuration found in content-types.yml (database.slug is required)");
  }

  const mapping = ctConfig.database.field_mapping;
  const regularMapping: Record<string, string | null> = {};
  if (mapping) {
    for (const [key, value] of Object.entries(mapping)) {
      if (!key.startsWith("_")) {
        regularMapping[key] = value;
      }
    }
  }

  const localeKey = getLocaleKey("blog");

  configCache = {
    database: ctConfig.database.slug,
    url_pattern: ctConfig.url_pattern || { en: "/en/blog/:category/:slug", es: "/es/blog/:category/:slug" },
    categories: localeKey ? { en: "en", es: "es" } : { en: "blog-us", es: "blog-es" },
    field_mapping: Object.keys(regularMapping).length > 0 ? regularMapping : undefined,
  };
  return configCache;
}

export function clearConfigCache(): void {
  configCache = null;
}

const markdownCache = new Map<string, { content: string; fetched_at: number }>();

export async function fetchMarkdownContent(readmeUrl: string): Promise<string> {
  const ttlMs = 24 * 60 * 60 * 1000;

  const cached = markdownCache.get(readmeUrl);
  if (cached && Date.now() - cached.fetched_at < ttlMs) {
    return cached.content;
  }

  try {
    const response = await fetch(readmeUrl);
    if (!response.ok) return "";
    const text = await response.text();
    const frontmatterRegex = /^---[\s\S]*?---\s*/;
    const content = text.replace(frontmatterRegex, "").trim();
    markdownCache.set(readmeUrl, { content, fetched_at: Date.now() });
    return content;
  } catch (err) {
    console.error(`[Blog] Failed to fetch markdown from ${readmeUrl}:`, err);
    return cached?.content || "";
  }
}

export function clearMarkdownCache(slug?: string): void {
  if (!slug) {
    markdownCache.clear();
    console.log("[Blog] Cleared all markdown cache entries");
    return;
  }
  const keys = Array.from(markdownCache.keys());
  for (const url of keys) {
    if (url.includes(slug)) {
      markdownCache.delete(url);
      console.log(`[Blog] Cleared markdown cache for slug containing: ${slug}`);
    }
  }
}

export function clearMarkdownCacheByUrl(readmeUrl: string): boolean {
  return markdownCache.delete(readmeUrl);
}

function extractByDotPath(obj: unknown, dotPath: string): unknown {
  if (!dotPath || !dotPath.trim()) return undefined;
  let current = obj;
  const segments = dotPath.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  for (const key of segments) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const idx = Number(key);
      if (Number.isInteger(idx) && idx >= 0 && idx < current.length) {
        current = current[idx];
      } else {
        return undefined;
      }
    } else if (typeof current === "object" && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

function applyFieldMapping(rawItems: unknown[], mapping: Record<string, string | null>): BlogPost[] {
  return rawItems.map((item, idx) => {
    if (!item || typeof item !== "object") return item as BlogPost;
    const src = item as Record<string, unknown>;

    const getValue = (dotPath: string | null): unknown => {
      if (!dotPath) return undefined;
      return extractByDotPath(src, dotPath);
    };

    const mapped: Record<string, unknown> = { ...src };

    if (mapping.title) mapped.title = getValue(mapping.title) ?? mapped.title;
    if (mapping.slug) mapped.slug = getValue(mapping.slug) ?? mapped.slug;
    if (!mapped.slug && mapped.title && typeof mapped.title === "string") {
      mapped.slug = slugify(mapped.title);
    }
    if (mapping.description) mapped.description = getValue(mapping.description) ?? mapped.description;
    if (mapping.published_at) mapped.published_at = getValue(mapping.published_at) ?? mapped.published_at;
    if (mapping.updated_at) mapped.updated_at = getValue(mapping.updated_at) ?? mapped.updated_at;
    if (mapping.status) mapped.status = getValue(mapping.status) ?? mapped.status;
    if (mapping.lang) {
      let langVal = getValue(mapping.lang) ?? mapped.lang;
      if (langVal === "us") langVal = "en";
      mapped.lang = langVal;
    }
    if (mapping.image) mapped.preview = getValue(mapping.image) ?? mapped.preview;
    if (mapping.content) mapped.content = getValue(mapping.content) ?? mapped.content;
    if (mapping.content_url) mapped.readme_url = getValue(mapping.content_url) ?? mapped.readme_url;
    if (mapping.tags) {
      const tagsVal = getValue(mapping.tags);
      mapped.tags = Array.isArray(tagsVal) ? tagsVal : mapped.tags;
    }
    if (mapping.author) {
      const authorVal = getValue(mapping.author);
      if (authorVal && typeof authorVal === "object") {
        mapped.author = authorVal;
      } else if (typeof authorVal === "string") {
        mapped.author = { id: 0, first_name: authorVal, last_name: "" };
      }
    }
    if (mapping.category) {
      const catVal = getValue(mapping.category);
      if (catVal && typeof catVal === "object") {
        mapped.category = catVal;
      } else if (typeof catVal === "string") {
        mapped.category = { slug: catVal };
      } else {
        mapped.category = { slug: "uncategorized" };
      }
    }

    if (!mapped.id) mapped.id = idx;

    return mapped as unknown as BlogPost;
  });
}

export async function getBlogPosts(forceRefresh = false): Promise<BlogPost[]> {
  const config = loadConfig();

  if (!config.database) {
    console.warn("[Blog] No database configured in content-types.yml");
    return [];
  }

  if (!databaseManager.exists(config.database)) {
    console.warn(`[Blog] Database "${config.database}" not found`);
    return [];
  }

  try {
    const result = await databaseManager.fetchItems(config.database, forceRefresh);
    const rawItems = result.items;

    if (config.field_mapping && Object.keys(config.field_mapping).length > 0) {
      const mapped = applyFieldMapping(rawItems, config.field_mapping);
      console.log(`[Blog] Fetched ${mapped.length} posts from database "${config.database}" (cache: ${result.from_cache})`);
      return mapped;
    }

    console.log(`[Blog] Fetched ${rawItems.length} posts from database "${config.database}" (cache: ${result.from_cache})`);
    return rawItems as BlogPost[];
  } catch (err) {
    console.error(`[Blog] Failed to fetch from database "${config.database}":`, err);
    return [];
  }
}

export function getBlogPostsByLocale(posts: BlogPost[], locale: string): BlogPost[] {
  return posts.filter((p) => (p as any).lang === locale);
}

export function findBlogPostBySlug(posts: BlogPost[], slug: string, locale?: string): BlogPost | undefined {
  if (locale) {
    const localeMatch = posts.find((p) => p.slug === slug && (p as any).lang === locale);
    if (localeMatch) return localeMatch;
  }
  return posts.find((p) => p.slug === slug);
}

export function clearBlogCache(): { success: boolean; message: string } {
  const config = loadConfig();
  clearMarkdownCache();

  if (config.database && databaseManager.exists(config.database)) {
    databaseManager.fetchItems(config.database, true).catch(() => {});
    return { success: true, message: "Blog cache cleared (database will re-fetch on next request)" };
  }

  return { success: true, message: "No blog cache to clear" };
}

export function getBlogCacheStatus(): { exists: boolean; age_hours: number | null; post_count: number | null } {
  const config = loadConfig();

  if (!config.database || !databaseManager.exists(config.database)) {
    return { exists: false, age_hours: null, post_count: null };
  }

  const cachePath = path.join(process.cwd(), ".cache", `db-${config.database}.json`);
  if (!fs.existsSync(cachePath)) {
    return { exists: false, age_hours: null, post_count: null };
  }

  try {
    const raw = fs.readFileSync(cachePath, "utf-8");
    const cached = JSON.parse(raw) as { fetched_at: string; items: unknown[] };
    const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
    const ageHours = Math.round((ageMs / (60 * 60 * 1000)) * 10) / 10;
    return { exists: true, age_hours: ageHours, post_count: cached.items.length };
  } catch {
    return { exists: false, age_hours: null, post_count: null };
  }
}

export function getBlogConfig(): BlogConfig {
  return loadConfig();
}


function getBaseUrl(): string {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/$/, "");
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return "http://localhost:5000";
}

export function parseBlogRoute(url: string): { slug: string; locale: string } | null {
  const cleanUrl = url.split("?")[0].split("#")[0];
  const match = cleanUrl.match(/^\/(en|es)\/blog\/(.+)$/);
  if (match) {
    const segments = match[2].split("/").filter(Boolean);
    const slug = segments[segments.length - 1];
    return { locale: match[1], slug };
  }
  return null;
}

export function generateBlogSsrHtml(post: BlogPost, locale: string): string {
  const scripts: string[] = [];
  const baseUrl = getBaseUrl();
  const config = loadConfig();
  const urlPattern = config.url_pattern[locale] || config.url_pattern["en"];
  const postUrl = `${baseUrl}${resolveUrlPattern(urlPattern, post, locale)}`;

  const authorName = post.author
    ? `${post.author.first_name || ""} ${post.author.last_name || ""}`.trim()
    : "4Geeks Academy";

  const articleSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description || post.preview || "",
    url: postUrl,
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at || post.published_at || post.created_at,
    author: {
      "@type": "Person",
      name: authorName,
    },
    publisher: {
      "@type": "Organization",
      name: "4Geeks Academy",
      url: baseUrl,
    },
  };

  if (post.preview) {
    articleSchema.image = post.preview;
  }

  if (post.tags && post.tags.length > 0) {
    articleSchema.keywords = post.tags.join(", ");
  }

  scripts.push(
    `<script type="application/ld+json" data-ssr="true">${JSON.stringify(articleSchema)}</script>`
  );

  const description = (post.description || post.preview || "").replace(/"/g, "&quot;");
  const title = (post.title || "").replace(/"/g, "&quot;");

  const metaTags = [
    `<title>${title} | 4Geeks Academy</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${postUrl}" />`,
    post.preview ? `<meta property="og:image" content="${post.preview}" />` : "",
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    post.preview ? `<meta name="twitter:image" content="${post.preview}" />` : "",
    `<meta property="article:published_time" content="${post.published_at || post.created_at}" />`,
    `<meta property="article:modified_time" content="${post.updated_at || post.published_at || post.created_at}" />`,
    `<meta property="article:author" content="${authorName}" />`,
    `<link rel="canonical" href="${postUrl}" />`,
  ].filter(Boolean);

  const altLocale = locale === "en" ? "es" : "en";
  const altPattern = config.url_pattern[altLocale] || config.url_pattern["en"];
  if (altPattern) {
    const altUrl = `${baseUrl}${resolveUrlPattern(altPattern, post, altLocale)}`;
    metaTags.push(`<link rel="alternate" hreflang="${locale}" href="${postUrl}" />`);
    metaTags.push(`<link rel="alternate" hreflang="${altLocale}" href="${altUrl}" />`);
    const xDefaultUrl = locale === "en" ? postUrl : altUrl;
    metaTags.push(`<link rel="alternate" hreflang="x-default" href="${xDefaultUrl}" />`);
  }

  return [...metaTags, ...scripts].join("\n");
}

export function generateBlogListingSsrHtml(locale: string): string {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/${locale}/blog`;
  const title = locale === "es" ? "Blog | 4Geeks Academy" : "Blog | 4Geeks Academy";
  const description = locale === "es"
    ? "Lee las últimas noticias, tutoriales y artículos sobre programación, tecnología y educación en 4Geeks Academy."
    : "Read the latest news, tutorials and articles about coding, technology and education at 4Geeks Academy.";

  const metaTags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
  ];

  const altLocale = locale === "en" ? "es" : "en";
  const altUrl = `${baseUrl}/${altLocale}/blog`;
  metaTags.push(`<link rel="alternate" hreflang="${locale}" href="${url}" />`);
  metaTags.push(`<link rel="alternate" hreflang="${altLocale}" href="${altUrl}" />`);
  metaTags.push(`<link rel="alternate" hreflang="x-default" href="${baseUrl}/en/blog" />`);

  return metaTags.join("\n");
}
