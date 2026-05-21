import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getDebugToken } from "@/hooks/useDebugAuth";
import { normalizeContentType } from "@/hooks/useContentTypes";
import { IconArrowLeft, IconGitBranch, IconPencil, IconRefresh } from "@tabler/icons-react";

interface VersioningVariant {
  slug: string;
  allocation: number;
}

interface VersioningLocale {
  variants: VersioningVariant[];
}

interface VersioningResponse {
  versioning: Record<string, VersioningLocale> | null;
  hasVersioningFile: boolean;
  filePath: string;
}

function deslugify(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function VersionEditor() {
  const { contentType, contentSlug } = useParams<{
    contentType: string;
    contentSlug: string;
  }>();
  const normalizedType = normalizeContentType(contentType || "");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [tempAllocations, setTempAllocations] = useState<
    Record<string, number>
  >({});

  const { data, isLoading, error } = useQuery<VersioningResponse>({
    queryKey: ["/api/versioning", contentType, contentSlug],
    enabled: !!contentType && !!contentSlug,
  });

  const locales = data?.versioning ? Object.keys(data.versioning) : [];

  const activeLocale = useMemo(() => {
    if (selectedLocale && locales.includes(selectedLocale)) return selectedLocale;
    return locales[0] || null;
  }, [selectedLocale, locales]);

  const activeVariants = useMemo(() => {
    if (!activeLocale || !data?.versioning) return [];
    return data.versioning[activeLocale]?.variants || [];
  }, [activeLocale, data]);

  const currentVariant = useMemo(() => {
    if (selectedVariant && activeVariants.find((v) => v.slug === selectedVariant))
      return selectedVariant;
    return activeVariants[0]?.slug || null;
  }, [selectedVariant, activeVariants]);

  const updateMutation = useMutation({
    mutationFn: async ({
      locale,
      variants,
    }: {
      locale: string;
      variants: VersioningVariant[];
    }) => {
      return apiRequest(
        "PATCH",
        `/api/versioning/${contentType}/${contentSlug}/${locale}`,
        { variants }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/versioning", contentType, contentSlug],
      });
      toast({
        title: "Versions updated",
        description: "Allocation changes have been saved.",
      });
    },
    onError: (err) => {
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const backUrl = useMemo(() => {
    if (normalizedType === "program") return `/en/career-programs/${contentSlug}`;
    if (normalizedType === "location") return `/en/location/${contentSlug}`;
    if (normalizedType === "landing") return `/landing/${contentSlug}`;
    return `/en/${contentSlug}`;
  }, [normalizedType, contentSlug]);

  const openAllocationDialog = () => {
    const allocations: Record<string, number> = {};
    activeVariants.forEach((v) => {
      allocations[v.slug] = v.allocation;
    });
    setTempAllocations(allocations);
    setAllocationDialogOpen(true);
  };

  const saveAllocations = () => {
    if (!activeLocale) return;
    const variants = activeVariants.map((v) => ({
      slug: v.slug,
      allocation: tempAllocations[v.slug] ?? v.allocation,
    }));
    updateMutation.mutate({ locale: activeLocale, variants });
    setAllocationDialogOpen(false);
  };

  const totalAllocation = Object.values(tempAllocations).reduce(
    (sum, v) => sum + v,
    0
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <IconRefresh className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.hasVersioningFile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <IconGitBranch className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">No versioning file found</h1>
        <p className="text-muted-foreground">
          Create <code>versioning.yml</code> in the{" "}
          {contentType}/{contentSlug} folder to get started.
        </p>
        <Button onClick={() => navigate(backUrl)} variant="outline">
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(backUrl)}
              data-testid="button-back"
            >
              <IconArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 min-w-0">
              <IconGitBranch className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <h1
                  className="font-semibold text-sm truncate"
                  data-testid="text-version-editor-title"
                >
                  Versions
                </h1>
                <p className="text-xs text-muted-foreground truncate">
                  {deslugify(contentType || "")} /{" "}
                  {deslugify(contentSlug || "")}
                </p>
              </div>
            </div>

            {/* Locale selector */}
            {locales.length > 1 && (
              <div className="flex items-center gap-1 border rounded-lg p-1">
                {locales.map((locale) => (
                  <Button
                    key={locale}
                    variant={activeLocale === locale ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setSelectedLocale(locale);
                      setSelectedVariant(null);
                    }}
                    data-testid={`button-locale-${locale}`}
                  >
                    {locale.toUpperCase()}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Variant switcher */}
            <div className="flex items-center gap-1 border rounded-lg p-1">
              {activeVariants.map((variant) => (
                <Button
                  key={variant.slug}
                  variant={currentVariant === variant.slug ? "default" : "ghost"}
                  size="sm"
                  className="gap-2"
                  onClick={() => setSelectedVariant(variant.slug)}
                  data-testid={`button-variant-${variant.slug}`}
                >
                  {deslugify(variant.slug)}
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                      currentVariant === variant.slug
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {variant.allocation}%
                  </span>
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={openAllocationDialog}
              data-testid="button-edit-allocations"
            >
              <IconPencil className="h-4 w-4 mr-1" />
              Allocations
            </Button>
          </div>
        </div>
      </header>

      {/* Preview iframes */}
      <div className="flex-1 overflow-hidden relative">
        {activeVariants.map((variant) => {
          const token = getDebugToken();
          const locale = activeLocale || "en";
          let basePath = "";
          if (normalizedType === "program") {
            basePath = `/${locale}/career-programs/${contentSlug}`;
          } else if (normalizedType === "landing") {
            basePath = `/landing/${contentSlug}`;
          } else if (normalizedType === "location") {
            basePath = `/${locale}/location/${contentSlug}`;
          } else if (normalizedType === "page") {
            basePath = `/${locale}/${contentSlug}`;
          }
          const baseUrl = `${basePath}?force_variant=${variant.slug}&navbar=false&debug=true&edit_mode=true`;
          const iframeSrc = token
            ? `${baseUrl}&token=${encodeURIComponent(token)}`
            : baseUrl;
          return (
            <iframe
              key={variant.slug}
              src={iframeSrc}
              className={`absolute inset-0 w-full h-full border-0 transition-opacity duration-150 ${
                currentVariant === variant.slug
                  ? "opacity-100 z-10"
                  : "opacity-0 z-0 pointer-events-none"
              }`}
              title={`Preview: ${deslugify(variant.slug)}`}
              data-testid={`iframe-preview-${variant.slug}`}
            />
          );
        })}
        {!currentVariant && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a variant to preview
          </div>
        )}
      </div>

      {/* Allocation dialog */}
      <Dialog open={allocationDialogOpen} onOpenChange={setAllocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Traffic Allocation</DialogTitle>
            <DialogDescription>
              Adjust how traffic is split between variants. 0% = hidden
              (draft), 100% = all traffic (live).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {activeVariants.map((variant) => (
              <div key={variant.slug} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{deslugify(variant.slug)}</Label>
                  <span className="text-sm font-medium tabular-nums">
                    {tempAllocations[variant.slug] ?? variant.allocation}%
                  </span>
                </div>
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
                  data-testid={`slider-allocation-${variant.slug}`}
                />
              </div>
            ))}
            <div className="flex items-center justify-between text-sm border-t pt-3">
              <span className="text-muted-foreground">Total</span>
              <Badge
                variant={totalAllocation === 100 ? "default" : "destructive"}
                data-testid="badge-total-allocation"
              >
                {totalAllocation}%
              </Badge>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAllocationDialogOpen(false)}
              data-testid="button-cancel-allocations"
            >
              Cancel
            </Button>
            <Button
              onClick={saveAllocations}
              disabled={updateMutation.isPending}
              data-testid="button-save-allocations"
            >
              {updateMutation.isPending ? (
                <IconRefresh className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
