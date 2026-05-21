import { useState } from "react";
import { deslugify } from "../utils/debugHelpers";
import { IconArrowLeft, IconGitBranch, IconRefresh, IconPencil, IconCheck, IconX, IconPlayerPlay } from "@tabler/icons-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getDebugToken } from "@/hooks/useDebugAuth";
import type { MenuView, ContentInfo, VersioningResponse } from "../types";

interface VersioningViewProps {
  setMenuView: (v: MenuView) => void;
  contentInfo: ContentInfo;
  versioningLoading: boolean;
  versioningData: VersioningResponse | null;
  navigate: (path: string) => void;
  pathname: string;
  onVersioningDataUpdate?: (data: VersioningResponse) => void;
}

export function VersioningView({
  setMenuView,
  contentInfo,
  versioningLoading,
  versioningData,
  navigate,
  pathname,
  onVersioningDataUpdate,
}: VersioningViewProps) {
  const { toast } = useToast();
  const locales = versioningData?.versioning ? Object.keys(versioningData.versioning) : [];

  const [editingLocale, setEditingLocale] = useState<string | null>(null);
  const [tempAllocations, setTempAllocations] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  const isPreview = pathname.startsWith("/private/preview/");

  const handleSwitchVariant = (locale: string, variantSlug: string) => {
    if (isPreview && contentInfo.type && contentInfo.slug) {
      navigate(
        `/private/preview/${contentInfo.type}/${contentInfo.slug}?force_variant=${encodeURIComponent(variantSlug)}&locale=${locale}`
      );
    } else {
      const { type, slug } = contentInfo;
      if (!type || !slug) return;
      let basePath = "";
      if (type === "program") basePath = `/${locale}/career-programs/${slug}`;
      else if (type === "location") basePath = `/${locale}/location/${slug}`;
      else if (type === "landing") basePath = `/landing/${slug}`;
      else basePath = `/${locale}/${slug}`;
      window.location.href = `${basePath}?force_variant=${encodeURIComponent(variantSlug)}`;
    }
  };

  const openEditAllocations = (locale: string) => {
    const localeData = versioningData?.versioning?.[locale];
    if (!localeData) return;
    const allocations: Record<string, number> = {};
    localeData.variants.forEach((v) => {
      allocations[v.slug] = v.allocation;
    });
    setTempAllocations(allocations);
    setEditingLocale(locale);
  };

  const cancelEdit = () => {
    setEditingLocale(null);
    setTempAllocations({});
  };

  const handleSaveAllocations = async () => {
    if (!editingLocale || !contentInfo.type || !contentInfo.slug) return;
    const localeData = versioningData?.versioning?.[editingLocale];
    if (!localeData) return;

    setIsSaving(true);
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Token ${token}`;

      const variants = localeData.variants.map((v) => ({
        slug: v.slug,
        allocation: tempAllocations[v.slug] ?? v.allocation,
      }));

      const res = await fetch(
        `/api/versioning/${contentInfo.type}/${contentInfo.slug}/${editingLocale}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ variants }),
        }
      );

      if (!res.ok) throw new Error("Failed to save allocations");

      const updated = await fetch(
        `/api/versioning/${contentInfo.type}/${contentInfo.slug}`
      ).then((r) => r.json());

      if (onVersioningDataUpdate) onVersioningDataUpdate(updated);

      toast({ title: "Allocations saved", description: "Traffic split updated." });
      setEditingLocale(null);
      setTempAllocations({});
    } catch {
      toast({
        title: "Failed to save",
        description: "Could not update traffic allocation.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalTemp = Object.values(tempAllocations).reduce((s, v) => s + v, 0);

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

      <div className="overflow-y-auto overflow-x-hidden max-h-[380px]">
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
            locales.map((locale) => {
              const localeData = versioningData!.versioning![locale];
              const isEditing = editingLocale === locale;
              return (
                <div key={locale} className="px-2 py-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {locale.toUpperCase()}
                    </p>
                    {!isEditing ? (
                      <button
                        onClick={() => openEditAllocations(locale)}
                        className="p-1 rounded-md hover-elevate text-muted-foreground"
                        title="Edit traffic allocation"
                        data-testid={`button-edit-allocations-${locale}`}
                      >
                        <IconPencil className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={totalTemp === 100 ? "default" : "destructive"}
                          className="text-xs"
                          data-testid="badge-total-allocation"
                        >
                          {totalTemp}%
                        </Badge>
                        <button
                          onClick={handleSaveAllocations}
                          disabled={isSaving}
                          className="p-1 rounded-md hover-elevate text-muted-foreground"
                          title="Save allocations"
                          data-testid={`button-save-allocations-${locale}`}
                        >
                          {isSaving ? (
                            <IconRefresh className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <IconCheck className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1 rounded-md hover-elevate text-muted-foreground"
                          title="Cancel"
                          data-testid={`button-cancel-allocations-${locale}`}
                        >
                          <IconX className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {localeData.variants.map((variant) => (
                      <div key={variant.slug}>
                        <div className="flex items-center justify-between text-sm gap-2">
                          <span className="truncate">{deslugify(variant.slug)}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {!isEditing && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                                {variant.allocation}%
                              </span>
                            )}
                            <button
                              onClick={() => handleSwitchVariant(locale, variant.slug)}
                              title={`Switch to: ${variant.slug}`}
                              className="p-0.5 rounded hover-elevate text-muted-foreground"
                              data-testid={`button-switch-variant-${locale}-${variant.slug}`}
                            >
                              <IconPlayerPlay className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        {isEditing && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <Slider
                              value={[tempAllocations[variant.slug] ?? variant.allocation]}
                              min={0}
                              max={100}
                              step={1}
                              onValueChange={([value]) =>
                                setTempAllocations((prev) => ({
                                  ...prev,
                                  [variant.slug]: value,
                                }))
                              }
                              className="flex-1"
                              data-testid={`slider-allocation-${locale}-${variant.slug}`}
                            />
                            <span className="text-xs font-medium tabular-nums w-8 text-right">
                              {tempAllocations[variant.slug] ?? variant.allocation}%
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
