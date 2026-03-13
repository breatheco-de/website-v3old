import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { IconPhoto, IconSearch, IconArrowLeft, IconCopy, IconCheck, IconAlertTriangle, IconDots, IconTrash, IconSquareCheck, IconSquare, IconX, IconChecks, IconSettings, IconCloud, IconFolder, IconStethoscope, IconLink, IconLoader2 } from "@tabler/icons-react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { ImageRegistry } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface DuplicateGroup {
  hash: string;
  ids: string[];
  canonical: string;
}

interface ScanResult {
  newImages: Array<{ id: string; src: string; filename: string }>;
  updatedImages: Array<{ id: string; oldSrc: string; newSrc: string }>;
  brokenReferences: Array<{ yamlFile: string; field: string; missingSrc: string }>;
  duplicates: DuplicateGroup[];
  hashesComputed: number;
  registeredCount: number;
  scannedImagesCount: number;
  summary: { new: number; updated: number; broken: number; duplicates: number };
}

interface BulkDeleteResult {
  id: string;
  success: boolean;
  message: string;
}

interface ValidationIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  file?: string;
  suggestion?: string;
}

interface ValidatorResult {
  name: string;
  description: string;
  status: "passed" | "failed" | "warning";
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  duration: number;
  artifacts?: Record<string, unknown>;
}

interface ValidationRunResult {
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    duration: number;
  };
  validators: ValidatorResult[];
}

