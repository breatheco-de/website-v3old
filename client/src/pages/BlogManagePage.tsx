import { useQuery } from "@tanstack/react-query";
import {ArrowLeft, ArrowRight, Check, Clock, Database, ExternalLink, Eye, EyeOff, FileText, Globe, LayoutList, Link as LinkIcon, Loader2, MoreVertical, RefreshCw, Search, Settings, Trash2, Wand2, X} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useState, useMemo, useEffect, useRef } from "react";
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WebhookUrlPopover } from "@/components/WebhookUrlPopover";

interface BlogResponse {
  count: number;
  results: Record<string, any>[];
}

interface CacheStatus {
  exists: boolean;
  age_hours: number | null;
  post_count: number | null;
}

interface FieldMapping {
  [standardField: string]: string | null;
}

interface BlogConfig {
  database: string;
  url_pattern: Record<string, string>;
  categories: Record<string, string>;
  field_mapping?: FieldMapping;
}

interface DatabaseListItem {
  name: string;
  label: string;
  description: string | null;
  source_type: string;
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
    return <Badge variant="default" data-testid="badge-status-published"><Check className="h-3 w-3 mr-1" />Published</Badge>;
  }
  if (normalized === "draft") {
    return <Badge variant="secondary" data-testid="badge-status-draft"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
  }
  return <Badge variant="outline" data-testid={`badge-status-${normalized}`}>{status}</Badge>;
}

function VisibilityIcon({ visibility }: { visibility: string }) {
  if (visibility?.toLowerCase() === "public") {
    return <Eye className="h-4 w-4 text-muted-foreground" />;
  }
  return <EyeOff className="h-4 w-4 text-muted-foreground" />;
}

const WIZARD_STEPS = [
  { id: "database", label: "Select Database", icon: Database },
  { id: "settings", label: "Blog Settings", icon: Settings },
  { id: "fields", label: "Field Mapping", icon: LayoutList },
] as const;

type WizardStep = typeof WIZARD_STEPS[number]["id"];

