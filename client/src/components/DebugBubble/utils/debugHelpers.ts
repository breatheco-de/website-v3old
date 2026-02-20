import { ContentInfo, MenuView, STORAGE_KEY } from "../types";

export function deslugify(slug: string): string {
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function detectContentInfo(pathname: string): ContentInfo {
  const typeLabels: Record<string, string> = {
    program: "Program",
    page: "Page",
    landing: "Landing",
    location: "Location",
  };

  const toSingular: Record<string, string> = { programs: "program", pages: "page", landings: "landing", locations: "location" };

  const previewMatch = pathname.match(/^\/private\/preview\/(program|page|landing|location|programs|pages|landings|locations)\/([^/]+)\/?$/);
  if (previewMatch) {
    const normalizedType = (toSingular[previewMatch[1]] || previewMatch[1]) as ContentInfo["type"];
    return { 
      type: normalizedType, 
      slug: previewMatch[2], 
      label: typeLabels[normalizedType!] || "Content" 
    };
  }

  const experimentMatch = pathname.match(/^\/private\/(program|page|landing|location|programs|pages|landings|locations)\/([^/]+)\/experiment\/[^/]+\/?$/);
  if (experimentMatch) {
    const normalizedType = (toSingular[experimentMatch[1]] || experimentMatch[1]) as ContentInfo["type"];
    return { 
      type: normalizedType, 
      slug: experimentMatch[2], 
      label: typeLabels[normalizedType!] || "Content" 
    };
  }

  const programEnMatch = pathname.match(/^\/en\/career-programs\/([^/]+)\/?$/);
  if (programEnMatch) {
    return { type: "program", slug: programEnMatch[1], label: "Program" };
  }
  const programEsMatch = pathname.match(/^\/es\/programas-de-carrera\/([^/]+)\/?$/);
  if (programEsMatch) {
    return { type: "program", slug: programEsMatch[1], label: "Program" };
  }

  const landingMatch = pathname.match(/^\/landing\/([^/]+)\/?$/);
  if (landingMatch) {
    return { type: "landing", slug: landingMatch[1], label: "Landing" };
  }

  const locationEnMatch = pathname.match(/^\/en\/location\/([^/]+)\/?$/);
  if (locationEnMatch) {
    return { type: "location", slug: locationEnMatch[1], label: "Location" };
  }
  const locationEsMatch = pathname.match(/^\/es\/ubicacion\/([^/]+)\/?$/);
  if (locationEsMatch) {
    return { type: "location", slug: locationEsMatch[1], label: "Location" };
  }

  const pageEnMatch = pathname.match(/^\/en\/([^/]+)\/?$/);
  if (pageEnMatch && !["career-programs", "location"].includes(pageEnMatch[1])) {
    return { type: "page", slug: pageEnMatch[1], label: "Page" };
  }
  const pageEsMatch = pathname.match(/^\/es\/([^/]+)\/?$/);
  if (pageEsMatch && !["programas-de-carrera", "ubicacion"].includes(pageEsMatch[1])) {
    return { type: "page", slug: pageEsMatch[1], label: "Page" };
  }

  return { type: null, slug: null, label: "" };
}

export function getContentFilePath(type: string | null, slug: string | null, locale?: string | null, variant?: string | null, version?: number | null): string {
  if (!type || !slug) return "";
  
  if (variant && version !== null && version !== undefined && locale) {
    return `${type}/${slug}/${variant}.v${version}.${locale}.yml`;
  }
  
  if (locale) {
    return `${type}/${slug}/${locale}.yml`;
  }
  
  return `${type}/${slug}/`;
}

export const getPersistedMenuView = (): MenuView => {
  if (typeof window !== "undefined") {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === "main" || stored === "components" || stored === "sitemap" || stored === "experiments" || stored === "menus") {
      return stored;
    }
  }
  return "main";
};
