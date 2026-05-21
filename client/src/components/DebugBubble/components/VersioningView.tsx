import { useState } from "react";
import { deslugify } from "../utils/debugHelpers";
import { IconArrowLeft, IconGitBranch, IconRefresh, IconPencil, IconCheck, IconX, IconPlayerPlay, IconPlus } from "@tabler/icons-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getDebugToken } from "@/hooks/useDebugAuth";
import type { MenuView, ContentInfo, VersioningResponse } from "../types";
import { STORAGE_KEY, OPEN_STORAGE_KEY } from "../types";

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

  const activeVariant = new URLSearchParams(window.location.search).get("force_variant") ?? null;

  const [editingLocale, setEditingLocale] = useState<string | null>(null);
  const [tempAllocations, setTempAllocations] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [createVersionOpen, setCreateVersionOpen] = useState(false);
  const [createVersionSlug, setCreateVersionSlug] = useState("");
  const [createVersionLocale, setCreateVersionLocale] = useState(locales[0] ?? "en");
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);

  const [promoteTarget, setPromoteTarget] = useState<{ locale: string; slug: string } | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);

  const isPreview = pathname.startsWith("/private/preview/");

  const persistOpenStateForNavigation = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(OPEN_STORAGE_KEY, "true");
      sessionStorage.setItem(STORAGE_KEY, "versioning");
    }
  };

  const handleSwitchVariant = (locale: string, variantSlug: string) => {
    persistOpenStateForNavigation();
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

  const handleEditVariant = (locale: string, variantSlug: string) => {
    const { type, slug } = contentInfo;
    if (!type || !slug) return;
    persistOpenStateForNavigation();
    navigate(
      `/private/preview/${type}/${slug}?force_variant=${encodeURIComponent(variantSlug)}&locale=${locale}`
    );
  };

  const handleSwitchToDefault = (locale: string) => {
    persistOpenStateForNavigation();
    if (isPreview && contentInfo.type && contentInfo.slug) {
      navigate(`/private/preview/${contentInfo.type}/${contentInfo.slug}?locale=${locale}`);
    } else {
      const { type, slug } = contentInfo;
      if (!type || !slug) return;
      let basePath = "";
      if (type === "program") basePath = `/${locale}/career-programs/${slug}`;
      else if (type === "location") basePath = `/${locale}/location/${slug}`;
      else if (type === "landing") basePath = `/landing/${slug}`;
      else basePath = `/${locale}/${slug}`;
      window.location.href = basePath;
    }
  };

  const handleEditDefault = (locale: string) => {
    const { type, slug } = contentInfo;
    if (!type || !slug) return;
    persistOpenStateForNavigation();
    navigate(`/private/preview/${type}/${slug}?locale=${locale}`);
  };

  const handleCreateVersion = async () => {
    const { type, slug } = contentInfo;
    if (!type || !slug || !createVersionSlug) return;
    setIsCreatingVersion(true);
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Token ${token}`;
      const res = await fetch(`/api/versioning/${type}/${slug}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ variantSlug: createVersionSlug, locale: createVersionLocale }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Failed to create version", variant: "destructive" });
        return;
      }
      toast({ title: `Version "${createVersionSlug}" created` });
      setCreateVersionOpen(false);
      setCreateVersionSlug("");
      if (onVersioningDataUpdate) {
        fetch(`/api/versioning/${type}/${slug}`)
          .then((r) => r.json())
          .then(onVersioningDataUpdate)
          .catch(() => {});
      }
      persistOpenStateForNavigation();
      navigate(`/private/preview/${type}/${slug}?force_variant=${encodeURIComponent(createVersionSlug)}&locale=${createVersionLocale}`);
    } catch {
      toast({ title: "Failed to create version", variant: "destructive" });
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const handlePromote = async () => {
    if (!promoteTarget || !contentInfo.type || !contentInfo.slug) return;
    setIsPromoting(true);
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Token ${token}`;
      const res = await fetch(
        `/api/versioning/${contentInfo.type}/${contentInfo.slug}/${promoteTarget.locale}/promote/${promoteTarget.slug}`,
        { method: "POST", headers }
      );
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Failed to promote variant", variant: "destructive" });
        return;
      }
      toast({ title: `Variant "${promoteTarget.slug}" promoted to default` });
      setPromoteTarget(null);
      if (onVersioningDataUpdate) {
        fetch(`/api/versioning/${contentInfo.type}/${contentInfo.slug}`)
          .then((r) => r.json())
          .then(onVersioningDataUpdate)
          .catch(() => {});
      }
    } catch {
      toast({ title: "Failed to promote variant", variant: "destructive" });
    } finally {
      setIsPromoting(false);
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
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Versions</h3>
            <p className="text-xs text-muted-foreground truncate">
              {contentInfo.label}: {contentInfo.slug}
            </p>
          </div>
          {versioningData?.hasVersioningFile && (
            <Button
              size="sm"
              variant="outline"
              className="flex-shrink-0 h-7 gap-1 text-xs"
              onClick={() => {
                setCreateVersionLocale(locales[0] ?? "en");
                setCreateVersionSlug("");
                setCreateVersionOpen(true);
              }}
              data-testid="button-new-version"
            >
              <IconPlus className="h-3 w-3" />
              New
            </Button>
          )}
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
                    {/* Synthetic default row */}
                    {(() => {
                      const variantTotal = localeData.variants.reduce((sum, v) => sum + v.allocation, 0);
                      const defaultAllocation = Math.max(0, 100 - variantTotal);
                      const isDefaultActive = activeVariant === null;
                      return (
                        <div key="__default__" className={isDefaultActive ? "rounded-md bg-primary/10 px-2 py-1 -mx-2" : ""}>
                          <div className="flex items-center justify-between text-sm gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {isDefaultActive && (
                                <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" data-testid={`dot-active-variant-${locale}-default`} />
                              )}
                              <button
                                onClick={() => handleEditDefault(locale)}
                                title="Edit default version"
                                className={`truncate text-left hover:underline ${isDefaultActive ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                data-testid={`button-edit-variant-${locale}-default`}
                              >
                                Default
                              </button>
                              {isDefaultActive && (
                                <Badge variant="default" className="text-[10px] px-1.5 py-0 leading-4 flex-shrink-0" data-testid={`badge-active-variant-${locale}`}>
                                  active
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {!isEditing && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                                  {defaultAllocation}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {localeData.variants.map((variant) => {
                      const isActive = activeVariant === variant.slug;
                      return (
                      <div key={variant.slug} className={isActive ? "rounded-md bg-primary/10 px-2 py-1 -mx-2" : ""}>
                        <div className="flex items-center justify-between text-sm gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isActive && (
                              <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" data-testid={`dot-active-variant-${locale}-${variant.slug}`} />
                            )}
                            <button
                              onClick={() => handleEditVariant(locale, variant.slug)}
                              title={`Edit variant: ${variant.slug}`}
                              className={`truncate text-left hover:underline ${isActive ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                              data-testid={`button-edit-variant-${locale}-${variant.slug}`}
                            >
                              {deslugify(variant.slug)}
                            </button>
                            {isActive && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0 leading-4 flex-shrink-0" data-testid={`badge-active-variant-${locale}`}>
                                active
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {!isEditing && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                                {variant.allocation}%
                              </span>
                            )}
                            {!isEditing && (
                              <button
                                onClick={() => setPromoteTarget({ locale, slug: variant.slug })}
                                className="text-[10px] text-muted-foreground hover:text-foreground hover:underline px-1"
                                data-testid={`button-promote-variant-${locale}-${variant.slug}`}
                              >
                                Promote
                              </button>
                            )}
                          </div>
                        </div>
                        {isEditing && (() => {
                          const thisValue = tempAllocations[variant.slug] ?? variant.allocation;
                          const othersTotal = localeData.variants.reduce((sum, v) => {
                            if (v.slug === variant.slug) return sum;
                            return sum + (tempAllocations[v.slug] ?? v.allocation);
                          }, 0);
                          const maxAllowed = Math.min(100, 100 - othersTotal);
                          return (
                            <div className="mt-1.5 flex items-center gap-2">
                              <Slider
                                value={[thisValue]}
                                min={0}
                                max={maxAllowed}
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
                                {thisValue}%
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={createVersionOpen} onOpenChange={(open) => {
        setCreateVersionOpen(open);
        if (!open) setCreateVersionSlug("");
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Version</DialogTitle>
            <DialogDescription>
              A version is a copy of this page's content that can be A/B tested against the original.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Locale</label>
              <Select value={createVersionLocale} onValueChange={setCreateVersionLocale}>
                <SelectTrigger data-testid="select-version-locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locales.map((loc) => (
                    <SelectItem key={loc} value={loc}>{loc.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Version name</label>
              <Input
                placeholder="e.g. colorful, dark-hero, new-cta"
                value={createVersionSlug}
                onChange={(e) => setCreateVersionSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                data-testid="input-version-slug"
              />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only.</p>
            </div>
            {createVersionSlug && contentInfo.slug && (
              <div className="rounded-md bg-muted px-3 py-2 space-y-0.5">
                <p className="text-xs font-medium">File that will be created:</p>
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {contentInfo.slug}/{createVersionSlug}.{createVersionLocale}.yml
                </p>
              </div>
            )}
            <div className="rounded-md bg-muted px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Starts with <strong>0% traffic allocation</strong> — no real visitors will see it until you allocate traffic. You can preview it anytime using <code className="text-xs">?force_variant=</code>.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateVersionOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateVersion}
              disabled={!createVersionSlug || isCreatingVersion}
              data-testid="button-confirm-create-version"
            >
              {isCreatingVersion && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={promoteTarget !== null} onOpenChange={(open) => { if (!open) setPromoteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Are you sure you want to promote this variant?</DialogTitle>
            <DialogDescription>
              This action will remove the default current page and replace it with this{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{promoteTarget?.slug}</code>{" "}
              variant and 100% of the traffic will now be directed to this by default.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPromoteTarget(null)}
              disabled={isPromoting}
              data-testid="button-cancel-promote"
            >
              No, keep it as a secondary variant
            </Button>
            <Button
              variant="destructive"
              onClick={handlePromote}
              disabled={isPromoting}
              data-testid="button-confirm-promote"
            >
              {isPromoting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Yes, remove and replace original
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
