import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useMemo } from "react";
import NotFound from "@/pages/not-found";
import { DebugBubble } from "@/components/DebugBubble";
import { VariableModalHost } from "@/components/editing/VariableHighlight";
import { SessionProvider } from "@/contexts/SessionContext";
import { EditModeWrapper } from "@/components/editing/EditModeWrapper";
import { DebugAuthProvider } from "@/hooks/useDebugAuth";
import { usePageTracking } from "@/hooks/usePageTracking";
import type { ContentTypeApiItem } from "@/hooks/useContentTypes";
import "./i18n";

import ContentTypeDetail from "@/pages/ContentTypeDetail";
import LandingDetail from "@/pages/LandingDetail";
import TemplatePage from "@/pages/page";
import HomePage from "@/pages/HomePage";

const PreviewFrame = lazy(() => import("@/pages/PreviewFrame"));
const PrivateRouter = lazy(() => import("@/pages/PrivateRouter"));
const ApplyPage = lazy(() => import("@/pages/ApplyPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const DatabaseSinglePage = lazy(() => import("@/pages/DatabaseSinglePage"));

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
          role="status"
        >
          <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
            Loading...
          </span>
        </div>
      </div>
    </div>
  );
}

const STATIC_ROUTE_TYPES = new Set(["page", "landing", "program", "location", "blog"]);

function useDynamicRoutes() {
  const { data: contentTypes } = useQuery<ContentTypeApiItem[]>({
    queryKey: ["/api/content-types"],
    staleTime: Infinity,
  });

  return useMemo(() => {
    if (!contentTypes) return [];

    const routes: Array<{
      path: string;
      type: string;
      locale: string;
      urlPattern: Record<string, string>;
      isDb: boolean;
      slugParam: string;
      isListingPrefix: boolean;
    }> = [];

    for (const ct of contentTypes) {
      if (STATIC_ROUTE_TYPES.has(ct.name)) continue;

      for (const [locale, pattern] of Object.entries(ct.url_pattern)) {
        if (locale === "default") continue;

        const slugParam = "slug";

        if (ct.has_database) {
          const listingPrefix = pattern.replace(/\/:[^/]+.*$/, "");
          if (listingPrefix && listingPrefix !== pattern) {
            routes.push({
              path: listingPrefix,
              type: ct.name,
              locale,
              urlPattern: ct.url_pattern,
              isDb: true,
              slugParam,
              isListingPrefix: true,
            });
          }
          routes.push({
            path: pattern.replace(":slug", "*"),
            type: ct.name,
            locale,
            urlPattern: ct.url_pattern,
            isDb: true,
            slugParam,
            isListingPrefix: false,
          });
        } else {
          routes.push({
            path: pattern,
            type: ct.name,
            locale,
            urlPattern: ct.url_pattern,
            isDb: false,
            slugParam,
            isListingPrefix: false,
          });
        }
      }
    }

    return routes;
  }, [contentTypes]);
}

function Router() {
  const dynamicRoutes = useDynamicRoutes();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/en/" component={HomePage} />
        <Route path="/es/" component={HomePage} />
        <Route path="/en/landing/:slug" component={LandingDetail} />
        <Route path="/es/landing/:slug" component={LandingDetail} />
        <Route path="/landing/:slug" component={LandingDetail} />
        <Route path="/en/career-programs/:slug">
          {(params) => <ContentTypeDetail type="program" slug={params.slug} locale="en" />}
        </Route>
        <Route path="/es/programas-de-carrera/:slug">
          {(params) => <ContentTypeDetail type="program" slug={params.slug} locale="es" />}
        </Route>
        <Route path="/en/location/:slug">
          {(params) => <ContentTypeDetail type="location" slug={params.slug} locale="en" />}
        </Route>
        <Route path="/es/ubicacion/:slug">
          {(params) => <ContentTypeDetail type="location" slug={params.slug} locale="es" />}
        </Route>
        <Route path="/en/blog">
          {() => <TemplatePage />}
        </Route>
        <Route path="/es/blog">
          {() => <TemplatePage />}
        </Route>
        <Route path="/en/blog/*">
          {() => <DatabaseSinglePage contentType="blog" />}
        </Route>
        <Route path="/es/blog/*">
          {() => <DatabaseSinglePage contentType="blog" />}
        </Route>
        {dynamicRoutes.map((r) => {
          if (r.isDb && r.isListingPrefix) {
            return (
              <Route key={`listing-${r.type}-${r.locale}`} path={r.path}>
                {() => <TemplatePage />}
              </Route>
            );
          }
          if (r.isDb) {
            return (
              <Route key={`db-${r.type}-${r.locale}`} path={r.path}>
                {() => <DatabaseSinglePage contentType={r.type} />}
              </Route>
            );
          }
          return (
            <Route key={`ct-${r.type}-${r.locale}`} path={r.path}>
              {(params) => (
                <ContentTypeDetail
                  type={r.type}
                  slug={params.slug || ""}
                  locale={r.locale}
                  urlPattern={r.urlPattern}
                />
              )}
            </Route>
          );
        })}
        <Route path="/preview-frame" component={PreviewFrame} />
        <Route path="/private/*" component={PrivateRouter} />
        <Route path="/en/apply" component={ApplyPage} />
        <Route path="/es/aplica" component={ApplyPage} />
        <Route path="/terms-conditions" component={TermsPage} />
        <Route path="/terminos-condiciones" component={TermsPage} />
        <Route path="/privacy-policy" component={PrivacyPage} />
        <Route path="/politica-privacidad" component={PrivacyPage} />
        <Route path="/en/:slug" component={TemplatePage} />
        <Route path="/es/:slug" component={TemplatePage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function PageTracker() {
  usePageTracking();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <DebugAuthProvider>
        <TooltipProvider>
          <EditModeWrapper>
            <Toaster />
            <PageTracker />
            <Router />
            <DebugBubble />
            <VariableModalHost />
          </EditModeWrapper>
        </TooltipProvider>
        </DebugAuthProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

export default App;
