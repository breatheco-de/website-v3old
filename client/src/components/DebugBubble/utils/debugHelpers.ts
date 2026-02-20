import { ContentInfo, MenuView, STORAGE_KEY } from "../types";

export function deslugify(slug: string): string {
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function detectContentInfo(pathname: string, searchParams?: URLSearchParams): ContentInfo {
  const forceVariant = searchParams?.get("force_variant") || null;
  const forceVersionStr = searchParams?.get("force_version");
  const parsedVersion = forceVersionStr ? parseInt(forceVersionStr, 10) : null;
  const forceVersion = parsedVersion !== null && Number.isFinite(parsedVersion) ? parsedVersion : null;
  const toSingular: Record<string, string> = { programs: "program", pages: "page", landings: "landing", locations: "location" };

  const experimentMatch = pathname.match(/^\/private\/(program|page|landing|location|programs|pages|landings|locations)\/([^/]+)\/experiment\/[^/]+\/?$/);
  if (experimentMatch) {
    const typeLabels: Record<string, string> = {
      program: "Program",
      page: "Page",
      landing: "Landing",
      location: "Location",
    };
    const normalized = (toSingular[experimentMatch[1]] || experimentMatch[1]) as ContentInfo["type"];
    return { 
      type: normalized, 
      slug: experimentMatch[2], 
      label: typeLabels[toSingular[experimentMatch[1]] || experimentMatch[1]] || "Content",
      locale: null,
      variant: forceVariant,
      version: forceVersion
    };
  }

  const programEnMatch = pathname.match(/^\/en\/career-programs\/([^/]+)\/?$/);
  if (programEnMatch) {
    return { type: "program", slug: programEnMatch[1], label: "Program", locale: "en", variant: forceVariant, version: forceVersion };
  }
  const programEsMatch = pathname.match(/^\/es\/programas-de-carrera\/([^/]+)\/?$/);
  if (programEsMatch) {
    return { type: "program", slug: programEsMatch[1], label: "Program", locale: "es", variant: forceVariant, version: forceVersion };
  }

  const landingMatch = pathname.match(/^\/landing\/([^/]+)\/?$/);
  if (landingMatch) {
    return { type: "landing", slug: landingMatch[1], label: "Landing", locale: "promoted", variant: forceVariant, version: forceVersion };
  }

  const locationEnMatch = pathname.match(/^\/en\/location\/([^/]+)\/?$/);
  if (locationEnMatch) {
    return { type: "location", slug: locationEnMatch[1], label: "Location", locale: "en", variant: forceVariant, version: forceVersion };
  }
  const locationEsMatch = pathname.match(/^\/es\/ubicacion\/([^/]+)\/?$/);
  if (locationEsMatch) {
    return { type: "location", slug: locationEsMatch[1], label: "Location", locale: "es", variant: forceVariant, version: forceVersion };
  }

  const pageEnMatch = pathname.match(/^\/en\/([^/]+)\/?$/);
  if (pageEnMatch && !["career-programs", "location"].includes(pageEnMatch[1])) {
    return { type: "page", slug: pageEnMatch[1], label: "Page", locale: "en", variant: forceVariant, version: forceVersion };
  }
  const pageEsMatch = pathname.match(/^\/es\/([^/]+)\/?$/);
  if (pageEsMatch && !["programas-de-carrera", "ubicacion"].includes(pageEsMatch[1])) {
    return { type: "page", slug: pageEsMatch[1], label: "Page", locale: "es", variant: forceVariant, version: forceVersion };
  }

  return { type: null, slug: null, label: "", locale: null, variant: null, version: null };
}

export function getContentFilePath(info: ContentInfo): string {
  if (!info.type || !info.slug) return "";
  
  if (info.variant && info.version !== null && info.locale) {
    return `${info.type}/${info.slug}/${info.variant}.v${info.version}.${info.locale}.yml`;
  }
  
  if (info.locale) {
    return `${info.type}/${info.slug}/${info.locale}.yml`;
  }
  
  return `${info.type}/${info.slug}/`;
}

export const getPersistedMenuView = (): MenuView => {
  if (typeof window !== "undefined") {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === "main" || stored === "components" || stored === "sitemap" || stored === "experiments") {
      return stored;
    }
  }
  return "main";
};
