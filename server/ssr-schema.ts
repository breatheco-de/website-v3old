import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { getMergedSchemas } from "./schema-org";
import { contentIndex } from "./content-index";
import { deepMerge } from "./utils/deepMerge";
import { escapeTemplateVars, unescapeObjectVars } from "@shared/templateVars";
import { getFolder, getContentTypeConfig, resolveUrlPatternWithMapping } from "./content-types";
import { getBaseUrl, generateHreflangTags, generateListingHreflangTags } from "./hreflang";

const MARKETING_CONTENT_PATH = path.join(process.cwd(), "marketing-content");

function safeYamlLoad(yamlStr: string): unknown {
  const { escaped, map } = escapeTemplateVars(yamlStr);
  const parsed = yaml.load(escaped);
  return unescapeObjectVars(parsed, map);
}

interface FaqItem {
  question: string;
  answer: string;
  locations?: string[];
  related_features?: string[];
  priority?: number;
}

export interface FaqSection {
  type: "faq";
  title?: string;
  items?: FaqItem[];
  related_features?: string[];
}

interface SchemaReference {
  include?: string[];
  overrides?: Record<string, Record<string, unknown>>;
}

interface ParsedRoute {
  contentType: string;
  slug: string;
  locale: string;
}

let faqCache: Record<string, FaqItem[]> = {};

function loadCentralizedFaqs(locale: string): FaqItem[] {
  if (faqCache[locale]) return faqCache[locale];

  const faqPath = path.join(MARKETING_CONTENT_PATH, "faqs", `${locale}.yml`);
  if (!fs.existsSync(faqPath)) return [];

  try {
    const content = fs.readFileSync(faqPath, "utf-8");
    const data = safeYamlLoad(content) as { faqs?: FaqItem[] };
    faqCache[locale] = data?.faqs || [];
    return faqCache[locale];
  } catch {
    return [];
  }
}

export function clearSsrSchemaCache(): void {
  faqCache = {};
}

function parseRoute(url: string): ParsedRoute | null {
  const cleanUrl = url.split("?")[0].split("#")[0];

  if (cleanUrl === "/" || cleanUrl === "/en" || cleanUrl === "/en/" || cleanUrl === "/es" || cleanUrl === "/es/") {
    return null;
  }

  const resolved = contentIndex.resolveUrl(cleanUrl);
  if (resolved && !resolved.fromDatabase) {
    let locale = cleanUrl.match(/^\/(es)\b/) ? "es" : "en";
    if (resolved.params?.locale) {
      locale = resolved.params.locale;
    } else if (!cleanUrl.match(/^\/(en|es)\b/)) {
      const commonData = contentIndex.loadCommonData(resolved.contentType, resolved.slug);
      if (commonData?.locale && typeof commonData.locale === "string") {
        locale = commonData.locale;
      }
    }
    return { contentType: resolved.contentType, slug: resolved.slug, locale };
  }

  return null;
}

export function loadRawYaml(contentType: string, slug: string, locale: string): Record<string, unknown> | null {
  const resolvedSlug = contentIndex.resolveBaseSlug(slug, contentType);
  const folder = getFolder(contentType);
  const contentDir = path.join(MARKETING_CONTENT_PATH, folder, resolvedSlug);
  const commonPath = path.join(contentDir, "_common.yml");

  const contentPath = path.join(contentDir, `${locale}.yml`);

  if (!fs.existsSync(contentPath)) return null;

  try {
    let commonData: Record<string, unknown> = {};
    if (fs.existsSync(commonPath)) {
      commonData = safeYamlLoad(fs.readFileSync(commonPath, "utf-8")) as Record<string, unknown>;
    }

    const contentData = safeYamlLoad(fs.readFileSync(contentPath, "utf-8")) as Record<string, unknown>;
    return deepMerge(commonData, contentData);
  } catch {
    return null;
  }
}

