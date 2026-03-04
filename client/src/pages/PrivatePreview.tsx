import { useCallback, useState, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearch } from "wouter";
import { SectionRenderer } from "@/components/SectionRenderer";
import { apiFetch } from "@/lib/queryClient";
import { normalizeContentType } from "@/hooks/useContentTypes";
import type { CareerProgram, LandingPage, LocationPage, TemplatePage } from "@shared/schema";
import { IconLoader2, IconAlertTriangle, IconArrowLeft, IconCode } from "@tabler/icons-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useSchemaOrg } from "@/hooks/useSchemaOrg";
import { useContentAutoRefresh } from "@/hooks/useContentAutoRefresh";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import LazyRender from "@/components/LazyRender";
import MenuSlotPlaceholder from "@/components/editing/MenuSlotPlaceholder";

const RawFileEditorPanel = lazy(() => import("@/components/editing/RawFileEditorPanel"));

type ContentData = CareerProgram | LandingPage | LocationPage | TemplatePage;

const contentTypeConfig: Record<string, { 
  apiPath: string; 
  singular: string;
  label: string;
}> = {
  program: { apiPath: "career-programs", singular: "program", label: "Program" },
  landing: { apiPath: "landings", singular: "landing", label: "Landing" },
  location: { apiPath: "locations", singular: "location", label: "Location" },
  page: { apiPath: "pages", singular: "page", label: "Page" },
};

export default function PrivatePreview() {
  const params = useParams<{ contentType: string; slug: string }>();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  
  const contentType = params.contentType!;
  const slug = params.slug;
  const variant = searchParams.get("variant");
  const version = searchParams.get("version");
  const locale = searchParams.get("locale") || "en";
  
  const normalizedType = normalizeContentType(contentType);
  const config = contentTypeConfig[normalizedType];
  const isValidContentType = !!config;

  const [showRawEditor, setShowRawEditor] = useState(false);

  const { data: content, isLoading, error, refetch } = useQuery<ContentData>({
    queryKey: ["/api/preview", contentType, slug, variant, version, locale],
    queryFn: async () => {
      let url = `/api/${config.apiPath}/${slug}?locale=${locale}`;
      if (variant) url += `&force_variant=${variant}`;
      if (version) url += `&force_version=${version}`;
      const response = await apiFetch(url);
      if (!response.ok) {
        throw new Error("Content not found");
      }
      return response.json();
    },
    enabled: !!slug && isValidContentType,
  });

  const { data: rawFileCheck } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/content/raw-file", contentType, slug, locale],
    queryFn: async () => {
      const res = await fetch(`/api/content/raw-file?contentType=${contentType}&slug=${slug}&locale=${locale}`);
      if (!res.ok) return { exists: false };
      const data = await res.json();
      return { exists: !!data.exists };
    },
    enabled: !!slug && isValidContentType && (!!error || !content),
  });

  usePageMeta(content?.meta);
  useSchemaOrg(content?.schema);

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!content || isLoading) return;
    const hash = window.location.hash;
    if (!hash) return;
    const id = hash.slice(1);
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }, [content, isLoading]);

  useContentAutoRefresh(
    config?.singular || contentType,
    slug,
    locale,
    handleRefetch
  );

  if (!isValidContentType) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="error-invalid-type">
        <div className="text-center">
          <IconAlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Content Type</h1>
          <p className="text-muted-foreground mb-4">
            Content type "{contentType}" is not valid.
          </p>
          <p className="text-sm text-muted-foreground">
            Valid types: program, landing, location, page
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-preview">
        <div className="text-center">
          <IconLoader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Loading {config.label.toLowerCase()} preview...
          </p>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center" data-testid="error-preview">
          <div className="text-center">
            <IconAlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {config.label} not found
            </h1>
            <p className="text-muted-foreground mb-4">
              Could not load the requested content variant.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button variant="outline" onClick={() => window.history.back()} data-testid="button-go-back">
                <IconArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
              {rawFileCheck?.exists && (
                <Button variant="outline" onClick={() => setShowRawEditor(true)} data-testid="button-edit-yaml">
                  <IconCode className="w-4 h-4 mr-2" />
                  Edit YAML
                </Button>
              )}
            </div>
          </div>
        </div>
        {showRawEditor && (
          <Suspense fallback={null}>
            <RawFileEditorPanel
              contentType={contentType}
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

  const layoutData = (content as any).layout as { menu?: { top?: string | null; bottom?: string | null } } | undefined;
  const topMenuId = layoutData?.menu?.top ?? null;
  const bottomMenuId = layoutData?.menu?.bottom ?? null;

  return (
    <div data-testid={`preview-${contentType}-${slug}`}>
      <MenuSlotPlaceholder
        position="top"
        currentMenuId={topMenuId}
        contentType={normalizedType}
        slug={slug!}
        onMenuChange={() => refetch()}
      />
      {topMenuId && <Header menuId={topMenuId} />}
      <SectionRenderer 
        sections={content.sections} 
        contentType={config.singular}
        slug={slug}
        locale={locale}
        singleEntry={(content as any).singleEntry}
      />
      {bottomMenuId && (
        <LazyRender>
          <div className="pb-12">
            <Footer menuId={bottomMenuId} />
          </div>
        </LazyRender>
      )}
      <MenuSlotPlaceholder
        position="bottom"
        currentMenuId={bottomMenuId}
        contentType={normalizedType}
        slug={slug!}
        onMenuChange={() => refetch()}
      />
    </div>
  );
}
