import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IconArrowLeft,
  IconDatabase,
  IconRefresh,
  IconSearch,
  IconTable,
  IconApi,
  IconClock,
  IconArrowsSort,
  IconChevronUp,
  IconChevronDown,
  IconLoader2,
  IconPlus,
  IconCheck,
  IconX,
  IconTestPipe,
  IconTrash,
  IconAlertTriangle,
  IconSettings,
  IconDownload,
  IconDeviceFloppy,
  IconEdit,
  IconWand,
  IconArrowRight,
  IconTrashX,
  IconPencil,
  IconArrowsExchange,
  IconEye,
  IconCode,
  IconUpload,
  IconFile,
  IconCloudUpload,
  IconLink,
  IconServer,
} from "@tabler/icons-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DatabaseSummary {
  name: string;
  label: string;
  description: string | null;
  source_type: string;
  field_count: number;
}

type SourceType = "api" | "local" | "remote";

interface DatabaseDetail {
  name: string;
  config: {
    name: string;
    description?: string;
    source: {
      type: string;
      api?: {
        endpoint: string;
        params?: Record<string, unknown>;
        results_path?: string;
        auth?: { token_env_var?: string; prefix?: string };
        headers?: Record<string, string>;
      };
      local?: {
        filename: string;
        results_path?: string;
      };
      remote?: {
        url: string;
        results_path?: string;
      };
    };
    cache?: { ttl_hours?: number };
    field_mapping?: Record<string, string>;
  };
  cache_status?: {
    fetched_at: string;
    item_count: number;
  } | null;
}

interface DatasetFile {
  id: string;
  filename: string;
  dbSlug: string;
  provider: "local";
  path: string;
}

interface DatabaseItems {
  items: Record<string, unknown>[];
  raw_count: number;
  fetched_at: string;
  from_cache: boolean;
}

interface KeyValuePair {
  key: string;
  value: string;
}

