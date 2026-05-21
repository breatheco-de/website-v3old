import { deslugify } from "../utils/debugHelpers";
import { IconArrowLeft, IconGitBranch, IconRefresh, IconExternalLink } from "@tabler/icons-react";
import type { MenuView, ContentInfo, VersioningResponse } from "../types";

interface VersioningViewProps {
  setMenuView: (v: MenuView) => void;
  contentInfo: ContentInfo;
  versioningLoading: boolean;
  versioningData: VersioningResponse | null;
  handleLinkClick: (e: React.MouseEvent) => void;
}

function buildPreviewUrl(contentInfo: ContentInfo, locale: string, variantSlug: string): string {
  const { type, slug } = contentInfo;
  if (!type || !slug) return "#";
  let basePath = "";
  if (type === "program") basePath = `/${locale}/career-programs/${slug}`;
  else if (type === "location") basePath = `/${locale}/location/${slug}`;
  else if (type === "landing") basePath = `/landing/${slug}`;
  else basePath = `/${locale}/${slug}`;
  return `${basePath}?force_variant=${encodeURIComponent(variantSlug)}`;
}

export function VersioningView({
  setMenuView,
  contentInfo,
  versioningLoading,
  versioningData,
  handleLinkClick,
}: VersioningViewProps) {
  const locales = versioningData?.versioning ? Object.keys(versioningData.versioning) : [];

  return (
    <>
      <div className="px-3 py-2 border-b">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuView("main")}
            className="p-1 rounded-md hover-elevate"
            data-testid="button-back-to-main-versioning"
          >
            <IconArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h3 className="font-semibold text-sm">Versions</h3>
            <p className="text-xs text-muted-foreground">
              {contentInfo.label}: {contentInfo.slug}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto overflow-x-hidden max-h-[280px]">
        <div className="p-2 space-y-1">
          {versioningLoading ? (
            <div className="flex items-center justify-center py-8">
              <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !versioningData?.hasVersioningFile ? (
            <div className="text-center py-8 px-4">
              <IconGitBranch className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">No versioning file found</p>
              <p className="text-xs text-muted-foreground">
                Create <code className="bg-muted px-1 rounded">versioning.yml</code> in the content folder
              </p>
            </div>
          ) : locales.length === 0 ? (
            <div className="text-center py-8 px-4">
              <IconGitBranch className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No variants defined</p>
            </div>
          ) : (
            <>
              <a
                href={`/private/${contentInfo.type}/${contentInfo.slug}/versions`}
                onClick={handleLinkClick}
                className="flex items-center w-full px-3 py-2 rounded-md text-sm hover-elevate cursor-pointer gap-2"
                data-testid="link-open-version-editor"
              >
                <IconGitBranch className="h-4 w-4 text-muted-foreground" />
                <span>Open Version Editor</span>
              </a>
              <div className="border-t my-1" />
              {locales.map((locale) => {
                const localeData = versioningData!.versioning![locale];
                return (
                  <div key={locale} className="px-3 py-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {locale.toUpperCase()}
                    </p>
                    <div className="space-y-1">
                      {localeData.variants.map((variant) => {
                        const previewUrl = buildPreviewUrl(contentInfo, locale, variant.slug);
                        return (
                          <div
                            key={variant.slug}
                            className="flex items-center justify-between text-sm gap-2"
                          >
                            <span className="truncate">{deslugify(variant.slug)}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                                {variant.allocation}%
                              </span>
                              <a
                                href={previewUrl}
                                onClick={handleLinkClick}
                                title={`Force preview: ${variant.slug}`}
                                className="p-0.5 rounded hover-elevate text-muted-foreground"
                                data-testid={`link-force-variant-${locale}-${variant.slug}`}
                              >
                                <IconExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </>
  );
}
