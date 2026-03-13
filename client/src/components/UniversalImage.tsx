import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ImageRef, ImageEntry, ImagePreset } from "@shared/schema";
import SolidCard from "./SolidCard";
import { useSectionPriority } from "@/contexts/SectionPriorityContext";

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

interface UniversalImageProps extends ImageRef {
  loading?: "lazy" | "eager";
  onLoad?: () => void;
  onError?: () => void;
  useSolidCard?: boolean;
  bordered?: boolean;
  style?: React.CSSProperties;
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
}: UniversalImageProps) {
  const { registry, loading: registryLoading } = useImageRegistry();
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const isPrioritySection = useSectionPriority();

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [id]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

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

  const resolvedLoading: "lazy" | "eager" =
    loadingProp !== undefined
      ? loadingProp
      : isPrioritySection
        ? "eager"
        : "lazy";

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

  const imageContent = (
    <div
      className={`relative overflow-hidden ${borderClasses} ${useSolidCard ? "" : className}`}
      style={containerStyle}
      data-testid={`img-container-${id}`}
    >
      {!isLoaded && (
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
          resolvedLoading === "eager"
            ? (isLoaded ? "opacity-100" : "opacity-0")
            : `transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`
        }`}
        style={{
          objectFit: style?.objectFit || "cover",
          objectPosition: style?.objectPosition || "center center",
          ...style,
        }}
        data-testid={`img-${id}`}
      />
    </div>
  );

  if (useSolidCard) {
    return (
      <SolidCard className={`!p-0 !min-h-0 overflow-hidden ${className}`}>
        {imageContent}
      </SolidCard>
    );
  }

  return imageContent;
}

export default UniversalImage;
