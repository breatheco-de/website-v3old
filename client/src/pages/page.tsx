import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { SectionRenderer } from "@/components/SectionRenderer";
import { apiFetch } from "@/lib/queryClient";
import type { TemplatePage } from "@shared/schema";
import { IconCode, IconLoader2 } from "@tabler/icons-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useSchemaOrg } from "@/hooks/useSchemaOrg";
import { useContentAutoRefresh } from "@/hooks/useContentAutoRefresh";
import { useAlternateUrls } from "@/hooks/useAlternateUrls";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LazyRender from "@/components/LazyRender";
import MenuSlotPlaceholder from "@/components/editing/MenuSlotPlaceholder";
import { Button } from "@/components/ui/button";

const RawFileEditorPanel = lazy(() => import("@/components/editing/RawFileEditorPanel"));

export default function Page() {
  const [location, setLocation] = useLocation();
  const { i18n } = useTranslation();
  const locale = location.startsWith("/es/") || location.startsWith("/es") ? "es" : "en";
  const params = useParams<{ slug: string }>();
  const slugFromPath = location.split("?")[0].replace(/^\/(?:en|es)\//, "").split("/")[0] || "";
  const slug = params.slug || slugFromPath || "home";

  const [showRawEditor, setShowRawEditor] = useState(false);

  useEffect(() => {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

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

  const { data: rawFileCheck } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/content/raw-file", "page", slug, locale],
    queryFn: async () => {
      const res = await fetch(`/api/content/raw-file?contentType=page&slug=${slug}&locale=${locale}`);
      if (!res.ok) return { exists: false };
      const data = await res.json();
      return { exists: !!data.exists };
    },
    enabled: !!slug && !!error,
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
      <>
        <div 
          className="min-h-screen flex items-center justify-center"
          data-testid="error-page"
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {locale === "es" ? "Página no encontrada" : "Page not found"}
            </h1>
            <p className="text-muted-foreground mb-4">
              {locale === "es" 
                ? "La página que buscas no existe." 
                : "The page you're looking for doesn't exist."}
            </p>
            {rawFileCheck?.exists && (
              <Button variant="outline" onClick={() => setShowRawEditor(true)} data-testid="button-edit-yaml">
                <IconCode className="w-4 h-4 mr-2" />
                Edit YAML
              </Button>
            )}
          </div>
        </div>
        {showRawEditor && (
          <Suspense fallback={null}>
            <RawFileEditorPanel
              contentType="page"
              slug={slug}
              locale={locale}
              onClose={() => setShowRawEditor(false)}
              onSaved={() => {
                setShowRawEditor(false);
                refetch();
              }}
            />
          </Suspense>
        )}
      </>
    );
  }

  const layoutMenu = (page as any).layout?.menu;
  const topMenuId = layoutMenu?.top as string | null | undefined;
  const bottomMenuId = layoutMenu?.bottom as string | null | undefined;

  return (
    <div data-testid={`page-${slug}`}>
      <div className="group relative">
        <MenuSlotPlaceholder
          position="top"
          currentMenuId={topMenuId ?? null}
          contentType="page"
          slug={slug}
          locale={locale}
          onMenuChange={() => refetch()}
        />
      </div>
      {topMenuId && <Header menuId={topMenuId} />}
      <SectionRenderer 
        sections={page.sections} 
        settings={page.settings}
        contentType="page"
        slug={slug}
        locale={locale}
        singleEntry={page.singleEntry}
      />
      <div className="group relative">
        {bottomMenuId && (
          <LazyRender>
            <Footer menuId={bottomMenuId} />
          </LazyRender>
        )}
        <MenuSlotPlaceholder
          position="bottom"
          currentMenuId={bottomMenuId ?? null}
          contentType="page"
          slug={slug}
          locale={locale}
          onMenuChange={() => refetch()}
        />
      </div>
    </div>
  );
}
