import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconArrowLeft,
  IconArrowRight,
  IconSearch,
  IconArticle,
  IconCheck,
  IconClock,
  IconEye,
  IconEyeOff,
  IconExternalLink,
  IconRefresh,
  IconWorld,
  IconDatabase,
  IconDotsVertical,
  IconLink,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconTrash,
  IconTrashX,
  IconWand,
  IconLoader2,
  IconSettings,
  IconTestPipe,
  IconTransform,
  IconLayoutList,
} from "@tabler/icons-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BlogPost {
  id: number;
  slug: string;
  title: string;
  lang: string;
  category: { slug: string };
  status: string;
  visibility: string;
  description: string;
  preview: string;
  author: { id: number; first_name: string; last_name: string; profile?: { avatar_url?: string } } | null;
  published_at: string;
  created_at: string;
  updated_at: string;
  cluster: string | null;
  clusters: string[];
  tags: string[];
}

interface BlogResponse {
  count: number;
  results: BlogPost[];
}

interface CacheStatus {
  exists: boolean;
  age_hours: number | null;
  post_count: number | null;
}

interface ApiSourceConfig {
  endpoint: string;
  params: Record<string, string | number>;
  token_env_var: string;
  auth_prefix: string;
  headers: Record<string, string>;
  academy_header?: string;
  results_path?: string;
}

interface FieldMapping {
  [standardField: string]: string | null;
}

interface TransformConfig {
  results_path: string;
  pagination?: {
    type: string;
    has_more_field?: string | null;
    total_field?: string | null;
    next_field?: string | null;
    strategy_description?: string;
  };
}

interface BlogConfig {
  data_source: {
    type: string;
    api?: ApiSourceConfig;
  };
  cache: {
    ttl_hours: number;
    file_path: string;
  };
  url_pattern: Record<string, string>;
  categories: Record<string, string>;
  field_mapping?: FieldMapping;
  transform?: TransformConfig;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status?.toLowerCase() || "unknown";
  if (normalized === "published") {
    return <Badge variant="default" data-testid="badge-status-published"><IconCheck className="h-3 w-3 mr-1" />Published</Badge>;
  }
  if (normalized === "draft") {
    return <Badge variant="secondary" data-testid="badge-status-draft"><IconClock className="h-3 w-3 mr-1" />Draft</Badge>;
  }
  return <Badge variant="outline" data-testid={`badge-status-${normalized}`}>{status}</Badge>;
}

function VisibilityIcon({ visibility }: { visibility: string }) {
  if (visibility?.toLowerCase() === "public") {
    return <IconEye className="h-4 w-4 text-muted-foreground" />;
  }
  return <IconEyeOff className="h-4 w-4 text-muted-foreground" />;
}

const WIZARD_STEPS = [
  { id: "configure", label: "Configure", icon: IconSettings },
  { id: "test", label: "Test", icon: IconTestPipe },
  { id: "transform", label: "Transform", icon: IconTransform },
  { id: "fields", label: "Field Mapping", icon: IconLayoutList },
] as const;

type WizardStep = typeof WIZARD_STEPS[number]["id"];