export default function MediaGallery() {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteResults, setBulkDeleteResults] = useState<BulkDeleteResult[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsProviderView, setSettingsProviderView] = useState<string | null>(null);
  const [deduplicating, setDeduplicating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationRunResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateConfirmOpen, setMigrateConfirmOpen] = useState(false);
  const [migrateResults, setMigrateResults] = useState<{ message: string; migratedCount: number; totalProcessed: number; results: Array<{ id: string; oldSrc: string; newSrc: string; status: string }> } | null>(null);
  const [redundantOpen, setRedundantOpen] = useState(false);
  const [redundantResult, setRedundantResult] = useState<{ resolved: number; errors: string[] } | null>(null);
  const [redundantVisible, setRedundantVisible] = useState(10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  interface MediaStatus {
    defaultProvider: string;
    providers: string[];
    gcs?: { bucket: string; basePath: string; projectId?: string };
  }

  const { data: mediaStatus } = useQuery<MediaStatus>({
    queryKey: ["/api/media/status"],
  });

  const { data: registry, isLoading, error } = useQuery<ImageRegistry>({
    queryKey: ["/api/image-registry"],
  });

  interface RedundantImage { id: string; cloudUrl: string; localPath: string; }
  const { data: redundantData } = useQuery<{ count: number; images: RedundantImage[] }>({
    queryKey: ["/api/image-registry/redundant"],
  });
  const redundantCount = redundantData?.count ?? 0;

  const resolveRedundancyMutation = useMutation({
    mutationFn: (action: "delete-local" | "delete-cloud") =>
      apiRequest("POST", "/api/image-registry/redundant/resolve", { action }).then(r => r.json()),
    onSuccess: (data) => {
      setRedundantResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/image-registry"] });
      queryClient.invalidateQueries({ queryKey: ["/api/image-registry/redundant"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to resolve redundancy", variant: "destructive" });
    },
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
    setValidationResult(null);
    try {
      const [scanRes, validationRes] = await Promise.all([
        apiRequest("POST", "/api/image-registry/scan"),
        apiRequest("POST", "/api/validation/run", {
          validators: ["images", "hero-image-tags", "image-optimization"],
          includeArtifacts: true,
        }),
      ]);
      const scanData: ScanResult = await scanRes.json();
      setScanResult(scanData);
      const validationData: ValidationRunResult = await validationRes.json();
      setValidationResult(validationData);
    } catch {
      toast({ title: "Scan failed", description: "Could not scan image registry", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleTriggerOptimization = async () => {
    setOptimizing(true);
    try {
      const res = await apiRequest("POST", "/api/image-registry/optimize-batch", {});
      const data = await res.json();
      toast({
        title: "Optimization started",
        description: data.message || `Queued ${data.queued} image(s) for processing`,
      });
    } catch {
      toast({ title: "Optimization failed", description: "Could not start batch optimization", variant: "destructive" });
    } finally {
      setOptimizing(false);
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
      if (freshScan.summary.new === 0 && freshScan.summary.updated === 0 && freshScan.summary.broken === 0 && freshScan.summary.duplicates === 0) {
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

  const handleDeduplicate = async () => {
    setDeduplicating(true);
    try {
      const res = await apiRequest("POST", "/api/image-registry/deduplicate");
      const data = await res.json();
      toast({ title: "Duplicates removed", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/image-registry"] });
      const refreshed = await apiRequest("POST", "/api/image-registry/scan");
      const freshScan: ScanResult = await refreshed.json();
      if (freshScan.summary.new === 0 && freshScan.summary.updated === 0 && freshScan.summary.broken === 0 && freshScan.summary.duplicates === 0) {
        setScanResult(null);
      } else {
        setScanResult(freshScan);
      }
    } catch {
      toast({ title: "Deduplication failed", description: "Could not remove duplicates", variant: "destructive" });
    } finally {
      setDeduplicating(false);
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

  const localImageCount = registry?.images
    ? Object.values(registry.images).filter(img => !img.src.startsWith("http")).length
    : 0;

  const cloudProvider = mediaStatus?.providers.find(p => p !== "local") ?? null;
  const cloudProviderLabel = cloudProvider === "gcs" ? "Google Bucket" : cloudProvider ?? "";

  const handleMigrate = async () => {
    setMigrateConfirmOpen(false);
    setMigrating(true);
    try {
      const res = await apiRequest("POST", "/api/image-registry/migrate", {
        from: "local",
        to: cloudProvider,
      });
      const data = await res.json();
      setMigrateResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/image-registry"] });
      toast({
        title: "Migration complete",
        description: data.message,
      });
    } catch (err: any) {
      toast({
        title: "Migration failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setMigrating(false);
    }
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
                {searchOpen ? (
                  <div className="relative w-64 flex items-center gap-1">
                    <div className="relative flex-1">
                      <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 h-9"
                        data-testid="input-search"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setSearch("");
                            setSearchOpen(false);
                          }
                        }}
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setSearch(""); setSearchOpen(false); }}
                      data-testid="button-close-search"
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setSearchOpen(true);
                      setTimeout(() => searchInputRef.current?.focus(), 0);
                    }}
                    data-testid="button-open-search"
                  >
                    <IconSearch className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleScan}
                  disabled={scanning}
                  data-testid="button-scan-registry"
                >
                  {scanning ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconStethoscope className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSettingsOpen(true)}
                  data-testid="button-media-settings"
                >
                  <IconSettings className="h-4 w-4" />
                </Button>
              </div>
              {registry && (
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {Object.keys(registry.presets).map((name) => (
                    <Badge
                      key={name}
                      variant="outline"
                      className="cursor-pointer text-xs"
                      onClick={() => { setSearch(name); setSearchOpen(true); }}
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
                {scanResult.summary.duplicates > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeduplicate}
                    disabled={deduplicating}
                    data-testid="button-remove-duplicates"
                  >
                    {deduplicating ? "Removing..." : `Remove ${scanResult.duplicates.reduce((sum, g) => sum + g.ids.length - 1, 0)} duplicate(s)`}
                  </Button>
                )}
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

            {scanResult.duplicates.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {scanResult.duplicates.length} duplicate group(s) ({scanResult.duplicates.reduce((sum, g) => sum + g.ids.length - 1, 0)} extra image(s))
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pl-6">
                  {scanResult.duplicates.map((group, i) => (
                    <div key={i} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{group.ids.length} copies:</span>{" "}
                      {group.ids.map((id, j) => (
                        <span key={id}>
                          {j > 0 && ", "}
                          <code className={id === group.canonical ? "text-foreground font-semibold" : ""}>{id}</code>
                          {id === group.canonical && <span className="text-xs text-muted-foreground ml-0.5">(keep)</span>}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scanResult.hashesComputed > 0 && (
              <div className="text-xs text-muted-foreground">
                Computed {scanResult.hashesComputed} new hash(es) during this scan
              </div>
            )}

            {scanResult.summary.new === 0 && scanResult.summary.updated === 0 && scanResult.summary.broken === 0 && scanResult.summary.duplicates === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <IconCheck className="h-4 w-4" />
                All image references are valid
              </div>
            )}
          </div>
        )}

        {validationResult && validationResult.validators.length > 0 && (
          <div className="mb-6 rounded-lg border p-4 space-y-4" data-testid="validation-results">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Image Health Checks</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{validationResult.summary.total} check(s) in {validationResult.summary.duration}ms</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setValidationResult(null)}
                  data-testid="button-dismiss-validation"
                >
                  Dismiss
                </Button>
              </div>
            </div>

            {validationResult.validators.map((v) => {
              const issueCount = v.errors.length + v.warnings.length;
              const statusColor =
                v.status === "passed"
                  ? "text-green-600 dark:text-green-400"
                  : v.status === "warning"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-destructive";

              return (
                <div key={v.name} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${statusColor}`}>
                        {v.status === "passed" ? <IconCheck className="inline h-3.5 w-3.5 mr-1" /> : <IconAlertTriangle className="inline h-3.5 w-3.5 mr-1" />}
                        {v.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{v.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {v.name === "image-optimization" && issueCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleTriggerOptimization}
                          disabled={optimizing || mediaStatus?.defaultProvider !== "gcs"}
                          title={mediaStatus?.defaultProvider !== "gcs" ? "GCS provider required for optimization" : undefined}
                          data-testid="button-trigger-optimization"
                        >
                          {optimizing ? (
                            <>
                              <IconLoader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            "Trigger optimization"
                          )}
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground">{v.duration}ms</span>
                    </div>
                  </div>

                  {v.artifacts && (
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pl-5">
                      {Object.entries(v.artifacts).map(([key, value]) => (
                        <span key={key}>
                          {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}: <strong className="text-foreground">{String(value)}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  {issueCount > 0 && (
                    <div className="max-h-40 overflow-y-auto space-y-1 pl-5">
                      {[...v.errors, ...v.warnings].slice(0, 20).map((issue, i) => (
                        <div key={i} className="text-xs">
                          <span className={issue.type === "error" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}>
                            [{issue.code}]
                          </span>
                          <span className="text-muted-foreground ml-1.5">{issue.message}</span>
                        </div>
                      ))}
                      {issueCount > 20 && (
                        <div className="text-xs text-muted-foreground">
                          ...and {issueCount - 20} more issue(s)
                        </div>
                      )}
                    </div>
                  )}

                  {issueCount === 0 && (
                    <div className="text-xs text-green-600 dark:text-green-400 pl-5">
                      No issues found
                    </div>
                  )}
                </div>
              );
            })}
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
                              onClick={() => {
                                const url = img.src.startsWith("http") ? img.src : `${window.location.origin}${img.src}`;
                                navigator.clipboard.writeText(url);
                                setCopiedId(id);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              data-testid={`button-copy-url-${id}`}
                            >
                              <IconLink className="h-4 w-4 mr-2" />
                              Copy URL
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
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 no-default-active-elevate" data-testid={`badge-storage-${id}`}>
                          {img.src.startsWith("http") ? (
                            <><IconCloud className="h-3 w-3 mr-1" />Google Bucket</>
                          ) : (
                            <><IconFolder className="h-3 w-3 mr-1" />Local</>
                          )}
                        </Badge>
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
                              onClick={() => { setSearch(tag); setSearchOpen(true); }}
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

      <Dialog open={settingsOpen} onOpenChange={(open) => { setSettingsOpen(open); if (!open) setSettingsProviderView(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Media Storage Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {mediaStatus?.defaultProvider === "gcs" ? (
                  <IconCloud className="h-5 w-5 text-primary" />
                ) : (
                  <IconFolder className="h-5 w-5 text-primary" />
                )}
                <div>
                  <p className="text-sm font-medium" data-testid="text-default-provider">
                    Default Provider: <span className="font-semibold">{mediaStatus?.defaultProvider === "gcs" ? "Google Cloud Storage" : "Local"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    New uploads will use this provider
                  </p>
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">Storage Providers</p>
                <div className="flex flex-wrap gap-2">
                  {(mediaStatus?.providers.includes("gcs")
                    ? mediaStatus.providers
                    : [...(mediaStatus?.providers ?? []), "gcs"]
                  ).map((p) => {
                    const isActive = mediaStatus?.providers.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() => setSettingsProviderView(settingsProviderView === p ? null : p)}
                        data-testid={`badge-provider-${p}`}
                      >
                        <Badge variant={settingsProviderView === p ? "default" : "outline"} className={`cursor-pointer gap-1.5 ${!isActive ? "opacity-60" : ""}`}>
                          {isActive && <span className="inline-block h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />}
                          {p === "gcs" ? "Cloud Storage" : p === "local" ? "Local Filesystem" : p}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              {settingsProviderView === "local" && (
                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <IconFolder className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Local Filesystem</p>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-2">
                    <p>Images stored locally are served from the <code className="bg-muted px-1 rounded text-foreground">marketing-content/images/</code> folder.</p>
                    <div className="space-y-1.5">
                      <p className="font-medium text-foreground text-xs">How to add images:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Place image files (PNG, JPG, WebP, SVG, AVIF, GIF) into <code className="bg-muted px-1 rounded text-foreground">marketing-content/images/</code></li>
                        <li>Click the scan button in the gallery toolbar to detect new files</li>
                        <li>Review the scan results and click Apply to register them</li>
                      </ol>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-medium text-foreground text-xs">How they appear in the gallery:</p>
                      <p>Each registered image gets a unique ID derived from its filename. The ID, alt text, tags, and focal point are stored in <code className="bg-muted px-1 rounded text-foreground">image-registry.json</code>. Images can then be selected by ID or URL in any content editor.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50 border border-dashed">
                    <IconAlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Always delete images through the gallery (not manually from the filesystem). Manual deletion can leave broken references in YAML content files and the image registry.
                    </p>
                  </div>
                  {cloudProvider && localImageCount > 0 && (
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-xs font-medium text-foreground">Migrate to {cloudProviderLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        Upload all <span className="font-semibold text-foreground">{localImageCount}</span> local image{localImageCount !== 1 ? "s" : ""} to <span className="font-semibold text-foreground">{cloudProviderLabel}</span>. All YAML content references will be updated automatically.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMigrateConfirmOpen(true)}
                        disabled={migrating}
                        data-testid="button-migrate-to-cloud"
                      >
                        <IconCloud className="h-4 w-4 mr-2" />
                        {migrating ? "Migrating..." : `Migrate ${localImageCount} image${localImageCount !== 1 ? "s" : ""} to ${cloudProviderLabel}`}
                      </Button>
                    </div>
                  )}
                  {cloudProvider && localImageCount === 0 && (
                    <div className="border-t pt-3 flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-xs text-muted-foreground">All images are already stored in {cloudProviderLabel}.</p>
                      {redundantCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setRedundantOpen(true); setRedundantResult(null); }}
                          data-testid="button-redundant-images"
                        >
                          <IconAlertTriangle className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                          {redundantCount} Redundant {redundantCount === 1 ? "image" : "images"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {settingsProviderView === "gcs" && !mediaStatus?.gcs && (
                <div className="rounded-md border border-dashed p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <IconCloud className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Google Cloud Storage</p>
                    <Badge variant="outline" className="text-xs">Not configured</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cloud storage is not active. Set the environment variables below to enable it.
                  </p>
                </div>
              )}

              {settingsProviderView === "gcs" && mediaStatus?.gcs && (
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <IconCloud className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Google Cloud Storage</p>
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">Active</Badge>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Bucket</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded" data-testid="text-gcs-bucket">{mediaStatus.gcs.bucket}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Base Path</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded" data-testid="text-gcs-base-path">{mediaStatus.gcs.basePath}/</code>
                    </div>
                    {mediaStatus.gcs.projectId && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Project ID</span>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded" data-testid="text-gcs-project">{mediaStatus.gcs.projectId}</code>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {settingsProviderView === "gcs" && (
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-sm font-medium">{mediaStatus?.gcs ? "Configuration Reference" : "Setup Guide"}</p>
                  <div className="text-xs text-muted-foreground space-y-1.5">
                    <p>{mediaStatus?.gcs ? "Cloud storage is configured with these environment variables:" : "Configure these environment variables to enable cloud storage:"}</p>
                    <div className="space-y-1 font-mono bg-muted p-2 rounded">
                      <p><span className="text-foreground">GCS_BUCKET_NAME</span> - Bucket name</p>
                      <p><span className="text-foreground">GCS_PROJECT_ID</span> - GCP project ID</p>
                      <p><span className="text-foreground">GCS_CREDENTIALS_JSON</span> - Service account key JSON</p>
                      <p><span className="text-foreground">GCS_BASE_PATH</span> - Folder prefix (default: media)</p>
                      <p><span className="text-foreground">MEDIA_DEFAULT_PROVIDER</span> - Set to "gcs" for cloud default</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setSettingsOpen(false); setSettingsProviderView(null); }} data-testid="button-close-settings">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={migrateConfirmOpen} onOpenChange={setMigrateConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Migrate Local Images to {cloudProviderLabel}</DialogTitle>
            <DialogDescription>
              This will upload {localImageCount} local image{localImageCount !== 1 ? "s" : ""} to {cloudProviderLabel}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded bg-destructive/10 border border-destructive/20">
              <IconAlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1.5">
                <p className="font-medium text-destructive">This action is not reversible</p>
                <p className="text-muted-foreground">
                  All {localImageCount} local image{localImageCount !== 1 ? "s" : ""} will be uploaded to {cloudProviderLabel}. Image references in YAML content files and the image registry will be permanently updated to point to the cloud URLs.
                </p>
                <p className="text-muted-foreground">
                  The updated YAML files will <span className="font-medium text-foreground">not</span> be automatically committed to GitHub. You will need to commit and push the changes manually after migration.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setMigrateConfirmOpen(false)} data-testid="button-cancel-migrate">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleMigrate} data-testid="button-confirm-migrate">
              <IconCloud className="h-4 w-4 mr-2" />
              Migrate {localImageCount} image{localImageCount !== 1 ? "s" : ""} to {cloudProviderLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={migrateResults !== null} onOpenChange={(open) => { if (!open) setMigrateResults(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Migration Results</DialogTitle>
          </DialogHeader>
          {migrateResults && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{migrateResults.message}</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600 dark:text-green-400">
                  {migrateResults.migratedCount} migrated
                </span>
                {migrateResults.totalProcessed - migrateResults.migratedCount > 0 && (
                  <span className="text-muted-foreground">
                    {migrateResults.totalProcessed - migrateResults.migratedCount} skipped/failed
                  </span>
                )}
              </div>
              <ScrollArea className="max-h-[300px]">
                <div className="border rounded-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium">Image ID</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {migrateResults.results.map((result) => (
                        <tr
                          key={result.id}
                          className={result.status === "migrated"
                            ? "bg-green-50 dark:bg-green-950/30"
                            : "bg-muted/30"
                          }
                        >
                          <td className="px-3 py-2 font-mono text-xs truncate max-w-[200px]" data-testid={`text-migrate-id-${result.id}`}>
                            {result.id}
                          </td>
                          <td className={`px-3 py-2 text-xs ${result.status === "migrated" ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`} data-testid={`text-migrate-status-${result.id}`}>
                            {result.status}
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
            <Button onClick={() => setMigrateResults(null)} data-testid="button-close-migrate-results">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={redundantOpen} onOpenChange={(open) => { if (!open) { setRedundantOpen(false); setRedundantResult(null); setRedundantVisible(10); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Redundant Images Found</DialogTitle>
            <DialogDescription>
              There {redundantCount === 1 ? "is" : "are"} <span className="font-semibold text-foreground">{redundantCount}</span> {redundantCount === 1 ? "image" : "images"} that {redundantCount === 1 ? "has a copy" : "have copies"} in the cloud but also in the local filesystem. What do you want to do?
            </DialogDescription>
          </DialogHeader>

          {!redundantResult ? (
            <div className="space-y-3">
              <ScrollArea className="max-h-72 rounded-md border">
                <div className="divide-y">
                  {(redundantData?.images ?? []).slice(0, redundantVisible).map((img) => (
                    <div key={img.id} className="px-3 py-2.5 space-y-1.5">
                      <p className="text-xs font-mono font-medium text-foreground truncate" data-testid={`text-redundant-id-${img.id}`}>{img.id}</p>
                      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 items-start">
                        <div className="flex items-center gap-1 pt-px">
                          <IconCloud className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground">Cloud</span>
                        </div>
                        <a href={img.cloudUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-muted-foreground break-all leading-relaxed hover:underline" data-testid={`link-cloud-${img.id}`}>{img.cloudUrl}</a>
                        <div className="flex items-center gap-1 pt-px">
                          <IconFolder className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground">Local</span>
                        </div>
                        <a href={img.localPath} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-muted-foreground break-all leading-relaxed hover:underline" data-testid={`link-local-${img.id}`}>{img.localPath}</a>
                      </div>
                    </div>
                  ))}
                </div>
                {redundantVisible < redundantCount && (
                  <div className="p-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setRedundantVisible(v => v + 10)}
                      data-testid="button-load-more-redundant"
                    >
                      Load 10 more ({redundantCount - redundantVisible} remaining)
                    </Button>
                  </div>
                )}
              </ScrollArea>

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Choose an action to apply to all {redundantCount} {redundantCount === 1 ? "image" : "images"}:</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    disabled={resolveRedundancyMutation.isPending}
                    onClick={() => resolveRedundancyMutation.mutate("delete-local")}
                    data-testid="button-delete-local-redundant"
                  >
                    {resolveRedundancyMutation.isPending && resolveRedundancyMutation.variables === "delete-local"
                      ? <IconLoader2 className="h-4 w-4 animate-spin" />
                      : <IconFolder className="h-4 w-4 text-muted-foreground" />
                    }
                    <span className="flex flex-col items-start text-left">
                      <span className="text-xs font-medium">Delete local</span>
                      <span className="text-xs text-muted-foreground font-normal">Keep cloud copy</span>
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    disabled={resolveRedundancyMutation.isPending}
                    onClick={() => resolveRedundancyMutation.mutate("delete-cloud")}
                    data-testid="button-delete-cloud-redundant"
                  >
                    {resolveRedundancyMutation.isPending && resolveRedundancyMutation.variables === "delete-cloud"
                      ? <IconLoader2 className="h-4 w-4 animate-spin" />
                      : <IconCloud className="h-4 w-4 text-muted-foreground" />
                    }
                    <span className="flex flex-col items-start text-left">
                      <span className="text-xs font-medium">Delete cloud</span>
                      <span className="text-xs text-muted-foreground font-normal">Keep local copy</span>
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 py-1">
              <p className="text-sm text-muted-foreground">
                {redundantResult.resolved} {redundantResult.resolved === 1 ? "image" : "images"} resolved successfully.
                {redundantResult.errors.length > 0 && ` ${redundantResult.errors.length} error(s) occurred.`}
              </p>
              {redundantResult.errors.length > 0 && (
                <ScrollArea className="max-h-48 rounded-md border p-2">
                  <div className="space-y-1">
                    {redundantResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive font-mono">{e}</p>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setRedundantOpen(false); setRedundantResult(null); setRedundantVisible(10); }}
              data-testid="button-close-redundant"
            >
              {redundantResult ? "Close" : "Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
