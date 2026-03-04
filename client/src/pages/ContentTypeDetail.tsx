import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { SectionRenderer } from "@/components/SectionRenderer";
import { IconLoader2 } from "@tabler/icons-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useSchemaOrg } from "@/hooks/useSchemaOrg";
import { useContentAutoRefresh } from "@/hooks/useContentAutoRefresh";
import { useAlternateUrls } from "@/hooks/useAlternateUrls";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const LEGACY_API_PATHS: Record<string, string> = {
  program: "/api/career-programs",
  location: "/api/locations",
};

function getApiPath(type: string): string {
  return LEGACY_API_PATHS[type] || `/api/content-pages/${type}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ContentTypeDetailProps {
  type: string;
  slug: string;
  locale: string;
  urlPattern?: Record<string, string>;
}

export default function ContentTypeDetail({ type, slug, locale, urlPattern }: ContentTypeDetailProps) {
  const { i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const effectiveLocale = locale || (i18n.language as string) || "en";
  const apiPath = getApiPath(type);

  const { data, isLoading, error, refetch } = useQuery<Record<string, unknown>>({
    queryKey: [apiPath, slug, effectiveLocale],
    queryFn: async () => {
      const response = await fetch(`${apiPath}/${slug}?locale=${effectiveLocale}`);
      if (!response.ok) {
        throw new Error(`${type} not found`);
      }
      return response.json();
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (data?.slug && data.slug !== slug && urlPattern) {
      const pattern = urlPattern[effectiveLocale] || urlPattern["en"];
      if (pattern) {
        const correctUrl = pattern.replace(":slug", String(data.slug));
        setLocation(correctUrl, { replace: true });
      }
    }
  }, [data?.slug, slug, effectiveLocale, urlPattern, setLocation]);

  const alternates = useAlternateUrls(location);
  const metaWithAlternates = useMemo(() => {
    if (!data?.meta) return undefined;
    return { ...(data.meta as object), alternates };
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
        data-testid={`loading-${type}`}
      >
        <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    const label = capitalize(type);
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        data-testid={`error-${type}`}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {effectiveLocale === "es" ? `${label} no encontrado` : `${label} not found`}
          </h1>
          <p className="text-muted-foreground">
            {effectiveLocale === "es"
              ? `El ${type} que buscas no existe.`
              : `The ${type} you're looking for doesn't exist.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid={`page-${type}`}>
      <Header />
      <SectionRenderer
        sections={(data.sections as any[]) || []}
        settings={data.settings}
        contentType={type}
        slug={slug}
        locale={effectiveLocale}
        programSlug={type === "program" ? slug : undefined}
        singleEntry={data.singleEntry as Record<string, unknown> | undefined}
      />
      <div className="pb-12">
        <Footer />
      </div>
    </div>
  );
}
