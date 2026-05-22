import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { AlertTriangle, ArrowRight, Award, BarChart2, Blocks, Book, Brain, Building2, Check, ClipboardList, Columns, Columns2, CreditCard, FolderCode, HelpCircle, Image, List, ListFilter, MessageSquare, MousePointerClick, PanelBottom, RefreshCw, Rocket, ScatterChart, Search, Sparkles, Star, Table, Trophy, Users, Wand2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import jsYaml from "js-yaml";
import { escapeTemplateVars, unescapeObjectVars } from "@shared/templateVars";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDebugToken, resolveAuthorName } from "@/hooks/useDebugAuth";
import { useToast } from "@/hooks/use-toast";
import { useContentTypes, useContentTypesRaw, getFolderFromType } from "@/hooks/useContentTypes";
import { emitContentUpdated } from "@/lib/contentEvents";
import { DbTemplateWarningDialog } from "@/components/editing/DbTemplateWarningDialog";
import { RelatedFeaturesPicker } from "./RelatedFeaturesPicker";
import { TableBuilderWizard, type DynamicTableConfig } from "@/components/TableBuilderWizard";

interface ComponentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  insertIndex: number;
  contentType?: string;
  slug?: string;
  locale?: string;
  variant?: string;
  version?: number;
  isSharedTemplate?: boolean;
  singleEntry?: Record<string, unknown>;
}

