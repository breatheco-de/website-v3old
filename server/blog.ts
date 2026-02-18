import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

const MARKETING_CONTENT_PATH = path.join(process.cwd(), "marketing-content");
const BLOG_CONFIG_PATH = path.join(MARKETING_CONTENT_PATH, "blog.yml");

export interface ApiSourceConfig {
  endpoint: string;
  params: Record<string, string | number>;
  token_env_var: string;
  auth_prefix: string;
  headers: Record<string, string>;
  academy_header?: string;
  results_path?: string;
}

export interface BlogConfig {
  data_source: {
    type: string;
    api?: ApiSourceConfig;
    [key: string]: unknown;
  };
  cache: {
    ttl_hours: number;
    file_path: string;
  };
  url_pattern: Record<string, string>;
  categories: Record<string, string>;
  transform?: {
    results_path: string;
    pagination?: {
      type: string;
      has_more_field?: string | null;
      total_field?: string | null;
      next_field?: string | null;
      strategy_description?: string;
    };
  };
  field_mapping?: Record<string, string | null>;
}

interface CachedData {
  fetched_at: number;
  results: BlogPost[];
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
  tags: string[];
  [key: string]: unknown;
}

let configCache: BlogConfig | null = null;

function loadConfig(): BlogConfig {
  if (configCache) return configCache;

  if (!fs.existsSync(BLOG_CONFIG_PATH)) {
    throw new Error("[Blog] blog.yml not found in marketing-content/");
  }

  const raw = fs.readFileSync(BLOG_CONFIG_PATH, "utf-8");
  const parsed = yaml.load(raw) as Record<string, unknown>;

  if (parsed.data_source) {
    configCache = parsed as unknown as BlogConfig;
  } else if (parsed.api) {
    configCache = {
      data_source: {
        type: "api",
        api: parsed.api as ApiSourceConfig,
      },
      cache: parsed.cache as BlogConfig["cache"],
      url_pattern: parsed.url_pattern as Record<string, string>,
      categories: parsed.categories as Record<string, string>,
    };
    console.log("[Blog] Migrated legacy blog.yml format (flat api) to data_source wrapper in-memory");
  } else {
    throw new Error("[Blog] blog.yml has no data_source or api configuration");
  }

  return configCache;
}

export function clearConfigCache(): void {
  configCache = null;
}

function getApiConfig(): ApiSourceConfig {
  const config = loadConfig();
  if (config.data_source.type !== "api" || !config.data_source.api) {
    throw new Error(`[Blog] data_source.type is "${config.data_source.type}" but no api config found`);
  }
  const api = config.data_source.api;
  if (api.auth_prefix === undefined) {
    api.auth_prefix = "Token";
  }
  if (!api.headers) {
    api.headers = {};
    if (api.academy_header) {
      api.headers["Academy"] = api.academy_header;
    }
  }
  return api;
}

const markdownCache = new Map<string, { content: string; fetched_at: number }>();

export async function fetchMarkdownContent(readmeUrl: string): Promise<string> {
  const config = loadConfig();
  const ttlMs = config.cache.ttl_hours * 60 * 60 * 1000;

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

function getCachePath(): string {
  const config = loadConfig();
  return path.join(process.cwd(), config.cache.file_path);
}

function isCacheValid(): boolean {
  const cachePath = getCachePath();
  if (!fs.existsSync(cachePath)) return false;

  try {
    const raw = fs.readFileSync(cachePath, "utf-8");
    const cached = JSON.parse(raw) as CachedData;
    const config = loadConfig();
    const ttlMs = config.cache.ttl_hours * 60 * 60 * 1000;
    return Date.now() - cached.fetched_at < ttlMs;
  } catch {
    return false;
  }
}

function readCache(): BlogPost[] | null {
  const cachePath = getCachePath();
  if (!fs.existsSync(cachePath)) return null;

  try {
    const raw = fs.readFileSync(cachePath, "utf-8");
    const cached = JSON.parse(raw) as CachedData;
    return cached.results;
  } catch {
    return null;
  }
}

function writeCache(results: BlogPost[]): void {
  const cachePath = getCachePath();
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const data: CachedData = {
    fetched_at: Date.now(),
    results,
  };

  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf-8");
}

function extractByDotPath(obj: unknown, dotPath: string): unknown {
  if (!dotPath) return obj;
  let current = obj;
  for (const key of dotPath.split(".")) {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
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
    if (mapping.lang) mapped.lang = getValue(mapping.lang) ?? mapped.lang;
    if (mapping.image) mapped.preview = getValue(mapping.image) ?? mapped.preview;
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
      }
    }

    if (!mapped.id) mapped.id = idx;

    return mapped as unknown as BlogPost;
  });
}

