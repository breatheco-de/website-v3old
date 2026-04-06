import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ImageRef, ImageEntry, ImagePreset } from "@shared/schema";
import SolidCard from "./SolidCard";
import { useSectionContext } from "@/contexts/SectionContext";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import { Pencil } from "lucide-react";
import {
  IconSearch,
  IconUpload,
  IconCloudUpload,
  IconLoader2,
  IconCheck,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { editContent } from "@/lib/contentApi";
import { emitContentUpdated } from "@/lib/contentEvents";
import { useToast } from "@/hooks/use-toast";

interface ImageRegistryData {
  presets: Record<string, ImagePreset>;
  images: Record<string, ImageEntry>;
}

export function useImageRegistry() {
  const { data, isLoading } = useQuery<ImageRegistryData>({
    queryKey: ["/api/image-registry"],
    staleTime: Infinity,
  });

  return { registry: data ?? null, loading: isLoading };
}

interface FieldContext {
  fieldPath?: string;
  arrayPath?: string;
  index?: number;
  srcField?: string;
}

interface UniversalImageProps extends ImageRef {
  loading?: "lazy" | "eager";
  onLoad?: () => void;
  onError?: () => void;
  useSolidCard?: boolean;
  bordered?: boolean;
  style?: React.CSSProperties;
  fieldContext?: FieldContext;
}

const ASPECT_RATIOS: Record<string, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "1:1": 1,
  "21:9": 21 / 9,
};

function buildSrcsetString(srcset: Array<{ w: number; url: string }>): string {
  return srcset.map((s) => `${s.url} ${s.w}w`).join(", ");
}

