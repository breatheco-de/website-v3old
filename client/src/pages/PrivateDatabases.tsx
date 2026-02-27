import { useState, useMemo, useCallback } from "react";
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
    };
    cache?: { ttl_hours?: number };
    field_mapping?: Record<string, string>;
  };
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

  const [endpoint, setEndpoint] = useState("");
  const [resultsPath, setResultsPath] = useState("");
  const [tokenEnvVar, setTokenEnvVar] = useState("");
  const [authPrefix, setAuthPrefix] = useState("Bearer");
  const [params, setParams] = useState<KeyValuePair[]>([]);
  const [headers, setHeaders] = useState<KeyValuePair[]>([]);

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
    setEndpoint("");
    setResultsPath("");
    setTokenEnvVar("");
    setAuthPrefix("Bearer");
    setParams([]);
    setHeaders([]);
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
        body: JSON.stringify({ source: buildSourceConfig() }),
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
  const canProceedStep2 = endpoint.trim();
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
              <Label htmlFor="db-endpoint">API Endpoint</Label>
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
                      <IconApi className="h-3 w-3 mr-1" />
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

function DatabaseDetailView({ dbName }: { dbName: string }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: detail } = useQuery<DatabaseDetail>({
    queryKey: ["/api/databases", dbName],
  });

  const {
    data: itemsData,
    isLoading: itemsLoading,
    refetch: refetchItems,
  } = useQuery<DatabaseItems>({
    queryKey: [`/api/databases/${dbName}/items`],
  });

  const config = detail?.config;
  const fieldMapping = config?.field_mapping;
  const columns = useMemo(() => {
    if (fieldMapping && Object.keys(fieldMapping).length > 0) {
      return Object.keys(fieldMapping);
    }
    if (itemsData?.items?.[0]) {
      return Object.keys(itemsData.items[0]);
    }
    return [];
  }, [fieldMapping, itemsData?.items]);

  const filteredItems = useMemo(() => {
    if (!itemsData?.items) return [];
    let items = itemsData.items;

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch(`/api/databases/${dbName}/refresh`, { method: "POST" });
      await refetchItems();
    } finally {
      setIsRefreshing(false);
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
          <h2 className="text-lg font-semibold truncate" data-testid="text-database-name">
            {config?.name || dbName}
          </h2>
          {config?.description && (
            <p className="text-xs text-muted-foreground truncate">{config.description}</p>
          )}
        </div>
      </div>

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
              {itemsData ? itemsData.raw_count : itemsLoading ? "..." : "\u2014"}
            </p>
            {itemsData?.from_cache && (
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
                : "\u2014"}
            </p>
            <p className="text-xs text-muted-foreground">
              TTL: {config?.cache?.ttl_hours ?? 24}h
            </p>
          </CardContent>
        </Card>
      </div>

      {fieldMapping && (
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm">Field Mapping</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(fieldMapping).map(([key, p]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-medium">{key}</code>
                  <span className="text-muted-foreground">&larr;</span>
                  <code className="text-muted-foreground truncate">{p || "null"}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm">
              Data{" "}
              {filteredItems.length !== (itemsData?.items?.length ?? 0) && (
                <span className="text-muted-foreground font-normal">
                  ({filteredItems.length} of {itemsData?.items?.length ?? 0})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                data-testid="button-refresh-items"
              >
                <IconRefresh className={`h-3.5 w-3.5 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {itemsLoading ? (
            <div className="flex items-center justify-center py-12">
              <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                {search ? "No items match your search." : "No items fetched yet."}
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
