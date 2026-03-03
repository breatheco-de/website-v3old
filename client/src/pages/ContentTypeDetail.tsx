import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { SectionRenderer } from "@/components/SectionRenderer";
import type { CareerProgram, LocationPage } from "@shared/schema";
import { IconLoader2 } from "@tabler/icons-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useSchemaOrg } from "@/hooks/useSchemaOrg";
import { useContentAutoRefresh } from "@/hooks/useContentAutoRefresh";
import { useAlternateUrls } from "@/hooks/useAlternateUrls";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export type ContentType = "program" | "location";

interface ContentTypeConfig {
  apiPath: string;
  notFoundTitle: { en: string; es: string };
  notFoundMessage: { en: string; es: string };
  testIdPrefix: string;
  urlPattern: { en: string; es: string };
}

const contentTypeConfigs: Record<ContentType, ContentTypeConfig> = {
  program: {
    apiPath: "/api/career-programs",
    notFoundTitle: {
      en: "Program not found",
      es: "Programa no encontrado",
    },
    notFoundMessage: {
      en: "The program you're looking for doesn't exist.",
      es: "El programa que buscas no existe.",
    },
    testIdPrefix: "program",
    urlPattern: {
      en: "/en/career-programs/:slug",
      es: "/es/programas-de-carrera/:slug",
    },
  },
  location: {
    apiPath: "/api/locations",
    notFoundTitle: {
      en: "Location not found",
      es: "Ubicación no encontrada",
    },
    notFoundMessage: {
      en: "The location you're looking for doesn't exist.",
      es: "La ubicación que buscas no existe.",
    },
    testIdPrefix: "location",
    urlPattern: {
      en: "/en/location/:slug",
      es: "/es/ubicacion/:slug",
    },
  },
};

interface ContentTypeDetailProps {
  type: ContentType;
  slug: string;
  locale: "en" | "es";
}

type ContentData = CareerProgram | LocationPage;

export default function ContentTypeDetail({ type, slug, locale }: ContentTypeDetailProps) {
  const { i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const config = contentTypeConfigs[type];
  const effectiveLocale = locale || (i18n.language as "en" | "es");

  const { data, isLoading, error, refetch } = useQuery<ContentData>({
    queryKey: [config.apiPath, slug, effectiveLocale],
    queryFn: async () => {
      const response = await fetch(`${config.apiPath}/${slug}?locale=${effectiveLocale}`);
      if (!response.ok) {
        throw new Error(`${type} not found`);
      }
      return response.json();
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (data?.slug && data.slug !== slug) {
      const correctUrl = config.urlPattern[effectiveLocale].replace(":slug", data.slug);
      setLocation(correctUrl, { replace: true });
    }
  }, [data?.slug, slug, effectiveLocale, config.urlPattern, setLocation]);

  const alternates = useAlternateUrls(location);
  const metaWithAlternates = useMemo(() => {
    if (!data?.meta) return undefined;
    return { ...data.meta, alternates };
  }, [data?.meta, alternates]);
  usePageMeta(metaWithAlternates);
  useSchemaOrg(data?.schema);

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  useContentAutoRefresh(type, slug, effectiveLocale, handleRefetch);

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        data-testid={`loading-${config.testIdPrefix}`}
      >
        <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        data-testid={`error-${config.testIdPrefix}`}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {config.notFoundTitle[effectiveLocale]}
          </h1>
          <p className="text-muted-foreground">
            {config.notFoundMessage[effectiveLocale]}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid={`page-${config.testIdPrefix}`}>
      <Header />
      <SectionRenderer 
        sections={data.sections || []} 
        settings={data.settings}
        contentType={type}
        slug={slug}
        locale={effectiveLocale}
        programSlug={type === "program" ? slug : undefined}
        singleEntry={(data as any).singleEntry}
      />
      <div className="pb-12">
        <Footer />
      </div>
    </div>
  );
}
