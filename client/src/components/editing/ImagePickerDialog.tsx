import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactCrop from "react-image-crop";
import type { Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  IconSearch,
  IconUpload,
  IconCloudUpload,
  IconLoader2,
  IconCheck,
  IconX,
  IconCrop,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { ImageRegistry } from "@shared/schema";

export interface ImagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  initialSrc?: string;
  initialAlt?: string;
  tagFilter?: string;
  onSave: (src: string, alt: string, registryId: string | undefined) => Promise<void> | void;
  onRemove?: () => void;
  renderPreset?: string;
  renderedSize?: { width: number; height: number };
}

const ASPECT_RATIO_MAP: Record<string, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "1:1": 1,
  "21:9": 21 / 9,
};

export function ImagePickerDialog({
  open,
  onOpenChange,
  title = "Select Image",
  initialSrc = "",
  initialAlt = "",
  tagFilter,
  onSave,
  onRemove,
  renderPreset,
  renderedSize,
}: ImagePickerDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: imageRegistry } = useQuery<ImageRegistry>({
    queryKey: ["/api/image-registry"],
  });

  const { data: mediaStatus } = useQuery<{
    defaultProvider: string;
    providers: string[];
    gcs?: { bucket: string; basePath: string; projectId?: string };
  }>({
    queryKey: ["/api/media/status"],
    enabled: open,
    staleTime: 60000,
  });

  const hasCloudProvider = (mediaStatus?.providers ?? []).some((p) => p !== "local");

  const [pickerMode, setPickerMode] = useState<"browse" | "upload">("browse");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(48);
  const [selectedSrc, setSelectedSrc] = useState(initialSrc);
  const [selectedAlt, setSelectedAlt] = useState(initialAlt);
  const [selectedRegistryId, setSelectedRegistryId] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cropPanelOpen, setCropPanelOpen] = useState(false);
  const [cropState, setCropState] = useState<Crop>({ unit: "%", x: 0, y: 0, width: 100, height: 100 });
  const [cropTargetWidth, setCropTargetWidth] = useState(800);
  const [cropTargetHeight, setCropTargetHeight] = useState(600);
  const [cropAspectLock, setCropAspectLock] = useState(false);
  const [cropQuality, setCropQuality] = useState(85);
  const [cropProcessing, setCropProcessing] = useState(false);

  const cropSizeSuggestions = useMemo(() => {
    const suggestions: Array<{ value: string; label: string; width: number; height: number }> = [];
    const seen = new Set<string>();

    const addPresetSuggestion = (presetName: string) => {
      if (!imageRegistry?.presets) return;
      const presetConfig = (imageRegistry.presets as Record<string, { widths: number[]; aspect_ratio: string | null; description?: string }>)[presetName];
      if (!presetConfig) return;
      const maxWidth = Math.max(...presetConfig.widths);
      const ar = presetConfig.aspect_ratio ? ASPECT_RATIO_MAP[presetConfig.aspect_ratio] : null;
      const height = ar ? Math.round(maxWidth / ar) : 0;
      const key = `${maxWidth}x${height}`;
      if (seen.has(key)) return;
      seen.add(key);
      const label = height > 0
        ? `${presetName} — ${maxWidth} × ${height} px`
        : `${presetName} — ${maxWidth} px wide`;
      suggestions.push({ value: key, label, width: maxWidth, height: height > 0 ? height : cropTargetHeight });
    };

    if (renderPreset) addPresetSuggestion(renderPreset);

    if (selectedRegistryId && imageRegistry?.images?.[selectedRegistryId]?.preset) {
      for (const p of imageRegistry.images[selectedRegistryId].preset!) {
        if (p !== renderPreset) addPresetSuggestion(p);
      }
    }

    if (renderedSize && renderedSize.width > 0 && renderedSize.height > 0) {
      const key = `${renderedSize.width}x${renderedSize.height}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({
          value: key,
          label: `Match displayed size on retina screens — ${renderedSize.width} × ${renderedSize.height} px`,
          width: renderedSize.width,
          height: renderedSize.height,
        });
      }
    }

    return suggestions;
  }, [imageRegistry, selectedRegistryId, renderPreset, renderedSize, cropTargetHeight]);

  useEffect(() => {
    if (open) {
      setSelectedSrc(initialSrc);
      setSelectedAlt(initialAlt);
      let resolvedId: string | undefined;
      if (initialSrc && imageRegistry?.images) {
        resolvedId = Object.entries(imageRegistry.images).find(
          ([, entry]) => entry.src === initialSrc
        )?.[0];
      }
      setSelectedRegistryId(resolvedId);
      setSearch("");
      setPickerMode("browse");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSrc, initialAlt]);

  useEffect(() => {
    setVisibleCount(48);
  }, [search, open]);

  const filteredImages = useMemo(() => {
    if (!imageRegistry?.images) return [];
    const searchLower = search.toLowerCase();
    const tagLower = tagFilter?.toLowerCase();
    return Object.entries(imageRegistry.images)
      .filter(([id, img]) => {
        if (tagLower && !img.tags?.some((t) => t.toLowerCase() === tagLower)) {
          return false;
        }
        if (!searchLower) return true;
        return (
          id.toLowerCase().includes(searchLower) ||
          img.alt?.toLowerCase().includes(searchLower) ||
          img.tags?.some((t) => t.toLowerCase().includes(searchLower))
        );
      })
      .sort((a, b) => (b[1].usage_count ?? 0) - (a[1].usage_count ?? 0));
  }, [imageRegistry, search, tagFilter]);

  const selectedDisplaySrc = useMemo(() => {
    if (!selectedSrc) return "";
    return imageRegistry?.images?.[selectedSrc]?.src || selectedSrc;
  }, [selectedSrc, imageRegistry]);

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!files.length) return;
      const file = files[0];
      const allowed = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".avif", ".gif"];
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
      if (!allowed.includes(ext)) {
        toast({
          title: "Unsupported file type",
          description: `${ext} files are not supported`,
          variant: "destructive",
        });
        return;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const resp = await fetch("/api/image-registry/upload", {
          method: "POST",
          body: formData,
        });
        if (!resp.ok) {
          const errData = (await resp.json()) as { error?: string };
          throw new Error(errData.error ?? "Upload failed");
        }
        const result = (await resp.json()) as {
          id: string;
          src: string;
          alt: string;
          duplicate?: boolean;
          existingId?: string;
        };
        await queryClient.invalidateQueries({ queryKey: ["/api/image-registry"] });
        setSelectedSrc(result.src);
        setSelectedAlt(result.alt);
        setSelectedRegistryId(result.id);
        setPickerMode("browse");
        toast({
          title: result.duplicate ? "Image already exists" : "Image uploaded",
          description: result.duplicate
            ? `Already registered as "${result.existingId}". Using the existing one.`
            : `Registered as "${result.id}"`,
        });
      } catch (err: unknown) {
        toast({
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [queryClient, toast],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(selectedSrc, selectedAlt, selectedRegistryId);
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [onSave, selectedSrc, selectedAlt, selectedRegistryId, onOpenChange, toast]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleRemove = useCallback(() => {
    onRemove?.();
    onOpenChange(false);
  }, [onRemove, onOpenChange]);

  const handleOpenCrop = useCallback(() => {
    setCropState({ unit: "%", x: 0, y: 0, width: 100, height: 100 });
    if (selectedRegistryId && imageRegistry?.images?.[selectedRegistryId]) {
      const entry = imageRegistry.images[selectedRegistryId];
      setCropTargetWidth(entry.width ?? 800);
      setCropTargetHeight(entry.height ?? 600);
      const presetQuality = entry.preset?.[0]
        ? (imageRegistry.presets as Record<string, { quality?: number }>)?.[entry.preset[0]]?.quality
        : undefined;
      setCropQuality(entry.quality_override ?? presetQuality ?? 85);
    } else {
      setCropTargetWidth(800);
      setCropTargetHeight(600);
      setCropQuality(85);
    }
    setCropPanelOpen(true);
  }, [selectedRegistryId, imageRegistry]);

  const handleCropApply = useCallback(async () => {
    if (!selectedRegistryId) return;
    setCropProcessing(true);
    try {
      const resp = await fetch("/api/media/crop-resize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: selectedRegistryId,
          crop: {
            x: (cropState.x ?? 0) / 100,
            y: (cropState.y ?? 0) / 100,
            width: (cropState.width ?? 100) / 100,
            height: (cropState.height ?? 100) / 100,
          },
          targetWidth: cropTargetWidth,
          targetHeight: cropTargetHeight,
          quality: cropQuality,
        }),
      });
      const contentType = resp.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Unexpected response (${resp.status})`);
      }
      if (!resp.ok) {
        const data = (await resp.json()) as { error?: string };
        throw new Error(data.error ?? "Processing failed");
      }
      const result = (await resp.json()) as {
        id: string;
        src: string;
        width: number;
        height: number;
      };
      await queryClient.invalidateQueries({ queryKey: ["/api/image-registry"] });
      setSelectedSrc(result.src);
      setSelectedRegistryId(result.id);
      setCropPanelOpen(false);
      toast({
        title: "Image processed",
        description: `Saved as ${result.width}×${result.height} WebP`,
      });
    } catch (err: unknown) {
      toast({
        title: "Processing failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCropProcessing(false);
    }
  }, [selectedRegistryId, cropState, cropTargetWidth, cropTargetHeight, cropQuality, queryClient, toast]);

  const cropSrc = selectedRegistryId
    ? (imageRegistry?.images?.[selectedRegistryId]?.src ?? selectedDisplaySrc)
    : selectedDisplaySrc;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleClose();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
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
                    {filteredImages.slice(0, visibleCount).map(([id, img]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setSelectedSrc(img.src);
                          setSelectedAlt(img.alt || "");
                          setSelectedRegistryId(id);
                        }}
                        className={`mb-2 rounded-md overflow-hidden bg-muted border-2 transition-colors block w-full ${
                          selectedSrc === img.src || selectedSrc === id
                            ? "border-primary"
                            : "border-transparent hover:border-muted-foreground/50"
                        }`}
                        title={img.alt}
                        data-testid={`gallery-image-${id}`}
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
                        onClick={() =>
                          setVisibleCount((prev) => Math.min(prev + 24, filteredImages.length))
                        }
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
                        dragOver
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/30 hover:border-muted-foreground/50"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
                      }}
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
                          <p className="text-sm font-medium">
                            Drop an image here or click to browse
                          </p>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG, WebP, SVG, AVIF, GIF (max 10 MB)
                          </p>
                          {hasCloudProvider && mediaStatus?.gcs && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Uploading to {mediaStatus.gcs.bucket}/{mediaStatus.gcs.basePath}
                            </p>
                          )}
                          {!hasCloudProvider && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Saving to marketing-content/images/
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center space-y-3 p-4">
                    <IconUpload className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-sm font-medium">No storage provider configured</p>
                    <p className="text-sm text-muted-foreground">
                      Drop images directly into the{" "}
                      <code className="bg-muted px-1 rounded text-xs">
                        marketing-content/images/
                      </code>{" "}
                      folder, then scan the registry to include them.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded-md overflow-hidden bg-muted border flex-shrink-0">
                  {selectedDisplaySrc ? (
                    <img
                      src={selectedDisplaySrc}
                      alt={selectedAlt || "Preview"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      None
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={selectedSrc}
                      onChange={(e) => {
                        setSelectedSrc(e.target.value);
                        setSelectedRegistryId(undefined);
                      }}
                      placeholder="Image URL or registry ID"
                      className="text-sm flex-1"
                      data-testid="input-image-url"
                    />
                    {selectedRegistryId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleOpenCrop}
                        data-testid="button-crop-resize"
                      >
                        <IconCrop className="h-4 w-4 mr-1.5" />
                        Crop & Resize
                      </Button>
                    )}
                  </div>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 bg-muted text-muted-foreground text-xs select-none">
                      Alt
                    </span>
                    <Input
                      value={selectedAlt}
                      onChange={(e) => setSelectedAlt(e.target.value)}
                      placeholder="Alt text"
                      className="text-sm rounded-l-none"
                      data-testid="input-image-alt"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-between">
            {onRemove ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemove}
                data-testid="button-image-remove"
              >
                <IconX className="h-4 w-4 mr-2" />
                Remove
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                data-testid="button-image-cancel"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cropPanelOpen} onOpenChange={setCropPanelOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Crop & Resize</DialogTitle>
            <DialogDescription>
              Select a crop area and set target dimensions to create a new optimized image.
            </DialogDescription>
          </DialogHeader>

          {cropSrc && (
            <div className="flex-1 overflow-y-auto space-y-4 py-2">
              <div className="flex justify-center">
                <ReactCrop
                  crop={cropState}
                  onChange={(_, percentCrop) => setCropState(percentCrop)}
                  aspect={
                    cropAspectLock && cropTargetWidth > 0 && cropTargetHeight > 0
                      ? cropTargetWidth / cropTargetHeight
                      : undefined
                  }
                >
                  <img
                    src={cropSrc}
                    alt="Crop source"
                    className="max-w-full max-h-80"
                    data-testid="crop-source-image"
                  />
                </ReactCrop>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Target Width (px)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={cropTargetWidth}
                    onChange={(e) => setCropTargetWidth(parseInt(e.target.value, 10) || 1)}
                    className="text-sm"
                    data-testid="input-crop-width"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Target Height (px)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={cropTargetHeight}
                    onChange={(e) => setCropTargetHeight(parseInt(e.target.value, 10) || 1)}
                    className="text-sm"
                    data-testid="input-crop-height"
                  />
                </div>
              </div>

              {cropSizeSuggestions.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Suggested size presets
                  </label>
                  <Select
                    onValueChange={(val) => {
                      const s = cropSizeSuggestions.find((s) => s.value === val);
                      if (s) {
                        setCropTargetWidth(s.width);
                        setCropTargetHeight(s.height);
                      }
                    }}
                    data-testid="select-crop-size-preset"
                  >
                    <SelectTrigger data-testid="trigger-crop-size-preset">
                      <SelectValue placeholder="Choose a preset size…" />
                    </SelectTrigger>
                    <SelectContent>
                      {cropSizeSuggestions.map((s) => (
                        <SelectItem key={s.value} value={s.value} data-testid={`option-crop-size-${s.value}`}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Switch
                  checked={cropAspectLock}
                  onCheckedChange={setCropAspectLock}
                  id="crop-aspect-lock-picker"
                  data-testid="toggle-crop-aspect-lock"
                />
                <label htmlFor="crop-aspect-lock-picker" className="text-sm cursor-pointer">
                  Lock aspect ratio
                </label>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Quality</label>
                  <span className="text-xs text-muted-foreground" data-testid="text-crop-quality">
                    {cropQuality}%
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={cropQuality}
                  onChange={(e) => setCropQuality(parseInt(e.target.value, 10))}
                  className="w-full accent-primary"
                  data-testid="slider-crop-quality"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCropPanelOpen(false)}
              data-testid="button-crop-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={cropProcessing}
              onClick={handleCropApply}
              data-testid="button-crop-apply"
            >
              {cropProcessing ? (
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <IconCrop className="h-4 w-4 mr-2" />
              )}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
