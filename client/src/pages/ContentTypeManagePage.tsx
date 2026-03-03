import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
  IconTrash,
  IconWand,
  IconLoader2,
  IconLayoutList,
  IconX,
  IconCode,
  IconTransform,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getDebugToken } from "@/hooks/useDebugAuth";
import { DeletePageModal } from "@/components/DebugBubble/components/DeletePageModal";

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
}

interface ContentTypeConfig {
  name: string;
  label: string;
  directory: string;
  field_mapping?: Record<string, string | { source: string; default: string }>;
  indexes?: string[];
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
  { id: "database", label: "Database", icon: IconDatabase },
  { id: "preview", label: "Inspect", icon: IconEye },
  { id: "identity", label: "Identity", icon: IconLink },
  { id: "mapping", label: "Mapping", icon: IconLayoutList },
  { id: "indexes", label: "Indexes", icon: IconArticle },
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
  const [slugField, setSlugField] = useState("");
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

  const [transformerModes, setTransformerModes] = useState<Record<string, boolean>>({});
  const [localeIsTransformer, setLocaleIsTransformer] = useState(false);
  const [slugIsTransformer, setSlugIsTransformer] = useState(false);

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

      if (config.field_mapping) {
        const fm: FieldMapping = {};
        const modes: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(config.field_mapping)) {
          if (!k.startsWith("_")) {
            const raw = typeof v === "object" ? v.source : v;
            if (raw && raw.startsWith("function:")) {
              try {
                fm[k] = atob(raw.slice("function:".length));
                modes[k] = true;
              } catch {
                fm[k] = raw;
              }
            } else {
              fm[k] = raw;
            }
          }
        }
        setFieldMapping(fm);
        setTransformerModes(modes);

        const sm = config.field_mapping._slug;
        const smVal = sm ? (typeof sm === "object" ? sm.source : sm) : "";
        if (smVal && smVal.startsWith("function:")) {
          try {
            setSlugField(atob(smVal.slice("function:".length)));
            setSlugIsTransformer(true);
          } catch {
            setSlugField(smVal);
          }
        } else {
          setSlugField(smVal);
          setSlugIsTransformer(false);
        }