function extractByPath(obj: unknown, dotPath: string): unknown {
  if (!dotPath || !dotPath.trim()) return undefined;
  let current = obj;
  const segments = dotPath.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  for (const key of segments) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const idx = Number(key);
      if (Number.isInteger(idx) && idx >= 0 && idx < current.length) {
        current = current[idx];
      } else {
        return undefined;
      }
    } else if (typeof current === "object" && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
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
                  <Check className="h-3.5 w-3.5" />
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
  const [step, setStep] = useState<WizardStep>("database");
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());

  const { data: config, isLoading } = useQuery<BlogConfig>({
    queryKey: ["/api/blog/config"],
    enabled: open,
  });

  const { data: databases } = useQuery<DatabaseListItem[]>({
    queryKey: ["/api/databases"],
    enabled: open,
  });

  const [selectedDb, setSelectedDb] = useState("");
  const [urlPatternEn, setUrlPatternEn] = useState("/en/blog/:category/:slug");
  const [urlPatternEs, setUrlPatternEs] = useState("/es/blog/:category/:slug");
  const [categoryEn, setCategoryEn] = useState("blog-us");
  const [categoryEs, setCategoryEs] = useState("blog-es");

  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [fieldMappingNotes, setFieldMappingNotes] = useState("");
  const [fieldMappingError, setFieldMappingError] = useState<string | null>(null);
  const [fieldMappingConfirmed, setFieldMappingConfirmed] = useState(false);
  const [aiMappingFields, setAiMappingFields] = useState(false);

  const [sampleItems, setSampleItems] = useState<Record<string, unknown>[]>([]);
  const [loadingSample, setLoadingSample] = useState(false);

  const markComplete = (s: WizardStep) => {
    setCompletedSteps((prev) => {
      const next = new Set(Array.from(prev));
      next.add(s);
      return next;
    });
  };

  useEffect(() => {
    if (config) {
      setSelectedDb(config.database || "");
      setUrlPatternEn(config.url_pattern?.en || "/en/blog/:category/:slug");
      setUrlPatternEs(config.url_pattern?.es || "/es/blog/:category/:slug");
      setCategoryEn(config.categories?.en || "blog-us");
      setCategoryEs(config.categories?.es || "blog-es");

      if (config.field_mapping) {
        setFieldMapping(config.field_mapping);
        setFieldMappingConfirmed(true);
      }

      const initialCompleted = new Set<WizardStep>();
      if (config.database) initialCompleted.add("database");
      if (config.url_pattern) initialCompleted.add("settings");
      if (config.field_mapping && Object.keys(config.field_mapping).length > 0) initialCompleted.add("fields");
      setCompletedSteps(initialCompleted);
    }
  }, [config]);

  const loadSampleFromDb = async (dbName: string) => {
    if (!dbName) return;
    setLoadingSample(true);
    try {
      const res = await fetch(`/api/databases/${dbName}/items`);
      if (res.ok) {
        const data = await res.json();
        const items = (data.items || []).slice(0, 3) as Record<string, unknown>[];
        setSampleItems(items);
        if (items.length > 0) {
          const keys = new Set<string>();
          for (const item of items) {
            collectFieldPaths(item, "", keys);
          }
          setAvailableFields(Array.from(keys).sort());
        }
      }
    } catch {
      setSampleItems([]);
    } finally {
      setLoadingSample(false);
    }
  };

  const handleAnalyzeFields = async () => {
    if (sampleItems.length === 0) return;
    setAiMappingFields(true);
    setFieldMappingError(null);
    setFieldMappingConfirmed(false);
    try {
      const res = await apiRequest("POST", "/api/blog/ai/analyze-fields", {
        sample_posts: sampleItems.slice(0, 3),
      });
      const data = await res.json();
      if (data.error) {
        setFieldMappingError(data.error);
      } else {
        setFieldMapping(data.field_mapping || {});
        if (data.available_fields) {
          setAvailableFields(data.available_fields);
        }
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
        database: selectedDb,
        url_pattern: { en: urlPatternEn, es: urlPatternEs },
        categories: { en: categoryEn, es: categoryEs },
        field_mapping: Object.keys(fieldMapping).length > 0 ? fieldMapping : undefined,
      };

      await apiRequest("PUT", "/api/blog/config", payload);
      queryClient.invalidateQueries({ queryKey: ["/api/blog/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/posts"] });
      toast({ title: "Blog configuration saved" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to save configuration", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const canGoNext = (s: WizardStep): boolean => {
    switch (s) {
      case "database": return !!selectedDb;
      case "settings": return !!urlPatternEn;
      case "fields": return fieldMappingConfirmed;
      default: return false;
    }
  };

  const goNext = () => {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === step);
    if (idx < WIZARD_STEPS.length - 1) {
      markComplete(step);
      const nextStep = WIZARD_STEPS[idx + 1].id;
      setStep(nextStep);
      if (nextStep === "fields" && sampleItems.length === 0 && selectedDb) {
        loadSampleFromDb(selectedDb);
      }
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

  const samplePost = sampleItems[0] as Record<string, unknown> | undefined;

  const getFieldValue = (post: Record<string, unknown>, dotPath: string | null): unknown => {
    if (!dotPath) return null;
    return extractByPath(post, dotPath);
  };

  const dbList = databases || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Blog Data Source</DialogTitle>
        </DialogHeader>

        <StepIndicator steps={WIZARD_STEPS} currentStep={step} completedSteps={completedSteps} />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Loading configuration...</span>
          </div>
        ) : (
          <div className="space-y-4 min-h-[250px]">

            {step === "database" && (
              <div className="space-y-4" data-testid="step-database">
                <p className="text-sm text-muted-foreground">
                  Select the database that provides blog post data. Databases are configured and managed separately.
                </p>

                <div className="space-y-2">
                  <Label>Database</Label>
                  <Select value={selectedDb} onValueChange={(v) => { setSelectedDb(v); setSampleItems([]); }}>
                    <SelectTrigger data-testid="select-database">
                      <SelectValue placeholder="Select a database..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dbList.map((db) => (
                        <SelectItem key={db.name} value={db.name}>
                          <div className="flex items-center gap-2">
                            <span>{db.label || db.name}</span>
                            <span className="text-muted-foreground text-xs">({db.name})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedDb && (() => {
                  const db = dbList.find((d) => d.name === selectedDb);
                  return db ? (
                    <div className="rounded-md border p-3 space-y-1" data-testid="section-db-info">
                      <p className="text-sm font-medium">{db.label || db.name}</p>
                      {db.description && (
                        <p className="text-xs text-muted-foreground">{db.description}</p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Badge variant="outline" className="text-xs">{db.source_type}</Badge>
                      </div>
                    </div>
                  ) : null;
                })()}

                {dbList.length === 0 && (
                  <div className="rounded-md bg-muted px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      No databases found. <a href="/private/databases?create=true" className="text-primary underline" data-testid="link-create-database">Create a database</a> first.
                    </p>
                  </div>
                )}

                {dbList.length > 0 && (
                  <div className="text-right">
                    <a href="/private/databases" className="text-xs text-muted-foreground underline" data-testid="link-manage-databases">
                      Manage databases
                    </a>
                  </div>
                )}
              </div>
            )}

            {step === "settings" && (
              <div className="space-y-4" data-testid="step-settings">
                <p className="text-sm text-muted-foreground">
                  Configure URL patterns and default categories for the blog.
                </p>

                <div className="space-y-2">
                  <Label>English URL Pattern</Label>
                  <Input
                    value={urlPatternEn}
                    onChange={(e) => setUrlPatternEn(e.target.value)}
                    placeholder="/en/blog/:category/:slug"
                    className="font-mono text-sm"
                    data-testid="input-url-pattern-en"
                  />
                  <p className="text-xs text-muted-foreground">
                    Available variables: <code>:slug</code>, <code>:category</code>, <code>:locale</code>, <code>:lang</code>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Spanish URL Pattern</Label>
                  <Input
                    value={urlPatternEs}
                    onChange={(e) => setUrlPatternEs(e.target.value)}
                    placeholder="/es/blog/:category/:slug"
                    className="font-mono text-sm"
                    data-testid="input-url-pattern-es"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Default EN Category</Label>
                    <Input
                      value={categoryEn}
                      onChange={(e) => setCategoryEn(e.target.value)}
                      placeholder="blog-us"
                      data-testid="input-category-en"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default ES Category</Label>
                    <Input
                      value={categoryEs}
                      onChange={(e) => setCategoryEs(e.target.value)}
                      placeholder="blog-es"
                      data-testid="input-category-es"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === "fields" && (
              <div className="space-y-4" data-testid="step-fields">
                <p className="text-sm text-muted-foreground">
                  Map database fields to standard blog post properties. Use AI to auto-detect mappings from sample data.
                </p>

                {loadingSample && (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading sample data from database...</span>
                  </div>
                )}

                {!loadingSample && sampleItems.length > 0 && (
                  <Button
                    onClick={handleAnalyzeFields}
                    disabled={aiMappingFields}
                    className="w-full"
                    data-testid="button-ai-fields"
                  >
                    {aiMappingFields ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing fields...</>
                    ) : (
                      <><Wand2 className="h-4 w-4 mr-2" />Auto-detect Field Mapping</>
                    )}
                  </Button>
                )}

                {!loadingSample && sampleItems.length === 0 && selectedDb && (
                  <div className="rounded-md bg-muted px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      No sample data available from database "{selectedDb}". Make sure the database has been fetched at least once.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => loadSampleFromDb(selectedDb)}
                      data-testid="button-retry-sample"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Retry
                    </Button>
                  </div>
                )}

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
                        const isCustom = sourceField != null && sourceField !== "__none__" && !availableFields.includes(sourceField);
                        const selectValue = isCustom ? "__custom__" : (sourceField || "__none__");
                        return (
                        <div key={standardField} className="flex items-center gap-2">
                            <span className={`text-xs font-medium w-24 flex-shrink-0 text-right ${isRequired && !sourceField ? "text-destructive" : "text-muted-foreground"}`}>
                              {standardField}{isRequired ? <span className="text-destructive ml-0.5">*</span> : null}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            {isCustom ? (
                              <>
                                <Input
                                  value={sourceField}
                                  onChange={(e) => {
                                    setFieldMapping((prev) => ({ ...prev, [standardField]: e.target.value }));
                                    setFieldMappingConfirmed(false);
                                  }}
                                  placeholder="e.g. author.details.name"
                                  className="h-8 text-xs font-mono flex-1"
                                  data-testid={`input-custom-path-${standardField}`}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="flex-shrink-0"
                                  onClick={() => {
                                    setFieldMapping((prev) => ({ ...prev, [standardField]: null }));
                                    setFieldMappingConfirmed(false);
                                  }}
                                  data-testid={`button-clear-custom-${standardField}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Select
                                value={selectValue}
                                onValueChange={(v) => {
                                  if (v === "__custom__") {
                                    setFieldMapping((prev) => ({ ...prev, [standardField]: "" }));
                                  } else {
                                    setFieldMapping((prev) => ({ ...prev, [standardField]: v === "__none__" ? null : v }));
                                  }
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
                                  <SelectItem value="__custom__">Custom path...</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
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
                        <><Check className="h-3.5 w-3.5 mr-1" />Confirmed</>
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
              <ArrowLeft className="h-4 w-4 mr-1" />
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
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function collectFieldPaths(obj: unknown, prefix: string, keys: Set<string>): void {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    keys.add(path);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      collectFieldPaths(v, path, keys);
    }
  }
}

function resolvePostField(post: Record<string, any>, field: string): string {
  switch (field) {
    case "slug": return post.slug || "";
    case "category": return post.category?.slug || "";
    case "lang": return post.lang || "";
    case "status": return post.status || "";
    case "tags": return (post.tags || []).join(",");
    default: return "";
  }
}

function buildBlogUrl(pattern: string, post: Record<string, any>, locale: string, fieldMappingKeys?: string[]): string {
  let result = pattern.replaceAll(":locale", locale);
  const keys = fieldMappingKeys || ["slug", "category", "lang", "status", "tags"];
  for (const key of keys) {
    result = result.replaceAll(`:${key}`, resolvePostField(post, key));
  }
  return result;
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

  const PREFIX = "/en/blog/";
  const [suffix, setSuffix] = useState(":slug");
  const inputRef = useRef<HTMLInputElement>(null);
  const pattern = PREFIX + suffix;

  useEffect(() => {
    if (config) {
      const full = config.url_pattern?.en || "/en/blog/:slug";
      setSuffix(full.startsWith(PREFIX) ? full.slice(PREFIX.length) : full.replace(/^\/(en|es)\/blog\/?/, ""));
    }
  }, [config]);

  const URL_SAFE_FIELDS = new Set(["slug", "category", "lang", "status", "tags"]);

  const mappedKeys = useMemo(() => {
    if (!config?.field_mapping) return ["slug"];
    return Object.entries(config.field_mapping)
      .filter(([k, v]) => v != null && URL_SAFE_FIELDS.has(k))
      .map(([k]) => k);
  }, [config]);

  const usedInPattern = useMemo(() => {
    const matches = pattern.match(/:([a-z_]+)/g) || [];
    return matches.map((m) => m.slice(1));
  }, [pattern]);

  const unknownVars = useMemo(() => {
    return usedInPattern.filter((v) => v !== "locale" && !mappedKeys.includes(v));
  }, [usedInPattern, mappedKeys]);

  const deriveLocalePattern = (basePattern: string, locale: string): string => {
    return basePattern.replace(/^\/en\//, `/${locale}/`).replace(/^\/en$/, `/${locale}`);
  };

  const esPreview = deriveLocalePattern(pattern, "es");

  const insertVariable = (varName: string) => {
    const el = inputRef.current;
    if (!el) {
      setSuffix((prev) => prev + `:${varName}`);
      return;
    }
    const start = el.selectionStart ?? suffix.length;
    const end = el.selectionEnd ?? suffix.length;
    const token = `:${varName}`;
    const next = suffix.slice(0, start) + token + suffix.slice(end);
    setSuffix(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

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

  const samplePost = { slug: "intro-to-python", category: { slug: "coding-bootcamp" } };

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
            <div className="space-y-2">
              <Label htmlFor="en-pattern" className="text-sm">URL Pattern</Label>
              <div className="flex items-center">
                <span className="inline-flex items-center px-3 h-9 rounded-l-md border border-r-0 bg-muted text-sm font-mono text-muted-foreground select-none" data-testid="text-url-prefix">
                  {PREFIX}
                </span>
                <Input
                  ref={inputRef}
                  id="en-pattern"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                  placeholder=":slug"
                  className="font-mono text-sm rounded-l-none"
                  data-testid="input-en-pattern"
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono" data-testid="text-en-preview">
                Preview: {buildBlogUrl(pattern, samplePost, "en", mappedKeys)}
              </p>
              {unknownVars.length > 0 && (
                <p className="text-xs text-destructive" data-testid="text-unknown-vars-warning">
                  Unknown variable{unknownVars.length > 1 ? "s" : ""}: {unknownVars.map((v) => `:${v}`).join(", ")}
                </p>
              )}
            </div>

            <div className="space-y-1.5" data-testid="section-available-variables">
              <Label className="text-xs text-muted-foreground">Click to insert a variable</Label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {mappedKeys.map((key) => (
                  <Badge
                    key={key}
                    variant="outline"
                    className="cursor-pointer font-mono text-xs"
                    onClick={() => insertVariable(key)}
                    data-testid={`chip-var-${key}`}
                  >
                    :{key}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-muted px-3 py-2 space-y-1" data-testid="text-locale-note">
              <p className="text-xs text-muted-foreground">
                The <code className="text-foreground">/en/blog/</code> prefix is locked. Other languages use the same structure — <code className="text-foreground">/es/blog/</code> is applied automatically.
              </p>
              <p className="text-xs text-muted-foreground font-mono" data-testid="text-es-preview">
                Spanish: {buildBlogUrl(esPreview, samplePost, "es", mappedKeys)}
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
    const enPosts = posts.filter((p) => p.lang === "en" || p.lang === "us");
    const esPosts = posts.filter((p) => p.lang === "es");
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
        result = result.filter((p) => p.lang === "en" || p.lang === "us");
      } else if (localeFilter === "es") {
        result = result.filter((p) => p.lang === "es");
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
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Blog Management</h1>
            <p className="text-sm text-muted-foreground">
              Overview of all blog articles and cache status — or by calling the <WebhookUrlPopover type="blog" />
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              disabled={clearing}
              data-testid="button-clear-cache"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${clearing ? "animate-spin" : ""}`} />
              Cache
              {cacheStatus?.exists && cacheStatus.age_hours != null && (
                <span className="text-[10px] text-muted-foreground ml-1" data-testid="text-cache-age">
                  ({cacheStatus.age_hours}h)
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDsDialogOpen(true)}
              data-testid="button-data-source"
            >
              <Database className="h-4 w-4 mr-1" />
              Source
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSeoDialogOpen(true)}
              data-testid="button-seo-settings"
            >
              <LinkIcon className="h-4 w-4 mr-1" />
              SEO
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="card-kpi-total">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Articles</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-kpi-total">{allLoading ? "..." : kpis.total}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-kpi-published">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
              <Check className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-kpi-published">{allLoading ? "..." : kpis.published}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-kpi-draft">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-kpi-draft">{allLoading ? "..." : kpis.draft}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-kpi-locale">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">By Language</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                      const locale = post.lang === "es" ? "es" : "en";
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
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <a href={blogUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-new-tab-${post.id}`}>
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Open in new tab
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a href={blogUrl} data-testid={`link-same-tab-${post.id}`}>
                                    <ArrowLeft className="h-4 w-4 mr-2 rotate-180" />
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
                                  <Trash2 className="h-4 w-4 mr-2" />
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
