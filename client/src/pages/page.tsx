import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { SectionRenderer } from "@/components/SectionRenderer";
import { apiFetch } from "@/lib/queryClient";
import type { TemplatePage } from "@shared/schema";
import { IconLoader2 } from "@tabler/icons-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useSchemaOrg } from "@/hooks/useSchemaOrg";
import { useContentAutoRefresh } from "@/hooks/useContentAutoRefresh";
import { useAlternateUrls } from "@/hooks/useAlternateUrls";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Page() {
  const [location, setLocation] = useLocation();
  const locale = location.startsWith("/es/") || location.startsWith("/es") ? "es" : "en";
  const params = useParams<{ slug: string }>();
  const slugFromPath = location.split("?")[0].replace(/^\/(?:en|es)\//, "").split("/")[0] || "";
  const slug = params.slug || slugFromPath;

  const { data: page, isLoading, error, refetch } = useQuery<TemplatePage>({
    queryKey: ["/api/pages", slug, locale],
    queryFn: async () => {
      const response = await apiFetch(`/api/pages/${slug}?locale=${locale}`);
      if (!response.ok) {
        throw new Error("Page not found");
      }
      return response.json();
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (page?.slug && page.slug !== slug) {
      const correctUrl = `/${locale}/${page.slug}`;
      setLocation(correctUrl, { replace: true });
    }
  }, [page?.slug, slug, locale, setLocation]);

  const alternates = useAlternateUrls(location);
  const metaWithAlternates = useMemo(() => {
    if (!page?.meta) return undefined;
    return { ...page.meta, alternates };
  }, [page?.meta, alternates]);
  usePageMeta(metaWithAlternates);
  useSchemaOrg(page?.schema);

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  useContentAutoRefresh("page", slug, locale, handleRefetch);

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        data-testid="loading-page"
      >
        <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        data-testid="error-page"
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
    <div data-testid={`page-${slug}`}>
      <Header />
      <SectionRenderer 
        sections={page.sections} 
        settings={page.settings}
        contentType="page"
        slug={slug}
        locale={locale}
        singleEntry={page.singleEntry}
      />
      <Footer />
    </div>
  );
}