function extractByPath(obj: unknown, dotPath: string): unknown {
  if (!dotPath) return obj;
  let current = obj;
  for (const key of dotPath.split(".")) {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

const PAYLOAD_SIZE_LIMIT = 80_000;

function truncateForAI(payload: unknown, maxItems = 3): unknown {
  if (Array.isArray(payload)) {
    return payload.slice(0, maxItems).map((item) => truncateForAI(item, maxItems));
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        result[key] = value.slice(0, maxItems).map((item) => truncateForAI(item, maxItems));
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return payload;
}

function estimatePayloadSize(payload: unknown): number {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return 0;
  }
}

function StepIndicator({ steps, currentStep, completedSteps }: {
  steps: typeof WIZARD_STEPS;
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center gap-1 px-1" data-testid="wizard-step-indicator">
      {steps.map((step, i) => {
        const isActive = step.id === currentStep;
        const isCompleted = completedSteps.has(step.id);
        const isPast = i < currentIndex;
        const StepIcon = step.icon;

        return (
          <div key={step.id} className="flex items-center gap-1 flex-1">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isCompleted || isPast
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
                data-testid={`step-indicator-${step.id}`}
              >
                {isCompleted || isPast ? (
                  <IconCheck className="h-3.5 w-3.5" />
                ) : (
                  <StepIcon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={`text-xs truncate ${
                  isActive ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px flex-shrink-0 w-4 ${
                  isPast || isCompleted ? "bg-primary/40" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DataSourceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<WizardStep>("configure");
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());

  const { data: config, isLoading } = useQuery<BlogConfig>({
    queryKey: ["/api/blog/config"],
    enabled: open,
  });

  const [sourceType, setSourceType] = useState("api");
  const [endpoint, setEndpoint] = useState("");
  const [queryParams, setQueryParams] = useState<Array<{ key: string; value: string }>>([]);
  const [editingParams, setEditingParams] = useState(false);
  const [tokenEnvVar, setTokenEnvVar] = useState("");
  const [authType, setAuthType] = useState<"none" | "Token" | "Bearer" | "raw">("Token");
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [editingHeaders, setEditingHeaders] = useState(false);
  const [ttlHours, setTtlHours] = useState("24");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: number; status_text: string; content_type: string; body: unknown } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [transformConfig, setTransformConfig] = useState<TransformConfig | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);
  const [transformConfirmed, setTransformConfirmed] = useState(false);

  const [aiMappingFields, setAiMappingFields] = useState(false);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [fieldMappingNotes, setFieldMappingNotes] = useState("");
  const [fieldMappingError, setFieldMappingError] = useState<string | null>(null);
  const [fieldMappingConfirmed, setFieldMappingConfirmed] = useState(false);

  const markComplete = (s: WizardStep) => {
    setCompletedSteps((prev) => {
      const next = new Set(Array.from(prev));
      next.add(s);
      return next;
    });
  };

  useEffect(() => {
    if (config) {
      setSourceType(config.data_source?.type || "api");
      if (config.data_source?.api) {
        const api = config.data_source.api;
        setEndpoint(api.endpoint || "");
        const pairs = Object.entries(api.params || {}).map(([key, value]) => ({
          key,
          value: String(value),
        }));
        setQueryParams(pairs.length > 0 ? pairs : [{ key: "", value: "" }]);
        setEditingParams(false);
        setTokenEnvVar(api.token_env_var || "");
        if (!api.token_env_var) {
          setAuthType("none");
        } else if (api.auth_prefix === "Bearer") {
          setAuthType("Bearer");
        } else if (api.auth_prefix === "" || api.auth_prefix === undefined) {
          setAuthType("raw");
        } else {
          setAuthType("Token");
        }
        const headerPairs = Object.entries(api.headers || {}).map(([key, value]) => ({
          key,
          value: String(value),
        }));
        if (headerPairs.length === 0 && api.academy_header) {
          headerPairs.push({ key: "Academy", value: api.academy_header });
        }
        setCustomHeaders(headerPairs.length > 0 ? headerPairs : [{ key: "", value: "" }]);
        setEditingHeaders(false);
      }
      setTtlHours(String(config.cache?.ttl_hours || 24));

      if (config.transform) {
        setTransformConfig(config.transform);
        setTransformConfirmed(true);
      }
      if (config.field_mapping) {
        setFieldMapping(config.field_mapping);
        setFieldMappingConfirmed(true);
      }

      if (config.data_source?.api?.endpoint) {
        setCompletedSteps(new Set<WizardStep>(["configure"]));
      }
    }
  }, [config]);

  const queryString = useMemo(() => {
    const parts = queryParams
      .filter((p) => p.key.trim())
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`);
    return parts.length > 0 ? `?${parts.join("&")}` : "";
  }, [queryParams]);

  const paramsRecord = useMemo(() => {
    const record: Record<string, string | number> = {};
    for (const p of queryParams) {
      if (p.key.trim()) {
        const num = Number(p.value);
        record[p.key.trim()] = !isNaN(num) && p.value.trim() !== "" && /^\d+$/.test(p.value.trim()) ? num : p.value;
      }
    }
    return record;
  }, [queryParams]);

  const updateParam = (index: number, field: "key" | "value", val: string) => {
    setQueryParams((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: val } : p)));
  };

  const removeParam = (index: number) => {
    setQueryParams((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [{ key: "", value: "" }] : next;
    });
  };

  const addParam = () => {
    setQueryParams((prev) => [...prev, { key: "", value: "" }]);
  };

  const headersPreview = useMemo(() => {
    return customHeaders
      .filter((h) => h.key.trim())
      .map((h) => `${h.key}: ${h.value}`)
      .join("\n");
  }, [customHeaders]);

  const headersRecord = useMemo(() => {
    const record: Record<string, string> = {};
    for (const h of customHeaders) {
      if (h.key.trim()) {
        record[h.key.trim()] = h.value;
      }
    }
    return record;
  }, [customHeaders]);

  const updateHeader = (index: number, field: "key" | "value", val: string) => {
    setCustomHeaders((prev) => prev.map((h, i) => (i === index ? { ...h, [field]: val } : h)));
  };

  const removeHeader = (index: number) => {
    setCustomHeaders((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [{ key: "", value: "" }] : next;
    });
  };

  const addHeader = () => {
    setCustomHeaders((prev) => [...prev, { key: "", value: "" }]);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await apiRequest("POST", "/api/blog/test-endpoint", {
        endpoint,
        params: paramsRecord,
        token_env_var: authType === "none" ? "" : tokenEnvVar,
        auth_prefix: authType === "none" || authType === "raw" ? "" : authType,
        headers: headersRecord,
      });
      const data = await res.json();
      setTestResult(data);
      if (data.status < 400) {
        markComplete("test");
      }
    } catch (err) {
      setTestError(String(err));
    } finally {
      setTesting(false);
    }
  };

  const handleAnalyzeTransform = async () => {
    if (!testResult?.body) return;
    setAiAnalyzing(true);
    setTransformError(null);
    setTransformConfirmed(false);
    try {
      const trimmed = truncateForAI(testResult.body);
      const res = await apiRequest("POST", "/api/blog/ai/analyze-response", {
        sample_payload: trimmed,
      });
      const data = await res.json();
      if (data.error) {
        setTransformError(data.error);
      } else {
        setTransformConfig({
          results_path: data.results_path || "",
          pagination: data.pagination || { type: "none", strategy_description: "No pagination detected" },
        });
      }
    } catch (err) {
      setTransformError(String(err));
    } finally {
      setAiAnalyzing(false);
    }
  };

  const extractedPosts = useMemo(() => {
    if (!testResult?.body || !transformConfig) return [];
    const extracted = extractByPath(testResult.body, transformConfig.results_path);
    return Array.isArray(extracted) ? extracted : [];
  }, [testResult, transformConfig]);

  const handleAnalyzeFields = async () => {
    if (extractedPosts.length === 0) return;
    setAiMappingFields(true);
    setFieldMappingError(null);
    setFieldMappingConfirmed(false);
    try {
      const res = await apiRequest("POST", "/api/blog/ai/analyze-fields", {
        sample_posts: extractedPosts.slice(0, 3),
      });
      const data = await res.json();
      if (data.error) {
        setFieldMappingError(data.error);
      } else {
        setFieldMapping(data.field_mapping || {});
        setAvailableFields(data.available_fields || []);
        setFieldMappingNotes(data.notes || "");
      }
    } catch (err) {
      setFieldMappingError(String(err));
    } finally {
      setAiMappingFields(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: BlogConfig = {
        data_source: {
          type: sourceType,
          ...(sourceType === "api" && {
            api: {
              endpoint,
              params: paramsRecord,
              token_env_var: authType === "none" ? "" : tokenEnvVar,
              auth_prefix: authType === "none" || authType === "raw" ? "" : authType,
              results_path: transformConfig?.results_path || "",
              headers: headersRecord,
            },
          }),
        },
        cache: {
          ttl_hours: Number(ttlHours) || 24,
          file_path: config?.cache?.file_path || ".cache/blog-posts.json",
        },
        url_pattern: config?.url_pattern || { en: "/en/blog/:slug", es: "/es/blog/:slug" },
        categories: config?.categories || { en: "blog-us", es: "blog-es" },
        transform: transformConfig || undefined,
        field_mapping: Object.keys(fieldMapping).length > 0 ? fieldMapping : undefined,
      };

      await apiRequest("PUT", "/api/blog/config", payload);
      queryClient.invalidateQueries({ queryKey: ["/api/blog/config"] });
      toast({ title: "Data source saved" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to save data source", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const canGoNext = (s: WizardStep): boolean => {
    switch (s) {
      case "configure": return sourceType === "api" && !!endpoint;
      case "test": return !!testResult && testResult.status < 400;
      case "transform": return transformConfirmed && !!transformConfig;
      case "fields": return fieldMappingConfirmed;
      default: return false;
    }
  };

  const goNext = () => {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === step);
    if (idx < WIZARD_STEPS.length - 1) {
      markComplete(step);
      setStep(WIZARD_STEPS[idx + 1].id);
    }
  };

  const goBack = () => {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === step);
    if (idx > 0) {
      setStep(WIZARD_STEPS[idx - 1].id);
    }
  };

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step);
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  const samplePost = extractedPosts[0] as Record<string, unknown> | undefined;

  const getFieldValue = (post: Record<string, unknown>, dotPath: string | null): unknown => {
    if (!dotPath) return null;
    return extractByPath(post, dotPath);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Blog Data Source</DialogTitle>
        </DialogHeader>

        <StepIndicator steps={WIZARD_STEPS} currentStep={step} completedSteps={completedSteps} />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <IconLoader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Loading configuration...</span>
          </div>
        ) : (
          <div className="space-y-4 min-h-[250px]">

            {step === "configure" && (
              <div className="space-y-4" data-testid="step-configure">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="source-type">Source Type</Label>
                    <Select value={sourceType} onValueChange={setSourceType}>
                      <SelectTrigger id="source-type" data-testid="select-source-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="api">REST API</SelectItem>
                        <SelectItem value="rss" disabled>RSS Feed (coming soon)</SelectItem>
                        <SelectItem value="csv" disabled>CSV File (coming soon)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cache-ttl">Cache TTL (hours)</Label>
                    <Input
                      id="cache-ttl"
                      type="number"
                      value={ttlHours}
                      onChange={(e) => setTtlHours(e.target.value)}
                      placeholder="24"
                      data-testid="input-cache-ttl"
                    />
                  </div>
                </div>

                {sourceType === "api" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="api-endpoint">API Endpoint</Label>
                      <Input
                        id="api-endpoint"
                        value={endpoint}
                        onChange={(e) => setEndpoint(e.target.value)}
                        placeholder="https://api.example.com/posts"
                        data-testid="input-api-endpoint"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Query Parameters</Label>
                        <Button variant="ghost" size="sm" onClick={() => setEditingParams(!editingParams)} data-testid="button-toggle-params">
                          <IconPencil className="h-3.5 w-3.5 mr-1" />
                          {editingParams ? "Done" : "Edit"}
                        </Button>
                      </div>
                      {!editingParams ? (
                        <div className="rounded-md bg-muted px-3 py-2" data-testid="text-querystring-preview">
                          <p className="text-xs font-mono text-muted-foreground break-all">
                            {queryString || "(no parameters)"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {queryParams.map((param, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input value={param.key} onChange={(e) => updateParam(i, "key", e.target.value)} placeholder="key" className="flex-1 font-mono text-xs" data-testid={`input-param-key-${i}`} />
                              <span className="text-muted-foreground text-xs">=</span>
                              <Input value={param.value} onChange={(e) => updateParam(i, "value", e.target.value)} placeholder="value" className="flex-1 font-mono text-xs" data-testid={`input-param-value-${i}`} />
                              <Button variant="ghost" size="icon" onClick={() => removeParam(i)} data-testid={`button-remove-param-${i}`}>
                                <IconTrash className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" onClick={addParam} data-testid="button-add-param">
                            <IconPlus className="h-3.5 w-3.5 mr-1" />
                            Add Parameter
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Authentication</Label>
                        <Select value={authType} onValueChange={(v) => setAuthType(v as "none" | "Token" | "Bearer" | "raw")}>
                          <SelectTrigger data-testid="select-auth-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Authentication</SelectItem>
                            <SelectItem value="Token">Token</SelectItem>
                            <SelectItem value="Bearer">Bearer</SelectItem>
                            <SelectItem value="raw">Raw Token (no prefix)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {authType !== "none" && (
                        <div className="space-y-2">
                          <Label htmlFor="token-env-var">Token Env Var</Label>
                          <Input id="token-env-var" value={tokenEnvVar} onChange={(e) => setTokenEnvVar(e.target.value)} placeholder="BREATHECODE_TOKEN" data-testid="input-token-env-var" />
                        </div>
                      )}
                    </div>
                    {authType !== "none" && tokenEnvVar && (
                      <div className="rounded-md bg-muted px-3 py-2" data-testid="text-auth-preview">
                        <p className="text-xs font-mono text-muted-foreground">
                          Authorization: {authType === "raw" ? "" : `${authType} `}<span className="text-foreground">{`$\{${tokenEnvVar}}`}</span>
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Custom Headers</Label>
                        <Button variant="ghost" size="sm" onClick={() => setEditingHeaders(!editingHeaders)} data-testid="button-toggle-headers">
                          <IconPencil className="h-3.5 w-3.5 mr-1" />
                          {editingHeaders ? "Done" : "Edit"}
                        </Button>
                      </div>
                      {!editingHeaders ? (
                        <div className="rounded-md bg-muted px-3 py-2" data-testid="text-headers-preview">
                          <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                            {headersPreview || "(no custom headers)"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {customHeaders.map((header, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input value={header.key} onChange={(e) => updateHeader(i, "key", e.target.value)} placeholder="Header-Name" className="flex-1 font-mono text-xs" data-testid={`input-header-key-${i}`} />
                              <span className="text-muted-foreground text-xs">:</span>
                              <Input value={header.value} onChange={(e) => updateHeader(i, "value", e.target.value)} placeholder="value" className="flex-1 font-mono text-xs" data-testid={`input-header-value-${i}`} />
                              <Button variant="ghost" size="icon" onClick={() => removeHeader(i)} data-testid={`button-remove-header-${i}`}>
                                <IconTrash className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" onClick={addHeader} data-testid="button-add-header">
                            <IconPlus className="h-3.5 w-3.5 mr-1" />
                            Add Header
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {step === "test" && (
              <div className="space-y-4" data-testid="step-test">
                <div className="rounded-md bg-muted px-3 py-2">
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {endpoint}{queryString}
                  </p>
                </div>

                <Button
                  onClick={handleTest}
                  disabled={testing || !endpoint}
                  className="w-full"
                  data-testid="button-test-endpoint"
                >
                  {testing ? (
                    <><IconLoader2 className="h-4 w-4 mr-2 animate-spin" />Testing endpoint...</>
                  ) : (
                    <><IconPlayerPlay className="h-4 w-4 mr-2" />Test Endpoint</>
                  )}
                </Button>

                {testResult && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Response</Label>
                      <Badge variant={testResult.status < 400 ? "default" : "destructive"}>
                        {testResult.status} {testResult.status_text}
                      </Badge>
                    </div>
                    <pre
                      className="rounded-md bg-muted px-3 py-2 text-xs font-mono text-muted-foreground overflow-auto max-h-[200px] whitespace-pre-wrap break-all"
                      data-testid="text-test-response"
                    >
                      {typeof testResult.body === "string" ? testResult.body : JSON.stringify(testResult.body, null, 2)}
                    </pre>
                    {testResult.status < 400 && (
                      <>
                        {estimatePayloadSize(testResult.body) > PAYLOAD_SIZE_LIMIT ? (
                          <div className="rounded-md bg-muted px-3 py-2" data-testid="text-payload-size-warning">
                            <p className="text-xs text-muted-foreground">
                              Large response detected ({Math.round(estimatePayloadSize(testResult.body) / 1024)} KB).
                              The payload will be automatically trimmed before sending to AI analysis — only a few sample items are needed.
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Test passed. Proceed to the next step for AI-powered response analysis.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
                {testError && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2" data-testid="text-test-error">
                    <p className="text-xs text-destructive">{testError}</p>
                  </div>
                )}
              </div>
            )}

            {step === "transform" && (
              <div className="space-y-4" data-testid="step-transform">
                <p className="text-sm text-muted-foreground">
                  AI will analyze the API response to determine how to extract blog posts and handle pagination.
                </p>

                <Button
                  onClick={handleAnalyzeTransform}
                  disabled={aiAnalyzing}
                  className="w-full"
                  data-testid="button-ai-analyze"
                >
                  {aiAnalyzing ? (
                    <><IconLoader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing response...</>
                  ) : (
                    <><IconWand className="h-4 w-4 mr-2" />Analyze with AI</>
                  )}
                </Button>

                {transformError && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2">
                    <p className="text-xs text-destructive">{transformError}</p>
                  </div>
                )}

                {transformConfig && (
                  <div className="space-y-3 rounded-md border p-3" data-testid="section-transform-result">
                    <Label className="text-sm font-medium">Extraction Path</Label>
                    <div className="space-y-2">
                      <Input
                        value={transformConfig.results_path}
                        onChange={(e) => {
                          setTransformConfig({ ...transformConfig, results_path: e.target.value });
                          setTransformConfirmed(false);
                        }}
                        placeholder="(direct array)"
                        className="font-mono text-sm"
                        data-testid="input-results-path"
                      />
                      <p className="text-xs text-muted-foreground">
                        {transformConfig.results_path
                          ? `Posts are at "${transformConfig.results_path}" in the response`
                          : "Response is treated as a direct array"}
                      </p>
                    </div>

                    {(() => {
                      const posts = extractedPosts;
                      return (
                        <div className="rounded-md bg-muted px-3 py-2" data-testid="text-extract-preview">
                          {posts.length > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Found <span className="text-foreground font-medium">{posts.length}</span> posts
                            </p>
                          ) : (
                            <p className="text-xs text-destructive">
                              No array found at this path. Try editing the extraction path.
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {transformConfig.pagination && transformConfig.pagination.type !== "none" && (
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Pagination</Label>
                        <div className="rounded-md bg-muted px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            <Badge variant="outline" className="mr-2">{transformConfig.pagination.type}</Badge>
                            {transformConfig.pagination.strategy_description}
                          </p>
                          {transformConfig.pagination.total_field && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Total count field: <code className="text-foreground">{transformConfig.pagination.total_field}</code>
                            </p>
                          )}
                          {transformConfig.pagination.next_field && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Next page field: <code className="text-foreground">{transformConfig.pagination.next_field}</code>
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <Button
                      size="sm"
                      disabled={extractedPosts.length === 0 || transformConfirmed}
                      onClick={() => { setTransformConfirmed(true); markComplete("transform"); }}
                      data-testid="button-confirm-transform"
                    >
                      {transformConfirmed ? (
                        <><IconCheck className="h-3.5 w-3.5 mr-1" />Confirmed</>
                      ) : (
                        "Confirm Transform"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {step === "fields" && (
              <div className="space-y-4" data-testid="step-fields">
                <p className="text-sm text-muted-foreground">
                  AI will analyze sample posts and suggest which fields map to standard blog properties.
                </p>

                <Button
                  onClick={handleAnalyzeFields}
                  disabled={aiMappingFields || extractedPosts.length === 0}
                  className="w-full"
                  data-testid="button-ai-fields"
                >
                  {aiMappingFields ? (
                    <><IconLoader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing fields...</>
                  ) : (
                    <><IconWand className="h-4 w-4 mr-2" />Analyze Fields with AI</>
                  )}
                </Button>

                {fieldMappingError && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2">
                    <p className="text-xs text-destructive">{fieldMappingError}</p>
                  </div>
                )}

                {Object.keys(fieldMapping).length > 0 && (
                  <div className="space-y-3" data-testid="section-field-mapping">
                    <Label className="text-sm font-medium">Field Mapping</Label>
                    {fieldMappingNotes && (
                      <p className="text-xs text-muted-foreground">{fieldMappingNotes}</p>
                    )}

                    <div className="space-y-2">
                      {Object.entries(fieldMapping).map(([standardField, sourceField]) => {
                        const isRequired = standardField === "title" || standardField === "content";
                        return (
                        <div key={standardField} className="flex items-center gap-2">
                          <span className={`text-xs font-medium w-24 flex-shrink-0 text-right ${isRequired && !sourceField ? "text-destructive" : "text-muted-foreground"}`}>
                            {standardField}{isRequired ? <span className="text-destructive ml-0.5">*</span> : null}
                          </span>
                          <IconArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <Select
                            value={sourceField || "__none__"}
                            onValueChange={(v) => {
                              setFieldMapping((prev) => ({ ...prev, [standardField]: v === "__none__" ? null : v }));
                              setFieldMappingConfirmed(false);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs font-mono" data-testid={`select-field-${standardField}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">(not mapped)</SelectItem>
                              {availableFields.map((f) => (
                                <SelectItem key={f} value={f}>{f}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        );
                      })}
                    </div>

                    {samplePost && (
                      <div className="rounded-md border p-3 space-y-2" data-testid="section-sample-preview">
                        <Label className="text-xs font-medium text-muted-foreground">Sample Post Preview</Label>
                        <div className="space-y-1">
                          {fieldMapping.title && (
                            <p className="text-sm font-medium truncate" data-testid="preview-title">
                              {String(getFieldValue(samplePost, fieldMapping.title) || "—")}
                            </p>
                          )}
                          {fieldMapping.slug && (
                            <p className="text-xs font-mono text-muted-foreground truncate" data-testid="preview-slug">
                              /{String(getFieldValue(samplePost, fieldMapping.slug) || "")}
                            </p>
                          )}
                          {fieldMapping.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2" data-testid="preview-description">
                              {String(getFieldValue(samplePost, fieldMapping.description) || "")}
                            </p>
                          )}
                          {fieldMapping.content && (() => {
                            const raw = getFieldValue(samplePost, fieldMapping.content);
                            const text = typeof raw === "string" ? raw.replace(/<[^>]*>/g, "").replace(/[#*_~`>\-\[\]()!]/g, "").replace(/\s+/g, " ").trim() : "";
                            return text ? (
                              <div className="rounded bg-muted px-2 py-1.5 mt-1" data-testid="preview-content">
                                <p className="text-xs text-muted-foreground line-clamp-3">{text.slice(0, 280)}{text.length > 280 ? "..." : ""}</p>
                              </div>
                            ) : null;
                          })()}
                          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground pt-1">
                            {fieldMapping.author && (
                              <span data-testid="preview-author">
                                {(() => {
                                  const v = getFieldValue(samplePost, fieldMapping.author);
                                  if (typeof v === "object" && v && "first_name" in (v as Record<string, unknown>)) {
                                    const a = v as Record<string, unknown>;
                                    return `${a.first_name || ""} ${a.last_name || ""}`.trim();
                                  }
                                  return String(v || "");
                                })()}
                              </span>
                            )}
                            {fieldMapping.published_at && (
                              <span data-testid="preview-date">
                                {formatDate(String(getFieldValue(samplePost, fieldMapping.published_at) || ""))}
                              </span>
                            )}
                            {fieldMapping.status && (
                              <Badge variant="outline" data-testid="preview-status">
                                {String(getFieldValue(samplePost, fieldMapping.status) || "")}
                              </Badge>
                            )}
                            {fieldMapping.lang && (
                              <Badge variant="outline" data-testid="preview-lang">
                                {String(getFieldValue(samplePost, fieldMapping.lang) || "").toUpperCase()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {(() => {
                      const missing = (["title", "content"] as const).filter((f) => !fieldMapping[f]);
                      return missing.length > 0 ? (
                        <p className="text-xs text-destructive" data-testid="text-required-fields-warning">
                          Required: {missing.join(", ")} must be mapped
                        </p>
                      ) : null;
                    })()}

                    <Button
                      size="sm"
                      disabled={fieldMappingConfirmed || !fieldMapping.title || !fieldMapping.content}
                      onClick={() => { setFieldMappingConfirmed(true); markComplete("fields"); }}
                      data-testid="button-confirm-fields"
                    >
                      {fieldMappingConfirmed ? (
                        <><IconCheck className="h-3.5 w-3.5 mr-1" />Confirmed</>
                      ) : (
                        "Confirm Field Mapping"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        <DialogFooter>
          {stepIndex > 0 && (
            <Button variant="outline" onClick={goBack} className="mr-auto" data-testid="button-wizard-back">
              <IconArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-datasource">
            Cancel
          </Button>
          {isLastStep ? (
            <Button
              onClick={handleSave}
              disabled={saving || isLoading || !fieldMappingConfirmed}
              data-testid="button-save-datasource"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              disabled={!canGoNext(step)}
              data-testid="button-wizard-next"
            >
              Next
              <IconArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildBlogUrl(pattern: string, post: BlogPost, locale: string): string {
  const cluster = (post.clusters && post.clusters.length > 0 ? post.clusters[0] : post.cluster) || "";
  return pattern
    .replace(":locale", locale)
    .replace(":cluster", cluster)
    .replace(":slug", post.slug);
}

function SeoSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const { data: config, isLoading } = useQuery<BlogConfig>({
    queryKey: ["/api/blog/config"],
    enabled: open,
  });

  const [pattern, setPattern] = useState("/en/blog/:slug");

  useEffect(() => {
    if (config) {
      setPattern(config.url_pattern?.en || "/en/blog/:slug");
    }
  }, [config]);

  const deriveLocalePattern = (basePattern: string, locale: string): string => {
    return basePattern.replace(/^\/en\//, `/${locale}/`).replace(/^\/en$/, `/${locale}`);
  };

  const esPreview = deriveLocalePattern(pattern, "es");

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: BlogConfig = {
        ...config!,
        url_pattern: {
          en: pattern,
          es: deriveLocalePattern(pattern, "es"),
        },
      };
      await apiRequest("PUT", "/api/blog/config", payload);
      queryClient.invalidateQueries({ queryKey: ["/api/blog/config"] });
      toast({ title: "URL pattern saved" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to save URL pattern", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const samplePost = { slug: "intro-to-python", cluster: "coding-bootcamp", clusters: ["coding-bootcamp"] } as BlogPost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>SEO URL Settings</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-muted px-3 py-2" data-testid="text-seo-variables-help">
              <p className="text-xs text-muted-foreground">
                Available variables: <code className="text-foreground">:slug</code> <code className="text-foreground">:cluster</code> (first cluster). The pattern must start with <code className="text-foreground">/en/</code>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="en-pattern" className="text-sm">URL Pattern</Label>
              <Input
                id="en-pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="/en/blog/:slug"
                className="font-mono text-sm"
                data-testid="input-en-pattern"
              />
              <p className="text-xs text-muted-foreground font-mono" data-testid="text-en-preview">
                Preview: {buildBlogUrl(pattern, samplePost, "en")}
              </p>
            </div>

            <div className="rounded-md bg-muted px-3 py-2 space-y-1" data-testid="text-locale-note">
              <p className="text-xs text-muted-foreground">
                Other languages follow the same structure. The <code className="text-foreground">/en/</code> prefix is replaced automatically.
              </p>
              <p className="text-xs text-muted-foreground font-mono" data-testid="text-es-preview">
                Spanish: {buildBlogUrl(esPreview, samplePost, "es")}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-seo">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || isLoading} data-testid="button-save-seo">
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BlogManagePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [localeFilter, setLocaleFilter] = useState<string>("all");
  const [clearing, setClearing] = useState(false);
  const [dsDialogOpen, setDsDialogOpen] = useState(false);
  const [seoDialogOpen, setSeoDialogOpen] = useState(false);

  const { data: allPostsData, isLoading: allLoading } = useQuery<BlogResponse>({
    queryKey: ["/api/blog/posts"],
    staleTime: 60000,
  });

  const { data: cacheStatus } = useQuery<CacheStatus>({
    queryKey: ["/api/blog/cache-status"],
    staleTime: 30000,
  });

  const { data: blogConfig } = useQuery<BlogConfig>({
    queryKey: ["/api/blog/config"],
    staleTime: 60000,
  });

  const urlPatterns = blogConfig?.url_pattern || { en: "/en/blog/:slug", es: "/es/blog/:slug" };

  const posts = allPostsData?.results || [];

  const kpis = useMemo(() => {
    const total = posts.length;
    const published = posts.filter((p) => p.status?.toLowerCase() === "published").length;
    const draft = posts.filter((p) => p.status?.toLowerCase() === "draft").length;
    const other = total - published - draft;
    const enPosts = posts.filter((p) => p.lang === "us" || p.category?.slug === "blog-en");
    const esPosts = posts.filter((p) => p.lang === "es" || p.category?.slug === "blog-es");
    const publicPosts = posts.filter((p) => p.visibility?.toLowerCase() === "public").length;
    const privatePosts = total - publicPosts;

    return { total, published, draft, other, en: enPosts.length, es: esPosts.length, publicPosts, privatePosts };
  }, [posts]);

  const filtered = useMemo(() => {
    let result = posts;

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status?.toLowerCase() === statusFilter);
    }

    if (localeFilter !== "all") {
      if (localeFilter === "en") {
        result = result.filter((p) => p.lang === "us" || p.category?.slug === "blog-en");
      } else if (localeFilter === "es") {
        result = result.filter((p) => p.lang === "es" || p.category?.slug === "blog-es");
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.slug?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          (p.author?.first_name + " " + p.author?.last_name).toLowerCase().includes(q)
      );
    }

    return result;
  }, [posts, statusFilter, localeFilter, search]);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await apiRequest("POST", "/api/debug/clear-blog-cache");
      toast({ title: "Blog cache cleared", description: "Refreshing posts..." });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/cache-status"] });
    } catch {
      toast({ title: "Failed to clear cache", variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const statuses = useMemo(() => {
    const set = new Set(posts.map((p) => p.status?.toLowerCase()).filter(Boolean));
    return Array.from(set).sort();
  }, [posts]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/" className="inline-flex">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <IconArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Blog Management</h1>
            <p className="text-sm text-muted-foreground">
              Overview of all blog articles and cache status
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {cacheStatus?.exists && (
              <span className="text-xs text-muted-foreground" data-testid="text-cache-age">
                Cache: {cacheStatus.age_hours != null ? `${cacheStatus.age_hours}h old` : "—"}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              disabled={clearing}
              data-testid="button-clear-cache"
            >
              <IconRefresh className={`h-4 w-4 mr-1 ${clearing ? "animate-spin" : ""}`} />
              Refresh Cache
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDsDialogOpen(true)}
              data-testid="button-data-source"
            >
              <IconDatabase className="h-4 w-4 mr-1" />
              Data Source
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSeoDialogOpen(true)}
              data-testid="button-seo-settings"
            >
              <IconLink className="h-4 w-4 mr-1" />
              SEO Settings
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="card-kpi-total">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Articles</CardTitle>
              <IconArticle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-kpi-total">{allLoading ? "..." : kpis.total}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-kpi-published">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
              <IconCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-kpi-published">{allLoading ? "..." : kpis.published}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-kpi-draft">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
              <IconClock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-kpi-draft">{allLoading ? "..." : kpis.draft}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-kpi-locale">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">By Language</CardTitle>
              <IconWorld className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div data-testid="text-kpi-en">
                  <span className="text-2xl font-bold">{allLoading ? "..." : kpis.en}</span>
                  <span className="text-xs text-muted-foreground ml-1">EN</span>
                </div>
                <div className="h-6 w-px bg-border" />
                <div data-testid="text-kpi-es">
                  <span className="text-2xl font-bold">{allLoading ? "..." : kpis.es}</span>
                  <span className="text-xs text-muted-foreground ml-1">ES</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles by title, slug, or author..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={localeFilter} onValueChange={setLocaleFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-locale-filter">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {allLoading ? (
              <div className="flex items-center justify-center py-12" data-testid="loading-posts">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                <span className="ml-2 text-sm text-muted-foreground">Loading articles...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-results">
                No articles found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-articles">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Author</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Lang</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Published</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Updated</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((post) => {
                      const locale = (post.lang === "es" || post.category?.slug === "blog-es") ? "es" : "en";
                      const pattern = locale === "es" ? urlPatterns.es : urlPatterns.en;
                      const blogUrl = buildBlogUrl(pattern, post, locale);
                      return (
                        <tr
                          key={post.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          data-testid={`row-article-${post.id}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {post.preview && (
                                <img
                                  src={post.preview}
                                  alt=""
                                  className="w-10 h-10 rounded-md object-cover flex-shrink-0 hidden sm:block"
                                />
                              )}
                              <div className="min-w-0">
                                <div className="font-medium truncate max-w-[300px]" title={post.title} data-testid={`text-title-${post.id}`}>
                                  {post.title || post.slug}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                                  {post.slug}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                            {post.author ? `${post.author.first_name || ""} ${post.author.last_name || ""}`.trim() : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={post.status} />
                              <VisibilityIcon visibility={post.visibility} />
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <Badge variant="outline">{locale.toUpperCase()}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                            {formatDate(post.published_at)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                            {formatDate(post.updated_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-actions-${post.id}`}>
                                  <IconDotsVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <a href={blogUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-new-tab-${post.id}`}>
                                    <IconExternalLink className="h-4 w-4 mr-2" />
                                    Open in new tab
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a href={blogUrl} data-testid={`link-same-tab-${post.id}`}>
                                    <IconArrowLeft className="h-4 w-4 mr-2 rotate-180" />
                                    Open in this tab
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={async () => {
                                    try {
                                      await apiRequest("DELETE", `/api/blog/cache/${post.slug}`);
                                      toast({ title: `Cache cleared for "${post.title || post.slug}"` });
                                    } catch {
                                      toast({ title: "Failed to clear cache", variant: "destructive" });
                                    }
                                  }}
                                  data-testid={`button-clear-cache-${post.id}`}
                                >
                                  <IconTrashX className="h-4 w-4 mr-2" />
                                  Clear cache
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!allLoading && filtered.length > 0 && (
              <div className="px-4 py-3 border-t text-xs text-muted-foreground" data-testid="text-showing-count">
                Showing {filtered.length} of {posts.length} articles
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DataSourceDialog open={dsDialogOpen} onOpenChange={setDsDialogOpen} />
      <SeoSettingsDialog open={seoDialogOpen} onOpenChange={setSeoDialogOpen} />
    </div>
  );
}
