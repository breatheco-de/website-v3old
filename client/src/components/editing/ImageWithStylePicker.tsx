import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IconPhoto,
  IconChevronDown,
  IconSearch,
  IconUpload,
  IconCloudUpload,
  IconLoader2,
  IconX,
  IconCheck,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { ImageRegistry } from "@shared/schema";

export interface ImageWithStylePickerProps {
  label: string;
  value: string;
  alt?: string;
  objectFit?: string;
  objectPosition?: string;
  tagFilter?: string;
  testId?: string;
  disabled?: boolean;
  onChangeSrc: (src: string, alt: string, registryId?: string) => void;
  onChangeAlt?: (alt: string) => void;
  onChangeObjectFit?: (fit: string) => void;
  onChangeObjectPosition?: (position: string) => void;
  onRemove?: () => void;
}

export function ImageWithStylePicker({
  label,
  value,
  alt = "",
  objectFit = "",
  objectPosition = "",
  tagFilter,
  testId = "image-style",
  disabled = false,
  onChangeSrc,
  onChangeAlt,
  onChangeObjectFit,
  onChangeObjectPosition,
  onRemove,
}: ImageWithStylePickerProps) {
  const { toast } = useToast();

  const { data: imageRegistry, refetch: refetchRegistry } =
    useQuery<ImageRegistry>({
      queryKey: ["/api/image-registry"],
    });

  const { data: mediaStatus } = useQuery<{
    defaultProvider: string;
    providers: string[];
    gcs?: { bucket: string; basePath: string; projectId?: string };
  }>({
    queryKey: ["/api/media/status"],
  });

  const hasCloudProvider = (mediaStatus?.providers ?? []).some(
    (p) => p !== "local",
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"browse" | "upload">("browse");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(48);
  const [selectedSrc, setSelectedSrc] = useState(value);
  const [selectedAlt, setSelectedAlt] = useState(alt);
  const [selectedRegistryId, setSelectedRegistryId] = useState<
    string | undefined
  >(undefined);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displaySrc = useMemo(() => {
    if (!value) return "";
    return imageRegistry?.images?.[value]?.src || value;
  }, [value, imageRegistry]);

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

  useEffect(() => {
    setVisibleCount(48);
  }, [search, pickerOpen]);

  const openPicker = () => {
    setSelectedSrc(value);
    setSelectedAlt(alt);
    setSelectedRegistryId(undefined);
    setSearch("");
    setPickerMode("browse");
    setPickerOpen(true);
  };

  const handleSave = () => {
    onChangeSrc(selectedSrc, selectedAlt, selectedRegistryId);
    if (selectedRegistryId) {
      fetch(`/api/media/classify/${encodeURIComponent(selectedRegistryId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tagFilter ? { context: { tagFilter } } : {}),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.added?.length > 0) {
            toast({
              title: "Tags added",
              description: `Added ${data.added.length} tag(s): ${data.added.join(", ")}`,
            });
          }
        })
        .catch(() => {});
    }
    setPickerOpen(false);
  };

  const handleRemove = () => {
    onRemove?.();
    setPickerOpen(false);
  };

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
          const err = await resp.json();
          throw new Error(err.error || "Upload failed");
        }
        const result = (await resp.json()) as {
          id: string;
          src: string;
          alt: string;
          duplicate?: boolean;
          existingId?: string;
        };
        await refetchRegistry();
        setSelectedSrc(result.src);
        setSelectedAlt(result.alt);
        setSelectedRegistryId(result.id);
        setPickerMode("browse");
        if (result.duplicate) {
          toast({
            title: "Image already exists",
            description: `Already registered as "${result.existingId}". Using the existing one.`,
          });
        } else {
          toast({
            title: "Image uploaded",
            description: `Registered as "${result.id}"`,
          });
        }
      } catch (err: any) {
        toast({
          title: "Upload failed",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [refetchRegistry, toast],
  );

  const selectedDisplaySrc = useMemo(() => {
    if (!selectedSrc) return "";
    return imageRegistry?.images?.[selectedSrc]?.src || selectedSrc;
  }, [selectedSrc, imageRegistry]);

  return (
    <>
      <Collapsible className="border rounded-md">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={`w-full flex items-center gap-3 p-3 transition-colors ${disabled ? "opacity-60 cursor-default" : "hover:bg-muted/50"}`}
            data-testid={`${testId}-trigger`}
          >
            <div className="w-10 h-10 rounded-md overflow-hidden bg-muted border flex-shrink-0">
              {displaySrc ? (
                <img
                  src={displaySrc}
                  alt={alt || label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <IconPhoto className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <span className="flex-1 text-left text-sm font-medium">{label}</span>
            <IconChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 pt-0 space-y-3 border-t">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={disabled ? undefined : openPicker}
                disabled={disabled}
                className="relative w-16 h-16 rounded-md border border-input bg-muted/50 hover:bg-muted transition-colors overflow-hidden group flex-shrink-0 disabled:cursor-default disabled:opacity-60"
                data-testid={`${testId}-picker`}
                title={disabled ? "Read-only" : "Change image"}
              >
                {displaySrc ? (
                  <>
                    <img
                      src={displaySrc}
                      alt={alt}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <IconPhoto className="h-5 w-5 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <IconPhoto className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </button>
              {onChangeAlt !== undefined && (
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Alt text</Label>
                  <Input
                    value={alt}
                    onChange={(e) => onChangeAlt(e.target.value)}
                    placeholder="Image description"
                    className="h-8 text-sm"
                    data-testid={`${testId}-alt`}
                  />
                </div>
              )}
            </div>

            {(onChangeObjectFit !== undefined ||
              onChangeObjectPosition !== undefined) && (
              <div className="grid grid-cols-2 gap-3">
                {onChangeObjectFit !== undefined && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Object Fit
                    </Label>
                    <Select
                      value={objectFit || "cover"}
                      onValueChange={onChangeObjectFit}
                    >
                      <SelectTrigger
                        className="h-8 text-sm"
                        data-testid={`${testId}-object-fit`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cover">Cover (crops)</SelectItem>
                        <SelectItem value="contain">Contain (fits)</SelectItem>
                        <SelectItem value="fill">Fill (stretch)</SelectItem>
                        <SelectItem value="none">None (original)</SelectItem>
                        <SelectItem value="scale-down">Scale Down</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {onChangeObjectPosition !== undefined && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Position (X Y)
                    </Label>
                    <Input
                      value={objectPosition}
                      onChange={(e) => onChangeObjectPosition(e.target.value)}
                      placeholder="center center"
                      className="h-8 text-sm"
                      data-testid={`${testId}-object-position`}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

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
            <DialogTitle>
              {tagFilter
                ? `Select ${tagFilter.charAt(0).toUpperCase() + tagFilter.slice(1)}`
                : "Select Image"}
            </DialogTitle>
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
                        <img
                          src={img.src}
                          alt={img.alt}
                          className="w-full h-auto"
                          loading="lazy"
                        />
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
                          setVisibleCount((prev) =>
                            Math.min(prev + 24, filteredImages.length),
                          )
                        }
                        data-testid="button-load-more-images"
                      >
                        Load more ({filteredImages.length - visibleCount}{" "}
                        remaining)
                      </Button>
                    </div>
                  )}
                  {filteredImages.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No images found
                    </div>
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
                        if (e.target.files?.length)
                          handleUpload(e.target.files);
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
                        if (e.dataTransfer.files.length)
                          handleUpload(e.dataTransfer.files);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="dropzone-upload"
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Uploading...
                          </p>
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
                              Uploading to {mediaStatus.gcs.bucket}/
                              {mediaStatus.gcs.basePath}
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
                    <p className="text-sm font-medium">
                      No storage provider configured
                    </p>
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

            <div className="border-t pt-4 space-y-3">
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
                  <Input
                    value={selectedSrc}
                    onChange={(e) => setSelectedSrc(e.target.value)}
                    placeholder="Image URL or registry ID"
                    className="text-sm"
                    data-testid="input-image-url"
                  />
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
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
              data-testid="button-image-remove"
            >
              <IconX className="h-4 w-4 mr-2" />
              Remove
            </Button>
            <div className="flex gap-2">
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
                onClick={handleSave}
                data-testid="button-image-save"
              >
                <IconCheck className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
