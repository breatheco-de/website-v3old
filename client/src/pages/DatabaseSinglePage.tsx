import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SectionRenderer } from "@/components/SectionRenderer";
import { apiFetch } from "@/lib/queryClient";
import type { TemplatePage } from "@shared/schema";
import { IconLoader2 } from "@tabler/icons-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useSchemaOrg } from "@/hooks/useSchemaOrg";
import { useContentAutoRefresh } from "@/hooks/useContentAutoRefresh";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface DatabaseSinglePageProps {
  contentType: string;
}

export default function DatabaseSinglePage({ contentType }: DatabaseSinglePageProps) {
  const [location] = useLocation();
  const locale = location.startsWith("/es") ? "es" : "en";

  const segments = location.split("?")[0].split("/").filter(Boolean);
  const slug = segments[segments.length - 1] || "";

  const { data: page, isLoading, error, refetch } = useQuery<TemplatePage>({
    queryKey: ["/api/database-single", contentType, slug, locale],
    queryFn: async () => {
      const response = await apiFetch(`/api/database-single/${contentType}/${slug}?locale=${locale}`);
      if (!response.ok) {
        throw new Error("Page not found");
      }
      return response.json();
    },
    enabled: !!slug,
  });

  usePageMeta(page?.meta);
  useSchemaOrg(page?.schema);

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  useContentAutoRefresh(contentType, slug, locale, handleRefetch);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        data-testid="loading-database-single"
      >
        <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div data-testid="error-database-single">
        <Header />
        <div className="min-h-screen flex items-center justify-center">
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
      </div>
    );
  }

  return (
    <div data-testid={`page-${contentType}-${slug}`}>
      <Header />
      <SectionRenderer
        sections={page.sections}
        settings={page.settings}
        contentType={contentType}
        slug={slug}
        locale={locale}
      />
      <Footer />
    </div>
  );
}