async function fetchFromApi(): Promise<BlogPost[]> {
  const config = loadConfig();
  const apiConfig = getApiConfig();
  const token = process.env[apiConfig.token_env_var];

  if (!token) {
    console.warn(`[Blog] Environment variable ${apiConfig.token_env_var} not set, cannot fetch blog posts`);
    return [];
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(apiConfig.params)) {
    params.set(key, String(value));
  }

  const url = `${apiConfig.endpoint}?${params.toString()}`;
  console.log(`[Blog] Fetching blog posts from API: ${url}`);

  const fetchHeaders: Record<string, string> = {
    ...(apiConfig.headers || {}),
  };
  if (token) {
    fetchHeaders["Authorization"] = apiConfig.auth_prefix ? `${apiConfig.auth_prefix} ${token}` : token;
  }

  const response = await fetch(url, {
    headers: fetchHeaders,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[Blog] API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json() as unknown;

  const resultsPath = config.transform?.results_path ?? apiConfig.results_path ?? "";

  let rawItems: unknown[];

  if (resultsPath) {
    const extracted = extractByDotPath(data, resultsPath);
    if (Array.isArray(extracted)) {
      rawItems = extracted;
      console.log(`[Blog] Extracted ${rawItems.length} posts via results_path "${resultsPath}"`);
    } else {
      console.warn(`[Blog] results_path "${resultsPath}" did not resolve to an array, got ${typeof extracted}`);
      rawItems = [];
    }
  } else if (Array.isArray(data)) {
    rawItems = data;
  } else if (data && typeof data === "object" && "results" in data) {
    const obj = data as { results?: unknown[]; count?: number };
    rawItems = obj.results || [];
    console.log(`[Blog] API returned ${obj.count ?? rawItems.length} total posts, fetched ${rawItems.length}`);
  } else {
    rawItems = [];
  }

  if (config.field_mapping && Object.keys(config.field_mapping).length > 0) {
    const mapped = applyFieldMapping(rawItems, config.field_mapping);
    console.log(`[Blog] Applied field mapping to ${mapped.length} posts`);
    return mapped;
  }

  return rawItems as BlogPost[];
}

export async function getBlogPosts(forceRefresh = false): Promise<BlogPost[]> {
  if (!forceRefresh && isCacheValid()) {
    const cached = readCache();
    if (cached) {
      console.log(`[Blog] Serving ${cached.length} posts from cache`);
      return cached;
    }
  }

  const config = loadConfig();

  if (config.data_source.type !== "api") {
    console.warn(`[Blog] Unsupported data source type: ${config.data_source.type}`);
    const cached = readCache();
    return cached || [];
  }

  try {
    const results = await fetchFromApi();
    if (results.length > 0) {
      writeCache(results);
      console.log(`[Blog] Cached ${results.length} blog posts`);
    }
    return results;
  } catch (err) {
    console.error("[Blog] Failed to fetch from API:", err);
    const cached = readCache();
    if (cached) {
      console.log(`[Blog] Falling back to stale cache with ${cached.length} posts`);
      return cached;
    }
    return [];
  }
}

export function getBlogPostsByLocale(posts: BlogPost[], locale: string): BlogPost[] {
  const config = loadConfig();
  const category = config.categories[locale];
  if (!category) return posts;
  return posts.filter((p) => p.category?.slug === category);
}

export function findBlogPostBySlug(posts: BlogPost[], slug: string, locale?: string): BlogPost | undefined {
  if (locale) {
    const config = loadConfig();
    const category = config.categories[locale];
    if (category) {
      const localeMatch = posts.find((p) => p.slug === slug && p.category?.slug === category);
      if (localeMatch) return localeMatch;
    }
  }
  return posts.find((p) => p.slug === slug);
}

export function clearBlogCache(): { success: boolean; message: string } {
  const cachePath = getCachePath();
  clearMarkdownCache();
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
    return { success: true, message: "Blog cache cleared (including markdown)" };
  }
  return { success: true, message: "No blog cache to clear" };
}

export function getBlogCacheStatus(): { exists: boolean; age_hours: number | null; post_count: number | null } {
  const cachePath = getCachePath();
  if (!fs.existsSync(cachePath)) {
    return { exists: false, age_hours: null, post_count: null };
  }

  try {
    const raw = fs.readFileSync(cachePath, "utf-8");
    const cached = JSON.parse(raw) as CachedData;
    const ageMs = Date.now() - cached.fetched_at;
    const ageHours = Math.round((ageMs / (60 * 60 * 1000)) * 10) / 10;
    return { exists: true, age_hours: ageHours, post_count: cached.results.length };
  } catch {
    return { exists: false, age_hours: null, post_count: null };
  }
}

export function getBlogConfig(): BlogConfig {
  return loadConfig();
}

export function saveBlogConfig(update: Partial<BlogConfig>): void {
  const current = loadConfig();
  const merged = { ...current, ...update };

  if (update.data_source) {
    merged.data_source = { ...current.data_source, ...update.data_source };
  }

  const raw = fs.readFileSync(BLOG_CONFIG_PATH, "utf-8");
  const commentLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("#") || line.trim() === "") {
      commentLines.push(line);
    } else {
      break;
    }
  }

  const yamlBody = yaml.dump(merged, { lineWidth: 120, noRefs: true, sortKeys: false });
  const output = commentLines.length > 0
    ? commentLines.join("\n") + "\n\n" + yamlBody
    : yamlBody;

  fs.writeFileSync(BLOG_CONFIG_PATH, output, "utf-8");
  clearConfigCache();
  console.log("[Blog] Saved blog.yml configuration");
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
  const match = cleanUrl.match(/^\/(en|es)\/blog\/([^/]+)$/);
  if (match) {
    return { locale: match[1], slug: match[2] };
  }
  return null;
}

export function generateBlogSsrHtml(post: BlogPost, locale: string): string {
  const scripts: string[] = [];
  const baseUrl = getBaseUrl();
  const config = loadConfig();
  const urlPattern = config.url_pattern[locale] || config.url_pattern["en"];
  const postUrl = `${baseUrl}${urlPattern.replace(":slug", post.slug)}`;

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

  return metaTags.join("\n");
}
