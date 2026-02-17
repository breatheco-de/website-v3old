import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

const MARKETING_CONTENT_PATH = path.join(process.cwd(), "marketing-content");
const BLOG_CONFIG_PATH = path.join(MARKETING_CONTENT_PATH, "blog.yml");

export interface ApiSourceConfig {
  endpoint: string;
  params: Record<string, string | number>;
  token_env_var: string;
  academy_header: string;
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
  return config.data_source.api;
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

async function fetchFromApi(): Promise<BlogPost[]> {
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

  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${token}`,
      Academy: apiConfig.academy_header,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[Blog] API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json() as { results?: BlogPost[]; count?: number } | BlogPost[];

  let results: BlogPost[];
  if (Array.isArray(data)) {
    results = data;
  } else if (data.results) {
    results = data.results;
    console.log(`[Blog] API returned ${data.count ?? results.length} total posts, fetched ${results.length}`);
  } else {
    results = [];
  }

  return results;
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
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
    return { success: true, message: "Blog cache cleared" };
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
