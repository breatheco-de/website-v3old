import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { IconPhoto, IconSearch, IconArrowLeft, IconCopy, IconCheck, IconRefresh, IconAlertTriangle, IconDots, IconTrash, IconSquareCheck, IconSquare, IconX, IconChecks } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { ImageRegistry } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface ScanResult {
  newImages: Array<{ id: string; src: string; filename: string }>;
  updatedImages: Array<{ id: string; oldSrc: string; newSrc: string }>;
  brokenReferences: Array<{ yamlFile: string; field: string; missingSrc: string }>;
  registeredCount: number;
  scannedImagesCount: number;
  summary: { new: number; updated: number; broken: number };
}

interface BulkDeleteResult {
  id: string;
  success: boolean;
  message: string;
}

export default function MediaGallery() {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteResults, setBulkDeleteResults] = useState<BulkDeleteResult[] | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: registry, isLoading, error } = useQuery<ImageRegistry>({
    queryKey: ["/api/image-registry"],
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleImageError = (id: string) => {
    setFailedImages(prev => new Set(prev).add(id));
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/image-registry/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        const usedIn = data.usedIn as string[] | undefined;
        toast({
          title: "Cannot delete",
          description: usedIn
            ? `"${id}" is used in: ${usedIn.join(", ")}`
            : data.message || data.error,
          variant: "destructive",
          duration: 8000,
        });
        return;
      }
      toast({ title: "Deleted", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/image-registry"] });
    } catch {
      toast({ title: "Delete failed", description: "Could not delete image from registry", variant: "destructive" });
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await apiRequest("POST", "/api/image-registry/scan");
      const data: ScanResult = await res.json();
      setScanResult(data);
    } catch {
      toast({ title: "Scan failed", description: "Could not scan image registry", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleApply = async (action: "add" | "update") => {
    setApplying(true);
    try {
      const res = await apiRequest("POST", `/api/image-registry/apply?action=${action}`);
      const data = await res.json();
      toast({ title: "Applied", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/image-registry"] });
      const refreshed = await apiRequest("POST", "/api/image-registry/scan");
      const freshScan: ScanResult = await refreshed.json();
      if (freshScan.summary.new === 0 && freshScan.summary.updated === 0 && freshScan.summary.broken === 0) {
        setScanResult(null);
      } else {
        setScanResult(freshScan);
      }
    } catch {
      toast({ title: "Apply failed", description: "Could not apply changes", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const toggleImageSelection = (id: string) => {
    setSelectedImages(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filteredImages = registry?.images
    ? Object.entries(registry.images).filter(([id, img]) => {
        const searchLower = search.toLowerCase();
        return (
          id.toLowerCase().includes(searchLower) ||
          img.alt.toLowerCase().includes(searchLower) ||
          img.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
        );
      })
    : [];

  const handleSelectAll = () => {
    const allIds = filteredImages.map(([id]) => id);
    setSelectedImages(new Set(allIds));
  };

  const handleClearSelection = () => {
    setSelectedImages(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedImages.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await apiRequest("POST", "/api/image-registry/bulk-delete", {
        ids: Array.from(selectedImages),
      });
      const data = await res.json();
      setBulkDeleteResults(data.results);
      if (data.deletedCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/image-registry"] });
      }
      setSelectedImages(new Set());
    } catch {
      toast({ title: "Bulk delete failed", description: "Could not complete bulk delete operation", variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  };

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search]);

  const visibleImages = filteredImages.slice(0, visibleCount);
  const hasMore = visibleCount < filteredImages.length;

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredImages.length));
  }, [filteredImages.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back-home">
                  <IconArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <IconPhoto className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-semibold" data-testid="text-page-title">Media Gallery</h1>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  ({filteredImages.length}{search ? " found" : ""})
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleScan}
                  disabled={scanning}
                  data-testid="button-scan-registry"
                >
                  <IconRefresh className={`h-4 w-4 mr-1.5 ${scanning ? 'animate-spin' : ''}`} />
                  {scanning ? "Scanning..." : "Scan Registry"}
                </Button>
                <div className="relative w-64">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-9"
                    data-testid="input-search"
                  />
                </div>
              </div>
              {registry && (
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {Object.keys(registry.presets).map((name) => (
                    <Badge
                      key={name}
                      variant="outline"
                      className="cursor-pointer text-xs"
                      onClick={() => setSearch(name)}
                      data-testid={`badge-preset-${name}`}
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">

        {scanResult && (
          <div className="mb-6 rounded-lg border p-4 space-y-3" data-testid="scan-results">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Scan Results</h3>
              <div className="flex items-center gap-2">
                {scanResult.summary.updated > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApply("update")}
                    disabled={applying}
                    data-testid="button-apply-updates"
                  >
                    {applying ? "Applying..." : `Update ${scanResult.summary.updated} extension(s)`}
                  </Button>
                )}
                {scanResult.summary.new > 0 && (
                  <Button
                    size="sm"
                    onClick={() => handleApply("add")}
                    disabled={applying}
                    data-testid="button-apply-new"
                  >
                    {applying ? "Applying..." : `Add ${scanResult.summary.new} new image(s)`}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setScanResult(null)}
                  data-testid="button-dismiss-scan"
                >
                  Dismiss
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-muted-foreground">
                Registered: <strong className="text-foreground">{scanResult.registeredCount}</strong>
              </span>
              <span className="text-muted-foreground">
                Scanned files: <strong className="text-foreground">{scanResult.scannedImagesCount}</strong>
              </span>
            </div>

            {scanResult.brokenReferences.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <IconAlertTriangle className="h-4 w-4" />
                  {scanResult.brokenReferences.length} broken reference(s)
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pl-6">
                  {scanResult.brokenReferences.map((ref, i) => (
                    <div key={i} className="text-xs text-muted-foreground">
                      <code className="text-foreground">{ref.yamlFile}</code>
                      <span className="mx-1">&rarr;</span>
                      <code className="text-destructive">{ref.missingSrc}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scanResult.updatedImages.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {scanResult.updatedImages.length} image(s) with changed extensions
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1 pl-6">
                  {scanResult.updatedImages.map((img, i) => (
                    <div key={i} className="text-xs text-muted-foreground">
                      <code className="text-foreground">{img.id}</code>: {img.oldSrc.split('/').pop()} &rarr; {img.newSrc.split('/').pop()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scanResult.newImages.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {scanResult.newImages.length} unregistered image(s)
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pl-6">
                  {scanResult.newImages.map((img, i) => (
                    <div key={i} className="text-xs text-muted-foreground">
                      <code className="text-foreground">{img.filename}</code>
                      <span className="mx-1">&rarr;</span>
                      id: <code>{img.id}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scanResult.summary.new === 0 && scanResult.summary.updated === 0 && scanResult.summary.broken === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <IconCheck className="h-4 w-4" />
                All image references are valid
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
              <p className="mt-4 text-muted-foreground">Loading images...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive p-6">
            <p className="text-destructive" data-testid="text-error">
              Failed to load image registry
            </p>
          </div>
        )}

        {registry && (
          <>
            <div 
              className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4"
              style={{ columnFill: 'balance' }}
            >
              {visibleImages.map(([id, img]) => {
                const isSelected = selectedImages.has(id);
                return (
                <div 
                  key={id} 
                  className="break-inside-avoid mb-4 group"
                  data-testid={`card-image-${id}`}
                >
                  <div className={`rounded-lg overflow-hidden bg-muted border hover-elevate transition-shadow ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}>
                    <div
                      className="relative cursor-pointer"
                      onClick={() => toggleImageSelection(id)}
                      data-testid={`select-image-${id}`}
                    >
                      {failedImages.has(id) ? (
                        <div className="aspect-video flex items-center justify-center bg-muted">
                          <div className="text-center p-4">
                            <IconPhoto className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground">Not found</p>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={img.src}
                          alt={img.alt}
                          className="w-full h-auto"
                          loading="lazy"
                          onError={() => handleImageError(id)}
                        />
                      )}
                      <div className={`absolute top-2 left-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {isSelected ? (
                          <IconSquareCheck className="h-5 w-5 text-primary drop-shadow-md" />
                        ) : (
                          <IconSquare className="h-5 w-5 text-white drop-shadow-md" />
                        )}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <code className="text-xs font-mono truncate text-foreground" data-testid={`text-image-id-${id}`}>
                          {id}
                        </code>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-menu-${id}`}
                            >
                              {copiedId === id ? (
                                <IconCheck className="h-3 w-3 text-green-600" />
                              ) : (
                                <IconDots className="h-3 w-3" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleCopyId(id)}
                              data-testid={`button-copy-${id}`}
                            >
                              <IconCopy className="h-4 w-4 mr-2" />
                              Copy ID
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(id)}
                              data-testid={`button-delete-${id}`}
                            >
                              <IconTrash className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2" data-testid={`text-image-alt-${id}`}>
                        {img.alt}
                      </p>
                      {img.tags && img.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {img.tags.map((tag) => (
                            <Badge 
                              key={tag} 
                              variant="secondary" 
                              className="text-xs px-1.5 py-0 cursor-pointer"
                              onClick={() => setSearch(tag)}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-8" data-testid="scroll-sentinel">
                <p className="text-sm text-muted-foreground">
                  Showing {visibleCount} of {filteredImages.length} images
                </p>
              </div>
            )}

            {!hasMore && filteredImages.length > PAGE_SIZE && (
              <div className="flex justify-center py-6">
                <p className="text-sm text-muted-foreground">
                  All {filteredImages.length} images loaded
                </p>
              </div>
            )}

            {filteredImages.length === 0 && !isLoading && (
              <div className="text-center py-16">
                <IconPhoto className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground" data-testid="text-no-results">
                  {search ? "No images match your search" : "No images in registry"}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {selectedImages.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg" data-testid="bulk-action-toolbar">
          <div className="container mx-auto px-4 pl-20 max-w-7xl">
            <div className="flex items-center justify-between py-3 gap-4">
              <div className="flex items-center gap-3">
                <IconChecks className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium" data-testid="text-selected-count">
                  {selectedImages.size} image{selectedImages.size !== 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  data-testid="button-select-all"
                >
                  Select all ({filteredImages.length})
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  data-testid="button-bulk-delete"
                >
                  <IconTrash className="h-4 w-4 mr-1.5" />
                  {bulkDeleting ? "Deleting..." : `Delete Selected`}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelection}
                  data-testid="button-clear-selection"
                >
                  <IconX className="h-4 w-4 mr-1.5" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={bulkDeleteResults !== null} onOpenChange={(open) => { if (!open) setBulkDeleteResults(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Delete Results</DialogTitle>
          </DialogHeader>
          {bulkDeleteResults && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600 dark:text-green-400">
                  {bulkDeleteResults.filter(r => r.success).length} deleted
                </span>
                {bulkDeleteResults.some(r => !r.success) && (
                  <span className="text-destructive">
                    {bulkDeleteResults.filter(r => !r.success).length} failed
                  </span>
                )}
              </div>
              <ScrollArea className="max-h-[400px]">
                <div className="border rounded-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium">Image ID</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkDeleteResults.map((result) => (
                        <tr
                          key={result.id}
                          className={result.success
                            ? "bg-green-50 dark:bg-green-950/30"
                            : "bg-red-50 dark:bg-red-950/30"
                          }
                        >
                          <td className="px-3 py-2 font-mono text-xs truncate max-w-[200px]" data-testid={`text-result-id-${result.id}`}>
                            {result.id}
                          </td>
                          <td className={`px-3 py-2 text-xs ${result.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`} data-testid={`text-result-status-${result.id}`}>
                            {result.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setBulkDeleteResults(null)} data-testid="button-close-results">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
