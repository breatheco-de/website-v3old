import { useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { SectionRenderer } from "@/components/SectionRenderer";
import type { LandingPage } from "@shared/schema";
import { IconLoader2 } from "@tabler/icons-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useSchemaOrg } from "@/hooks/useSchemaOrg";
import { useContentAutoRefresh } from "@/hooks/useContentAutoRefresh";

export default function LandingDetail() {
  const { i18n } = useTranslation();
  const params = useParams<{ slug: string }>();
  const [location] = useLocation();
  const slug = params.slug;
  
  // Detect locale from URL path first, fallback to i18n.language
  const urlLocale = location.startsWith('/es/') ? 'es' : location.startsWith('/en/') ? 'en' : null;
  const locale = urlLocale || (i18n.language === "es" ? "es" : "en");
  
  // Sync i18n language with URL locale
  useEffect(() => {
    if (urlLocale && i18n.language !== urlLocale) {
      i18n.changeLanguage(urlLocale);
    }
  }, [urlLocale, i18n]);

  const { data: landing, isLoading, error, refetch } = useQuery<LandingPage>({
    queryKey: ["/api/landings", slug, locale],
    queryFn: async () => {
      const response = await fetch(`/api/landings/${slug}?locale=${locale}`);
      if (!response.ok) {
        throw new Error("Landing page not found");
      }
      return response.json();
    },
    enabled: !!slug,
  });

  usePageMeta(landing?.meta);
  useSchemaOrg(landing?.schema);

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  useContentAutoRefresh("landing", slug, locale, handleRefetch);

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        data-testid="loading-landing"
      >
        <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !landing) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        data-testid="error-landing"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {locale === "es" ? "Página no encontrada" : "Page not found"}
          </h1>
          <p className="text-muted-foreground">
            {locale === "es" 
              ? "La página que buscas no existe." 
              : "The page you're looking for doesn't exist."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="page-landing">
      <SectionRenderer 
        sections={landing.sections} 
        contentType="landing"
        slug={slug}
        locale={locale}
        landingLocations={landing.landing_locations}
      />
    </div>
  );
}
