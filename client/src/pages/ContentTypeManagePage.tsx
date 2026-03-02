import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  IconFolder,
  IconLink,
  IconTrashX,
  IconWand,
  IconLoader2,
  IconLayoutList,
  IconX,
} from "@tabler/icons-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ItemsResponse {
  count: number;
  results: Record<string, any>[];
}

interface CacheStatus {
  exists: boolean;
  age_hours: number | null;
  post_count: number | null;
}

interface StaticEntry {
  slug: string;
  title: string;
  locales: string[];
  urls: Record<string, string>;
}

interface FieldMapping {
  [standardField: string]: string | null;
}

interface DatabaseConfig {
  slug: string;
  field_mapping?: Record<string, string | { source: string; default: string }>;
  indexes?: string[];
}

interface ContentTypeConfig {
  name: string;
  label: string;
  directory: string;
  database: DatabaseConfig | null;
  url_pattern: Record<string, string>;
  static_entry_count?: number;
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

function SearchableFieldSelect({
  value,
  onValueChange,
  dbFields,
  rawFields,
  placeholder,
  testId,
}: {
  value: string;
  onValueChange: (v: string) => void;
  dbFields: string[];
  rawFields: string[];
  placeholder?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const q = searchQuery.toLowerCase();
  const filteredDb = q ? dbFields.filter((f) => f.toLowerCase().includes(q)) : dbFields;
  const filteredRaw = q ? rawFields.filter((f) => f.toLowerCase().includes(q)) : rawFields;

  const displayValue = value === "__none__" || !value ? (placeholder || "(not mapped)") : value;

  return (
    <div className="relative flex-1" ref={containerRef}>
      <button
        type="button"
        className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-xs font-mono ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        onClick={() => { setOpen(!open); setSearchQuery(""); }}
        data-testid={testId}
      >
        <span className={!value || value === "__none__" ? "text-muted-foreground" : ""}>
          {displayValue}
        </span>
        <IconSearch className="h-3 w-3 text-muted-foreground ml-1 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-[10002] top-full left-0 mt-1 w-full min-w-[240px] max-h-64 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-1.5 border-b">
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fields..."
              className="h-7 text-xs"
              data-testid={testId ? `${testId}-search` : undefined}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            <div
              className="px-2 py-1.5 text-xs cursor-pointer hover:bg-muted rounded-sm mx-1 my-0.5 text-muted-foreground"
              onClick={() => { onValueChange("__none__"); setOpen(false); }}
            >
              (not mapped)
            </div>
            {filteredDb.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Database Fields
                </div>
                {filteredDb.map((f) => (
                  <div
                    key={`db-${f}`}
                    className={`px-2 py-1.5 text-xs font-mono cursor-pointer hover:bg-muted rounded-sm mx-1 my-0.5 flex items-center gap-1.5 ${value === f || value === `db.${f}` ? "bg-muted font-medium" : ""}`}
                    onClick={() => { onValueChange(f); setOpen(false); }}
                  >
                    {(value === f || value === `db.${f}`) && <IconCheck className="h-3 w-3 flex-shrink-0" />}
                    {f}
                  </div>
                ))}
              </>
            )}
            {filteredRaw.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1 border-t pt-1.5">
                  Raw API Fields
                </div>
                {filteredRaw.map((f) => (
                  <div
                    key={`raw-${f}`}
                    className={`px-2 py-1.5 text-xs font-mono cursor-pointer hover:bg-muted rounded-sm mx-1 my-0.5 flex items-center gap-1.5 ${value === `raw.${f}` ? "bg-muted font-medium" : ""}`}
                    onClick={() => { onValueChange(`raw.${f}`); setOpen(false); }}
                  >
                    {value === `raw.${f}` && <IconCheck className="h-3 w-3 flex-shrink-0" />}
                    <span className="text-muted-foreground">raw.</span>{f}
                  </div>
                ))}
              </>
            )}
            {filteredDb.length === 0 && filteredRaw.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                No fields match "{searchQuery}"
              </div>
            )}
            <div className="border-t mx-1 mt-1 pt-0.5 mb-0.5">
              <div
                className="px-2 py-1.5 text-xs cursor-pointer hover:bg-muted rounded-sm text-muted-foreground"
                onClick={() => { onValueChange("__custom__"); setOpen(false); }}
              >
                Custom path...
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const WIZARD_STEPS = [
  { id: "database", label: "Select Database", icon: IconDatabase },
  { id: "fields", label: "Field Mapping", icon: IconLayoutList },
] as const;

type WizardStep = typeof WIZARD_STEPS[number]["id"];


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

function SampleDataDialog({
  open,
  onOpenChange,
  sampleItems,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleItems: Record<string, unknown>[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sample Data ({sampleItems.length} item{sampleItems.length !== 1 ? "s" : ""})</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto rounded-md bg-muted p-3">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all" data-testid="text-sample-json">
            {JSON.stringify(sampleItems, null, 2)}
          </pre>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-sample">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DataSourceDialog({
  open,
  onOpenChange,
  contentType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: string;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<WizardStep>("database");
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
  const label = contentType.charAt(0).toUpperCase() + contentType.slice(1);

  const { data: config, isLoading } = useQuery<ContentTypeConfig>({
    queryKey: ["/api/content-types", contentType, "config"],
    queryFn: () => fetch(`/api/content-types/${contentType}/config`).then(r => r.json()),
    enabled: open,
  });

  const { data: databases } = useQuery<DatabaseListItem[]>({
    queryKey: ["/api/databases"],
    enabled: open,
  });

  const [selectedDb, setSelectedDb] = useState("");

  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [localeField, setLocaleField] = useState("");
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [fieldMappingNotes, setFieldMappingNotes] = useState("");
  const [fieldMappingError, setFieldMappingError] = useState<string | null>(null);
  const [aiMappingFields, setAiMappingFields] = useState(false);

  const [sampleItems, setSampleItems] = useState<Record<string, unknown>[]>([]);
  const [loadingSample, setLoadingSample] = useState(false);
  const [sampleDialogOpen, setSampleDialogOpen] = useState(false);
  const [deletedFields, setDeletedFields] = useState<string[]>([]);
  const [indexedFields, setIndexedFields] = useState<string[]>([]);
  const [rawFields, setRawFields] = useState<string[]>([]);

  const markComplete = (s: WizardStep) => {
    setCompletedSteps((prev) => {
      const next = new Set(Array.from(prev));
      next.add(s);
      return next;
    });
  };

  useEffect(() => {
    if (config) {
      setSelectedDb(config.database?.slug || "");

      if (config.database?.field_mapping) {
        const fm: FieldMapping = {};
        for (const [k, v] of Object.entries(config.database.field_mapping)) {
          if (!k.startsWith("_")) {
            fm[k] = typeof v === "object" ? v.source : v;
          }
        }
        setFieldMapping(fm);
        const lm = config.database.field_mapping._locale;
        setLocaleField(lm ? (typeof lm === "object" ? lm.source : lm) : "");
      }
      setIndexedFields(config.database?.indexes || []);

      const initialCompleted = new Set<WizardStep>();
      if (config.database?.slug) initialCompleted.add("database");
      if (config.database?.field_mapping && Object.keys(config.database.field_mapping).filter(k => !k.startsWith("_")).length > 0) initialCompleted.add("fields");
      setCompletedSteps(initialCompleted);
    }
  }, [config]);

  useEffect(() => {
    setCompletedSteps((prev) => {
      const next = new Set(Array.from(prev));
      if (selectedDb) next.add("database"); else next.delete("database");
      const hasMappedField = Object.values(fieldMapping).some((v) => v != null && v !== "__none__");
      if (hasMappedField) next.add("fields"); else next.delete("fields");
      return next;
    });
  }, [selectedDb, fieldMapping]);

  const loadSampleFromDb = async (dbName: string) => {
    if (!dbName) return;
    setLoadingSample(true);
    try {
      const [itemsRes, rawFieldsRes] = await Promise.all([
        fetch(`/api/databases/${dbName}/items`),
        fetch(`/api/databases/${dbName}/raw-fields`),
      ]);
      if (itemsRes.ok) {
        const data = await itemsRes.json();
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
      if (rawFieldsRes.ok) {
        const rawData = await rawFieldsRes.json();
        setRawFields((rawData.fields || []).sort());
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
    setDeletedFields([]);
    try {
      const res = await apiRequest("POST", `/api/content-types/${contentType}/ai/analyze-fields`, {
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
      const fullMapping: Record<string, string> = {};
      if (localeField) {
        fullMapping._locale = localeField;
      }
      for (const [k, v] of Object.entries(fieldMapping)) {
        if (v != null && v !== "__none__") {
          fullMapping[k] = v;
        }
      }

      const payload = {
        database: {
          slug: selectedDb,
          field_mapping: Object.keys(fullMapping).length > 0 ? fullMapping : undefined,
          indexes: indexedFields.length > 0 ? indexedFields : undefined,
        },
      };

      await apiRequest("PUT", `/api/content-types/${contentType}/config`, payload);
      queryClient.invalidateQueries({ queryKey: ["/api/content-types", contentType, "config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-types", contentType, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-types"] });
      toast({ title: `${label} configuration saved` });
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
      case "fields": return Object.values(fieldMapping).some((v) => v != null && v !== "__none__");
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

  const dbList = databases || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect Database to {label}</DialogTitle>
        </DialogHeader>

        <StepIndicator steps={WIZARD_STEPS} currentStep={step} completedSteps={completedSteps} />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <IconLoader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Loading configuration...</span>
          </div>
        ) : (
          <div className="space-y-4 min-h-[250px]">

            {step === "database" && (
              <div className="space-y-4" data-testid="step-database">
                <p className="text-sm text-muted-foreground">
                  Add a database as a dynamic source of {contentType} entries, alongside the existing static entries from the folder. Databases are configured and managed separately.
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

            {step === "fields" && (
              <div className="space-y-4" data-testid="step-fields">
                <p className="text-sm text-muted-foreground">
                  Map database fields to content type properties. Database fields are already normalized, so you can map them directly.
                </p>

                {loadingSample && (
                  <div className="flex items-center gap-2 py-2">
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading sample data from database...</span>
                  </div>
                )}

                {!loadingSample && selectedDb && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {sampleItems.length > 0 && (
                      <Button
                        onClick={handleAnalyzeFields}
                        disabled={aiMappingFields}
                        className="flex-1"
                        data-testid="button-ai-fields"
                      >
                        {aiMappingFields ? (
                          <><IconLoader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing fields...</>
                        ) : (
                          <><IconWand className="h-4 w-4 mr-2" />Auto-detect Field Mapping</>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => loadSampleFromDb(selectedDb)}
                      disabled={loadingSample}
                      data-testid="button-refresh-sample"
                    >
                      <IconRefresh className="h-4 w-4" />
                    </Button>
                    {sampleItems.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline"
                        onClick={() => setSampleDialogOpen(true)}
                        data-testid="link-view-sample"
                      >
                        View sample data ({sampleItems.length})
                      </button>
                    )}
                  </div>
                )}

                {!loadingSample && sampleItems.length === 0 && selectedDb && (
                  <div className="rounded-md bg-muted px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      No sample data available from database "{selectedDb}". Click the refresh button to retry, or make sure the database has been fetched at least once.
                    </p>
                  </div>
                )}

                {fieldMappingError && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2">
                    <p className="text-xs text-destructive">{fieldMappingError}</p>
                  </div>
                )}

                {Object.keys(fieldMapping).length > 0 && (
                  <div className="space-y-3" data-testid="section-field-mapping">
                    <Label className="text-sm font-medium">Field Mapping (Database → Content Type)</Label>
                    <p className="text-xs text-muted-foreground" data-testid="text-field-mapping-note">
                      Use <code className="font-mono bg-muted px-1 rounded">raw.fieldName</code> to reference original API fields directly, or <code className="font-mono bg-muted px-1 rounded">db.fieldName</code> (default) for normalized database fields.
                    </p>
                    {fieldMappingNotes && (
                      <p className="text-xs text-muted-foreground">{fieldMappingNotes}</p>
                    )}

                    <div className="space-y-2">
                      {Object.entries(fieldMapping).map(([standardField, sourceField]) => {
                        const isCustom = sourceField != null && sourceField !== "__none__" && !availableFields.includes(sourceField);
                        const selectValue = isCustom ? "__custom__" : (sourceField || "__none__");
                        return (
                        <div key={standardField} className="flex items-center gap-2">
                            <span className="text-xs font-medium w-24 flex-shrink-0 text-right text-muted-foreground">
                              {standardField}
                            </span>
                            <IconArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            {isCustom ? (
                              <>
                                <Input
                                  value={sourceField}
                                  onChange={(e) => {
                                    setFieldMapping((prev) => ({ ...prev, [standardField]: e.target.value }));
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
                                  }}
                                  data-testid={`button-clear-custom-${standardField}`}
                                >
                                  <IconX className="h-3.5 w-3.5" />
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="flex-shrink-0"
                              onClick={() => {
                                setFieldMapping((prev) => {
                                  const next = { ...prev };
                                  delete next[standardField];
                                  return next;
                                });
                                setDeletedFields((prev) => prev.includes(standardField) ? prev : [...prev, standardField]);
                              }}
                              data-testid={`button-delete-field-${standardField}`}
                            >
                              <IconTrashX className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        );
                      })}
                    </div>

                    {deletedFields.filter((f) => !(f in fieldMapping)).length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Re-add:</span>
                        {deletedFields.filter((f) => !(f in fieldMapping)).map((f) => (
                          <Badge
                            key={f}
                            variant="outline"
                            className="cursor-pointer text-xs"
                            onClick={() => {
                              setFieldMapping((prev) => ({ ...prev, [f]: null }));
                            }}
                            data-testid={`badge-readd-${f}`}
                          >
                            + {f}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs font-medium text-muted-foreground">Locale Field (_locale)</Label>
                      <Select
                        value={localeField || "__none__"}
                        onValueChange={(v) => {
                          setLocaleField(v === "__none__" ? "" : v);
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs font-mono" data-testid="select-locale-field">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">(none)</SelectItem>
                          {availableFields.map((f) => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Which field identifies the item's language/locale (e.g., "lang", "locale")
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs font-medium text-muted-foreground">Indexes</Label>
                      <p className="text-xs text-muted-foreground">
                        Indexed fields generate KPI cards, filter dropdowns, and table columns.
                        {localeField ? " Locale is always indexed automatically." : ""}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {localeField && (
                          <Badge variant="default" className="text-xs cursor-default opacity-70" data-testid="badge-index-locale">
                            <IconCheck className="h-3 w-3 mr-1" />
                            {localeField} (locale)
                          </Badge>
                        )}
                        {Object.keys(fieldMapping).filter(k => !k.startsWith("_") && k !== localeField).map((field) => {
                          const isIndexed = indexedFields.includes(field);
                          return (
                            <Badge
                              key={field}
                              variant={isIndexed ? "default" : "outline"}
                              className="text-xs cursor-pointer"
                              onClick={() => {
                                setIndexedFields((prev) =>
                                  isIndexed ? prev.filter((f) => f !== field) : [...prev, field]
                                );
                              }}
                              data-testid={`badge-index-${field}`}
                            >
                              {isIndexed && <IconCheck className="h-3 w-3 mr-1" />}
                              {field}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}

                <SampleDataDialog
                  open={sampleDialogOpen}
                  onOpenChange={setSampleDialogOpen}
                  sampleItems={sampleItems}
                />
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
              disabled={saving || isLoading || !Object.values(fieldMapping).some((v) => v != null && v !== "__none__")}
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

function resolveItemField(item: Record<string, any>, field: string): string {
  switch (field) {
    case "slug": return item.slug || "";
    case "category": return item.category?.slug || item.category || "";
    case "lang": return item.lang || "";
    case "status": return item.status || "";
    case "tags": return (item.tags || []).join(",");
    default: return String(item[field] || "");
  }
}

function buildItemUrl(pattern: string, item: Record<string, any>, locale: string): string {
  let result = pattern.replaceAll(":locale", locale);
  const paramMatches = pattern.match(/:([a-zA-Z_]+)/g) || [];
  for (const param of paramMatches) {
    const key = param.slice(1);
    if (key === "locale") continue;
    result = result.replaceAll(param, resolveItemField(item, key));
  }
  return result;
}

function SeoSettingsDialog({
  open,
  onOpenChange,
  contentType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: string;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const label = contentType.charAt(0).toUpperCase() + contentType.slice(1);

  const { data: config, isLoading } = useQuery<ContentTypeConfig>({
    queryKey: ["/api/content-types", contentType, "config"],
    queryFn: () => fetch(`/api/content-types/${contentType}/config`).then(r => r.json()),
    enabled: open,
  });

  const [pattern, setPattern] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (config) {
      const existing = config.url_pattern?.en || config.url_pattern?.default || "";
      setPattern(existing.replace(/^\/(en|es)\//, "/:locale/"));
    }
  }, [config]);

  const URL_SAFE_FIELDS = new Set(["slug", "category", "lang", "status", "tags"]);

  const mappedKeys = useMemo(() => {
    const keys = ["locale"];
    if (!config?.database?.field_mapping) {
      keys.push("slug");
      return keys;
    }
    const fromMapping = Object.entries(config.database.field_mapping)
      .filter(([k, v]) => v != null && !k.startsWith("_") && URL_SAFE_FIELDS.has(k))
      .map(([k]) => k);
    return [...keys, ...fromMapping];
  }, [config]);

  const usedInPattern = useMemo(() => {
    const matches = pattern.match(/:([a-z_]+)/g) || [];
    return matches.map((m) => m.slice(1));
  }, [pattern]);

  const unknownVars = useMemo(() => {
    return usedInPattern.filter((v) => !mappedKeys.includes(v));
  }, [usedInPattern, mappedKeys]);

  const sampleItem = { slug: "sample-item", category: { slug: "general" } };

  const insertVariable = (varName: string) => {
    const el = inputRef.current;
    if (!el) {
      setPattern((prev) => prev + `:${varName}`);
      return;
    }
    const start = el.selectionStart ?? pattern.length;
    const end = el.selectionEnd ?? pattern.length;
    const token = `:${varName}`;
    const next = pattern.slice(0, start) + token + pattern.slice(end);
    setPattern(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        url_pattern: {
          en: pattern.replace(/:locale/g, "en"),
          es: pattern.replace(/:locale/g, "es"),
        },
      };
      await apiRequest("PUT", `/api/content-types/${contentType}/config`, payload);
      queryClient.invalidateQueries({ queryKey: ["/api/content-types", contentType, "config"] });
      toast({ title: "URL pattern saved" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to save URL pattern", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{label} URL Settings</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url-pattern" className="text-sm">URL Pattern</Label>
              <Input
                ref={inputRef}
                id="url-pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder={`/:locale/${contentType}/:slug`}
                className="font-mono text-sm"
                data-testid="input-url-pattern"
              />
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

            {pattern && (
              <div className="rounded-md bg-muted px-3 py-2 space-y-1" data-testid="section-url-previews">
                <Label className="text-xs text-muted-foreground">Preview</Label>
                <p className="text-xs text-muted-foreground font-mono" data-testid="text-url-preview-en">
                  EN: {buildItemUrl(pattern.replace(/:locale/g, "en"), sampleItem, "en")}
                </p>
                <p className="text-xs text-muted-foreground font-mono" data-testid="text-url-preview-es">
                  ES: {buildItemUrl(pattern.replace(/:locale/g, "es"), sampleItem, "es")}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-seo">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || isLoading || !pattern} data-testid="button-save-seo">
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ContentTypeManagePage() {
  const { toast } = useToast();
  const [, params] = useRoute("/private/type/:contentType");
  const contentType = params?.contentType || "blog";
  const label = contentType.charAt(0).toUpperCase() + contentType.slice(1);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [clearing, setClearing] = useState(false);
  const [dsDialogOpen, setDsDialogOpen] = useState(false);
  const [seoDialogOpen, setSeoDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"static" | "db">("static");

  const { data: allItemsData, isLoading: allLoading } = useQuery<ItemsResponse>({
    queryKey: ["/api/content-types", contentType, "items"],
    queryFn: () => fetch(`/api/content-types/${contentType}/items`).then(r => r.json()),
    staleTime: 60000,
  });

  const { data: staticEntriesData, isLoading: staticLoading } = useQuery<{ count: number; results: StaticEntry[] }>({
    queryKey: ["/api/content-types", contentType, "static-entries"],
    queryFn: () => fetch(`/api/content-types/${contentType}/static-entries`).then(r => r.json()),
    staleTime: 60000,
  });

  const { data: cacheStatus } = useQuery<CacheStatus>({
    queryKey: ["/api/content-types", contentType, "cache-status"],
    queryFn: () => fetch(`/api/content-types/${contentType}/cache-status`).then(r => r.json()),
    staleTime: 30000,
  });

  const { data: typeConfig } = useQuery<ContentTypeConfig>({
    queryKey: ["/api/content-types", contentType, "config"],
    queryFn: () => fetch(`/api/content-types/${contentType}/config`).then(r => r.json()),
    staleTime: 60000,
  });

  const urlPatterns = typeConfig?.url_pattern || {};
  const localeMapping = typeConfig?.database?.field_mapping?._locale;
  const localeKey = localeMapping
    ? (typeof localeMapping === "object" ? localeMapping.source : localeMapping)
    : null;

  const items = allItemsData?.results || [];

  const LOCALE_LABELS: Record<string, string> = { en: "English", es: "Spanish", pt: "Portuguese", fr: "French", de: "German", it: "Italian" };

  const allIndexFields = useMemo(() => {
    const explicit = typeConfig?.database?.indexes || [];
    const result = [...explicit];
    if (localeKey && !result.includes(localeKey)) {
      result.push(localeKey);
    }
    return result;
  }, [typeConfig?.database?.indexes, localeKey]);

  const indexStats = useMemo(() => {
    const stats: Record<string, Record<string, number>> = {};
    for (const idx of allIndexFields) {
      const counts: Record<string, number> = {};
      for (const item of items) {
        const val = String(item[idx] || "").toLowerCase();
        if (val) {
          counts[val] = (counts[val] || 0) + 1;
        }
      }
      stats[idx] = counts;
    }
    return stats;
  }, [items, allIndexFields]);

  const filtered = useMemo(() => {
    let result = items;

    for (const [field, value] of Object.entries(filters)) {
      if (value && value !== "all") {
        result = result.filter((p) => {
          const itemVal = String(p[field] || "").toLowerCase();
          return itemVal === value.toLowerCase();
        });
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.slug?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          (p.author_name ? `${p.author_name} ${p.author_last_name || ""}` : "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [items, filters, search]);

  const staticEntries = staticEntriesData?.results || [];
  const filteredStatic = useMemo(() => {
    if (!search.trim()) return staticEntries;
    const q = search.toLowerCase();
    return staticEntries.filter(
      (e) => e.title.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q)
    );
  }, [staticEntries, search]);

  const hasDb = !!typeConfig?.database?.slug;
  const defaultViewMode = hasDb ? "db" : "static";
  const prevDefaultRef = useRef(defaultViewMode);
  useEffect(() => {
    if (prevDefaultRef.current !== defaultViewMode) {
      prevDefaultRef.current = defaultViewMode;
      setViewMode(defaultViewMode);
    }
  }, [defaultViewMode]);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await apiRequest("POST", `/api/content-types/${contentType}/clear-cache`);
      toast({ title: `${label} cache cleared`, description: "Refreshing entries..." });
      queryClient.invalidateQueries({ queryKey: ["/api/content-types", contentType, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-types", contentType, "cache-status"] });
    } catch {
      toast({ title: "Failed to clear cache", variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const hasAuthorField = items.some(p => p.author_name || p.author);
  const hasPublishedAt = items.some(p => p.published_at);
  const hasUpdatedAt = items.some(p => p.updated_at);

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
            <h1 className="text-2xl font-bold" data-testid="text-page-title">{label} Management</h1>
            <p className="text-sm text-muted-foreground">
              Overview of all {contentType} entries and cache status
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-data-source"
                >
                  <IconDatabase className="h-4 w-4 mr-1" />
                  Database
                  {cacheStatus?.exists && cacheStatus.age_hours != null && (
                    <span className="text-[10px] text-muted-foreground ml-1" data-testid="text-cache-age">
                      ({cacheStatus.age_hours}h)
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setDsDialogOpen(true)}
                  data-testid="button-manage-connection"
                >
                  <IconDatabase className="h-4 w-4 mr-2" />
                  Manage Connection
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleClearCache}
                  disabled={clearing}
                  data-testid="button-clear-cache"
                >
                  <IconRefresh className={`h-4 w-4 mr-2 ${clearing ? "animate-spin" : ""}`} />
                  Clear Cache
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSeoDialogOpen(true)}
              data-testid="button-seo-settings"
            >
              <IconLink className="h-4 w-4 mr-1" />
              URLs
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="card-kpi-total">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Entries</CardTitle>
              <IconArticle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 flex-wrap">
                <div data-testid="text-kpi-static">
                  <span className="text-2xl font-bold">
                    {typeConfig?.static_entry_count !== undefined ? typeConfig.static_entry_count : "..."}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">Static</span>
                </div>
                {typeConfig?.database?.slug && (
                  <>
                    <div className="h-6 w-px bg-border" />
                    <div data-testid="text-kpi-db">
                      <span className="text-2xl font-bold">{allLoading ? "..." : items.length}</span>
                      <span className="text-xs text-muted-foreground ml-1">DB</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          {allIndexFields.map((idx) => {
            const counts = indexStats[idx] || {};
            const isLocale = idx === localeKey;
            const sortedEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            return (
              <Card key={idx} data-testid={`card-kpi-${idx}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {isLocale ? "Language" : idx.charAt(0).toUpperCase() + idx.slice(1)}
                  </CardTitle>
                  {isLocale ? (
                    <IconWorld className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <IconLayoutList className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardHeader>
                <CardContent>
                  {(() => {
                    const VISIBLE_COUNT = 2;
                    const visible = sortedEntries.slice(0, VISIBLE_COUNT);
                    const remaining = sortedEntries.length - VISIBLE_COUNT;
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {visible.map(([val, count]) => (
                          <Badge key={val} variant="secondary" className="text-xs" data-testid={`text-kpi-${idx}-${val}`}>
                            {allLoading ? "..." : count}
                            <span className="ml-1 text-muted-foreground font-normal">
                              {isLocale ? val.toUpperCase() : val.charAt(0).toUpperCase() + val.slice(1)}
                            </span>
                          </Badge>
                        ))}
                        {remaining > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Badge variant="outline" className="text-xs cursor-pointer" data-testid={`button-view-more-${idx}`}>
                                +{remaining} more
                              </Badge>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto max-w-xs p-3" align="start">
                              <div className="flex flex-wrap gap-1.5">
                                {sortedEntries.slice(VISIBLE_COUNT).map(([val, count]) => (
                                  <Badge key={val} variant="secondary" className="text-xs" data-testid={`text-kpi-${idx}-${val}`}>
                                    {allLoading ? "..." : count}
                                    <span className="ml-1 text-muted-foreground font-normal">
                                      {isLocale ? val.toUpperCase() : val.charAt(0).toUpperCase() + val.slice(1)}
                                    </span>
                                  </Badge>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1" data-testid="toggle-view-mode">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`toggle-elevate ${viewMode === "static" ? "toggle-elevated" : ""}`}
                  onClick={() => setViewMode("static")}
                  data-testid="button-view-static"
                >
                  <IconFolder className="h-4 w-4 mr-1" />
                  Static Entries
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`toggle-elevate ${viewMode === "db" ? "toggle-elevated" : ""}`}
                  onClick={() => setViewMode("db")}
                  data-testid="button-view-db"
                >
                  <IconDatabase className="h-4 w-4 mr-1" />
                  DB Entries
                </Button>
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search ${contentType} entries by title or slug...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              {viewMode === "db" && allIndexFields.map((idx) => {
                const isLocale = idx === localeKey;
                const counts = indexStats[idx] || {};
                const distinctValues = Object.keys(counts).sort();
                if (distinctValues.length === 0) return null;
                return (
                  <Select
                    key={idx}
                    value={filters[idx] || "all"}
                    onValueChange={(v) => setFilters((prev) => ({ ...prev, [idx]: v }))}
                  >
                    <SelectTrigger className="w-[140px]" data-testid={`select-filter-${idx}`}>
                      <SelectValue placeholder={isLocale ? "Language" : idx.charAt(0).toUpperCase() + idx.slice(1)} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        All {isLocale ? "Languages" : `${idx.charAt(0).toUpperCase() + idx.slice(1)}es`}
                      </SelectItem>
                      {distinctValues.map((val) => (
                        <SelectItem key={val} value={val}>
                          {isLocale ? (LOCALE_LABELS[val] || val.toUpperCase()) : val.charAt(0).toUpperCase() + val.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {viewMode === "static" ? (
              staticLoading ? (
                <div className="flex items-center justify-center py-12" data-testid="loading-static">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading entries...</span>
                </div>
              ) : filteredStatic.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-no-results">
                  No static entries found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-static-entries">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Locales</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStatic.map((entry) => {
                        const firstUrl = entry.urls[entry.locales[0]] || Object.values(entry.urls)[0] || "";
                        return (
                          <tr
                            key={entry.slug}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                            data-testid={`row-static-${entry.slug}`}
                          >
                            <td className="px-4 py-3">
                              <div className="min-w-0">
                                <div className="font-medium truncate max-w-[300px]" title={entry.title} data-testid={`text-title-${entry.slug}`}>
                                  {entry.title}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                                  {entry.slug}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 flex-wrap">
                                {entry.locales.map((loc) => (
                                  <Badge key={loc} variant="outline" className="text-xs">
                                    {loc.toUpperCase()}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {Object.keys(entry.urls).length > 0 && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" data-testid={`button-actions-${entry.slug}`}>
                                      <IconDotsVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {Object.entries(entry.urls).map(([loc, url]) => (
                                      <DropdownMenuItem key={loc} asChild>
                                        <a href={url} target="_blank" rel="noopener noreferrer" data-testid={`link-${entry.slug}-${loc}`}>
                                          <IconExternalLink className="h-4 w-4 mr-2" />
                                          Open ({loc.toUpperCase()})
                                        </a>
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              allLoading ? (
                <div className="flex items-center justify-center py-12" data-testid="loading-items">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading entries...</span>
                </div>
              ) : !hasDb ? (
                <div className="text-center py-12 space-y-3" data-testid="text-no-database">
                  <IconDatabase className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    You can link a database to create more {label} entries dynamically. You will be able to configure how these dynamic entries look in a template.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDsDialogOpen(true)}
                    data-testid="button-link-database"
                  >
                    <IconDatabase className="h-4 w-4 mr-1" />
                    Link to Database
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-no-results">
                  No DB entries found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-items">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                        {hasAuthorField && <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Author</th>}
                        {allIndexFields.map((idx) => (
                          <th key={idx} className="text-left px-4 py-3 font-medium text-muted-foreground">
                            {idx === localeKey ? "Lang" : idx.charAt(0).toUpperCase() + idx.slice(1)}
                          </th>
                        ))}
                        {hasPublishedAt && <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Published</th>}
                        {hasUpdatedAt && <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Updated</th>}
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item) => {
                        const itemLocale = localeKey ? String(item[localeKey] || "en") : "en";
                        const pattern = itemLocale === "es" ? (urlPatterns.es || urlPatterns.en) : (urlPatterns.en || urlPatterns.default || "");
                        const itemUrl = pattern ? buildItemUrl(pattern, item, itemLocale) : "";
                        return (
                          <tr
                            key={item.id || item.slug}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                            data-testid={`row-item-${item.id || item.slug}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {(item.preview || item.image) && (
                                  <img
                                    src={item.preview || item.image}
                                    alt=""
                                    className="w-10 h-10 rounded-md object-cover flex-shrink-0 hidden sm:block"
                                  />
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium truncate max-w-[300px]" title={item.title} data-testid={`text-title-${item.id || item.slug}`}>
                                    {item.title || item.slug}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                                    {item.slug}
                                  </div>
                                </div>
                              </div>
                            </td>
                            {hasAuthorField && (
                              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                                {item.author_name
                                  ? `${item.author_name} ${item.author_last_name || ""}`.trim()
                                  : item.author
                                    ? `${item.author.first_name || ""} ${item.author.last_name || ""}`.trim()
                                    : "—"}
                              </td>
                            )}
                            {allIndexFields.map((idx) => {
                              const val = String(item[idx] || "");
                              const isLocale = idx === localeKey;
                              if (idx === "status") {
                                return (
                                  <td key={idx} className="px-4 py-3">
                                    <StatusBadge status={val} />
                                  </td>
                                );
                              }
                              return (
                                <td key={idx} className="px-4 py-3">
                                  <Badge variant="outline">
                                    {isLocale ? val.toUpperCase() : val.charAt(0).toUpperCase() + val.slice(1)}
                                  </Badge>
                                </td>
                              );
                            })}
                            {hasPublishedAt && (
                              <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                                {formatDate(item.published_at)}
                              </td>
                            )}
                            {hasUpdatedAt && (
                              <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                                {formatDate(item.updated_at)}
                              </td>
                            )}
                            <td className="px-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-actions-${item.id || item.slug}`}>
                                    <IconDotsVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {itemUrl && (
                                    <>
                                      <DropdownMenuItem asChild>
                                        <a href={itemUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-new-tab-${item.id || item.slug}`}>
                                          <IconExternalLink className="h-4 w-4 mr-2" />
                                          Open in new tab
                                        </a>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <a href={itemUrl} data-testid={`link-same-tab-${item.id || item.slug}`}>
                                          <IconArrowLeft className="h-4 w-4 mr-2 rotate-180" />
                                          Open in this tab
                                        </a>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      try {
                                        await apiRequest("DELETE", `/api/content-types/${contentType}/cache/${item.slug}`);
                                        toast({ title: `Cache cleared for "${item.title || item.slug}"` });
                                      } catch {
                                        toast({ title: "Failed to clear cache", variant: "destructive" });
                                      }
                                    }}
                                    data-testid={`button-clear-cache-${item.id || item.slug}`}
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
              )
            )}
            {viewMode === "static" && !staticLoading && filteredStatic.length > 0 && (
              <div className="px-4 py-3 border-t text-xs text-muted-foreground" data-testid="text-showing-count">
                Showing {filteredStatic.length} of {staticEntries.length} entries
              </div>
            )}
            {viewMode === "db" && !allLoading && filtered.length > 0 && (
              <div className="px-4 py-3 border-t text-xs text-muted-foreground" data-testid="text-showing-count">
                Showing {filtered.length} of {items.length} entries
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DataSourceDialog open={dsDialogOpen} onOpenChange={setDsDialogOpen} contentType={contentType} />
      <SeoSettingsDialog open={seoDialogOpen} onOpenChange={setSeoDialogOpen} contentType={contentType} />
    </div>
  );
}
