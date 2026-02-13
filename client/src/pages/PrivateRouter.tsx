import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";

const ComponentShowcase = lazy(() => import("@/pages/ComponentShowcase"));
const ComponentPreview = lazy(() => import("@/pages/ComponentPreview"));
const ExperimentEditor = lazy(() => import("@/pages/ExperimentEditor"));
const MediaGallery = lazy(() => import("@/pages/MediaGallery"));
const MenuEditor = lazy(() => import("@/pages/MenuEditor"));
const MoleculesShowcase = lazy(() => import("@/pages/MoleculesShowcase"));
const PrivatePreview = lazy(() => import("@/pages/PrivatePreview"));
const DiagnosticsPage = lazy(() => import("@/pages/DiagnosticsPage"));
const PrivateRedirects = lazy(() => import("@/pages/PrivateRedirects"));

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

export default function PrivateRouter() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        <Route path="/private/component-showcase" component={ComponentShowcase} />
        <Route path="/private/component-showcase/:componentType" component={ComponentShowcase} />
        <Route path="/private/component-showcase/:componentType/preview" component={ComponentPreview} />
        <Route path="/private/diagnostics" component={DiagnosticsPage} />
        <Route path="/private/redirects" component={PrivateRedirects} />
        <Route path="/private/media-gallery" component={MediaGallery} />
        <Route path="/private/menu-editor/:menuName" component={MenuEditor} />
        <Route path="/private/molecules-showcase" component={MoleculesShowcase} />
        <Route path="/private/preview/:contentType/:slug" component={PrivatePreview} />
        <Route path="/private/:contentType/:contentSlug/experiment/:experimentSlug" component={ExperimentEditor} />
      </Switch>
    </Suspense>
  );
}