interface ComponentInfo {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface ApiExample {
  name: string;
  description: string;
  yaml: string;
  variant?: string;
}

interface ProcessedExample {
  name: string;
  slug: string;
  variant: string;
  content: Record<string, unknown>;
}

interface RegistryComponent {
  type: string;
  name: string;
  description: string;
  latestVersion: string;
  versions: string[];
}

interface RegistryOverview {
  components: RegistryComponent[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  hero: Rocket,
  two_column: Columns2,
  two_column_accordion_card: Columns,
  comparison_table: Table,
  features_grid: Columns2,
  numbered_steps: ArrowRight,
  ai_learning: Brain,
  mentorship: Users,
  pricing: CreditCard,
  projects: FolderCode,
  project_showcase: BarChart2,
  syllabus: Book,
  why_learn_ai: Sparkles,
  certificate: Award,
  whos_hiring: Building2,
  testimonials: MessageSquare,
  testimonials_slide: MessageSquare,
  faq: HelpCircle,
  cta_banner: MousePointerClick,
  footer: PanelBottom,
  award_badges: Award,
  awards_marquee: Trophy,
  bullet_tabs_showcase: ListFilter,
  apply_form: ClipboardList,
  lead_form: ClipboardList,
  graduates_stats: ScatterChart,
  horizontal_bars: BarChart2,
  vertical_bars_cards: BarChart2,
  human_and_ai_duo: Users,
  community_support: Users,
  article: Book,
  dynamic_table: Table,
  modal: MousePointerClick,
  cards_deck: Columns2,
  trust_cards: Star,
};

const variantLabels: Record<string, string> = {
  singleColumn: "Single Column",
  showcase: "Showcase",
  productShowcase: "Product Showcase",
  simpleTwoColumn: "Two Column",
  imageText: "Image + Text",
  bulletGroups: "Bullet Groups",
  video: "Video",
  highlight: "Highlight",
  detailed: "Detailed",
  default: "Default",
  subscription: "Subscription",
  product: "Product",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseYamlContent(yamlStr: string): Record<string, unknown> | null {
  try {
    const { escaped, map } = escapeTemplateVars(yamlStr);
    const parsed = unescapeObjectVars(jsYaml.load(escaped), map);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const section = parsed[0];
      const { type, ...rest } = section as Record<string, unknown>;
      return rest;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const { type, ...rest } = parsed as Record<string, unknown>;
      return rest;
    }
    return null;
  } catch {
    return null;
  }
}

export default function ComponentPickerModal({
  isOpen,
  onClose,
  insertIndex,
  contentType,
  slug,
  locale,
  variant,
  version,
  isSharedTemplate,
  singleEntry,
}: ComponentPickerModalProps) {
  const [step, setStep] = useState<"select" | "configure" | "wizard" | "scope">("select");
  const [selectedComponent, setSelectedComponent] = useState<ComponentInfo | null>(null);
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [examples, setExamples] = useState<ProcessedExample[]>([]);
  const [selectedExample, setSelectedExample] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [useAiAdaptation, setUseAiAdaptation] = useState(false);
  const [isAdapting, setIsAdapting] = useState(false);
  const [selectedRelatedFeatures, setSelectedRelatedFeatures] = useState<string[]>([]);
  const [componentSearch, setComponentSearch] = useState("");
  const [addWarnOpen, setAddWarnOpen] = useState(false);
  /** "All entries" path for the scope step (shared-template add or wizard shared add). */
  const pendingAddFn = useRef<(() => Promise<void>) | null>(null);
  /** "This entry only" path for the scope step — separate from pendingAddFn because
   *  wizard and example-based flows use different per-entry functions. */
  const pendingPerEntryFn = useRef<(() => Promise<void>) | null>(null);
  /** Which step to return to if the user cancels from the scope step. */
  const scopeOrigin = useRef<"configure" | "wizard">("configure");
  const { toast } = useToast();
  const contentTypesMap = useContentTypes();
  const { data: rawContentTypes } = useContentTypesRaw();
  const singularLabel = (() => {
    if (!contentType) return "entry";
    const found = rawContentTypes?.find((t) => t.name === contentType);
    const label = found?.label ?? contentType.replace(/_/g, " ");
    const lower = label.toLowerCase();
    if (lower.endsWith("ies")) return lower.slice(0, -3) + "y";
    if (lower.endsWith("ses") || lower.endsWith("xes") || lower.endsWith("zes")) return lower.slice(0, -2);
    if (lower.endsWith("s") && lower.length > 2) return lower.slice(0, -1);
    return lower;
  })();

  const { data: registryData, isLoading: isLoadingRegistry } = useQuery<RegistryOverview>({
    queryKey: ["/api/component-registry"],
    enabled: isOpen,
  });

  const componentsList: ComponentInfo[] = useMemo(() => {
    if (!registryData?.components) return [];
    
    const RESERVED_COMPONENT_NAMES = ["common", "_common", "shared", "_shared", "utils", "_utils"];
    
    return registryData.components
      .filter((comp) => !RESERVED_COMPONENT_NAMES.includes(comp.type.toLowerCase()))
      .map((comp) => ({
        type: comp.type,
        label: comp.name,
        icon: iconMap[comp.type] || Blocks,
        description: comp.description || "",
      }));
  }, [registryData]);

  const filteredComponentsList = useMemo(() => {
    if (!componentSearch.trim()) return componentsList;
    const searchLower = componentSearch.toLowerCase();
    return componentsList.filter(
      (comp) =>
        comp.label.toLowerCase().includes(searchLower) ||
        comp.type.toLowerCase().includes(searchLower) ||
        comp.description.toLowerCase().includes(searchLower)
    );
  }, [componentsList, componentSearch]);

  useEffect(() => {
    if (selectedComponent) {
      setIsLoading(true);
      fetch(`/api/component-registry/${selectedComponent.type}/versions`)
        .then(res => res.json())
        .then(data => {
          const vers = data.versions || [];
          setVersions(vers);
          if (vers.length > 0) {
            setSelectedVersion(vers[vers.length - 1]);
          }
        })
        .catch(() => setVersions([]))
        .finally(() => setIsLoading(false));
    }
  }, [selectedComponent]);

  useEffect(() => {
    if (selectedComponent && selectedVersion) {
      setIsLoading(true);
      fetch(`/api/component-registry/${selectedComponent.type}/${selectedVersion}/examples`)
        .then(res => res.json())
        .then(data => {
          const apiExamples: ApiExample[] = data.examples || [];
          const processed: ProcessedExample[] = apiExamples.map((ex, idx) => {
            const content = parseYamlContent(ex.yaml);
            return {
              name: ex.name,
              slug: slugify(ex.name) || `example-${idx}`,
              variant: ex.variant || 'default',
              content: content || {},
            };
          }).filter(ex => Object.keys(ex.content).length > 0);
          
          setExamples(processed);
          if (processed.length > 0) {
            setSelectedExample(processed[0].slug);
          }
        })
        .catch(() => setExamples([]))
        .finally(() => setIsLoading(false));
    }
  }, [selectedComponent, selectedVersion]);

  const selectedExampleData = useMemo(() => {
    return examples.find(e => e.slug === selectedExample) || null;
  }, [examples, selectedExample]);

  useEffect(() => {
    if (!isOpen) {
      setComponentSearch("");
      setStep("select");
      setSelectedComponent(null);
    }
  }, [isOpen]);

  const handleSelectComponent = useCallback((component: ComponentInfo) => {
    setSelectedComponent(component);
    if (component.type === "dynamic_table") {
      setStep("wizard");
    } else {
      setStep("configure");
    }
    setVersions([]);
    setExamples([]);
    setSelectedVersion("");
    setSelectedExample("");
    setSelectedRelatedFeatures([]);
  }, []);

  const handleBack = useCallback(() => {
    setStep("select");
    setSelectedComponent(null);
    setVersions([]);
    setExamples([]);
    setSelectedVersion("");
    setSelectedExample("");
    setSelectedRelatedFeatures([]);
    setComponentSearch("");
  }, []);

  const executeWizardComplete = useCallback(async (config: DynamicTableConfig) => {
    if (!contentType || !slug || !locale) return;

    setIsAdding(true);
    try {
      const sectionToAdd = {
        type: "dynamic_table",
        version: "1.0",
        endpoint: config.endpoint,
        ...(config.data_path ? { data_path: config.data_path } : {}),
        ...(config.title ? { title: config.title } : {}),
        columns: config.columns,
        ...(config.action ? { action: config.action } : {}),
      };

      const token = getDebugToken();
      const author = await resolveAuthorName();
      const response = await fetch("/api/content/edit-sections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Token ${token}` } : {}),
        },
        body: JSON.stringify({
          contentType,
          slug,
          locale,
          variant,
          version,
          author,
          operations: [{
            action: "add_item",
            path: "sections",
            item: sectionToAdd,
            index: insertIndex,
          }],
        }),
      });

      if (response.ok) {
        onClose();
        emitContentUpdated({ contentType: contentType!, slug: slug!, locale: locale! });
        toast({
          title: "Dynamic table added",
          description: config.title || "Table section inserted successfully",
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to add dynamic table:", errorData);
        toast({
          title: "Failed to add table",
          description: errorData.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding dynamic table:", error);
      toast({
        title: "Error",
        description: "Failed to add the table section",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  }, [contentType, slug, locale, variant, version, insertIndex, onClose, toast]);

  /** Per-entry variant of wizard add — sends the wizard section to /api/per-entry-section-add */
  const executePerEntryWizardComplete = useCallback(async (config: DynamicTableConfig) => {
    if (!contentType || !slug || !locale) return;
    setIsAdding(true);
    try {
      const sectionData = {
        type: "dynamic_table",
        version: "1.0",
        endpoint: config.endpoint,
        ...(config.data_path ? { data_path: config.data_path } : {}),
        ...(config.title ? { title: config.title } : {}),
        columns: config.columns,
        ...(config.action ? { action: config.action } : {}),
      };
      const token = getDebugToken();
      const resp = await fetch("/api/per-entry-section-add", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Token ${token}` } : {}) },
        body: JSON.stringify({ contentType, slug, locale, sectionData, insertIndex }),
      });
      if (resp.ok) {
        onClose();
        emitContentUpdated({ contentType, slug, locale });
        toast({ title: "Table added", description: "Dynamic table added to this entry only." });
      } else {
        const err = await resp.json().catch(() => ({}));
        toast({ title: "Failed to add table", description: err.error || "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error adding table", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  }, [contentType, slug, locale, insertIndex, onClose, toast]);

  const handleWizardComplete = useCallback(async (config: DynamicTableConfig) => {
    if (isSharedTemplate && singleEntry) {
      pendingAddFn.current = () => executeWizardComplete(config);
      pendingPerEntryFn.current = () => executePerEntryWizardComplete(config);
      scopeOrigin.current = "wizard";
      setStep("scope");
      return;
    }
    if (isSharedTemplate) {
      pendingAddFn.current = () => executeWizardComplete(config);
      pendingPerEntryFn.current = null;
      setAddWarnOpen(true);
      return;
    }
    await executeWizardComplete(config);
  }, [isSharedTemplate, singleEntry, executeWizardComplete, executePerEntryWizardComplete]);

  const executeAddSection = useCallback(async () => {
    if (!selectedExampleData || !selectedComponent || !contentType || !slug || !locale) {
      return;
    }

    setIsAdding(true);
    
    try {
      let finalContent = selectedExampleData.content;
      
      // If AI adaptation is enabled, call the AI adaptation API
      if (useAiAdaptation) {
        setIsAdapting(true);
        try {
          // Convert content type to API format
          const apiContentType = contentTypesMap ? getFolderFromType(contentTypesMap, contentType || "") : contentType || "";
          
          // Convert example content to YAML for AI adaptation
          const sourceYaml = jsYaml.dump(selectedExampleData.content);
          
          const token = getDebugToken();
          const adaptResponse = await fetch("/api/content/adapt-with-ai", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { "Authorization": `Token ${token}` } : {}),
            },
            body: JSON.stringify({
              contentType: apiContentType,
              contentSlug: slug,
              targetComponent: selectedComponent.type,
              targetVersion: selectedVersion,
              sourceYaml,
            }),
          });
          
          if (adaptResponse.ok) {
            const adaptResult = await adaptResponse.json();
            // Parse the adapted YAML back to an object
            const { escaped: escapedAdapt, map: adaptMap } = escapeTemplateVars(adaptResult.adaptedYaml);
            const adaptedContent = unescapeObjectVars(jsYaml.load(escapedAdapt), adaptMap) as Record<string, unknown>;
            finalContent = adaptedContent;
            toast({
              title: "Content adapted with AI",
              description: `Used ${adaptResult.context.brand} brand context`,
            });
          } else {
            const errorData = await adaptResponse.json().catch(() => ({}));
            toast({
              title: "AI adaptation failed",
              description: errorData.error || "Using original example content",
              variant: "destructive",
            });
          }
        } catch (adaptError) {
          console.error("AI adaptation error:", adaptError);
          toast({
            title: "AI adaptation error",
            description: "Using original example content",
            variant: "destructive",
          });
        } finally {
          setIsAdapting(false);
        }
      }
      
      // For FAQ sections with related_features, use centralized mode (remove inline items)
      let sectionContent = { ...finalContent };
      if (selectedComponent.type === "faq" && selectedRelatedFeatures.length > 0) {
        sectionContent = {
          title: (finalContent.title as string) || "Frequently Asked Questions",
          related_features: selectedRelatedFeatures,
        };
      }

      const sectionToAdd = {
        type: selectedComponent.type,
        version: selectedVersion,
        ...sectionContent,
      };

      const token = getDebugToken();
      const author = await resolveAuthorName();
      const response = await fetch("/api/content/edit-sections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Token ${token}` } : {}),
        },
        body: JSON.stringify({
          contentType,
          slug,
          locale,
          variant,
          version,
          author,
          operations: [{
            action: "add_item",
            path: "sections",
            item: sectionToAdd,
            index: insertIndex,
          }],
        }),
      });

      if (response.ok) {
        onClose();
        emitContentUpdated({ contentType: contentType!, slug: slug!, locale: locale! });
        toast({
          title: "Section added",
          description: `${selectedComponent?.label || "Section"} added to the page.`,
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to add section:", errorData);
        toast({
          title: "Failed to add section",
          description: errorData.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding section:", error);
    } finally {
      setIsAdding(false);
    }
  }, [selectedExampleData, selectedComponent, selectedVersion, contentType, slug, locale, variant, version, insertIndex, onClose, useAiAdaptation, selectedRelatedFeatures, toast]);

  const executePerEntryAddSection = useCallback(async () => {
    if (!selectedExampleData || !selectedComponent || !contentType || !slug || !locale) return;
    setIsAdding(true);
    try {
      let finalContent = selectedExampleData.content;
      if (selectedComponent.type === "faq" && selectedRelatedFeatures.length > 0) {
        finalContent = {
          title: (finalContent.title as string) || "Frequently Asked Questions",
          related_features: selectedRelatedFeatures,
        };
      }
      const sectionData = { type: selectedComponent.type, version: selectedVersion, ...finalContent };
      const token = getDebugToken();
      const resp = await fetch("/api/per-entry-section-add", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Token ${token}` } : {}) },
        body: JSON.stringify({ contentType, slug, locale, sectionData, insertIndex }),
      });
      if (resp.ok) {
        onClose();
        emitContentUpdated({ contentType, slug, locale });
        toast({ title: "Section added", description: `${selectedComponent.label} added to this entry only.` });
      } else {
        const err = await resp.json().catch(() => ({}));
        toast({ title: "Failed to add section", description: err.error || "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error adding section", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  }, [selectedExampleData, selectedComponent, selectedVersion, contentType, slug, locale, selectedRelatedFeatures, onClose, toast]);

  const handleAddSection = useCallback(async () => {
    if (isSharedTemplate && singleEntry) {
      pendingAddFn.current = executeAddSection;
      pendingPerEntryFn.current = executePerEntryAddSection;
      scopeOrigin.current = "configure";
      setStep("scope");
      return;
    }
    if (isSharedTemplate) {
      pendingAddFn.current = executeAddSection;
      pendingPerEntryFn.current = null;
      setAddWarnOpen(true);
      return;
    }
    await executeAddSection();
  }, [isSharedTemplate, singleEntry, executeAddSection, executePerEntryAddSection]);

  const previewUrl = useMemo(() => {
    if (!selectedComponent || !selectedVersion || !selectedExample) {
      return null;
    }
    const exampleData = examples.find(e => e.slug === selectedExample);
    if (!exampleData) return null;
    return `/private/component-showcase/${selectedComponent.type}/preview?version=${selectedVersion}&example=${encodeURIComponent(exampleData.name)}&debug=false`;
  }, [selectedComponent, selectedVersion, selectedExample, examples]);

  const groupedExamples = useMemo(() => {
    const grouped = examples.reduce((acc, ex) => {
      const variant = ex.variant;
      if (!acc[variant]) acc[variant] = [];
      acc[variant].push(ex);
      return acc;
    }, {} as Record<string, ProcessedExample[]>);
    
    const variantOrder = ['singleColumn', 'showcase', 'productShowcase', 'simpleTwoColumn', 'default'];
    const sortedVariants = Object.keys(grouped).sort((a, b) => {
      const aIdx = variantOrder.indexOf(a);
      const bIdx = variantOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    
    return { grouped, sortedVariants };
  }, [examples]);

  const exampleSelectItems = useMemo(() => {
    const { grouped, sortedVariants } = groupedExamples;
    
    if (sortedVariants.length === 0) {
      return (
        <SelectItem value="no examples available" disabled>
          No examples available
        </SelectItem>
      );
    }
    
    if (sortedVariants.length === 1 && sortedVariants[0] === 'default') {
      return grouped['default'].map(ex => (
        <SelectItem key={ex.slug} value={ex.slug}>{ex.name}</SelectItem>
      ));
    }
    
    return sortedVariants.map(variant => (
      <SelectGroup key={variant}>
        <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wide">
          {variantLabels[variant] || variant}
        </SelectLabel>
        {grouped[variant].map(ex => (
          <SelectItem key={ex.slug} value={ex.slug}>{ex.name}</SelectItem>
        ))}
      </SelectGroup>
    ));
  }, [groupedExamples]);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <DialogTitle>
            {step === "select" ? "Choose a Component" : step === "wizard" ? "Dynamic Table Builder" : step === "scope" ? "Where should this section appear?" : `Configure ${selectedComponent?.label}`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {step === "select" ? "Select a component type to add to the page" : step === "wizard" ? "Build a dynamic table step by step" : "Configure the component version and example"}
          </DialogDescription>
        </DialogHeader>
        
        {isSharedTemplate && (
          <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-md border bg-muted p-3" data-testid="text-shared-template-notice">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground leading-snug">
              <strong>Shared template:</strong> the section you add will appear on{" "}
              <strong>every {contentType} page</strong>, not just this one.
            </p>
          </div>
        )}

        {step === "select" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-2 pb-3 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search components..."
                  value={componentSearch}
                  onChange={(e) => setComponentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  data-testid="input-search-components"
                />
              </div>
            </div>
            <ScrollArea className="flex-1 px-4 pb-4">
              {isLoadingRegistry ? (
                <div className="flex items-center justify-center h-full py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredComponentsList.length === 0 ? (
                <div className="flex items-center justify-center h-full py-12 text-muted-foreground">
                  {componentSearch ? "No components match your search" : "No components available"}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredComponentsList.map((component) => {
                    const Icon = component.icon;
                    return (
                      <button
                        key={component.type}
                        onClick={() => handleSelectComponent(component)}
                        className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left"
                        data-testid={`component-option-${component.type}`}
                      >
                        <div className="p-3 rounded-full bg-muted">
                          <Icon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-sm">{component.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{component.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : step === "wizard" ? (
          <div className="flex-1 flex flex-col overflow-auto p-4">
            <TableBuilderWizard
              onComplete={handleWizardComplete}
              onCancel={handleBack}
              locale={locale || "en"}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b flex items-center gap-4 flex-shrink-0 flex-wrap">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                Back
              </Button>
              
              <div className="flex items-center gap-4 flex-1 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Version:</span>
                  <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                    <SelectTrigger className="w-24" data-testid="select-version">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Example:</span>
                  <Select value={selectedExample} onValueChange={setSelectedExample}>
                    <SelectTrigger className="w-64" data-testid="select-example">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {exampleSelectItems}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* FAQ-specific: Related features picker */}
              {selectedComponent?.type === "faq" && (
                <div className="w-full border-t pt-3 mt-1">
                  <RelatedFeaturesPicker
                    value={selectedRelatedFeatures}
                    onChange={setSelectedRelatedFeatures}
                    locale={locale || "en"}
                  />
                </div>
              )}
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Switch 
                      id="ai-adaptation"
                      checked={useAiAdaptation}
                      onCheckedChange={setUseAiAdaptation}
                      data-testid="switch-ai-adaptation"
                    />
                    <Label 
                      htmlFor="ai-adaptation" 
                      className="flex items-center gap-1 text-sm cursor-pointer"
                    >
                      <Wand2 className="h-4 w-4" />
                      AI Adapt
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>Use AI to adapt the example content to match this page's context, brand voice, and target audience.</p>
                </TooltipContent>
              </Tooltip>
              
              <Button 
                onClick={handleAddSection}
                disabled={!selectedExampleData || isAdding || isAdapting}
                data-testid="button-add-component"
              >
                {isAdapting ? (
                  <>
                    <Wand2 className="h-4 w-4 mr-2 animate-pulse" />
                    Adapting...
                  </>
                ) : isAdding ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Add Section
                  </>
                )}
              </Button>
            </div>
            
            <div className="flex-1 overflow-hidden bg-muted/30">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Component Preview"
                  data-testid="component-preview-iframe"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a version and example to preview
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <DbTemplateWarningDialog
      open={addWarnOpen}
      onClose={() => { setAddWarnOpen(false); pendingAddFn.current = null; }}
      onConfirm={async () => {
        if (pendingAddFn.current) {
          await pendingAddFn.current();
          pendingAddFn.current = null;
        }
        setAddWarnOpen(false);
      }}
      operation="add"
      contentType={contentType || "page"}
      isLoading={isAdding}
    />
    {/* Scope choice dialog — only when adding to a DB entry page */}
    <Dialog open={addScopeOpen} onOpenChange={(open) => { if (!open && !isAdding) { setAddScopeOpen(false); pendingAddFn.current = null; pendingPerEntryFn.current = null; } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Where should this section appear?</DialogTitle>
          <DialogDescription>
            Choose whether to add this section to this {singularLabel} only, or to the shared template for all {singularLabel}s.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="outline"
            disabled={isAdding}
            className="w-full justify-start gap-2"
            data-testid="button-scope-this-entry"
            onClick={async () => {
              if (pendingPerEntryFn.current) {
                await pendingPerEntryFn.current();
              }
              setAddScopeOpen(false);
              pendingAddFn.current = null;
              pendingPerEntryFn.current = null;
            }}
          >
            <X className="h-4 w-4 shrink-0" />
            This {singularLabel} only
          </Button>
          <Button
            variant="outline"
            disabled={isAdding}
            className="w-full justify-start gap-2"
            data-testid="button-scope-all-entries"
            onClick={async () => {
              if (pendingAddFn.current) {
                await pendingAddFn.current();
                pendingAddFn.current = null;
              }
              setAddScopeOpen(false);
              pendingPerEntryFn.current = null;
            }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            All {singularLabel}s (shared template)
          </Button>
          <Button
            variant="ghost"
            disabled={isAdding}
            className="w-full"
            onClick={() => { setAddScopeOpen(false); pendingAddFn.current = null; pendingPerEntryFn.current = null; }}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
