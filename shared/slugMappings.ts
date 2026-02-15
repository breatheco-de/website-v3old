export interface SlugMapping {
  en: string;
  es: string;
  folder: string;
}

export type ContentType = 'page' | 'program' | 'location';

export interface ContentTypePrefix {
  en: string;
  es: string;
}

export const contentTypePrefixes: Record<ContentType, ContentTypePrefix> = {
  page: {
    en: '',
    es: '',
  },
  program: {
    en: 'career-programs',
    es: 'programas-de-carrera',
  },
  location: {
    en: 'location',
    es: 'ubicacion',
  },
};

export function getContentTypeUrlPrefix(contentType: ContentType, locale: 'en' | 'es'): string {
  const prefix = contentTypePrefixes[contentType]?.[locale] || '';
  return prefix ? `/${prefix}` : '';
}

export function buildContentUrl(contentType: ContentType, slug: string, locale: 'en' | 'es'): string {
  const prefix = getContentTypeUrlPrefix(contentType, locale);
  return `/${locale}${prefix}/${slug}`;
}

export const pageSlugMappings: SlugMapping[] = [
  { en: "awards", es: "premios", folder: "awards" },
  { en: "geekforce-career-support", es: "geekforce", folder: "geekforce-career-support" },
  { en: "geekpal-support", es: "geekpal", folder: "geekpal-support" },
  { en: "geeks-vs-others", es: "geeks-vs-otros", folder: "geeks-vs-others" },
  { en: "graduates-and-projects", es: "alumnos-y-proyectos", folder: "graduates-and-projects" },
  { en: "job-guarantee", es: "trabajo-garantizado", folder: "job-guarantee" },
  { en: "outcomes", es: "resultados", folder: "outcomes" },
  { en: "apply", es: "aplica", folder: "apply" },
  { en: "financials", es: "financiacion", folder: "financials" },
  { en: "the-academy", es: "sobre-la-academia", folder: "the-academy" },
  { en: "partners", es: "alianzas", folder: "partners" },
  { en: "career-programs", es: "programas-de-carrera", folder: "career-programs" },
];

export function getSlugForLocale(folder: string, locale: string): string {
  const mapping = pageSlugMappings.find(m => m.folder === folder);
  if (!mapping) return folder;
  return locale === "es" ? mapping.es : mapping.en;
}

export function getFolderFromSlug(slug: string, locale: string): string {
  const mapping = pageSlugMappings.find(m => 
    locale === "es" ? m.es === slug : m.en === slug
  );
  return mapping?.folder || slug;
}

export function getTranslatedSlug(currentSlug: string, fromLocale: string, toLocale: string): string {
  const folder = getFolderFromSlug(currentSlug, fromLocale);
  return getSlugForLocale(folder, toLocale);
}