export function UniversalImage({
  id,
  preset = "full",
  alt: altOverride,
  className = "",
  loading: loadingProp,
  onLoad,
  onError,
  useSolidCard = false,
  bordered = false,
  style,
  fieldContext,
}: UniversalImageProps) {
  const { registry, loading: registryLoading } = useImageRegistry();
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const { isPriority: isPrioritySection, sectionIndex, contentType: sectionContentType, slug: sectionSlug, locale: sectionLocale } = useSectionContext();
  const editModeCtx = useEditModeOptional();
  const isEditMode = editModeCtx?.isEditMode ?? false;
  const { toast } = useToast();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"browse" | "upload">("browse");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(48);
  const [selectedSrc, setSelectedSrc] = useState("");
  const [selectedAlt, setSelectedAlt] = useState("");
  const [selectedRegistryId, setSelectedRegistryId] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: mediaStatus } = useQuery<{
    defaultProvider: string;
    providers: string[];
    gcs?: { bucket: string; basePath: string };
  }>({
    queryKey: ["/api/media/status"],
    enabled: isEditMode,
    staleTime: 60000,
  });

  const hasCloudProvider = (mediaStatus?.providers ?? []).some((p) => p !== "local");

  const filteredImages = useMemo(() => {
    if (!registry?.images) return [];
    const searchLower = search.toLowerCase();
    return Object.entries(registry.images)
      .filter(([imgId, img]) => {
        if (!searchLower) return true;
        return (
          imgId.toLowerCase().includes(searchLower) ||
          img.alt?.toLowerCase().includes(searchLower) ||
          img.tags?.some((t) => t.toLowerCase().includes(searchLower))
        );
      })
      .sort((a, b) => (b[1].usage_count ?? 0) - (a[1].usage_count ?? 0));
  }, [registry, search]);

  useEffect(() => {
    setVisibleCount(48);
  }, [search, pickerOpen]);

  const resolvedLoadingEarly: "lazy" | "eager" =
    loadingProp !== undefined
      ? loadingProp
      : isPrioritySection
        ? "eager"
        : "lazy";

  const isEager = resolvedLoadingEarly === "eager";

  useEffect(() => {
    setHasError(false);
    if (isEager) {
      return;
    }
    const img = imgRef.current;
    const alreadyCached = img && img.complete && img.naturalWidth > 0;
    if (alreadyCached) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [id, isEager]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!files.length) return;
      const file = files[0];
      const allowed = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".avif", ".gif"];
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
      if (!allowed.includes(ext)) {
        toast({ title: "Unsupported file type", description: `${ext} files are not supported`, variant: "destructive" });
        return;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const resp = await fetch("/api/image-registry/upload", { method: "POST", body: formData });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || "Upload failed");
        }
        const result = await resp.json() as { id: string; src: string; alt: string; duplicate?: boolean; existingId?: string };
        setSelectedSrc(result.src);
        setSelectedAlt(result.alt);
        setSelectedRegistryId(result.id);
        setPickerMode("browse");
        toast({ title: result.duplicate ? "Image already exists" : "Image uploaded", description: result.duplicate ? `Using existing "${result.existingId}"` : `Registered as "${result.id}"` });
      } catch (err: any) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    },
    [toast],
  );

  const handlePickerSave = useCallback(async () => {
    if (!selectedSrc || sectionIndex < 0 || !sectionContentType || !sectionSlug || !sectionLocale) {
      toast({ title: "Cannot save", description: "Missing section context", variant: "destructive" });
      return;
    }

    let path: string | null = null;
    if (fieldContext?.fieldPath) {
      path = `sections.${sectionIndex}.${fieldContext.fieldPath}`;
    } else if (fieldContext?.arrayPath !== undefined && fieldContext?.index !== undefined && fieldContext?.srcField) {
      path = `sections.${sectionIndex}.${fieldContext.arrayPath}.${fieldContext.index}.${fieldContext.srcField}`;
    }

    if (!path) {
      toast({ title: "Cannot save", description: "No field path configured for this image", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const result = await editContent({
        contentType: sectionContentType,
        slug: sectionSlug,
        locale: sectionLocale,
        operations: [{ action: "update_field", path, value: selectedSrc }],
      });

      if (result.success) {
        emitContentUpdated({ contentType: sectionContentType, slug: sectionSlug, locale: sectionLocale });
        setPickerOpen(false);
        toast({ title: "Image updated" });
      } else {
        toast({ title: "Save failed", description: result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [selectedSrc, sectionIndex, sectionContentType, sectionSlug, sectionLocale, fieldContext, toast]);

  if (registryLoading || !registry || !registry.images) {
    return (
      <div
        className={`bg-muted animate-pulse ${className}`}
        data-testid={`img-skeleton-${id}`}
      />
    );
  }

  if (!id || !id.trim()) {
    return null;
  }

  const imageEntry = registry.images[id];
  const isDirectPath =
    !imageEntry &&
    (id.startsWith("/") ||
      id.startsWith("http://") ||
      id.startsWith("https://") ||
      id.startsWith("data:"));

  if (!imageEntry && !isDirectPath) {
    return null;
  }

  const presetConfig = registry.presets[preset];
  const aspectRatio = presetConfig?.aspect_ratio
    ? ASPECT_RATIOS[presetConfig.aspect_ratio]
    : undefined;

  const finalAlt = altOverride || (imageEntry ? imageEntry.alt : id);
  const src = imageEntry ? imageEntry.src : id;

  const resolvedLoading = resolvedLoadingEarly;

  const fetchPriority: "high" | "auto" = isPrioritySection ? "high" : "auto";
  const decoding: "sync" | "async" = isPrioritySection ? "sync" : "async";

  const srcsetString =
    imageEntry?.srcset && imageEntry.srcset.length > 0
      ? buildSrcsetString(imageEntry.srcset)
      : undefined;

  const sizesString = presetConfig?.sizes || undefined;

  const intrinsicWidth = imageEntry?.width;
  const intrinsicHeight = imageEntry?.height;

  const containerStyle: React.CSSProperties = aspectRatio
    ? { aspectRatio: aspectRatio.toString() }
    : {};

  if (hasError) {
    return null;
  }

  const borderClasses = bordered
    ? "border-2 border-muted-foreground/40 rounded-lg"
    : "";

  const hasFieldContext = !!(
    fieldContext?.fieldPath ||
    (fieldContext?.arrayPath !== undefined && fieldContext?.index !== undefined && fieldContext?.srcField)
  );
  const canReplace = isEditMode && hasFieldContext && sectionIndex >= 0;

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSrc(src);
    setSelectedAlt(finalAlt);
    setSelectedRegistryId(imageEntry ? id : undefined);
    setSearch("");
    setPickerMode("browse");
    setPickerOpen(true);
  };

  const selectedDisplaySrc = registry.images[selectedSrc]?.src || selectedSrc;

  const editOverlay = canReplace ? (
    <button
      type="button"
      onClick={handleEditClick}
      className="absolute inset-0 flex items-center justify-center invisible group-hover/editimg:visible cursor-pointer w-full"
      data-edit-overlay="true"
      data-testid={`button-edit-image-${id}`}
      aria-label="Replace image"
    >
      <div className="absolute inset-0 bg-black/40" />
      <span className="relative z-10 flex items-center gap-1.5 bg-white/90 text-gray-900 rounded-md px-2.5 py-1.5 text-xs font-medium shadow-md">
        <Pencil className="h-3 w-3" />
        Replace
      </span>
    </button>
  ) : null;

  const imageContent = (
    <div
      className={`relative overflow-hidden ${borderClasses} ${useSolidCard ? "" : className} ${canReplace ? "group/editimg" : ""}`}
      style={containerStyle}
      data-testid={`img-container-${id}`}
    >
      {!isEager && !isLoaded && (
        <div
          className="absolute inset-0 bg-muted animate-pulse"
          data-testid={`img-loading-${id}`}
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={finalAlt}
        loading={resolvedLoading}
        decoding={decoding}
        {...{ fetchpriority: fetchPriority }}
        {...(srcsetString ? { srcSet: srcsetString } : {})}
        {...(sizesString ? { sizes: sizesString } : {})}
        {...(intrinsicWidth ? { width: intrinsicWidth } : {})}
        {...(intrinsicHeight ? { height: intrinsicHeight } : {})}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full ${
          isEager
            ? "opacity-100"
            : `transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`
        }`}
        style={{
          objectFit: style?.objectFit || "cover",
          objectPosition: style?.objectPosition || "center center",
          ...style,
        }}
        data-testid={`img-${id}`}
      />
      {editOverlay}
    </div>
  );

  const pickerDialog = canReplace ? (
    <Dialog
      open={pickerOpen}
      onOpenChange={(open) => {
        setPickerOpen(open);
        if (!open) {
          setSearch("");
          setPickerMode("browse");
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Replace Image</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
          <div className="flex rounded-md border overflow-visible">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`flex-1 rounded-none toggle-elevate ${pickerMode === "browse" ? "toggle-elevated bg-muted" : ""}`}
              onClick={() => setPickerMode("browse")}
              data-testid="button-picker-browse"
            >
              <IconSearch className="h-4 w-4 mr-1.5" />
              Browse
            </Button>
            <div className="w-px bg-border" />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`flex-1 rounded-none toggle-elevate ${pickerMode === "upload" ? "toggle-elevated bg-muted" : ""}`}
              onClick={() => setPickerMode("upload")}
              data-testid="button-picker-upload"
            >
              <IconUpload className="h-4 w-4 mr-1.5" />
              Upload
            </Button>
          </div>

          {pickerMode === "browse" ? (
            <>
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search images..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-image-gallery-search"
                />
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="columns-4 sm:columns-5 md:columns-6 gap-2">
                  {filteredImages.slice(0, visibleCount).map(([imgId, img]) => (
                    <button
                      key={imgId}
                      type="button"
                      onClick={() => {
                        setSelectedSrc(img.src);
                        setSelectedAlt(img.alt || "");
                        setSelectedRegistryId(imgId);
                      }}
                      className={`mb-2 rounded-md overflow-hidden bg-muted border-2 transition-colors block w-full ${
                        selectedSrc === img.src || selectedSrc === imgId
                          ? "border-primary"
                          : "border-transparent hover:border-muted-foreground/50"
                      }`}
                      title={img.alt}
                      data-testid={`gallery-image-${imgId}`}
                    >
                      <img src={img.src} alt={img.alt} className="w-full h-auto" loading="lazy" />
                    </button>
                  ))}
                </div>
                {visibleCount < filteredImages.length && (
                  <div className="py-3 flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setVisibleCount((prev) => Math.min(prev + 24, filteredImages.length))}
                      data-testid="button-load-more-images"
                    >
                      Load more ({filteredImages.length - visibleCount} remaining)
                    </Button>
                  </div>
                )}
                {filteredImages.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">No images found</div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
              {hasCloudProvider || mediaStatus?.defaultProvider === "local" ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.svg,.avif,.gif"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handleUpload(e.target.files);
                      e.target.value = "";
                    }}
                    data-testid="input-file-upload"
                  />
                  <div
                    className={`w-full rounded-md border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                      dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files); }}
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="dropzone-upload"
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Uploading...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <IconCloudUpload className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">Drop an image here or click to browse</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, WebP, SVG, AVIF, GIF (max 10 MB)</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center space-y-3 p-4">
                  <IconUpload className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium">No storage provider configured</p>
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-4">
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-md overflow-hidden bg-muted border flex-shrink-0">
                {selectedDisplaySrc ? (
                  <img src={selectedDisplaySrc} alt={selectedAlt || "Preview"} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">None</div>
                )}
              </div>
              <div className="flex-1">
                <Input
                  value={selectedSrc}
                  onChange={(e) => { setSelectedSrc(e.target.value); setSelectedRegistryId(undefined); }}
                  placeholder="Image URL or registry ID"
                  className="text-sm"
                  data-testid="input-image-url"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPickerOpen(false)}
            data-testid="button-image-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handlePickerSave}
            disabled={!selectedSrc || saving}
            data-testid="button-image-save"
          >
            {saving ? (
              <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <IconCheck className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  if (useSolidCard) {
    return (
      <>
        <SolidCard className={`!p-0 !min-h-0 overflow-hidden ${className}`}>
          {imageContent}
        </SolidCard>
        {pickerDialog}
      </>
    );
  }

  return (
    <>
      {imageContent}
      {pickerDialog}
    </>
  );
}

export default UniversalImage;