interface FieldEntry {
  sourcePath: string;
  normalizedKey: string;
  enabled: boolean;
}

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return [];
  const paths: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      paths.push(...flattenKeys(value, fullPath));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function DatasetPickerDialog({
  open,
  onOpenChange,
  slug,
  onSelected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  onSelected: (result: { provider: "local"; filename: string; path: string }) => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"browse" | "upload">("browse");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DatasetFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: datasetsData, isLoading: loadingDatasets } = useQuery<{ datasets: DatasetFile[] }>({
    queryKey: ["/api/databases/datasets"],
    enabled: open && mode === "browse",
  });

  const datasets = datasetsData?.datasets || [];
  const filtered = datasets.filter(
    (d) =>
      !search ||
      d.filename.toLowerCase().includes(search.toLowerCase()) ||
      d.dbSlug.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpload = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slug", slug || "datasets");
      const res = await fetch("/api/databases/upload-dataset", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      toast({ title: "File uploaded", description: data.filename });
      onSelected({ provider: "local", filename: data.filename, path: data.path });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setSearch("");
          setSelected(null);
          setMode("browse");
        }
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pick Dataset File</DialogTitle>
          <DialogDescription>
            Browse existing dataset files or upload a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
          <div className="flex rounded-md border overflow-visible">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`flex-1 rounded-none toggle-elevate ${mode === "browse" ? "toggle-elevated bg-muted" : ""}`}
              onClick={() => setMode("browse")}
              data-testid="button-dataset-picker-browse"
            >
              <IconSearch className="h-4 w-4 mr-1.5" />
              Browse
            </Button>
            <div className="w-px bg-border" />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`flex-1 rounded-none toggle-elevate ${mode === "upload" ? "toggle-elevated bg-muted" : ""}`}
              onClick={() => setMode("upload")}
              data-testid="button-dataset-picker-upload"
            >
              <IconUpload className="h-4 w-4 mr-1.5" />
              Upload
            </Button>
          </div>

          {mode === "browse" ? (
            <>
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-dataset-search"
                />
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {loadingDatasets ? (
                  <div className="flex items-center justify-center py-8">
                    <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <IconFile className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No dataset files found</p>
                    <p className="text-xs text-muted-foreground">
                      Switch to Upload to add a new file, or place files in{" "}
                      <code className="bg-muted px-1 rounded">marketing-content/db/</code>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filtered.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelected(d)}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-md border-2 transition-colors ${
                          selected?.id === d.id
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:border-muted-foreground/30 hover:bg-muted/50"
                        }`}
                        data-testid={`dataset-file-${d.id}`}
                      >
                        <IconFile className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{d.filename}</p>
                          <p className="text-xs text-muted-foreground truncate">{d.path}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          <IconServer className="h-3 w-3 mr-1" />
                          local
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv,.yaml,.yml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleUpload(e.target.files);
                  e.target.value = "";
                }}
                data-testid="input-dataset-file-upload"
              />
              <div
                className={`w-full rounded-md border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/30 hover:border-muted-foreground/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-dataset-upload"
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <IconCloudUpload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Drop a file here or click to browse</p>
                    <p className="text-xs text-muted-foreground">JSON, CSV, YAML (max 50 MB)</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Saves to marketing-content/db/{slug || "<slug>"}/
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-dataset-picker-cancel"
          >
            Cancel
          </Button>
          {mode === "browse" && (
            <Button
              type="button"
              disabled={!selected}
              onClick={() => {
                if (selected) {
                  onSelected({ provider: "local", filename: selected.filename, path: selected.path });
                  onOpenChange(false);
                }
              }}
              data-testid="button-dataset-picker-select"
            >
              <IconCheck className="h-4 w-4 mr-2" />
              Select
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function lastSegment(dotPath: string): string {
  const parts = dotPath.split(".");
  return parts[parts.length - 1];
}

function CreateDatabaseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (slug: string) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [ttlHours, setTtlHours] = useState("24");

  const [sourceType, setSourceType] = useState<SourceType>("api");
  const [endpoint, setEndpoint] = useState("");
  const [resultsPath, setResultsPath] = useState("");
  const [tokenEnvVar, setTokenEnvVar] = useState("");
  const [authPrefix, setAuthPrefix] = useState("Bearer");
  const [params, setParams] = useState<KeyValuePair[]>([]);
  const [headers, setHeaders] = useState<KeyValuePair[]>([]);
  const [localFilename, setLocalFilename] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [datasetPickerOpen, setDatasetPickerOpen] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    item_count?: number;
    sample?: unknown;
    error?: string;
  } | null>(null);
  const [fields, setFields] = useState<FieldEntry[]>([]);

  const resetForm = useCallback(() => {
    setStep(1);
    setDisplayName("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setTtlHours("24");
    setSourceType("api");
    setEndpoint("");
    setResultsPath("");
    setTokenEnvVar("");
    setAuthPrefix("Bearer");
    setParams([]);
    setHeaders([]);
    setLocalFilename("");
    setRemoteUrl("");
    setDatasetPickerOpen(false);
    setTesting(false);
    setTestResult(null);
    setFields([]);
    setSaving(false);
  }, []);

  const handleNameChange = (val: string) => {
    setDisplayName(val);
    if (!slugTouched) {
      setSlug(slugify(val));
    }
  };

  const buildSourceConfig = () => {
    if (sourceType === "local") {
      return {
        type: "local",
        local: {
          filename: localFilename,
          ...(resultsPath ? { results_path: resultsPath } : {}),
        },
      };
    }
    if (sourceType === "remote") {
      return {
        type: "remote",
        remote: {
          url: remoteUrl,
          ...(resultsPath ? { results_path: resultsPath } : {}),
        },
      };
    }
    const source: Record<string, unknown> = { type: "api" };
    const api: Record<string, unknown> = { endpoint };
    if (resultsPath) api.results_path = resultsPath;
    if (tokenEnvVar) {
      api.auth = { token_env_var: tokenEnvVar, prefix: authPrefix || "Bearer" };
    }
    const filteredParams = params.filter((p) => p.key.trim());
    if (filteredParams.length > 0) {
      api.params = Object.fromEntries(filteredParams.map((p) => [p.key, p.value]));
    }
    const filteredHeaders = headers.filter((h) => h.key.trim());
    if (filteredHeaders.length > 0) {
      api.headers = Object.fromEntries(filteredHeaders.map((h) => [h.key, h.value]));
    }
    source.api = api;
    return source;
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/databases/_test/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: buildSourceConfig(), slug }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success && data.sample) {
        const paths = flattenKeys(data.sample);
        setFields(
          paths.map((p) => ({
            sourcePath: p,
            normalizedKey: lastSegment(p),
            enabled: true,
          }))
        );
      }
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const fieldMapping: Record<string, string> = {};
      for (const f of fields) {
        if (f.enabled && f.normalizedKey.trim()) {
          fieldMapping[f.normalizedKey] = f.sourcePath;
        }
      }

      const config = {
        name: displayName,
        description: description || undefined,
        source: buildSourceConfig(),
        cache: { ttl_hours: ttlHours !== "" && Number.isFinite(Number(ttlHours)) ? Number(ttlHours) : 24 },
        field_mapping: Object.keys(fieldMapping).length > 0 ? fieldMapping : undefined,
      };

      const res = await fetch("/api/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, config }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create database");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/databases"] });
      toast({ title: "Database created", description: `"${displayName}" is ready.` });
      onOpenChange(false);
      resetForm();
      onCreated(slug);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const slugValid = /^[a-z0-9_-]+$/.test(slug);
  const canProceedStep1 = displayName.trim() && slug.trim() && slugValid;
  const canProceedStep2 =
    sourceType === "api"
      ? endpoint.trim().length > 0
      : sourceType === "local"
      ? localFilename.trim().length > 0
      : remoteUrl.trim().length > 0;
  const canCreate = fields.some((f) => f.enabled) || fields.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Create Database
          </DialogTitle>
          <DialogDescription>
            Step {step} of 3 —{" "}
            {step === 1 ? "Basics" : step === 2 ? "Data Source" : "Test & Map Fields"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="db-name">Display Name</Label>
              <Input
                id="db-name"
                placeholder="e.g. Upcoming Cohorts"
                value={displayName}
                onChange={(e) => handleNameChange(e.target.value)}
                data-testid="input-db-display-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="db-slug">Slug</Label>
              <Input
                id="db-slug"
                placeholder="e.g. upcoming_cohorts"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                data-testid="input-db-slug"
              />
              {slug && !slugValid && (
                <p className="text-xs text-destructive">
                  Only lowercase letters, digits, hyphens, and underscores allowed.
                </p>
              )}
              {(!slug || slugValid) && (
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, digits, hyphens, and underscores only.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="db-desc">Description (optional)</Label>
              <Textarea
                id="db-desc"
                placeholder="What data does this database contain?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none text-sm"
                rows={2}
                data-testid="input-db-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="db-ttl">Cache TTL (hours)</Label>
              <Input
                id="db-ttl"
                type="number"
                min="0"
                value={ttlHours}
                onChange={(e) => setTtlHours(e.target.value)}
                className="w-24"
                data-testid="input-db-ttl"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="db-source-type">Source Type</Label>
              <Select value={sourceType} onValueChange={(v) => { setSourceType(v as SourceType); setResultsPath(""); }}>
                <SelectTrigger id="db-source-type" data-testid="select-db-source-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">
                    <div className="flex items-center gap-2">
                      <IconApi className="h-4 w-4" />
                      API Endpoint
                    </div>
                  </SelectItem>
                  <SelectItem value="local">
                    <div className="flex items-center gap-2">
                      <IconServer className="h-4 w-4" />
                      Local File
                    </div>
                  </SelectItem>
                  <SelectItem value="remote">
                    <div className="flex items-center gap-2">
                      <IconLink className="h-4 w-4" />
                      Remote File
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sourceType === "api" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="db-endpoint">Endpoint URL</Label>
                  <Input
                    id="db-endpoint"
                    placeholder="https://api.example.com/v1/items"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    data-testid="input-db-endpoint"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="db-results-path">Results Path (optional)</Label>
                  <Input
                    id="db-results-path"
                    placeholder="e.g. results, data.items"
                    value={resultsPath}
                    onChange={(e) => setResultsPath(e.target.value)}
                    data-testid="input-db-results-path"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dot-notation path to the array in the API response. Leave empty if the response is already an array.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Authentication (optional)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="ENV var name"
                      value={tokenEnvVar}
                      onChange={(e) => setTokenEnvVar(e.target.value)}
                      data-testid="input-db-token-env"
                    />
                    <Input
                      placeholder="Prefix (Bearer, Token...)"
                      value={authPrefix}
                      onChange={(e) => setAuthPrefix(e.target.value)}
                      data-testid="input-db-auth-prefix"
                    />
                  </div>
                </div>
                <KeyValueEditor
                  label="Query Parameters"
                  pairs={params}
                  onChange={setParams}
                  keyPlaceholder="param name"
                  valuePlaceholder="value"
                  testIdPrefix="param"
                />
                <KeyValueEditor
                  label="Headers"
                  pairs={headers}
                  onChange={setHeaders}
                  keyPlaceholder="header name"
                  valuePlaceholder="value"
                  testIdPrefix="header"
                />
              </>
            )}

            {sourceType === "local" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="db-local-filename">Filename</Label>
                  <div className="flex gap-2">
                    <Input
                      id="db-local-filename"
                      placeholder="e.g. products.json, data.csv"
                      value={localFilename}
                      onChange={(e) => setLocalFilename(e.target.value)}
                      data-testid="input-db-local-filename"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDatasetPickerOpen(true)}
                      data-testid="button-db-pick-file-local"
                    >
                      <IconFile className="h-4 w-4 mr-1.5" />
                      Pick File
                    </Button>
                  </div>
                  <div className="rounded-md bg-muted/50 border px-3 py-2 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Where to place the file</p>
                    <p>
                      Put your file at{" "}
                      <code className="bg-muted px-1 rounded">
                        marketing-content/db/{slug || "<slug>"}/<span className="text-foreground">{localFilename || "your-file.json"}</span>
                      </code>{" "}
                      before syncing.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="db-local-results-path">Results Path (optional)</Label>
                  <Input
                    id="db-local-results-path"
                    placeholder="e.g. results, data.items"
                    value={resultsPath}
                    onChange={(e) => setResultsPath(e.target.value)}
                    data-testid="input-db-local-results-path"
                  />
                  <p className="text-xs text-muted-foreground">
                    For JSON files: dot-notation path to the array. Leave empty if the file is already an array.
                  </p>
                </div>
              </>
            )}

            {sourceType === "remote" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="db-remote-url">Remote URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="db-remote-url"
                      placeholder="https://example.com/data.json"
                      value={remoteUrl}
                      onChange={(e) => setRemoteUrl(e.target.value)}
                      data-testid="input-db-remote-url"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDatasetPickerOpen(true)}
                      data-testid="button-db-pick-file-remote"
                    >
                      <IconFile className="h-4 w-4 mr-1.5" />
                      Pick File
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Direct URL to a JSON, CSV, or YAML file. Use "Pick File" to browse or upload a file from storage.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="db-remote-results-path">Results Path (optional)</Label>
                  <Input
                    id="db-remote-results-path"
                    placeholder="e.g. results, data.items"
                    value={resultsPath}
                    onChange={(e) => setResultsPath(e.target.value)}
                    data-testid="input-db-remote-results-path"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dot-notation path to the array. Leave empty if the response is already an array.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing}
                data-testid="button-test-connection"
              >
                {testing ? (
                  <IconLoader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <IconTestPipe className="h-3.5 w-3.5 mr-1" />
                )}
                Test Connection
              </Button>
              {testResult && (
                <Badge variant={testResult.success ? "secondary" : "destructive"}>
                  {testResult.success ? (
                    <>
                      <IconCheck className="h-3 w-3 mr-1" />
                      {testResult.item_count} items found
                    </>
                  ) : (
                    <>
                      <IconX className="h-3 w-3 mr-1" />
                      Failed
                    </>
                  )}
                </Badge>
              )}
            </div>

            {testResult?.error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-xs text-destructive">
                {testResult.error}
              </div>
            )}

            {testResult?.success && fields.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">Field Mapping</Label>
                  <p className="text-xs text-muted-foreground">
                    {fields.filter((f) => f.enabled).length} of {fields.length} fields selected
                  </p>
                </div>
                <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                  {fields.map((field, i) => (
                    <div
                      key={field.sourcePath}
                      className="flex items-center gap-2 px-3 py-2"
                      data-testid={`field-mapping-${i}`}
                    >
                      <Switch
                        checked={field.enabled}
                        onCheckedChange={(checked) => {
                          const updated = [...fields];
                          updated[i] = { ...updated[i], enabled: checked };
                          setFields(updated);
                        }}
                        data-testid={`switch-field-${i}`}
                      />
                      <Input
                        value={field.normalizedKey}
                        onChange={(e) => {
                          const updated = [...fields];
                          updated[i] = { ...updated[i], normalizedKey: e.target.value };
                          setFields(updated);
                        }}
                        className="h-7 text-xs flex-1"
                        disabled={!field.enabled}
                        data-testid={`input-field-key-${i}`}
                      />
                      <code className="text-xs text-muted-foreground shrink-0 max-w-[200px] truncate" title={field.sourcePath}>
                        {field.sourcePath}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {testResult?.success && fields.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No fields detected in sample. The database will store raw items without field mapping.
              </p>
            )}

            {!testResult && (
              <div className="text-center py-8">
                <IconTestPipe className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Test the connection to preview the data and configure field mappings.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <div>
            {step > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(step - 1)}
                data-testid="button-step-back"
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step < 3 && (
              <Button
                size="sm"
                onClick={() => setStep(step + 1)}
                disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                data-testid="button-step-next"
              >
                Next
              </Button>
            )}
            {step === 3 && (
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={saving || !canCreate}
                data-testid="button-create-database"
              >
                {saving ? (
                  <IconLoader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <IconPlus className="h-3.5 w-3.5 mr-1" />
                )}
                Create Database
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      <DatasetPickerDialog
        open={datasetPickerOpen}
        onOpenChange={setDatasetPickerOpen}
        slug={slug}
        onSelected={(result) => {
          setLocalFilename(result.filename);
          setSourceType("local");
        }}
      />
    </Dialog>
  );
}

function KeyValueEditor({
  label,
  pairs,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  testIdPrefix,
}: {
  label: string;
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
  testIdPrefix: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">{label}</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...pairs, { key: "", value: "" }])}
          data-testid={`button-add-${testIdPrefix}`}
        >
          <IconPlus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      {pairs.map((pair, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder={keyPlaceholder}
            value={pair.key}
            onChange={(e) => {
              const updated = [...pairs];
              updated[i] = { ...updated[i], key: e.target.value };
              onChange(updated);
            }}
            className="h-8 text-xs flex-1"
            data-testid={`input-${testIdPrefix}-key-${i}`}
          />
          <Input
            placeholder={valuePlaceholder}
            value={pair.value}
            onChange={(e) => {
              const updated = [...pairs];
              updated[i] = { ...updated[i], value: e.target.value };
              onChange(updated);
            }}
            className="h-8 text-xs flex-1"
            data-testid={`input-${testIdPrefix}-value-${i}`}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange(pairs.filter((_, j) => j !== i))}
            data-testid={`button-remove-${testIdPrefix}-${i}`}
          >
            <IconTrash className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function DatabaseList() {
  const [createOpen, setCreateOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("create") === "true") {
        params.delete("create");
        const newUrl = params.toString()
          ? `${window.location.pathname}?${params.toString()}`
          : window.location.pathname;
        window.history.replaceState({}, "", newUrl);
        return true;
      }
    }
    return false;
  });
  const [, navigate] = useLocation();
  const { data: databases, isLoading } = useQuery<DatabaseSummary[]>({
    queryKey: ["/api/databases"],
  });

  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <IconDatabase className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Databases</h1>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-new-database">
          <IconPlus className="h-4 w-4 mr-1" />
          New Database
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !databases || databases.length === 0 ? (
        <div className="text-center py-20">
          <IconDatabase className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No databases configured yet.</p>
          <p className="text-xs text-muted-foreground mt-2">
            Click "New Database" to create your first one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {databases.map((db) => (
            <Link key={db.name} href={`/private/databases/${db.name}`}>
              <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-database-${db.name}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <IconDatabase className="h-4 w-4 text-primary flex-shrink-0" />
                    <CardTitle className="text-base truncate">{db.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {db.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{db.description}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {db.source_type === "local" ? (
                        <IconServer className="h-3 w-3 mr-1" />
                      ) : db.source_type === "remote" ? (
                        <IconLink className="h-3 w-3 mr-1" />
                      ) : (
                        <IconApi className="h-3 w-3 mr-1" />
                      )}
                      {db.source_type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {db.field_count} fields
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateDatabaseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(slug) => navigate(`/private/databases/${slug}`)}
      />
    </>
  );
}

function DatabaseConfigEditor({
  dbName,
  config,
  onSaved,
}: {
  dbName: string;
  config: DatabaseDetail["config"];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [sourceType, setSourceType] = useState<SourceType>(() => {
    const t = config.source.type;
    if (t === "local" || t === "remote") return t;
    return "api";
  });
  const [endpoint, setEndpoint] = useState(config.source.api?.endpoint || "");
  const [resultsPath, setResultsPath] = useState(
    config.source.api?.results_path ||
    config.source.local?.results_path ||
    config.source.remote?.results_path ||
    ""
  );
  const [tokenEnvVar, setTokenEnvVar] = useState(config.source.api?.auth?.token_env_var || "");
  const [authPrefix, setAuthPrefix] = useState(config.source.api?.auth?.prefix || "Bearer");
  const [ttlHours, setTtlHours] = useState(String(config.cache?.ttl_hours ?? 24));
  const [params, setParams] = useState<KeyValuePair[]>(() => {
    const p = config.source.api?.params;
    if (!p || Object.keys(p).length === 0) return [];
    return Object.entries(p).map(([key, value]) => ({ key, value: String(value) }));
  });
  const [headers, setHeaders] = useState<KeyValuePair[]>(() => {
    const h = config.source.api?.headers;
    if (!h || Object.keys(h).length === 0) return [];
    return Object.entries(h).map(([key, value]) => ({ key, value }));
  });
  const [localFilename, setLocalFilename] = useState(config.source.local?.filename || "");
  const [remoteUrl, setRemoteUrl] = useState(config.source.remote?.url || "");
  const [datasetPickerOpen, setDatasetPickerOpen] = useState(false);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    item_count?: number;
    error?: string;
  } | null>(null);

  const canSave =
    sourceType === "api"
      ? endpoint.trim().length > 0
      : sourceType === "local"
      ? localFilename.trim().length > 0
      : remoteUrl.trim().length > 0;

  const buildSourceConfig = () => {
    if (sourceType === "local") {
      return {
        type: "local",
        local: {
          filename: localFilename,
          ...(resultsPath ? { results_path: resultsPath } : {}),
        },
      };
    }
    if (sourceType === "remote") {
      return {
        type: "remote",
        remote: {
          url: remoteUrl,
          ...(resultsPath ? { results_path: resultsPath } : {}),
        },
      };
    }
    const source: Record<string, unknown> = { type: "api" };
    const api: Record<string, unknown> = { endpoint };
    if (resultsPath) api.results_path = resultsPath;
    if (tokenEnvVar) {
      api.auth = { token_env_var: tokenEnvVar, prefix: authPrefix || "Bearer" };
    }
    const filteredParams = params.filter((p) => p.key.trim());
    if (filteredParams.length > 0) {
      api.params = Object.fromEntries(filteredParams.map((p) => [p.key, p.value]));
    }
    const filteredHeaders = headers.filter((h) => h.key.trim());
    if (filteredHeaders.length > 0) {
      api.headers = Object.fromEntries(filteredHeaders.map((h) => [h.key, h.value]));
    }
    source.api = api;
    return source;
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/databases/${dbName}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: buildSourceConfig() }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedConfig = {
        name: config.name,
        description: config.description || undefined,
        source: buildSourceConfig(),
        cache: { ttl_hours: ttlHours !== "" && Number.isFinite(Number(ttlHours)) ? Number(ttlHours) : 24 },
        field_mapping: config.field_mapping || undefined,
      };

      const res = await fetch(`/api/databases/${dbName}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedConfig),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save config");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/databases", dbName] });
      queryClient.invalidateQueries({ queryKey: ["/api/databases"] });
      toast({ title: "Configuration saved" });
      onSaved();
    } catch (err) {
      toast({
        title: "Error saving",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/databases/${dbName}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/databases"] });
      toast({ title: "Database deleted" });
      navigate("/private/databases");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-source-type">Source Type</Label>
          <Select value={sourceType} onValueChange={(v) => { setSourceType(v as SourceType); setResultsPath(""); }}>
            <SelectTrigger id="edit-source-type" data-testid="select-edit-source-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="api">
                <div className="flex items-center gap-2">
                  <IconApi className="h-4 w-4" />
                  API Endpoint
                </div>
              </SelectItem>
              <SelectItem value="local">
                <div className="flex items-center gap-2">
                  <IconServer className="h-4 w-4" />
                  Local File
                </div>
              </SelectItem>
              <SelectItem value="remote">
                <div className="flex items-center gap-2">
                  <IconLink className="h-4 w-4" />
                  Remote File
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-ttl">Cache TTL (hours)</Label>
          <Input
            id="edit-ttl"
            type="number"
            min="0"
            value={ttlHours}
            onChange={(e) => setTtlHours(e.target.value)}
            className="w-24"
            data-testid="input-edit-ttl"
          />
        </div>
      </div>

      {sourceType === "api" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="edit-endpoint">Endpoint URL</Label>
            <Input
              id="edit-endpoint"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              data-testid="input-edit-endpoint"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-results-path">Results Path (optional)</Label>
            <Input
              id="edit-results-path"
              placeholder="e.g. results, data.items"
              value={resultsPath}
              onChange={(e) => setResultsPath(e.target.value)}
              data-testid="input-edit-results-path"
            />
            <p className="text-xs text-muted-foreground">
              Dot-notation path to the array in the API response. Leave empty if the response is already an array.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Authentication</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="ENV var name"
                value={tokenEnvVar}
                onChange={(e) => setTokenEnvVar(e.target.value)}
                data-testid="input-edit-token-env"
              />
              <Input
                placeholder="Prefix (Bearer, Token...)"
                value={authPrefix}
                onChange={(e) => setAuthPrefix(e.target.value)}
                data-testid="input-edit-auth-prefix"
              />
            </div>
          </div>
          <KeyValueEditor
            label="Query Parameters"
            pairs={params}
            onChange={setParams}
            keyPlaceholder="param name"
            valuePlaceholder="value"
            testIdPrefix="edit-param"
          />
          <KeyValueEditor
            label="Headers"
            pairs={headers}
            onChange={setHeaders}
            keyPlaceholder="header name"
            valuePlaceholder="value"
            testIdPrefix="edit-header"
          />
        </>
      )}

      {sourceType === "local" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="edit-local-filename">Filename</Label>
            <div className="flex gap-2">
              <Input
                id="edit-local-filename"
                placeholder="e.g. products.json, data.csv"
                value={localFilename}
                onChange={(e) => setLocalFilename(e.target.value)}
                data-testid="input-edit-local-filename"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDatasetPickerOpen(true)}
                data-testid="button-edit-pick-file"
              >
                <IconFile className="h-4 w-4 mr-1.5" />
                Pick File
              </Button>
            </div>
            <div className="rounded-md bg-muted/50 border px-3 py-2 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Where to place the file</p>
              <p>
                Put your file at{" "}
                <code className="bg-muted px-1 rounded">
                  marketing-content/db/{dbName}/{localFilename || "your-file.json"}
                </code>{" "}
                before syncing.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-local-results-path">Results Path (optional)</Label>
            <Input
              id="edit-local-results-path"
              placeholder="e.g. results, data.items"
              value={resultsPath}
              onChange={(e) => setResultsPath(e.target.value)}
              data-testid="input-edit-local-results-path"
            />
            <p className="text-xs text-muted-foreground">
              For JSON files: dot-notation path to the array. Leave empty if the file is already an array.
            </p>
          </div>
        </>
      )}

      {sourceType === "remote" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="edit-remote-url">Remote URL</Label>
            <div className="flex gap-2">
              <Input
                id="edit-remote-url"
                placeholder="https://example.com/data.json"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                data-testid="input-edit-remote-url"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDatasetPickerOpen(true)}
                data-testid="button-edit-pick-file-remote"
              >
                <IconFile className="h-4 w-4 mr-1.5" />
                Pick File
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-remote-results-path">Results Path (optional)</Label>
            <Input
              id="edit-remote-results-path"
              placeholder="e.g. results, data.items"
              value={resultsPath}
              onChange={(e) => setResultsPath(e.target.value)}
              data-testid="input-edit-remote-results-path"
            />
            <p className="text-xs text-muted-foreground">
              Dot-notation path to the array. Leave empty if the response is already an array.
            </p>
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing || !canSave}
            data-testid="button-test-config"
          >
            {testing ? (
              <IconLoader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <IconTestPipe className="h-3.5 w-3.5 mr-1" />
            )}
            Test Connection
          </Button>
          {testResult && (
            <Badge variant={testResult.success ? "secondary" : "destructive"}>
              {testResult.success ? (
                <>
                  <IconCheck className="h-3 w-3 mr-1" />
                  {testResult.item_count} items found
                </>
              ) : (
                <>
                  <IconX className="h-3 w-3 mr-1" />
                  Failed
                </>
              )}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            data-testid="button-delete-database"
          >
            <IconTrash className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !canSave}
            data-testid="button-save-config"
          >
            {saving ? (
              <IconLoader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <IconDeviceFloppy className="h-3.5 w-3.5 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>

      {testResult?.error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-xs text-destructive">
          {testResult.error}
        </div>
      )}

      <DatasetPickerDialog
        open={datasetPickerOpen}
        onOpenChange={setDatasetPickerOpen}
        slug={dbName}
        onSelected={(result) => {
          setLocalFilename(result.filename);
          setSourceType("local");
        }}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Database</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{config.name}"? This will remove the configuration and cached data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              data-testid="button-confirm-delete"
            >
              {deleting ? (
                <IconLoader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <IconTrash className="h-3.5 w-3.5 mr-1" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldMappingEditor({
  dbName,
  config,
  onSaved,
}: {
  dbName: string;
  config: DatabaseDetail["config"];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiNotes, setAiNotes] = useState<string | null>(null);
  const [newFieldKey, setNewFieldKey] = useState("");
  const [sampleOpen, setSampleOpen] = useState(false);
  const [sampleData, setSampleData] = useState<{ items: Record<string, unknown>[]; count: number } | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);

  const handleViewSample = async () => {
    setSampleOpen(true);
    if (sampleData) return;
    setSampleLoading(true);
    try {
      const res = await fetch(`/api/databases/${dbName}/raw-sample?limit=3`);
      const data = await res.json();
      setSampleData(data);
    } catch {
      toast({ title: "Failed to load sample data", variant: "destructive" });
    } finally {
      setSampleLoading(false);
    }
  };

  const [fieldMappingEntries, setFieldMappingEntries] = useState<Record<string, string | null>>(() => {
    const fm = config.field_mapping;
    if (!fm || Object.keys(fm).length === 0) return {};
    return { ...fm };
  });

  useEffect(() => {
    const fm = config.field_mapping;
    setFieldMappingEntries(!fm || Object.keys(fm).length === 0 ? {} : { ...fm });
  }, [config.field_mapping]);

  const { data: rawFieldsData } = useQuery<{ fields: string[] }>({
    queryKey: [`/api/databases/${dbName}/raw-fields`],
  });
  const rawFields = rawFieldsData?.fields || [];

  const handleAnalyzeFields = async () => {
    setAiAnalyzing(true);
    setAiNotes(null);
    try {
      const res = await fetch(`/api/databases/${dbName}/analyze-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.error) {
        toast({ title: "AI analysis failed", description: data.error, variant: "destructive" });
        return;
      }
      if (data.field_mapping) {
        setFieldMappingEntries(data.field_mapping);
      }
      if (data.notes) {
        setAiNotes(data.notes);
      }
      toast({ title: "AI field mapping generated", description: `${Object.keys(data.field_mapping || {}).length} fields mapped` });
    } catch (err) {
      toast({ title: "AI analysis failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fieldMapping: Record<string, string> = {};
      for (const [key, value] of Object.entries(fieldMappingEntries)) {
        if (key.trim() && value != null) {
          fieldMapping[key] = value;
        }
      }

      const updatedConfig = {
        ...config,
        field_mapping: Object.keys(fieldMapping).length > 0 ? fieldMapping : undefined,
      };

      const res = await fetch(`/api/databases/${dbName}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedConfig),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save mappings");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/databases", dbName] });
      queryClient.invalidateQueries({ queryKey: ["/api/databases"] });
      toast({ title: "Field mapping saved" });
      onSaved();
    } catch (err) {
      toast({
        title: "Error saving",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={handleViewSample}
          disabled={rawFields.length === 0}
          data-testid="button-view-sample-data"
        >
          <IconEye className="h-3.5 w-3.5 mr-1" />
          Sample Data
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAnalyzeFields}
          disabled={aiAnalyzing || rawFields.length === 0}
          data-testid="button-ai-analyze-fields"
        >
          {aiAnalyzing ? (
            <IconLoader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <IconWand className="h-3.5 w-3.5 mr-1" />
          )}
          {aiAnalyzing ? "Analyzing..." : "Auto-detect"}
        </Button>
      </div>

      {aiNotes && (
        <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2" data-testid="text-ai-notes">
          {aiNotes}
        </p>
      )}

      {Object.keys(fieldMappingEntries).length > 0 && (
        <div className="space-y-2">
          {Object.entries(fieldMappingEntries).map(([normalizedKey, sourcePath]) => {
            const isFunction = sourcePath != null && sourcePath.startsWith("function:");
            const isCustom = !isFunction && sourcePath != null && sourcePath !== "" && !rawFields.includes(sourcePath);
            const selectValue = isFunction ? "__function__" : isCustom ? "__custom__" : (sourcePath || "__none__");
            const decodedFn = isFunction ? (() => { try { return atob(sourcePath.slice("function:".length)); } catch { return sourcePath; } })() : "";
            return (
              <div key={normalizedKey} className="space-y-1">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-medium w-28 flex-shrink-0 text-right text-muted-foreground truncate" title={normalizedKey}>
                    {normalizedKey}
                  </code>
                  <IconArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  {isFunction ? (
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] text-muted-foreground font-mono">(value, item) =&gt; ...</p>
                      <Textarea
                        value={decodedFn}
                        onChange={(e) => {
                          const encoded = "function:" + btoa(e.target.value);
                          setFieldMappingEntries((prev) => ({ ...prev, [normalizedKey]: encoded }));
                        }}
                        placeholder="(value, item) => value"
                        className="text-xs font-mono min-h-[3rem] resize-y"
                        data-testid={`textarea-transform-${normalizedKey}`}
                      />
                    </div>
                  ) : isCustom ? (
                    <>
                      <Input
                        value={sourcePath || ""}
                        onChange={(e) => setFieldMappingEntries((prev) => ({ ...prev, [normalizedKey]: e.target.value }))}
                        placeholder="e.g. author.details.name"
                        className="h-8 text-xs font-mono flex-1"
                        data-testid={`input-custom-path-${normalizedKey}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFieldMappingEntries((prev) => ({ ...prev, [normalizedKey]: null }))}
                        data-testid={`button-clear-custom-${normalizedKey}`}
                      >
                        <IconX className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Select
                      value={selectValue}
                      onValueChange={(v) => {
                        if (v === "__function__") {
                          setFieldMappingEntries((prev) => ({ ...prev, [normalizedKey]: "function:" + btoa("(value, item) => value") }));
                        } else if (v === "__custom__") {
                          setFieldMappingEntries((prev) => ({ ...prev, [normalizedKey]: "" }));
                        } else {
                          setFieldMappingEntries((prev) => ({ ...prev, [normalizedKey]: v === "__none__" ? null : v }));
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs font-mono flex-1" data-testid={`select-field-${normalizedKey}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">(not mapped)</SelectItem>
                        {rawFields.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                        <SelectItem value="__custom__">Custom path...</SelectItem>
                        <SelectItem value="__function__">Compute with function...</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setFieldMappingEntries((prev) => {
                        const next = { ...prev };
                        delete next[normalizedKey];
                        return next;
                      });
                    }}
                    data-testid={`button-delete-field-${normalizedKey}`}
                  >
                    <IconTrashX className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={newFieldKey}
          onChange={(e) => setNewFieldKey(e.target.value)}
          placeholder="Add field (e.g. author_name)"
          className="h-8 text-xs font-mono flex-1"
          data-testid="input-new-field-key"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newFieldKey.trim()) {
              setFieldMappingEntries((prev) => ({ ...prev, [newFieldKey.trim()]: null }));
              setNewFieldKey("");
            }
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!newFieldKey.trim()}
          onClick={() => {
            setFieldMappingEntries((prev) => ({ ...prev, [newFieldKey.trim()]: null }));
            setNewFieldKey("");
          }}
          data-testid="button-add-field"
        >
          <IconPlus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      {rawFields.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No raw field data available. Fetch data first to populate source field dropdowns.
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          data-testid="button-save-mappings"
        >
          {saving ? (
            <IconLoader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <IconDeviceFloppy className="h-3.5 w-3.5 mr-1" />
          )}
          Save Mappings
        </Button>
      </div>

      <Dialog open={sampleOpen} onOpenChange={setSampleOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Raw API Sample Data</DialogTitle>
            <DialogDescription>
              {sampleData ? `Showing ${sampleData.items.length} of ${sampleData.count} total raw items` : "Loading sample data..."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {sampleLoading ? (
              <div className="flex items-center justify-center py-8">
                <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sampleData && sampleData.items.length > 0 ? (
              <div className="space-y-3">
                {sampleData.items.map((item, idx) => (
                  <div key={idx} className="border rounded-md">
                    <div className="px-3 py-1.5 bg-muted text-xs font-medium text-muted-foreground border-b">
                      Item {idx + 1}
                    </div>
                    <pre className="text-xs font-mono p-3 overflow-auto whitespace-pre-wrap break-all" data-testid={`text-sample-item-${idx}`}>
                      {JSON.stringify(item, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-sample-data">
                No raw data available. Fetch data first.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DatabaseDetailView({ dbName }: { dbName: string }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [isFetching, setIsFetching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activePanel, setActivePanel] = useState<"settings" | "mappings" | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [dataView, setDataView] = useState<"mapped" | "raw">("mapped");

  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDescValue, setEditDescValue] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);

  const { data: detail, refetch: refetchDetail } = useQuery<DatabaseDetail>({
    queryKey: ["/api/databases", dbName],
  });

  const {
    data: itemsData,
    isLoading: itemsLoading,
    refetch: refetchItems,
  } = useQuery<DatabaseItems>({
    queryKey: [`/api/databases/${dbName}/items`],
    enabled: false,
  });

  const {
    data: rawItemsData,
    isLoading: rawItemsLoading,
    refetch: refetchRawItems,
  } = useQuery<DatabaseItems>({
    queryKey: [`/api/databases/${dbName}/raw-items`],
    enabled: false,
  });

  const config = detail?.config;
  const fieldMapping = config?.field_mapping;

  const activeItems = dataView === "raw" ? rawItemsData : itemsData;

  const columns = useMemo(() => {
    if (dataView === "mapped" && fieldMapping && Object.keys(fieldMapping).length > 0) {
      return Object.keys(fieldMapping);
    }
    if (activeItems?.items?.[0]) {
      return Object.keys(activeItems.items[0]);
    }
    return [];
  }, [dataView, fieldMapping, activeItems?.items]);

  const filteredItems = useMemo(() => {
    if (!activeItems?.items) return [];
    let items = activeItems.items;

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((item) =>
        Object.values(item).some(
          (v) => v != null && String(v).toLowerCase().includes(q)
        )
      );
    }

    if (sortKey) {
      items = [...items].sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return items;
  }, [itemsData?.items, search, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleFetchData = async () => {
    setIsFetching(true);
    try {
      const [mappedResult] = await Promise.all([refetchItems(), refetchRawItems()]);
      if (mappedResult.error) {
        toast({
          title: "Fetch failed",
          description: mappedResult.error instanceof Error ? mappedResult.error.message : String(mappedResult.error),
          variant: "destructive",
        });
      } else {
        setHasFetched(true);
      }
    } catch (err) {
      toast({
        title: "Fetch failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch(`/api/databases/${dbName}/refresh`, { method: "POST" });
      await Promise.all([refetchItems(), refetchRawItems()]);
      setHasFetched(true);
    } catch (err) {
      toast({
        title: "Refresh failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const saveInlineField = async (field: "name" | "description", value: string) => {
    setInlineSaving(true);
    try {
      const updatedConfig = { ...config, [field]: value || undefined };
      const res = await fetch(`/api/databases/${dbName}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedConfig),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to save ${field}`);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/databases", dbName] });
      queryClient.invalidateQueries({ queryKey: ["/api/databases"] });
      await refetchDetail();
      if (field === "name") setEditingName(false);
      else setEditingDesc(false);
    } catch (err) {
      toast({
        title: `Error saving ${field}`,
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setInlineSaving(false);
    }
  };

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return "\u2014";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/private/databases">
          <Button variant="ghost" size="sm" data-testid="button-back-databases">
            <IconArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 group/name">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  className="h-8 text-sm font-semibold w-64"
                  autoFocus
                  disabled={inlineSaving}
                  data-testid="input-inline-name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editNameValue.trim()) saveInlineField("name", editNameValue.trim());
                    if (e.key === "Escape") setEditingName(false);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={inlineSaving || !editNameValue.trim()}
                  onClick={() => saveInlineField("name", editNameValue.trim())}
                  data-testid="button-save-inline-name"
                >
                  {inlineSaving ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" /> : <IconCheck className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setEditingName(false)} data-testid="button-cancel-inline-name">
                  <IconX className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold truncate" data-testid="text-database-name">
                  {config?.name || dbName}
                </h2>
                <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0" data-testid="text-database-slug">
                  {dbName}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="invisible group-hover/name:visible"
                  onClick={() => { setEditNameValue(config?.name || dbName); setEditingName(true); }}
                  data-testid="button-edit-name"
                >
                  <IconPencil className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 group/desc mt-0.5">
            {editingDesc ? (
              <div className="flex items-center gap-1.5 flex-1">
                <Input
                  value={editDescValue}
                  onChange={(e) => setEditDescValue(e.target.value)}
                  className="h-7 text-xs flex-1"
                  placeholder="Add a description..."
                  autoFocus
                  disabled={inlineSaving}
                  data-testid="input-inline-description"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveInlineField("description", editDescValue.trim());
                    if (e.key === "Escape") setEditingDesc(false);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={inlineSaving}
                  onClick={() => saveInlineField("description", editDescValue.trim())}
                  data-testid="button-save-inline-desc"
                >
                  {inlineSaving ? <IconLoader2 className="h-3 w-3 animate-spin" /> : <IconCheck className="h-3 w-3" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setEditingDesc(false)} data-testid="button-cancel-inline-desc">
                  <IconX className="h-3 w-3" />
                </Button>
              </div>
            ) : config?.description ? (
              <>
                <p className="text-xs text-muted-foreground truncate" data-testid="text-database-description">{config.description}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="invisible group-hover/desc:visible"
                  onClick={() => { setEditDescValue(config.description || ""); setEditingDesc(true); }}
                  data-testid="button-edit-description"
                >
                  <IconPencil className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <button
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground invisible group-hover/desc:visible cursor-pointer"
                onClick={() => { setEditDescValue(""); setEditingDesc(true); }}
                data-testid="button-add-description"
              >
                + Add description
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={activePanel === "settings" ? "default" : "outline"}
            size="sm"
            onClick={() => setActivePanel(activePanel === "settings" ? null : "settings")}
            data-testid="button-toggle-settings"
          >
            {activePanel === "settings" ? (
              <IconX className="h-3.5 w-3.5 mr-1" />
            ) : (
              <IconSettings className="h-3.5 w-3.5 mr-1" />
            )}
            Settings
          </Button>
          <Button
            variant={activePanel === "mappings" ? "default" : "outline"}
            size="sm"
            onClick={() => setActivePanel(activePanel === "mappings" ? null : "mappings")}
            data-testid="button-toggle-mappings"
          >
            {activePanel === "mappings" ? (
              <IconX className="h-3.5 w-3.5 mr-1" />
            ) : (
              <IconArrowsExchange className="h-3.5 w-3.5 mr-1" />
            )}
            Mappings
          </Button>
        </div>
      </div>

      {activePanel === "settings" && config ? (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Source &amp; Cache Configuration</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <DatabaseConfigEditor
              dbName={dbName}
              config={config}
              onSaved={() => {
                refetchDetail();
                setActivePanel(null);
              }}
            />
          </CardContent>
        </Card>
      ) : activePanel === "mappings" && config ? (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Field Mapping (Raw API &rarr; Database)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Transform raw source fields into normalized database fields. Applied before caching.
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <FieldMappingEditor
              dbName={dbName}
              config={config}
              onSaved={() => {
                refetchDetail();
                setActivePanel(null);
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4 pb-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <IconApi className="h-3.5 w-3.5" />
                  <span>Source</span>
                </div>
                <p className="text-sm font-medium">{config?.source.type || "\u2014"}</p>
                {config?.source.api?.endpoint && (
                  <p className="text-xs text-muted-foreground truncate" title={config.source.api.endpoint}>
                    {config.source.api.endpoint}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <IconTable className="h-3.5 w-3.5" />
                  <span>Items</span>
                </div>
                <p className="text-sm font-medium" data-testid="text-item-count">
                  {itemsData ? itemsData.raw_count : detail?.cache_status ? detail.cache_status.item_count : isFetching || itemsLoading ? "..." : "\u2014"}
                </p>
                {(itemsData?.from_cache || (!itemsData && detail?.cache_status)) && (
                  <p className="text-xs text-muted-foreground">from cache</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <IconClock className="h-3.5 w-3.5" />
                  <span>Last Fetched</span>
                </div>
                <p className="text-sm font-medium" data-testid="text-fetched-at">
                  {itemsData?.fetched_at
                    ? new Date(itemsData.fetched_at).toLocaleString()
                    : detail?.cache_status?.fetched_at
                      ? new Date(detail.cache_status.fetched_at).toLocaleString()
                      : "\u2014"}
                </p>
                <p className="text-xs text-muted-foreground">
                  TTL: {config?.cache?.ttl_hours ?? 24}h
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-sm" data-testid="text-field-mapping-title">Field Mapping (Raw API → Database)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {fieldMapping && Object.keys(fieldMapping).length > 0 ? (
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(fieldMapping).map(([key, p]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs">
                      <code className="bg-muted px-1.5 py-0.5 rounded font-medium">{key}</code>
                      <span className="text-muted-foreground">&larr;</span>
                      <code className="text-muted-foreground truncate">{p || "null"}</code>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-destructive/30 bg-destructive/5 rounded-md p-4 space-y-3" data-testid="field-mapping-error">
                  <div className="flex items-start gap-2">
                    <IconAlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">
                      No field mapping configured. Raw source fields (potentially hundreds) will be cached as-is. Open Settings to define mappings or use AI to auto-detect them.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActivePanel("mappings")}
                    data-testid="button-open-settings-mapping"
                  >
                    <IconArrowsExchange className="h-3.5 w-3.5 mr-1" />
                    Edit Mappings
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-sm">
                    Data{" "}
                    {activeItems && filteredItems.length !== (activeItems?.items?.length ?? 0) && (
                      <span className="text-muted-foreground font-normal">
                        ({filteredItems.length} of {activeItems?.items?.length ?? 0})
                      </span>
                    )}
                  </CardTitle>
                  {(hasFetched || itemsData) && (
                    <div className="flex items-center rounded-md border overflow-visible">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`rounded-r-none border-r toggle-elevate ${dataView === "mapped" ? "toggle-elevated bg-muted" : ""}`}
                        onClick={() => { setDataView("mapped"); setSortKey(null); setSearch(""); }}
                        data-testid="button-view-mapped"
                      >
                        Mapped
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`rounded-l-none toggle-elevate ${dataView === "raw" ? "toggle-elevated bg-muted" : ""}`}
                        onClick={() => { setDataView("raw"); setSortKey(null); setSearch(""); }}
                        data-testid="button-view-raw"
                      >
                        Raw
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(hasFetched || itemsData) && (
                    <div className="relative">
                      <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-7 h-8 w-48 text-xs"
                        data-testid="input-search-items"
                      />
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchData}
                    disabled={isFetching || itemsLoading || rawItemsLoading}
                    data-testid="button-fetch-data"
                  >
                    {isFetching || itemsLoading || rawItemsLoading ? (
                      <IconLoader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <IconDownload className="h-3.5 w-3.5 mr-1" />
                    )}
                    Fetch Data
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    data-testid="button-refresh-items"
                  >
                    <IconRefresh className={`h-3.5 w-3.5 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
                    Force Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {isFetching || itemsLoading || rawItemsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !hasFetched && !activeItems ? (
                <div className="text-center py-12">
                  <IconDownload className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Data has not been fetched yet.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click "Fetch Data" to load items from the datasource, or "Force Refresh" to bypass the cache.
                  </p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">
                    {search ? "No items match your search." : "No items returned from the datasource."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="table-database-items">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap"
                            onClick={() => handleSort(col)}
                            data-testid={`th-sort-${col}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {col}
                              {sortKey === col ? (
                                sortDir === "asc" ? (
                                  <IconChevronUp className="h-3 w-3" />
                                ) : (
                                  <IconChevronDown className="h-3 w-3" />
                                )
                              ) : (
                                <IconArrowsSort className="h-3 w-3 opacity-30" />
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item, i) => (
                        <tr
                          key={i}
                          className="border-b last:border-b-0 hover:bg-muted/30"
                          data-testid={`row-item-${i}`}
                        >
                          {columns.map((col) => (
                            <td
                              key={col}
                              className="px-3 py-2 max-w-[200px] truncate whitespace-nowrap"
                              title={formatCellValue(item[col])}
                            >
                              {formatCellValue(item[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function PrivateDatabases() {
  const [, params] = useRoute("/private/databases/:name");
  const dbName = params?.name;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {dbName ? (
        <DatabaseDetailView dbName={dbName} />
      ) : (
        <DatabaseList />
      )}
    </div>
  );
}
