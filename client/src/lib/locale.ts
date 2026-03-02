export function normalizeLocale(locale: string | undefined | null): string {
  if (!locale) return "en";
  const normalized = locale.toLowerCase().split("-")[0].split("_")[0];
  if (normalized === "us") return "en";
  return normalized;
}

export function buildContentUrlFromPattern(
  urlPattern: Record<string, string> | undefined,
  slug: string,
  locale: string,
): string {
  if (!urlPattern) return `/${locale}/${slug}`;
  const pattern = urlPattern[locale];
  if (!pattern) return `/${locale}/${slug}`;
  return pattern.replace(/:slug/g, slug);
}
