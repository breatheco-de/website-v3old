import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearch } from "wouter";
import { SectionRenderer } from "@/components/SectionRenderer";
import type { CareerProgram, LandingPage, LocationPage, TemplatePage } from "@shared/schema";
import { IconLoader2, IconAlertTriangle, IconArrowLeft } from "@tabler/icons-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useSchemaOrg } from "@/hooks/useSchemaOrg";
import { useContentAutoRefresh } from "@/hooks/useContentAutoRefresh";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

type ContentType = "programs" | "landings" | "locations" | "pages";
type ContentData = CareerProgram | LandingPage | LocationPage | TemplatePage;

const contentTypeConfig: Record<ContentType, { 
  apiPath: string; 
  singular: string;
  label: string;
}> = {
  programs: { apiPath: "career-programs", singular: "program", label: "Program" },
  landings: { apiPath: "landings", singular: "landing", label: "Landing" },
  locations: { apiPath: "locations", singular: "location", label: "Location" },
  pages: { apiPath: "pages", singular: "page", label: "Page" },
};

export default function PrivatePreview() {
  const params = useParams<{ contentType: string; slug: string }>();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  
  const contentType = params.contentType as ContentType;
  const slug = params.slug;
  const variant = searchParams.get("variant");
  const version = searchParams.get("version");
  const locale = searchParams.get("locale") || "en";
  
  const config = contentTypeConfig[contentType];
  const isValidContentType = !!config;

  const { data: content, isLoading, error, refetch } = useQuery<ContentData>({
    queryKey: ["/api/preview", contentType, slug, variant, version, locale],
    queryFn: async () => {
      let url = `/api/${config.apiPath}/${slug}?locale=${locale}`;
      if (variant) url += `&force_variant=${variant}`;
      if (version) url += `&force_version=${version}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Content not found");
      }
      return response.json();
    },
    enabled: !!slug && isValidContentType,
  });

  usePageMeta(content?.meta);
  useSchemaOrg(content?.schema);

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  useContentAutoRefresh(
    config?.singular as "program" | "landing" | "location" | "page",
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
            Valid types: programs, landings, locations, pages
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
      <div className="min-h-screen flex items-center justify-center" data-testid="error-preview">
        <div className="text-center">
          <IconAlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {config.label} not found
          </h1>
          <p className="text-muted-foreground mb-4">
            Could not load the requested content variant.
          </p>
          <Button variant="outline" onClick={() => window.history.back()}>
            <IconArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const showHeader = contentType === "programs" || contentType === "locations" || contentType === "pages";

  return (
    <div data-testid={`preview-${contentType}-${slug}`}>
      {showHeader && <Header />}
      <SectionRenderer 
        sections={content.sections} 
        contentType={config.singular as "program" | "landing" | "location" | "page"}
        slug={slug}
        locale={locale}
      />
    </div>
  );
}