export function buildFaqPageSchema(faqItems: Array<{ question: string; answer: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function resolveFaqItems(section: FaqSection, locale: string, locationSlug?: string, programSlug?: string): Array<{ question: string; answer: string }> {
  if (section.items && section.items.length > 0) {
    return section.items.map(({ question, answer }) => ({ question, answer }));
  }

  if (section.related_features && section.related_features.length > 0) {
    const allFaqs = loadCentralizedFaqs(locale);
    const relatedFeatures = section.related_features;

    let filtered = allFaqs
      .filter((faq) => {
        const faqFeatures = faq.related_features || [];
        return relatedFeatures.some((f) => faqFeatures.includes(f));
      });

    // Apply location filtering
    if (locationSlug) {
      // On location page: show "all" FAQs + FAQs for this specific location
      filtered = filtered.filter((faq) => {
        const locations = faq.locations || ["all"];
        return locations.includes("all") || locations.includes(locationSlug);
      });
    } else {
      // On general page: only show "all" FAQs, exclude location-specific ones
      filtered = filtered.filter((faq) => {
        const locations = faq.locations || ["all"];
        return locations.includes("all") || locations.length === 0;
      });
    }

    filtered = filtered
      .sort((a, b) => {
        const aFeatures = a.related_features || [];
        const bFeatures = b.related_features || [];
        const aCount = relatedFeatures.filter((f) => aFeatures.includes(f)).length;
        const bCount = relatedFeatures.filter((f) => bFeatures.includes(f)).length;
        
        // Prioritize FAQs that have the programSlug tag when programSlug is provided and in selected topics
        const shouldPrioritizeProgram = programSlug && relatedFeatures.includes(programSlug);
        if (shouldPrioritizeProgram) {
          const aHasProgram = aFeatures.includes(programSlug);
          const bHasProgram = bFeatures.includes(programSlug);
          if (aHasProgram !== bHasProgram) {
            return aHasProgram ? -1 : 1; // FAQs with programSlug come first (lower sort value)
          }
        }
        
        if (bCount !== aCount) return bCount - aCount;
        return (a.priority ?? 2) - (b.priority ?? 2);
      })
      .slice(0, 9);

    return filtered.map(({ question, answer }) => ({ question, answer }));
  }

  return [];
}

export function generateDatabaseSsrHtml(
  contentType: string,
  record: Record<string, unknown>,
  locale: string,
): string {
  const baseUrl = getBaseUrl();
  const config = getContentTypeConfig(contentType);
  if (!config?.url_pattern) return "";

  const urlPattern = config.url_pattern[locale] || config.url_pattern["en"];
  if (!urlPattern) return "";

  const recordUrl = `${baseUrl}${resolveUrlPatternWithMapping(urlPattern, record, locale, null)}`;
  const scripts: string[] = [];

  const title = ((record.title as string) || "").replace(/"/g, "&quot;");
  const description = ((record.description as string) || (record.preview as string) || "").replace(/"/g, "&quot;");
  const image = record.preview as string || record.image as string || "";
  const publishedAt = (record.published_at as string) || (record.created_at as string) || "";
  const updatedAt = (record.updated_at as string) || publishedAt;

  let authorName = "4Geeks Academy";
  if (record.author && typeof record.author === "object") {
    const author = record.author as Record<string, unknown>;
    authorName = `${author.first_name || ""} ${author.last_name || ""}`.trim() || "4Geeks Academy";
  } else if (typeof record.author === "string") {
    authorName = record.author || "4Geeks Academy";
  }

  const schemaType = contentType === "blog" ? "BlogPosting" : "WebPage";
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    headline: record.title,
    description: record.description || record.preview || "",
    url: recordUrl,
    datePublished: publishedAt,
    dateModified: updatedAt,
    author: { "@type": "Person", name: authorName },
    publisher: { "@type": "Organization", name: "4Geeks Academy", url: baseUrl },
  };
  if (image) schema.image = image;
  if (record.tags && Array.isArray(record.tags) && record.tags.length > 0) {
    schema.keywords = record.tags.join(", ");
  }
  scripts.push(`<script type="application/ld+json" data-ssr="true">${JSON.stringify(schema)}</script>`);

  const ogType = contentType === "blog" ? "article" : "website";
  const metaTags = [
    `<title>${title} | 4Geeks Academy</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${recordUrl}" />`,
    image ? `<meta property="og:image" content="${image}" />` : "",
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    image ? `<meta name="twitter:image" content="${image}" />` : "",
    publishedAt ? `<meta property="article:published_time" content="${publishedAt}" />` : "",
    updatedAt ? `<meta property="article:modified_time" content="${updatedAt}" />` : "",
    `<meta property="article:author" content="${authorName}" />`,
    `<link rel="canonical" href="${recordUrl}" />`,
  ].filter(Boolean);

  const hreflangTags = generateHreflangTags(contentType, record.slug as string || "", locale, record);
  return [...hreflangTags, ...metaTags, ...scripts].join("\n");
}

export function generateListingSsrHtml(contentType: string, locale: string): string {
  const baseUrl = getBaseUrl();
  const config = getContentTypeConfig(contentType);
  if (!config?.url_pattern) return "";

  const pattern = config.url_pattern[locale] || config.url_pattern["en"];
  if (!pattern) return "";

  const listingUrl = `${baseUrl}${pattern.replace(/\/:[a-zA-Z_]+/g, "").replace(/\/+$/, "") || "/"}`;
  const label = contentType.charAt(0).toUpperCase() + contentType.slice(1);
  const title = `${label} | 4Geeks Academy`;
  const description = locale === "es"
    ? `Explora nuestro contenido de ${label.toLowerCase()} en 4Geeks Academy.`
    : `Explore our ${label.toLowerCase()} content at 4Geeks Academy.`;

  const metaTags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${listingUrl}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<link rel="canonical" href="${listingUrl}" />`,
  ];

  const hreflangTags = generateListingHreflangTags(contentType, locale);
  return [...hreflangTags, ...metaTags].join("\n");
}

export function generateSsrSchemaHtml(url: string): string {
  try {
    const route = parseRoute(url);
    if (!route) return "";

    const pageData = loadRawYaml(route.contentType, route.slug, route.locale);
    if (!pageData) return "";

    const scripts: string[] = [];

    const schemaRef = pageData.schema as SchemaReference | undefined;
    if (schemaRef?.include && schemaRef.include.length > 0) {
      const schemas = getMergedSchemas(schemaRef, route.locale);
      for (const schema of schemas) {
        scripts.push(
          `<script type="application/ld+json" data-ssr="true">${JSON.stringify(schema)}</script>`
        );
      }
    }

    const sections = pageData.sections as Array<Record<string, unknown>> | undefined;
    if (sections) {
      const locationSlug = route.contentType === "location" ? route.slug : undefined;
      const programSlug = route.contentType === "program" ? route.slug : undefined;
      
      for (const section of sections) {
        if (section.type === "faq") {
          const faqItems = resolveFaqItems(section as unknown as FaqSection, route.locale, locationSlug, programSlug);
          if (faqItems.length > 0) {
            scripts.push(
              `<script type="application/ld+json" data-ssr="true">${JSON.stringify(buildFaqPageSchema(faqItems))}</script>`
            );
          }
        }
      }
    }

    const hreflangTags = generateHreflangTags(route.contentType, route.slug, route.locale);
    return [...hreflangTags, ...scripts].join("\n");
  } catch (err) {
    console.error("[SSR-Schema] Error generating schema for", url, err);
    return "";
  }
}
