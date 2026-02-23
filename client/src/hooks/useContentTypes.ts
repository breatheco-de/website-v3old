import { useQuery } from "@tanstack/react-query";

interface ContentTypeEntry {
  folder: string;
  url_pattern: Record<string, string>;
}

type ContentTypesMap = Record<string, ContentTypeEntry>;

export function useContentTypes() {
  const { data } = useQuery<ContentTypesMap>({
    queryKey: ["/api/content-types"],
    staleTime: Infinity,
  });

  return data ?? null;
}

export function getTypeFromFolder(configs: ContentTypesMap, folder: string): string {
  for (const [type, config] of Object.entries(configs)) {
    if (config.folder === folder) return type;
  }
  return folder;
}

export function getFolderFromType(configs: ContentTypesMap, type: string): string {
  const config = configs[type];
  if (config) return config.folder;
  for (const [t, c] of Object.entries(configs)) {
    if (c.folder === type) return type;
  }
  return type;
}

export function getContentTypeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function getAllContentTypes(configs: ContentTypesMap): string[] {
  return Object.keys(configs);
}

const PLURAL_TO_SINGULAR: Record<string, string> = {
  programs: "program",
  landings: "landing",
  locations: "location",
  pages: "page",
};

export function normalizeContentType(typeOrFolder: string, configs?: ContentTypesMap | null): string {
  if (PLURAL_TO_SINGULAR[typeOrFolder]) return PLURAL_TO_SINGULAR[typeOrFolder];
  if (configs && configs[typeOrFolder]) return typeOrFolder;
  if (configs) {
    for (const [type, config] of Object.entries(configs)) {
      if (config.folder === typeOrFolder) return type;
    }
  }
  return typeOrFolder;
}
