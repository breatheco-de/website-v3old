import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ImageRef, ImageEntry, ImagePreset } from "@shared/schema";
import SolidCard from "./SolidCard";
import { useSectionContext } from "@/contexts/SectionContext";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import { Pencil } from "lucide-react";
import { ImagePickerDialog } from "@/components/editing/ImagePickerDialog";
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

  const registry = data ?? null;

  const reverseMap = useMemo<Map<string, ImageEntry>>(() => {
    if (!registry?.images) return new Map();
    const map = new Map<string, ImageEntry>();
    for (const entry of Object.values(registry.images)) {
      if (entry.src) map.set(entry.src, entry);
    }
    return map;
  }, [registry?.images]);

  return { registry, loading: isLoading, reverseMap };
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
  const { registry, loading: registryLoading, reverseMap } = useImageRegistry();
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const { isPriority: isPrioritySection, sectionIndex, contentType: sectionContentType, slug: sectionSlug, locale: sectionLocale } = useSectionContext();
  const editModeCtx = useEditModeOptional();
  const isEditMode = editModeCtx?.isEditMode ?? false;
  const { toast } = useToast();

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

  if (!id || !id.trim()) {
    return null;
  }

  const isDirectUrl =
    id.startsWith("/") ||
    id.startsWith("http://") ||
    id.startsWith("https://") ||
    id.startsWith("data:");

  if (!isDirectUrl && !isEager && (registryLoading || !registry || !registry.images)) {
    return (
      <div
        className={`bg-muted animate-pulse ${className}`}
        data-testid={`img-skeleton-${id}`}
      />
    );
  }

  const imageEntry = registry?.images?.[id] ?? (isDirectUrl ? reverseMap.get(id) : undefined) ?? undefined;
  const isDirectPath = !imageEntry && isDirectUrl;

  if (!imageEntry && !isDirectPath) {
    return null;
  }

  const presetConfig = registry?.presets?.[preset];
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


  const sizesString = presetConfig?.sizes || (srcsetString ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" : undefined);

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
    setPickerOpen(true);
  };

  const handlePickerSave = async (pickedSrc: string, _alt: string, registryId: string | undefined) => {
    if (sectionIndex < 0 || !sectionContentType || !sectionSlug || !sectionLocale) {
      toast({ title: "Cannot save", description: "Missing section context", variant: "destructive" });
      throw new Error("Missing section context");
    }

    let path: string | null = null;
    if (fieldContext?.fieldPath) {
      path = `sections.${sectionIndex}.${fieldContext.fieldPath}`;
    } else if (fieldContext?.arrayPath !== undefined && fieldContext?.index !== undefined && fieldContext?.srcField) {
      path = `sections.${sectionIndex}.${fieldContext.arrayPath}.${fieldContext.index}.${fieldContext.srcField}`;
    }

    if (!path) {
      toast({ title: "Cannot save", description: "No field path configured for this image", variant: "destructive" });
      throw new Error("No field path configured");
    }

    const isIdField = fieldContext?.srcField?.endsWith("_id") ?? false;
    const valueToSave = isIdField && registryId ? registryId : pickedSrc;

    const result = await editContent({
      contentType: sectionContentType,
      slug: sectionSlug,
      locale: sectionLocale,
      operations: [{ action: "update_field", path, value: valueToSave }],
    });

    if (result.success) {
      emitContentUpdated({ contentType: sectionContentType, slug: sectionSlug, locale: sectionLocale });
      toast({ title: "Image updated" });
    } else {
      throw new Error(result.error ?? "Save failed");
    }
  };

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

  const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
  const renderedSize = imgRef.current
    ? { width: Math.round(imgRef.current.getBoundingClientRect().width * dpr), height: Math.round(imgRef.current.getBoundingClientRect().height * dpr) }
    : undefined;

  const pickerDialog = canReplace ? (
    <ImagePickerDialog
      open={pickerOpen}
      onOpenChange={setPickerOpen}
      title="Replace Image"
      initialSrc={src}
      initialAlt={finalAlt}
      onSave={handlePickerSave}
      renderPreset={preset !== "full" ? preset : undefined}
      renderedSize={renderedSize}
    />
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
