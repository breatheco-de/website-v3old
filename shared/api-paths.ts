const LEGACY_API_PATHS: Record<string, string> = {
  page: "/api/pages",
  program: "/api/career-programs",
  location: "/api/locations",
  landing: "/api/landings",
};

export function getApiPath(type: string): string {
  return LEGACY_API_PATHS[type] || `/api/content-pages/${type}`;
}
