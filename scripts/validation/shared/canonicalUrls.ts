/**
 * Canonical URL Helpers
 * 
 * Utilities for generating and validating canonical URLs for content.
 */

import type { ContentFile } from "./types";
import { contentIndex } from "../../../server/content-index";

const typeToContentType: Record<string, string> = {
  program: "programs",
  landing: "landings",
  location: "locations",
  page: "pages",
};

export function getCanonicalUrl(file: ContentFile): string {
  const contentType = typeToContentType[file.type] || file.type;
  const locale = file.locale === "_common" ? "en" : file.locale;
  return contentIndex.buildUrl(contentType, locale, file.slug);
}

export function normalizeUrl(url: string): string {
  let normalized = url.startsWith("/") ? url : `/${url}`;
  normalized = normalized.toLowerCase();
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export const STATIC_ROUTES = [
  "/",
  "/us",
  "/es",
  "/en/career-programs",
  "/es/programas-de-carrera",
  "/en/locations",
  "/es/ubicaciones",
  "/dashboard",
  "/component-showcase",
];

export function buildValidUrlSet(contentFiles: ContentFile[]): Set<string> {
  const validUrls = new Set<string>();
  
  for (const file of contentFiles) {
    validUrls.add(getCanonicalUrl(file));
  }
  
  STATIC_ROUTES.forEach((route) => validUrls.add(route));
  
  return validUrls;
}