        const lm = config.field_mapping._locale;
        const lmVal = lm ? (typeof lm === "object" ? lm.source : lm) : "";
        if (lmVal && lmVal.startsWith("function:")) {
          try {
            setLocaleField(atob(lmVal.slice("function:".length)));
            setLocaleIsTransformer(true);
          } catch {
            setLocaleField(lmVal);
          }
        } else {
          setLocaleField(lmVal);
          setLocaleIsTransformer(false);
        }
      }
      setIndexedFields(config.indexes || []);

      if (config.database?.slug && sampleItems.length === 0) {
        loadSampleFromDb(config.database.slug);
      }

      const initialCompleted = new Set<WizardStep>();
      if (config.database?.slug) {
        initialCompleted.add("database");
        initialCompleted.add("preview");
      }
      if (config.field_mapping) {
        const hasSlug = !!config.field_mapping._slug;
        const hasRegular = Object.keys(config.field_mapping).filter(k => !k.startsWith("_")).length > 0;
        if (hasSlug) initialCompleted.add("identity");
        if (hasRegular) {
          initialCompleted.add("mapping");
          initialCompleted.add("indexes");
        }
      }
      setCompletedSteps(initialCompleted);
    }
  }, [config]);

  useEffect(() => {
    setCompletedSteps((prev) => {
      const next = new Set(Array.from(prev));
      if (selectedDb) next.add("database"); else next.delete("database");
      if (sampleItems.length > 0) next.add("preview"); else next.delete("preview");
      if (slugField) next.add("identity"); else next.delete("identity");
      const hasMappedField = Object.values(fieldMapping).some((v) => v != null && v !== "__none__");
      if (hasMappedField) next.add("mapping"); else next.delete("mapping");
      return next;
    });
  }, [selectedDb, fieldMapping, slugField, sampleItems]);

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
        const aiMapping = data.field_mapping || {};
        if (aiMapping._slug) {
          setSlugField(typeof aiMapping._slug === "object" ? aiMapping._slug.source : aiMapping._slug);
          delete aiMapping._slug;
        }
        if (aiMapping._locale) {
          setLocaleField(typeof aiMapping._locale === "object" ? aiMapping._locale.source : aiMapping._locale);
          delete aiMapping._locale;
        }
        setFieldMapping(aiMapping);
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
      if (slugField) {
        fullMapping._slug = slugIsTransformer ? "function:" + btoa(slugField) : slugField;
      }
      if (localeField) {
        fullMapping._locale = localeIsTransformer ? "function:" + btoa(localeField) : localeField;
      }
      for (const [k, v] of Object.entries(fieldMapping)) {
        if (v != null && v !== "__none__") {
          fullMapping[k] = transformerModes[k] ? "function:" + btoa(v) : v;
        }
      }

      const payload = {
        field_mapping: Object.keys(fullMapping).length > 0 ? fullMapping : undefined,
        indexes: indexedFields.length > 0 ? indexedFields : undefined,
        database: {
          slug: selectedDb,
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
      case "preview": return true;
      case "identity": return !!slugField;
      case "mapping": return Object.values(fieldMapping).some((v) => v != null && v !== "__none__");
      case "indexes": return true;
      default: return false;
    }
  };

  const goNext = () => {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === step);
    if (idx < WIZARD_STEPS.length - 1) {
      markComplete(step);
      const nextStep = WIZARD_STEPS[idx + 1].id;
      setStep(nextStep);
      if (nextStep === "preview" && sampleItems.length === 0 && selectedDb) {
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
                  Choose which database provides dynamic entries for this content type. Database items will appear alongside any static YAML entries.
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

            {step === "preview" && (
              <div className="space-y-4" data-testid="step-preview">
                <p className="text-sm text-muted-foreground">
                  Here's what we found in your database. Review the detected fields below — these will be available for mapping in the next steps. You can also auto-detect the mapping using AI.
                </p>

                {loadingSample && (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <IconLoader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading sample data from database...</span>
                  </div>
                )}

                {!loadingSample && sampleItems.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs" data-testid="badge-item-count">
                        {sampleItems.length} sample item{sampleItems.length !== 1 ? "s" : ""} loaded
                      </Badge>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline"
                        onClick={() => setSampleDialogOpen(true)}
                        data-testid="link-view-sample"
                      >
                        View raw JSON
                      </button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => loadSampleFromDb(selectedDb)}
                        disabled={loadingSample}
                        data-testid="button-refresh-sample"
                      >
                        <IconRefresh className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Detected Fields ({availableFields.length})</Label>
                      <div className="rounded-md border p-3 flex flex-wrap gap-1.5" data-testid="section-detected-fields">
                        {availableFields.map((f) => (
                          <Badge key={f} variant="outline" className="text-xs font-mono no-default-active-elevate" data-testid={`badge-field-${f}`}>
                            {f}
                          </Badge>
                        ))}
                        {availableFields.length === 0 && (
                          <p className="text-xs text-muted-foreground">No fields detected.</p>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={handleAnalyzeFields}
                      disabled={aiMappingFields}
                      className="w-full"
                      data-testid="button-ai-fields"
                    >
                      {aiMappingFields ? (
                        <><IconLoader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing fields...</>
                      ) : (
                        <><IconWand className="h-4 w-4 mr-2" />Auto-detect Field Mapping</>
                      )}
                    </Button>

                    {fieldMappingError && (
                      <div className="rounded-md bg-destructive/10 px-3 py-2">
                        <p className="text-xs text-destructive">{fieldMappingError}</p>
                      </div>
                    )}
                  </>
                )}

                {!loadingSample && sampleItems.length === 0 && selectedDb && (
                  <div className="rounded-md bg-muted px-3 py-4 space-y-2 text-center">
                    <p className="text-sm text-muted-foreground">
                      No sample data available from database "{selectedDb}".
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => loadSampleFromDb(selectedDb)}
                      disabled={loadingSample}
                      data-testid="button-retry-sample"
                    >
                      <IconRefresh className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                )}

                <SampleDataDialog
                  open={sampleDialogOpen}
                  onOpenChange={setSampleDialogOpen}
                  sampleItems={sampleItems}
                />
              </div>
            )}

            {step === "identity" && (
              <div className="space-y-4" data-testid="step-identity">
                <p className="text-sm text-muted-foreground">
                  Every database-backed content type needs an identity. The slug field uniquely identifies each item for URL routing. The locale field identifies the item's language for multi-language support.
                </p>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium text-muted-foreground flex-1">Slug Field (_slug)</Label>
                    <Badge variant="default" className="text-[10px] no-default-active-elevate">Required</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={slugIsTransformer ? "text-primary" : ""}
                      onClick={() => {
                        if (!slugIsTransformer) {
                          setSlugIsTransformer(true);
                          if (!slugField) setSlugField("(value, item) => item.slug");
                        } else {
                          setSlugIsTransformer(false);
                          setSlugField("");
                        }
                      }}
                      data-testid="button-toggle-slug-transform"
                    >
                      <IconCode className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {slugIsTransformer ? (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-mono">(value, item) =&gt; ...</p>
                      <Textarea
                        value={slugField}
                        onChange={(e) => setSlugField(e.target.value)}
                        placeholder="(value, item) => item.slug"
                        className="text-xs font-mono min-h-[3rem] resize-y"
                        data-testid="textarea-slug-transform"
                      />
                    </div>
                  ) : (
                    <Select
                      value={slugField || "__none__"}
                      onValueChange={(v) => {
                        setSlugField(v === "__none__" ? "" : v);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs font-mono" data-testid="select-slug-field">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">(none)</SelectItem>
                        {availableFields.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Which field uniquely identifies each item (e.g., "slug", "id")
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium text-muted-foreground flex-1">Locale Field (_locale)</Label>
                    <Badge variant="outline" className="text-[10px] no-default-active-elevate">Recommended</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={localeIsTransformer ? "text-primary" : ""}
                      onClick={() => {
                        if (!localeIsTransformer) {
                          setLocaleIsTransformer(true);
                          if (!localeField) setLocaleField("(value) => value === 'us' ? 'en' : value");
                        } else {
                          setLocaleIsTransformer(false);
                          setLocaleField("");
                        }
                      }}
                      data-testid="button-toggle-locale-transform"
                    >
                      <IconCode className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {localeIsTransformer ? (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-mono">(value, item) =&gt; ...</p>
                      <Textarea
                        value={localeField}
                        onChange={(e) => setLocaleField(e.target.value)}
                        placeholder="(value) => value === 'us' ? 'en' : value"
                        className="text-xs font-mono min-h-[3rem] resize-y"
                        data-testid="textarea-locale-transform"
                      />
                    </div>
                  ) : (
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
                  )}
                  <p className="text-xs text-muted-foreground">
                    Which field identifies the item's language (e.g., "lang", "locale")
                  </p>
                </div>

                {(slugIsTransformer || localeIsTransformer) && (
                  <div className="rounded-md bg-muted px-3 py-2 space-y-1" data-testid="section-transform-help">
                    <p className="text-xs font-medium text-muted-foreground">About computed fields</p>
                    <p className="text-xs text-muted-foreground">
                      Write a JavaScript function that receives two arguments: <code className="font-mono bg-background px-1 rounded">value</code> (the raw field value) and <code className="font-mono bg-background px-1 rounded">item</code> (the full database record). Return the normalized value.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Example: <code className="font-mono bg-background px-1 rounded">(value, item) =&gt; value === 'us' ? 'en' : value</code>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Functions run in a secure sandbox — no access to files, network, or system resources. 50ms timeout.
                    </p>
                  </div>
                )}
              </div>
            )}

            {step === "mapping" && (
              <div className="space-y-4" data-testid="step-mapping">
                <p className="text-sm text-muted-foreground">
                  Map database fields to content type properties. Pick from detected fields, type a custom dot-path, or compute a value with a function.
                </p>

                <p className="text-xs text-muted-foreground" data-testid="text-field-mapping-note">
                  Use <code className="font-mono bg-muted px-1 rounded">raw.fieldName</code> to reference original API fields, or <code className="font-mono bg-muted px-1 rounded">db.fieldName</code> (default) for normalized database fields.
                </p>

                {fieldMappingNotes && (
                  <p className="text-xs text-muted-foreground">{fieldMappingNotes}</p>
                )}

                {fieldMappingError && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2">
                    <p className="text-xs text-destructive">{fieldMappingError}</p>
                  </div>
                )}

                {Object.values(transformerModes).some(Boolean) && (
                  <div className="rounded-md bg-muted px-3 py-2 space-y-1" data-testid="section-transform-help-mapping">
                    <p className="text-xs font-medium text-muted-foreground">About computed fields</p>
                    <p className="text-xs text-muted-foreground">
                      Write a JavaScript function: <code className="font-mono bg-background px-1 rounded">(value, item) =&gt; result</code>. <code className="font-mono bg-background px-1 rounded">value</code> is the raw field value, <code className="font-mono bg-background px-1 rounded">item</code> is the full record. Runs in a secure sandbox (50ms timeout).
                    </p>
                  </div>
                )}

                {Object.keys(fieldMapping).length > 0 && (
                  <div className="space-y-2">
                    {Object.entries(fieldMapping).map(([standardField, sourceField]) => {
                      const isFnMode = !!transformerModes[standardField];
                      const isCustom = !isFnMode && sourceField != null && sourceField !== "__none__" && !availableFields.includes(sourceField);
                      const selectValue = isCustom ? "__custom__" : (sourceField || "__none__");
                      return (
                      <div key={standardField} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium w-24 flex-shrink-0 text-right text-muted-foreground">
                            {standardField}
                          </span>
                          <IconArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          {isFnMode ? (
                            <div className="flex-1 space-y-1">
                              <p className="text-[10px] text-muted-foreground font-mono">(value, item) =&gt; ...</p>
                              <Textarea
                                value={sourceField || ""}
                                onChange={(e) => setFieldMapping((prev) => ({ ...prev, [standardField]: e.target.value }))}
                                placeholder="(value, item) => value"
                                className="text-xs font-mono min-h-[3rem] resize-y"
                                data-testid={`textarea-transform-${standardField}`}
                              />
                            </div>
                          ) : isCustom ? (
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
                            className={`flex-shrink-0 ${isFnMode ? "text-primary" : ""}`}
                            onClick={() => {
                              setTransformerModes((prev) => {
                                const next = { ...prev, [standardField]: !prev[standardField] };
                                if (!next[standardField]) {
                                  setFieldMapping((p) => ({ ...p, [standardField]: null }));
                                }
                                return next;
                              });
                            }}
                            data-testid={`button-toggle-transform-${standardField}`}
                          >
                            <IconCode className="h-3.5 w-3.5" />
                          </Button>
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
                              setTransformerModes((prev) => {
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
                      </div>
                      );
                    })}
                  </div>
                )}

                {Object.keys(fieldMapping).length === 0 && (
                  <div className="rounded-md bg-muted px-3 py-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No field mappings yet. Go back to the Inspect Data step and use "Auto-detect Field Mapping" to get started, or fields will be added when AI analysis runs.
                    </p>
                  </div>
                )}

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
              </div>
            )}

            {step === "indexes" && (
              <div className="space-y-4" data-testid="step-indexes">
                <p className="text-sm text-muted-foreground">
                  Indexed fields generate summary cards, filter dropdowns, and sortable columns on the management page. Click a field to toggle indexing. Locale is always indexed automatically.
                </p>

                <div className="flex items-center gap-2 flex-wrap" data-testid="section-index-badges">
                  {localeField && (
                    <Badge variant="default" className="text-xs cursor-default opacity-70 no-default-active-elevate" data-testid="badge-index-locale">
                      <IconCheck className="h-3 w-3 mr-1" />
                      {localeIsTransformer ? "locale (computed)" : localeField} (auto)
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
                  {Object.keys(fieldMapping).filter(k => !k.startsWith("_") && k !== localeField).length === 0 && !localeField && (
                    <p className="text-xs text-muted-foreground">No mapped fields available for indexing. Go back and add field mappings first.</p>
                  )}
                </div>
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

type FieldValidationResult = { valid: boolean; total: number; found: number; missing: string[] };
type ValidationState = Record<string, FieldValidationResult | "loading" | null>;

function FieldValidationIndicator({ result }: { result: FieldValidationResult | "loading" | null | undefined }) {
  if (!result) return null;
  if (result === "loading") {
    return <IconLoader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground flex-shrink-0" />;
  }
  if (result.valid) {
    return <IconCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" data-testid="icon-validation-valid" />;
  }
  return <IconAlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" data-testid="icon-validation-invalid" />;
}

function FieldValidationMessage({ result, fieldKey, source }: { result: FieldValidationResult | "loading" | null | undefined; fieldKey: string; source?: string }) {
  if (!result || result === "loading" || result.valid) return null;
  const displaySource = source || fieldKey;
  const allMissing = result.found === 0;
  return (
    <p className="text-[11px] text-destructive pl-[7.5rem]" data-testid={`text-validation-error-${fieldKey}`}>
      Source property "<span className="font-mono font-medium">{displaySource}</span>" was not found in {allMissing ? "any" : "some"} content {result.total === 1 ? "entry" : "entries"}.
      {" "}{allMissing ? "None" : `Only ${result.found}`} of {result.total} {result.total === 1 ? "entry has" : "entries have"} this property.
      {!allMissing && <>{" "}Affected: {result.missing.slice(0, 5).join(", ")}{result.missing.length > 5 ? ` (+${result.missing.length - 5} more)` : ""}</>}
    </p>
  );
}

function FieldMappingDialog({
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

  const isDbBacked = !!config?.database?.slug;

  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [indexedFields, setIndexedFields] = useState<string[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [transformerModes, setTransformerModes] = useState<Record<string, boolean>>({});
  const [validation, setValidation] = useState<ValidationState>({});
  const [newValueValidation, setNewValueValidation] = useState<FieldValidationResult | "loading" | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const requestCounters = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!config) return;
    const fm: Record<string, string> = {};
    const tmodes: Record<string, boolean> = {};
    if (config.field_mapping) {
      for (const [k, v] of Object.entries(config.field_mapping)) {
        if (typeof v === "string") {
          if (v.startsWith("function:")) {
            fm[k] = atob(v.slice(9));
            tmodes[k] = true;
          } else {
            fm[k] = v;
          }
        } else if (v && typeof v === "object" && "source" in v) {
          fm[k] = v.source;
        }
      }
    }
    setMappings(fm);
    setTransformerModes(tmodes);
    setIndexedFields(config.indexes || []);
    setValidation({});
    requestCounters.current = {};
  }, [config]);

  const validateSingleField = useCallback((key: string, source: string) => {
    if (isDbBacked || !source || key.startsWith("_")) return;
    const reqId = (requestCounters.current[key] || 0) + 1;
    requestCounters.current[key] = reqId;
    setValidation((prev) => ({ ...prev, [key]: "loading" }));
    fetch(`/api/content-types/${contentType}/validate-field?source=${encodeURIComponent(source)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((result: FieldValidationResult | null) => {
        if (requestCounters.current[key] !== reqId) return;
        setValidation((prev) => ({ ...prev, [key]: result }));
      })
      .catch(() => {
        if (requestCounters.current[key] !== reqId) return;
        setValidation((prev) => ({ ...prev, [key]: null }));
      });
  }, [contentType, isDbBacked]);

  const debouncedValidate = useCallback((key: string, source: string) => {
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => validateSingleField(key, source), 500);
  }, [validateSingleField]);

  useEffect(() => {
    if (!config || isDbBacked) return;
    const rawMapping: Record<string, string> = {};
    if (config.field_mapping) {
      for (const [k, v] of Object.entries(config.field_mapping)) {
        if (typeof v === "string" && !v.startsWith("function:") && !k.startsWith("_")) {
          rawMapping[k] = v;
        }
      }
    }
    if (Object.keys(rawMapping).length === 0) return;
    const bulkReqId = Date.now();
    requestCounters.current["__bulk"] = bulkReqId;
    fetch(`/api/content-types/${contentType}/validate-mappings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field_mapping: rawMapping }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { results: Record<string, FieldValidationResult> } | null) => {
        if (requestCounters.current["__bulk"] !== bulkReqId || !data) return;
        setValidation(data.results || {});
      })
      .catch(() => {});
  }, [config, contentType, isDbBacked]);

  const handleSourceChange = (key: string, value: string) => {
    setMappings((prev) => ({ ...prev, [key]: value }));
    if (!transformerModes[key] && !key.startsWith("_") && !isDbBacked) {
      debouncedValidate(key, value);
    }
  };

  const validateNewValue = useCallback((source: string) => {
    if (isDbBacked || !source) {
      setNewValueValidation(null);
      return;
    }
    const reqId = (requestCounters.current["__new"] || 0) + 1;
    requestCounters.current["__new"] = reqId;
    setNewValueValidation("loading");
    fetch(`/api/content-types/${contentType}/validate-field?source=${encodeURIComponent(source)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((result: FieldValidationResult | null) => {
        if (requestCounters.current["__new"] !== reqId) return;
        setNewValueValidation(result);
      })
      .catch(() => {
        if (requestCounters.current["__new"] !== reqId) return;
        setNewValueValidation(null);
      });
  }, [contentType, isDbBacked]);

  const debouncedValidateNew = useCallback((source: string) => {
    if (debounceTimers.current["__new"]) clearTimeout(debounceTimers.current["__new"]);
    debounceTimers.current["__new"] = setTimeout(() => validateNewValue(source), 500);
  }, [validateNewValue]);

  const handleNewValueChange = (value: string) => {
    setNewValue(value);
    debouncedValidateNew(value.trim() || newKey.trim());
  };

  const handleAddField = () => {
    const key = newKey.trim();
    if (!key || key in mappings) return;
    const source = newValue.trim() || key;
    setMappings((prev) => ({ ...prev, [key]: source }));
    if (newValueValidation && newValueValidation !== "loading") {
      setValidation((prev) => ({ ...prev, [key]: newValueValidation }));
    } else if (!isDbBacked && !key.startsWith("_")) {
      validateSingleField(key, source);
    }
    setNewKey("");
    setNewValue("");
    setNewValueValidation(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fullMapping: Record<string, string> = {};
      for (const [k, v] of Object.entries(mappings)) {
        if (v) {
          fullMapping[k] = transformerModes[k] ? "function:" + btoa(v) : v;
        }
      }

      const payload = {
        field_mapping: Object.keys(fullMapping).length > 0 ? fullMapping : undefined,
        indexes: indexedFields.length > 0 ? indexedFields : undefined,
      };

      const res = await fetch(`/api/content-types/${contentType}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }

      if (!res.ok) {
        if (data.validation && typeof data.validation === "object") {
          setValidation((prev) => ({ ...prev, ...(data.validation as Record<string, FieldValidationResult>) }));
        }
        toast({ title: (data.error as string) || "Failed to save field mappings", variant: "destructive" });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["/api/content-types", contentType, "config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-types", contentType, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-types"] });
      toast({ title: `${label} field mappings saved` });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to save field mappings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const regularKeys = Object.keys(mappings).filter((k) => !k.startsWith("_"));
  const specialKeys = Object.keys(mappings).filter((k) => k.startsWith("_"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{label} Field Mappings</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <IconLoader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Field mappings define which values are available as <code className="font-mono bg-muted px-1 rounded text-xs">{"{{ single.fieldName }}"}</code> template variables in sections.
            </p>

            {Object.values(transformerModes).some(Boolean) && (
              <div className="rounded-md bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Computed fields use: <code className="font-mono bg-background px-1 rounded">(value, item) =&gt; result</code>. Runs in a secure sandbox (50ms timeout).
                </p>
              </div>
            )}

            {specialKeys.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Special Fields</Label>
                {specialKeys.map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono flex-shrink-0">{key}</Badge>
                    <IconArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    {transformerModes[key] ? (
                      <Textarea
                        value={mappings[key] || ""}
                        onChange={(e) => setMappings((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="(value, item) => value"
                        className="text-xs font-mono min-h-[3rem] resize-y flex-1"
                        data-testid={`textarea-transform-${key}`}
                      />
                    ) : (
                      <Input
                        value={mappings[key] || ""}
                        onChange={(e) => setMappings((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="text-xs font-mono flex-1"
                        data-testid={`input-mapping-${key}`}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`flex-shrink-0 ${transformerModes[key] ? "text-primary" : ""}`}
                      onClick={() => setTransformerModes((prev) => ({ ...prev, [key]: !prev[key] }))}
                      data-testid={`button-toggle-transform-${key}`}
                    >
                      <IconCode className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Field Mappings</Label>
              {regularKeys.length > 0 ? (
                <div className="space-y-1">
                  {regularKeys.map((key) => {
                    const isFn = !!transformerModes[key];
                    const vResult = isFn ? null : validation[key];
                    return (
                      <div key={key}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono w-28 flex-shrink-0 text-right text-muted-foreground truncate" title={key}>
                            {key}
                          </span>
                          <IconArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          {isFn ? (
                            <Textarea
                              value={mappings[key] || ""}
                              onChange={(e) => setMappings((prev) => ({ ...prev, [key]: e.target.value }))}
                              placeholder="(value, item) => value"
                              className="text-xs font-mono min-h-[3rem] resize-y flex-1"
                              data-testid={`textarea-transform-${key}`}
                            />
                          ) : (
                            <Input
                              value={mappings[key] || ""}
                              onChange={(e) => handleSourceChange(key, e.target.value)}
                              placeholder={key}
                              className="text-xs font-mono flex-1"
                              data-testid={`input-mapping-${key}`}
                            />
                          )}
                          {!isFn && !isDbBacked && <FieldValidationIndicator result={vResult} />}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`flex-shrink-0 ${isFn ? "text-primary" : ""}`}
                            onClick={() => {
                              const nowFn = !transformerModes[key];
                              setTransformerModes((prev) => ({ ...prev, [key]: nowFn }));
                              if (nowFn) {
                                setValidation((prev) => { const n = { ...prev }; delete n[key]; return n; });
                              } else if (!isDbBacked && mappings[key]) {
                                validateSingleField(key, mappings[key]);
                              }
                            }}
                            data-testid={`button-toggle-transform-${key}`}
                          >
                            <IconCode className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0"
                            onClick={() => {
                              setMappings((prev) => {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                              });
                              setTransformerModes((prev) => {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                              });
                              setValidation((prev) => {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                              });
                              setIndexedFields((prev) => prev.filter((f) => f !== key));
                            }}
                            data-testid={`button-delete-mapping-${key}`}
                          >
                            <IconTrashX className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {!isFn && !isDbBacked && <FieldValidationMessage result={vResult} fieldKey={key} source={mappings[key]} />}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2">No field mappings defined yet.</p>
              )}

              <div className="space-y-1 pt-1">
                <div className="flex items-center gap-2">
                  <Input
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="Field name"
                    className="text-xs font-mono flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddField(); }}
                    data-testid="input-new-mapping-key"
                  />
                  <IconArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={newValue}
                    onChange={(e) => handleNewValueChange(e.target.value)}
                    placeholder="Source (default: same)"
                    className="text-xs font-mono flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddField(); }}
                    data-testid="input-new-mapping-value"
                  />
                  {!isDbBacked && (newValue.trim() || newKey.trim()) && <FieldValidationIndicator result={newValueValidation} />}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleAddField}
                    disabled={!newKey.trim() || newKey.trim() in mappings}
                    data-testid="button-add-mapping"
                  >
                    <IconCheck className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {!isDbBacked && <FieldValidationMessage result={newValueValidation} fieldKey="__new" source={newValue.trim() || newKey.trim()} />}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Indexes</Label>
              <p className="text-[11px] text-muted-foreground">
                Indexed fields generate filter dropdowns and summary cards on the management page.
              </p>
              <div className="flex items-center gap-2 flex-wrap" data-testid="section-index-toggles">
                {regularKeys.map((field) => {
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
                      data-testid={`badge-index-toggle-${field}`}
                    >
                      {isIndexed && <IconCheck className="h-3 w-3 mr-1" />}
                      {field}
                    </Badge>
                  );
                })}
                {regularKeys.length === 0 && (
                  <p className="text-xs text-muted-foreground">Add field mappings first to enable indexing.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-mappings">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || isLoading}
            data-testid="button-save-mappings"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
    if (!config?.field_mapping) {
      keys.push("slug");
      return keys;
    }
    const fromMapping = Object.entries(config.field_mapping)
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
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"static" | "db">("static");
  const [deletingEntry, setDeletingEntry] = useState<StaticEntry | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);

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
  const localeKey = useMemo(() => {
    const raw = typeConfig?.field_mapping?._locale;
    if (!raw) return null;
    const val = typeof raw === "object" ? raw.source : raw;
    if (typeof val === "string" && val.startsWith("function:")) {
      const fm = typeConfig?.field_mapping || {};
      const localeLike = ["lang", "locale", "language"];
      for (const f of localeLike) {
        if (f in fm && !f.startsWith("_")) return f;
      }
      return null;
    }
    return val;
  }, [typeConfig?.field_mapping]);

  const items = allItemsData?.results || [];

  const LOCALE_LABELS: Record<string, string> = { en: "English", es: "Spanish", pt: "Portuguese", fr: "French", de: "German", it: "Italian" };

  const allIndexFields = useMemo(() => {
    const explicit = typeConfig?.indexes || [];
    const result = [...explicit];
    if (localeKey && !result.includes(localeKey)) {
      result.push(localeKey);
    }
    return result;
  }, [typeConfig?.indexes, localeKey]);

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

  const handleDeleteEntry = async (localesToDelete: string[]) => {
    if (!deletingEntry || deleteConfirmInput !== deletingEntry.slug) return;
    setIsDeletingEntry(true);
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Token ${token}`;
      const response = await fetch("/api/content/delete", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: contentType,
          slug: deletingEntry.slug,
          confirmSlug: deleteConfirmInput,
          ...(localesToDelete.length > 0 ? { localesToDelete } : {}),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast({ title: "Entry deleted", description: data.message });
        setDeleteModalOpen(false);
        setDeletingEntry(null);
        setDeleteConfirmInput("");
        queryClient.invalidateQueries({ queryKey: ["/api/content-types", contentType, "static-entries"] });
      } else {
        toast({ title: "Error", description: data.error || "Failed to delete", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Connection error", variant: "destructive" });
    } finally {
      setIsDeletingEntry(false);
    }
  };

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
              onClick={() => setMappingDialogOpen(true)}
              data-testid="button-field-mappings"
            >
              <IconTransform className="h-4 w-4 mr-1" />
              Mappings
            </Button>
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
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setDeletingEntry(entry);
                                        setDeleteConfirmInput("");
                                        setDeleteModalOpen(true);
                                      }}
                                      className="text-destructive focus:text-destructive"
                                      data-testid={`button-delete-${entry.slug}`}
                                    >
                                      <IconTrash className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
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
      <FieldMappingDialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen} contentType={contentType} />
      <SeoSettingsDialog open={seoDialogOpen} onOpenChange={setSeoDialogOpen} contentType={contentType} />
      <DeletePageModal
        open={deleteModalOpen}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) {
            setDeletingEntry(null);
            setDeleteConfirmInput("");
          }
        }}
        deletingPage={deletingEntry ? { slug: deletingEntry.slug, contentType } : null}
        deleteConfirmInput={deleteConfirmInput}
        setDeleteConfirmInput={setDeleteConfirmInput}
        isDeletingPage={isDeletingEntry}
        onConfirm={handleDeleteEntry}
        availableLocales={deletingEntry?.locales}
      />
    </div>
  );
}
