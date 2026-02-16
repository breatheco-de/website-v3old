import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IconX,
  IconDeviceFloppy,
  IconLoader2,
  IconCode,
  IconSettings,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDevices,
  IconCheck,
  IconAlertTriangle,
  IconPlus,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconPhoto,
  IconChevronDown,
  IconTrash,
  IconPencil,
  IconMapPin,
} from "@tabler/icons-react";
import { IconQuestionMark } from "@tabler/icons-react";
import { getIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ColorPicker } from "@/components/ui/color-picker";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { editContent } from "@/lib/contentApi";
import { emitContentUpdated } from "@/lib/contentEvents";
import {
  parseEditorType,
  type ColorPickerVariant,
  type EditorType,
} from "@/lib/field-editor-registry";
import { IconPickerModal } from "./IconPickerModal";
import { RelatedFeaturesPicker } from "./RelatedFeaturesPicker";
import { TestimonialItemsPreview } from "./TestimonialItemsPreview";
import { DynamicTableChat } from "./DynamicTableChat";
import { RichTextArea } from "./RichTextArea";
import { MarkdownEditorField } from "./MarkdownEditorField";
import { LinkPicker } from "./LinkPicker";
import type { Section, SectionLayout, ImageRegistry } from "@shared/schema";
import { locations as allLocations, getLocationBySlug } from "@/lib/locations";
import type { Location } from "@shared/session";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconSearch, IconUpload, IconCloudUpload } from "@tabler/icons-react";
import CodeMirror from "@uiw/react-codemirror";
import type { EditorView } from "@codemirror/view";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";
import { variableHighlightPlugin } from "@/lib/cm-variable-highlight";
import * as yamlParser from "js-yaml";
import { escapeTemplateVars, unescapeObjectVars, unescapeYamlDump } from "@shared/templateVars";
import { useUndoRedo } from "@/hooks/useUndoRedo";

function safeYamlLoad(yamlStr: string): unknown {
  const { escaped, map } = escapeTemplateVars(yamlStr);
  const parsed = yamlParser.load(escaped);
  return unescapeObjectVars(parsed, map);
}

function safeYamlDump(obj: unknown, opts?: yamlParser.DumpOptions): string {
  const serialized = JSON.stringify(obj);
  const { escaped: escapedJson, map } = escapeTemplateVars(serialized);
  const escapedObj = JSON.parse(escapedJson);
  const dumped = yamlParser.dump(escapedObj, opts);
  return unescapeYamlDump(dumped, map);
}
import { usePageHistoryOptional } from "@/contexts/PageHistoryContext";

interface SectionEditorPanelProps {
  section: Section;
  sectionIndex: number;
  contentType?: "program" | "landing" | "location" | "page";
  slug?: string;
  locale?: string;
  variant?: string;
  version?: number;
  onUpdate: (updatedSection: Section) => void;
  onClose: () => void;
  onPreviewChange?: (previewSection: Section | null) => void;
  allSections?: Section[];
}

interface ShowOnPickerProps {
  value: string;
  onChange: (value: string) => void;
}

function ShowOnPicker({ value, onChange }: ShowOnPickerProps) {
  const options = [
    { id: "all", label: "Both", icon: IconDevices },
    { id: "desktop", label: "Desktop", icon: IconDeviceDesktop },
    { id: "mobile", label: "Mobile", icon: IconDeviceMobile },
  ];

  const currentValue = value || "all";

  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm font-medium whitespace-nowrap">Show on</Label>
      <div className="flex rounded-md border border-border overflow-hidden">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = currentValue === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id === "all" ? "" : option.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              } ${option.id !== "all" ? "border-l border-border" : ""}`}
              data-testid={`props-showon-${option.id}`}
            >
              <Icon className="h-4 w-4" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function countryCodeToFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
}

interface ShowOnLocationsPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
}

function ShowOnLocationsPicker({ value, onChange }: ShowOnLocationsPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  const hasLocations = value.length > 0;

  const grouped = useMemo(() => {
    const groups: Record<string, Location[]> = {};
    const searchLower = search.toLowerCase();
    for (const loc of allLocations) {
      if (loc.visibility !== 'listed') continue;
      if (searchLower && !loc.name.toLowerCase().includes(searchLower) && !loc.country.toLowerCase().includes(searchLower) && !loc.slug.toLowerCase().includes(searchLower)) continue;
      const region = loc.region;
      if (!groups[region]) groups[region] = [];
      groups[region].push(loc);
    }
    return groups;
  }, [search]);

  const regionLabels: Record<string, string> = {
    'usa-canada': 'USA & Canada',
    'latam': 'Latin America',
    'europe': 'Europe',
    'online': 'Online',
  };

  const toggleLocation = (slug: string) => {
    if (value.includes(slug)) {
      onChange(value.filter(s => s !== slug));
    } else {
      onChange([...value, slug]);
    }
  };

  const removeLocation = (slug: string) => {
    onChange(value.filter(s => s !== slug));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium whitespace-nowrap flex items-center gap-1.5">
          <IconMapPin className="h-3.5 w-3.5" />
          Show on locations
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              data-testid="button-edit-locations"
            >
              {hasLocations ? (
                <IconPencil className="h-3.5 w-3.5" />
              ) : (
                <>
                  <IconPlus className="h-3.5 w-3.5 mr-1" />
                  <span>Add filter</span>
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0 z-[10000]" align="end">
            <div className="p-2 border-b">
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search locations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  data-testid="input-location-filter-search"
                  autoFocus
                />
              </div>
            </div>
            <ScrollArea className="h-[240px]">
              <div className="p-1">
                {Object.entries(grouped).map(([region, locs]) => (
                  <div key={region} className="mb-1">
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                      {regionLabels[region] || region}
                    </div>
                    {locs.map((loc) => {
                      const isSelected = value.includes(loc.slug);
                      return (
                        <button
                          key={loc.slug}
                          type="button"
                          onClick={() => toggleLocation(loc.slug)}
                          className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors ${
                            isSelected ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted'
                          }`}
                          data-testid={`button-location-toggle-${loc.slug}`}
                        >
                          <span className="text-base leading-none">{countryCodeToFlag(loc.country_code)}</span>
                          <span className="flex-1 text-left truncate">{loc.name}, {loc.country}</span>
                          {isSelected && <IconCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {Object.keys(grouped).length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">No locations found</div>
                )}
              </div>
            </ScrollArea>
            {hasLocations && (
              <div className="p-2 border-t">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-destructive"
                  onClick={() => { onChange([]); setOpen(false); }}
                  data-testid="button-clear-location-filters"
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
      {hasLocations && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((slug) => {
            const loc = getLocationBySlug(slug);
            if (!loc) return null;
            return (
              <Badge key={slug} variant="secondary" className="gap-1 pr-1">
                <span className="text-xs leading-none">{countryCodeToFlag(loc.country_code)}</span>
                <span>{loc.name}</span>
                <button
                  type="button"
                  onClick={() => removeLocation(slug)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                  data-testid={`button-remove-location-${slug}`}
                >
                  <IconX className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface VariantPickerProps {
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
  label?: string;
}

function VariantPicker({ value, onChange, options, label = "Variant" }: VariantPickerProps) {
  const currentValue = value || options[0]?.id || "";

  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm font-medium whitespace-nowrap">{label}</Label>
      <div className="flex rounded-md border border-border overflow-hidden">
        {options.map((option, index) => {
          const isSelected = currentValue === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              } ${index !== 0 ? "border-l border-border" : ""}`}
              data-testid={`props-variant-${option.id}`}
            >
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SectionEditorPanel({
  section,
  sectionIndex,
  contentType,
  slug,
  locale,
  variant,
  version,
  onUpdate,
  onClose,
  onPreviewChange,
  allSections,
}: SectionEditorPanelProps) {
  const { toast } = useToast();
  const [yamlContent, setYamlContent] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("code");

  // Icon picker state
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<{
    arrayField: string;
    index: number;
    field: string;
    label: string;
    currentIcon: string;
  } | null>(null);
  const [nestedUpdateFn, setNestedUpdateFn] = useState<((value: string) => void) | null>(null);

  // Image picker modal state
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<{
    // For array fields
    arrayPath?: string;
    index?: number;
    srcField?: string;
    // For simple fields
    fieldPath?: string;
    label?: string;
    // Common
    currentSrc: string;
    currentAlt: string;
    currentRegistryId?: string;
    // Optional tag filter (e.g., "logo" to show only logos)
    tagFilter?: string;
  } | null>(null);
  const [imageGallerySearch, setImageGallerySearch] = useState("");
  const [visibleImageCount, setVisibleImageCount] = useState(48);
  const [imagePickerMode, setImagePickerMode] = useState<"browse" | "upload">("browse");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  const handleUndoRedoRestore = useCallback((content: string) => {
    setYamlContent(content);
    setHasChanges(true);
    try {
      const parsed = safeYamlLoad(content) as Section;
      setParseError(null);
      if (parsed && typeof parsed === "object" && onPreviewChange) {
        onPreviewChange(parsed);
      }
    } catch (error) {
      if (error instanceof Error) {
        setParseError(error.message);
      }
    }
  }, [onPreviewChange]);

  const { pushState: pushUndoState, canUndo, canRedo, undo, redo, clear: clearUndoHistory } = useUndoRedo(
    yamlContent,
    handleUndoRedoRestore,
    { enableKeyboardShortcuts: true }
  );
  
  const pageHistory = usePageHistoryOptional();

  // Store initial state when section loads for undo capability
  const initialYamlRef = useRef<string | null>(null);
  
  // Clear undo history and store initial state when section changes
  useEffect(() => {
    clearUndoHistory();
    // Store the initial YAML so we can undo back to it
    try {
      const yamlStr = safeYamlDump(section, {
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
      });
      initialYamlRef.current = yamlStr;
    } catch {
      initialYamlRef.current = null;
    }
  }, [sectionIndex, section, clearUndoHistory]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const { sectionIndex: idx, originalText, templateSyntax, selectionFrom, selectionTo } = detail;
      if (idx !== sectionIndex) return;

      detail._handled = true;

      const view = editorViewRef.current;
      if (view) {
        const doc = view.state.doc.toString();
        let from: number;
        let to: number;

        if (selectionFrom !== undefined && selectionTo !== undefined
            && selectionFrom >= 0 && selectionTo <= doc.length
            && doc.slice(selectionFrom, selectionTo) === originalText) {
          from = selectionFrom;
          to = selectionTo;
        } else {
          const pos = doc.indexOf(originalText);
          if (pos === -1) {
            toast({ title: "Text not found", description: "The selected text was not found in the YAML content.", variant: "destructive" });
            return;
          }
          from = pos;
          to = pos + originalText.length;
        }

        view.dispatch({
          changes: { from, to, insert: templateSyntax },
        });
        toast({ title: "Variable inserted", description: "Text replaced with variable template." });
      } else {
        setYamlContent((prev) => {
          if (!prev.includes(originalText)) {
            toast({ title: "Text not found", description: "The selected text was not found in the YAML content.", variant: "destructive" });
            return prev;
          }
          const updated = prev.replace(originalText, templateSyntax);
          setHasChanges(true);
          setParseError(null);
          try {
            const parsed = safeYamlLoad(updated) as Record<string, unknown>;
            if (onPreviewChange) onPreviewChange(parsed as Section);
          } catch { /* ignore parse errors during preview */ }
          toast({ title: "Variable inserted", description: "Text replaced with variable template." });
          return updated;
        });
      }
    };

    window.addEventListener("variable-created-replace", handler);
    return () => window.removeEventListener("variable-created-replace", handler);
  }, [sectionIndex, toast, onPreviewChange]);

  // Fetch image registry for gallery picker
  const { data: imageRegistry, refetch: refetchRegistry } = useQuery<ImageRegistry>({
    queryKey: ["/api/image-registry"],
  });

  const { data: mediaStatus } = useQuery<{
    defaultProvider: string;
    providers: string[];
    gcs?: { bucket: string; basePath: string; projectId?: string };
  }>({
    queryKey: ["/api/media/status"],
  });

  const hasCloudProvider = (mediaStatus?.providers ?? []).some(p => p !== "local");

  const handleImageUpload = useCallback(async (files: FileList | File[]) => {
    if (!files.length || !imagePickerTarget) return;
    const file = files[0];
    const allowed = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".avif", ".gif"];
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!allowed.includes(ext)) {
      toast({ title: "Unsupported file type", description: `${ext} files are not supported`, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/image-registry/upload", { method: "POST", body: formData });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Upload failed");
      }
      const result = await resp.json() as { id: string; src: string; alt: string; duplicate?: boolean; existingId?: string };
      await refetchRegistry();
      const fieldName = imagePickerTarget.srcField || imagePickerTarget.fieldPath || "";
      const isIdField = fieldName.endsWith("_id");
      setImagePickerTarget({
        ...imagePickerTarget,
        currentSrc: isIdField ? result.id : result.src,
        currentAlt: result.alt,
        currentRegistryId: result.id,
      });
      setImagePickerMode("browse");
      if (result.duplicate) {
        toast({ title: "Image already exists", description: `This image is already registered as "${result.existingId}". Using the existing one.` });
      } else {
        toast({ title: "Image uploaded", description: `Registered as "${result.id}"` });
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [imagePickerTarget, refetchRegistry, toast]);

  // Filter and sort gallery images by usage count (most used first)
  const filteredGalleryImages = useMemo(() => {
    if (!imageRegistry?.images) return [];
    const searchLower = imageGallerySearch.toLowerCase();
    const tagFilter = imagePickerTarget?.tagFilter?.toLowerCase();
    return Object.entries(imageRegistry.images)
      .filter(([id, img]) => {
        // Apply tag filter first (e.g., "logo" to show only logos)
        if (tagFilter && !img.tags?.some((tag) => tag.toLowerCase() === tagFilter)) {
          return false;
        }
        if (!searchLower) return true;
        return (
          id.toLowerCase().includes(searchLower) ||
          img.alt.toLowerCase().includes(searchLower) ||
          img.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
        );
      })
      .sort((a, b) => (b[1].usage_count ?? 0) - (a[1].usage_count ?? 0));
  }, [imageRegistry, imageGallerySearch, imagePickerTarget?.tagFilter]);

  // Reset visible count when search changes or modal opens
  useEffect(() => {
    setVisibleImageCount(48);
  }, [imageGallerySearch, imagePickerOpen]);

  // Parse current YAML to extract props
  const parsedSection = useMemo(() => {
    try {
      return safeYamlLoad(yamlContent) as Record<string, unknown> | null;
    } catch {
      return null;
    }
  }, [yamlContent]);

  const currentBackground = (parsedSection?.background as string) || "";
  const currentShowOn = (parsedSection?.showOn as string) || "";
  const currentShowOnLocations = (parsedSection?.showOnLocations as string[]) || [];

  // Initialize YAML content from section
  useEffect(() => {
    try {
      const yamlStr = safeYamlDump(section, {
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
      });
      setYamlContent(yamlStr);
      setHasChanges(false);
    } catch (error) {
      console.error("Error converting section to YAML:", error);
    }
  }, [section]);

  const handleYamlChange = useCallback(
    (value: string) => {
      // Save the initial state on first edit so user can undo back to it
      if (!hasChanges && initialYamlRef.current && yamlContent !== value) {
        pushUndoState(initialYamlRef.current);
      }
      
      setYamlContent(value);
      setHasChanges(true);

      // Validate YAML on change and trigger live preview
      try {
        const parsed = safeYamlLoad(value) as Section;
        setParseError(null);

        // Trigger live preview if valid section
        if (parsed && typeof parsed === "object" && onPreviewChange) {
          onPreviewChange(parsed);
        }
      } catch (error) {
        if (error instanceof Error) {
          setParseError(error.message);
        }
      }
    },
    [onPreviewChange, hasChanges, yamlContent, pushUndoState],
  );

  // Update a specific property in the YAML
  const updateProperty = useCallback(
    (key: string, value: string) => {
      try {
        const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return;

        pushUndoState(yamlContent);

        // Handle nested paths like "left.image" or "media.src"
        const pathParts = key.split(".");
        if (pathParts.length === 1) {
          // Simple key
          if (value) {
            parsed[key] = value;
          } else {
            delete parsed[key];
          }
        } else {
          // Nested path - traverse and set
          let current: Record<string, unknown> = parsed;
          for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!current[part] || typeof current[part] !== "object") {
              current[part] = {};
            }
            current = current[part] as Record<string, unknown>;
          }
          const finalKey = pathParts[pathParts.length - 1];
          if (value) {
            current[finalKey] = value;
          } else {
            delete current[finalKey];
          }
        }

        const newYaml = safeYamlDump(parsed, {
          lineWidth: -1,
          noRefs: true,
          quotingType: '"',
        });

        setYamlContent(newYaml);
        setHasChanges(true);
        setParseError(null);

        // Trigger live preview
        if (onPreviewChange) {
          onPreviewChange(parsed as Section);
        }
      } catch (error) {
        console.error("Error updating property:", error);
      }
    },
    [yamlContent, onPreviewChange, pushUndoState],
  );

  // Update a property with a raw value (e.g. boolean) so YAML dumps natively (layout_reversed: true)
  const updatePropertyWithValue = useCallback(
    (key: string, value: unknown) => {
      try {
        const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return;

        pushUndoState(yamlContent);

        const pathParts = key.split(".");
        if (pathParts.length === 1) {
          if (value !== undefined && value !== null && value !== "") {
            parsed[key] = value;
          } else {
            delete parsed[key];
          }
        } else {
          let current: Record<string, unknown> = parsed;
          for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!current[part] || typeof current[part] !== "object") {
              current[part] = {};
            }
            current = current[part] as Record<string, unknown>;
          }
          const finalKey = pathParts[pathParts.length - 1];
          if (value !== undefined && value !== null && value !== "") {
            current[finalKey] = value;
          } else {
            delete current[finalKey];
          }
        }

        const newYaml = safeYamlDump(parsed, {
          lineWidth: -1,
          noRefs: true,
          quotingType: '"',
        });

        setYamlContent(newYaml);
        setHasChanges(true);
        setParseError(null);

        if (onPreviewChange) {
          onPreviewChange(parsed as Section);
        }
      } catch (error) {
        console.error("Error updating property:", error);
      }
    },
    [yamlContent, onPreviewChange, pushUndoState],
  );

  // Update an array property in the YAML (e.g., related_features)
  // For related_features, insert after title to maintain YAML structure
  const updateArrayProperty = useCallback(
    (key: string, value: string[]) => {
      try {
        const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return;

        pushUndoState(yamlContent);

        // Build ordered result with related_features after title
        const buildOrderedResult = (
          obj: Record<string, unknown>,
          keyToInsert: string,
          valueToInsert: string[]
        ): Record<string, unknown> => {
          const result: Record<string, unknown> = {};
          let inserted = false;

          for (const [k, v] of Object.entries(obj)) {
            if (k === keyToInsert) continue; // Skip - we'll insert in correct position
            result[k] = v;
            // Insert after title
            if (k === "title" && !inserted) {
              result[keyToInsert] = valueToInsert;
              inserted = true;
            }
          }

          // Fallback: insert after type if no title found
          if (!inserted) {
            const fallback: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(result)) {
              fallback[k] = v;
              if (k === "type" && !inserted) {
                fallback[keyToInsert] = valueToInsert;
                inserted = true;
              }
            }
            return inserted ? fallback : { ...result, [keyToInsert]: valueToInsert };
          }

          return result;
        };

        let updated: Record<string, unknown>;

        if (value && value.length > 0) {
          if (key === "related_features") {
            updated = buildOrderedResult(parsed, key, value);
          } else {
            updated = { ...parsed, [key]: value };
          }
        } else {
          // Remove the key
          updated = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (k !== key) {
              updated[k] = v;
            }
          }
        }

        const newYaml = safeYamlDump(updated, {
          lineWidth: -1,
          noRefs: true,
          quotingType: '"',
        });

        setYamlContent(newYaml);
        setHasChanges(true);
        setParseError(null);

        // Trigger live preview with updated object
        if (onPreviewChange) {
          onPreviewChange(updated as Section);
        }
      } catch (error) {
        console.error("Error updating array property:", error);
      }
    },
    [yamlContent, onPreviewChange, pushUndoState],
  );

  // Update a specific field in an array item (supports nested paths like "signup_card.features")
  const updateArrayItemField = useCallback(
    (arrayPath: string, index: number, field: string, value: string | number) => {
      try {
        const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return;

        pushUndoState(yamlContent);

        // Support nested paths like "signup_card.features" by splitting on dots
        const pathParts = arrayPath.split(".");
        let current: Record<string, unknown> = parsed;
        
        // Traverse to the parent object containing the array
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!current[part] || typeof current[part] !== "object") return;
          current = current[part] as Record<string, unknown>;
        }
        
        // Get the array from the final path part
        const arrayField = pathParts[pathParts.length - 1];
        const array = current[arrayField] as
          | Record<string, unknown>[]
          | undefined;
        if (!Array.isArray(array) || !array[index]) return;

        array[index][field] = value;

        const newYaml = safeYamlDump(parsed, {
          lineWidth: -1,
          noRefs: true,
          quotingType: '"',
        });

        setYamlContent(newYaml);
        setHasChanges(true);
        setParseError(null);

        if (onPreviewChange) {
          onPreviewChange(parsed as Section);
        }
      } catch (error) {
        console.error("Error updating array item:", error);
      }
    },
    [yamlContent, onPreviewChange, pushUndoState],
  );

  // Update multiple fields of an array item at once (avoids stale state issues)
  const updateArrayItemFields = useCallback(
    (arrayPath: string, index: number, updates: Record<string, string>) => {
      try {
        const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return;

        pushUndoState(yamlContent);

        const pathParts = arrayPath.split(".");
        let current: Record<string, unknown> = parsed;
        
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!current[part] || typeof current[part] !== "object") return;
          current = current[part] as Record<string, unknown>;
        }
        
        const arrayField = pathParts[pathParts.length - 1];
        const array = current[arrayField] as Record<string, unknown>[] | undefined;
        if (!Array.isArray(array) || !array[index]) return;

        // Apply all updates at once
        for (const [field, value] of Object.entries(updates)) {
          array[index][field] = value;
        }

        const newYaml = safeYamlDump(parsed, {
          lineWidth: -1,
          noRefs: true,
          quotingType: '"',
        });

        setYamlContent(newYaml);
        setHasChanges(true);
        setParseError(null);

        if (onPreviewChange) {
          onPreviewChange(parsed as Section);
        }
      } catch (error) {
        console.error("Error updating array item fields:", error);
      }
    },
    [yamlContent, onPreviewChange, pushUndoState],
  );

  // Add a new item to an array field
  const addArrayItem = useCallback(
    (arrayPath: string, defaultItem: Record<string, unknown>) => {
      try {
        const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return;

        pushUndoState(yamlContent);

        // Support nested paths like "signup_card.features" by splitting on dots
        const pathParts = arrayPath.split(".");
        let current: Record<string, unknown> = parsed;
        
        // Traverse to the parent object containing the array
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!current[part] || typeof current[part] !== "object") {
            current[part] = {};
          }
          current = current[part] as Record<string, unknown>;
        }
        
        // Get or create the array from the final path part
        const arrayField = pathParts[pathParts.length - 1];
        let array = current[arrayField] as Record<string, unknown>[] | undefined;
        
        if (!Array.isArray(array)) {
          array = [];
          current[arrayField] = array;
        }

        array.push(defaultItem);

        const newYaml = safeYamlDump(parsed, {
          lineWidth: -1,
          noRefs: true,
          quotingType: '"',
        });

        setYamlContent(newYaml);
        setHasChanges(true);
        setParseError(null);

        if (onPreviewChange) {
          onPreviewChange(parsed as Section);
        }
      } catch (error) {
        console.error("Error adding array item:", error);
      }
    },
    [yamlContent, onPreviewChange, pushUndoState],
  );

  // Remove an item from an array field
  const removeArrayItem = useCallback(
    (arrayPath: string, indexToRemove: number) => {
      try {
        const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return;

        pushUndoState(yamlContent);

        const pathParts = arrayPath.split(".");
        let current: Record<string, unknown> = parsed;
        
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!current[part] || typeof current[part] !== "object") return;
          current = current[part] as Record<string, unknown>;
        }
        
        const arrayField = pathParts[pathParts.length - 1];
        const array = current[arrayField] as Record<string, unknown>[] | undefined;
        
        if (!Array.isArray(array) || indexToRemove < 0 || indexToRemove >= array.length) return;

        array.splice(indexToRemove, 1);

        const newYaml = safeYamlDump(parsed, {
          lineWidth: -1,
          noRefs: true,
          quotingType: '"',
        });

        setYamlContent(newYaml);
        setHasChanges(true);
        setParseError(null);

        if (onPreviewChange) {
          onPreviewChange(parsed as Section);
        }
      } catch (error) {
        console.error("Error removing array item:", error);
      }
    },
    [yamlContent, onPreviewChange, pushUndoState],
  );

  // Replace an entire array field
  const updateArrayField = useCallback(
    (arrayPath: string, newArray: Record<string, unknown>[]) => {
      try {
        const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return;

        pushUndoState(yamlContent);

        // Support nested paths like "signup_card.features" by splitting on dots
        const pathParts = arrayPath.split(".");
        let current: Record<string, unknown> = parsed;
        
        // Traverse to the parent object containing the array
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!current[part] || typeof current[part] !== "object") {
            current[part] = {};
          }
          current = current[part] as Record<string, unknown>;
        }
        
        // Set the array from the final path part
        const arrayField = pathParts[pathParts.length - 1];
        
        if (newArray.length === 0) {
          // Remove the field if array is empty
          delete current[arrayField];
        } else {
          current[arrayField] = newArray;
        }

        const newYaml = safeYamlDump(parsed, {
          lineWidth: -1,
          noRefs: true,
          quotingType: '"',
        });

        setYamlContent(newYaml);
        setHasChanges(true);
        setParseError(null);

        if (onPreviewChange) {
          onPreviewChange(parsed as Section);
        }
      } catch (error) {
        console.error("Error updating array field:", error);
      }
    },
    [yamlContent, onPreviewChange, pushUndoState],
  );

  // Get configured field editors from the component registry API
  const sectionType = (section as { type: string }).type || "";

  // Fetch all field editors from component registry
  const { data: allFieldEditors } = useQuery<
    Record<string, Record<string, EditorType>>
  >({
    queryKey: ["/api/component-registry/field-editors"],
  });

  // Get configured fields for current section type, filtering by variant
  const configuredFields = useMemo(() => {
    const rawFields = allFieldEditors?.[sectionType] || {};
    const result: Record<string, EditorType> = {};
    
    // Get current variant from parsed section
    const currentVariant = parsedSection?.variant as string | undefined;
    
    for (const [fieldPath, editorType] of Object.entries(rawFields)) {
      // Check if field path has variant prefix (e.g., "productShowcase:left_images[].src")
      const colonIndex = fieldPath.indexOf(":");
      if (colonIndex > 0 && !fieldPath.startsWith("color-picker:")) {
        // This is a variant-specific field
        const variantPrefix = fieldPath.substring(0, colonIndex);
        const actualFieldPath = fieldPath.substring(colonIndex + 1);
        
        // Only include if current variant matches
        if (currentVariant === variantPrefix) {
          result[actualFieldPath] = editorType;
        }
      } else {
        // Global field - include for all variants
        result[fieldPath] = editorType;
      }
    }
    
    return result;
  }, [allFieldEditors, sectionType, parsedSection?.variant]);

  // Render icon from name using shared icon utility
  const renderIconByName = useCallback((iconName: string) => {
    if (!iconName) {
      return <IconQuestionMark className="h-5 w-5 text-muted-foreground" />;
    }
    const IconComponent = getIcon(iconName);
    if (!IconComponent) {
      return <IconQuestionMark className="h-5 w-5 text-muted-foreground" />;
    }
    return <IconComponent className="h-5 w-5" />;
  }, []);

  // Handle icon picker selection
  const handleIconSelect = useCallback(
    (iconName: string) => {
      if (nestedUpdateFn) {
        nestedUpdateFn(iconName);
        setNestedUpdateFn(null);
        setIconPickerTarget(null);
      } else if (iconPickerTarget) {
        updateArrayItemField(
          iconPickerTarget.arrayField,
          iconPickerTarget.index,
          iconPickerTarget.field,
          iconName,
        );
        setIconPickerTarget(null);
      }
    },
    [iconPickerTarget, nestedUpdateFn, updateArrayItemField],
  );

  // Shared save logic - returns true on success
  const saveToServer = useCallback(async (): Promise<{
    success: boolean;
    warning?: string;
  }> => {
    if (!contentType || !slug || !locale) {
      return { success: false };
    }

    let parsed: Section;
    try {
      parsed = safeYamlLoad(yamlContent) as Section;
      if (!parsed || typeof parsed !== "object") {
        setParseError("Invalid section structure");
        return { success: false };
      }
    } catch (error) {
      if (error instanceof Error) {
        setParseError(error.message);
      }
      return { success: false };
    }

    setIsSaving(true);
    setSaveError(null);
    
    // Save page snapshot for undo before making changes
    if (pageHistory && allSections) {
      pageHistory.pushSnapshot(allSections, `Antes de editar sección ${sectionIndex + 1}`);
    }

    try {
      const result = await editContent({
        contentType,
        slug,
        locale,
        variant,
        version,
        operations: [
          {
            action: "update_section",
            index: sectionIndex,
            section: parsed as Record<string, unknown>,
          },
        ],
      });

      if (result.success) {

        // Use server-confirmed section data if available, fallback to local parsed
        const confirmedSection = result.updatedSections?.[sectionIndex] as
          | Section
          | undefined;
        if (!confirmedSection) {
          console.warn(
            "Server did not return updated section, using local parsed data",
          );
        }
        onUpdate(confirmedSection || parsed);
        setHasChanges(false);
        
        // Update initial state reference so next undo session starts from saved state
        initialYamlRef.current = yamlContent;

        // Emit event to trigger page refresh
        emitContentUpdated({ contentType, slug, locale });

        // Return warning if present (for GitHub sync failures)
        return { success: true, warning: result.warning };
      } else {
        setSaveError(result.error || "Failed to save changes");
        return { success: false };
      }
    } catch (error) {
      console.error("Error saving changes:", error);
      setSaveError(error instanceof Error ? error.message : "Network error");
      return { success: false };
    } finally {
      setIsSaving(false);
    }
  }, [
    yamlContent,
    sectionIndex,
    contentType,
    slug,
    locale,
    variant,
    version,
    onUpdate,
    pageHistory,
    allSections,
  ]);

  // Save without closing editor
  const handleSave = useCallback(async () => {
    const result = await saveToServer();
    if (result && result.success) {
      if (result.warning) {
        // Show warning toast for GitHub sync failures
        toast({
          title: "Changes saved with warning",
          description: result.warning,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Changes saved",
          description: "Your section has been updated successfully.",
        });
      }
    }
  }, [saveToServer, toast]);

  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close without saving?",
      );
      if (!confirmed) return;
    }
    // Clear live preview when closing
    if (onPreviewChange) {
      onPreviewChange(null);
    }
    onClose();
  }, [hasChanges, onClose, onPreviewChange]);

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-background border-l shadow-xl z-[9999] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold">Editar Sección</h2>
          <p className="text-sm text-muted-foreground">
            {sectionType} (Sección {sectionIndex + 1})
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={undo}
            disabled={!canUndo}
            title="Deshacer (Ctrl+Z)"
            data-testid="button-undo"
          >
            <IconArrowBackUp className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={redo}
            disabled={!canRedo}
            title="Rehacer (Ctrl+Shift+Z)"
            data-testid="button-redo"
          >
            <IconArrowForwardUp className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleClose}
            data-testid="button-close-editor"
          >
            <IconX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="mx-4 mt-2 grid w-auto grid-cols-2">
          <TabsTrigger value="code" className="gap-1.5" data-testid="tab-code">
            <IconCode className="h-4 w-4" />
            Code
          </TabsTrigger>
          <TabsTrigger
            value="props"
            className="gap-1.5"
            data-testid="tab-props"
          >
            <IconSettings className="h-4 w-4" />
            Props
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="code"
          className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden"
        >
          <div className="flex-1 min-h-0" data-section-index={sectionIndex}>
            <CodeMirror
              value={yamlContent}
              height="100%"
              extensions={[yaml(), variableHighlightPlugin]}
              theme={oneDark}
              onChange={handleYamlChange}
              onCreateEditor={(view) => { editorViewRef.current = view; }}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
              }}
              className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
            />
          </div>
        </TabsContent>

        <TabsContent
          value="props"
          className="flex-1 overflow-auto p-4 mt-0 data-[state=inactive]:hidden"
        >
          <div className="space-y-6">
            <ShowOnLocationsPicker
              value={currentShowOnLocations}
              onChange={(value) => updateArrayProperty("showOnLocations", value)}
            />
            <ShowOnPicker
              value={currentShowOn}
              onChange={(value) => updateProperty("showOn", value)}
            />
            
            {/* CTA Banner variant picker */}
            {sectionType === "cta_banner" && (
              <VariantPicker
                value={(parsedSection?.variant as string) || "default"}
                onChange={(value) => updateProperty("variant", value)}
                options={[
                  { id: "default", label: "Default (Buttons)" },
                  { id: "form", label: "Form" },
                ]}
              />
            )}
            {/* FAQ related features picker */}
            {sectionType === "faq" && (
              <RelatedFeaturesPicker
                value={(parsedSection?.related_features as string[]) || []}
                onChange={(value) => updateArrayProperty("related_features", value)}
                locale={locale}
              />
            )}
            {/* Testimonials Grid related features picker */}
            {sectionType === "testimonials_grid" && (
              <>
                <div 
                  className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2"
                  data-testid="alert-testimonials-edit-info"
                >
                  <IconAlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    {locale === "es" 
                      ? "Los testimonios se cargan del banco centralizado y se filtran por las características seleccionadas."
                      : "Testimonials are loaded from the centralized bank and filtered by the selected features."}
                  </p>
                </div>
                <RelatedFeaturesPicker
                  value={(parsedSection?.related_features as string[]) || []}
                  onChange={(value) => updateArrayProperty("related_features", value)}
                  locale={locale}
                  context="testimonials"
                />
                <TestimonialItemsPreview
                  relatedFeatures={(parsedSection?.related_features as string[]) || []}
                  itemStyles={(parsedSection?.item_styles as Record<string, { box_color?: string; name_color?: string; comment_color?: string }>) || {}}
                  locale={locale || "en"}
                  onUpdateItemStyle={(studentName, prop, value) => {
                    updateProperty(`item_styles.${studentName}.${prop}`, value);
                  }}
                />
              </>
            )}
            {sectionType === "dynamic_table" && parsedSection?.endpoint && (
              <DynamicTableChat
                endpoint={parsedSection.endpoint as string}
                dataPath={parsedSection.data_path as string | undefined}
                currentColumns={(parsedSection.columns as Array<{ key: string; label: string; type: "text" | "number" | "date" | "image" | "link" | "boolean"; template?: string }>) || []}
                currentTitle={parsedSection.title as string | undefined}
                locale={locale}
                onApplyConfig={(config) => {
                  try {
                    const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
                    if (!parsed || typeof parsed !== "object") return;
                    pushUndoState(yamlContent);
                    parsed.columns = config.columns;
                    if (config.title) {
                      parsed.title = config.title;
                    } else {
                      delete parsed.title;
                    }
                    const newYaml = safeYamlDump(parsed, { lineWidth: -1, noRefs: true, quotingType: '"' });
                    setYamlContent(newYaml);
                    setHasChanges(true);
                    setParseError(null);
                    if (onPreviewChange) onPreviewChange(parsed as Section);
                  } catch (err) {
                    console.error("Error applying table config:", err);
                  }
                }}
              />
            )}
            {sectionType === "dynamic_table" && (
              <>
                <div className="space-y-2 border-t pt-3 mt-3">
                  <Label className="text-xs font-medium">Max Rows</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Show all rows"
                    value={parsedSection?.max_rows != null ? String(parsedSection.max_rows) : ""}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (val === "") {
                        updatePropertyWithValue("max_rows", undefined);
                      } else {
                        const n = parseInt(val, 10);
                        if (!isNaN(n) && n > 0) updatePropertyWithValue("max_rows", n);
                      }
                    }}
                    data-testid="input-max-rows"
                  />
                  <p className="text-xs text-muted-foreground">Limit visible rows. Users can expand to see all.</p>
                </div>
                <div className="space-y-3 border-t pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Region Filter</Label>
                    <Switch
                      checked={!!parsedSection?.region_filter}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updatePropertyWithValue("region_filter", {
                            key: "",
                            mapping: {
                              "usa-canada": [],
                              "latam": [],
                              "europe": [],
                            },
                          });
                        } else {
                          updatePropertyWithValue("region_filter", undefined);
                        }
                      }}
                      data-testid="switch-region-filter"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Filter rows based on the visitor's detected region.</p>
                  {!!parsedSection?.region_filter && (() => {
                    const rf = parsedSection.region_filter as { key: string; mapping: Record<string, string[]> };
                    const regionFields = (
                      <div className="space-y-3 pl-1">
                        <div className="space-y-1">
                          <Label className="text-xs">Data Field (key path)</Label>
                          <Input
                            value={rf.key || ""}
                            placeholder="e.g. academy.country_code"
                            onChange={(e) => {
                              updatePropertyWithValue("region_filter", { ...rf, key: e.target.value });
                            }}
                            data-testid="input-region-filter-key"
                          />
                          <p className="text-xs text-muted-foreground">Dot-notation path to the field in each row to match against.</p>
                        </div>
                        {(["usa-canada", "latam", "europe"] as const).map((region) => (
                          <div key={region} className="space-y-1">
                            <Label className="text-xs capitalize">{region}</Label>
                            <Input
                              value={(rf.mapping[region] || []).join(", ")}
                              placeholder="e.g. US, CA"
                              onChange={(e) => {
                                const vals = e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean);
                                updatePropertyWithValue("region_filter", {
                                  ...rf,
                                  mapping: { ...rf.mapping, [region]: vals },
                                });
                              }}
                              data-testid={`input-region-mapping-${region}`}
                            />
                          </div>
                        ))}
                      </div>
                    );
                    return regionFields;
                  })()}
                </div>
              </>
            )}
            
            <ColorPicker
              value={currentBackground}
              onChange={(value) => updateProperty("background", value)}
              type="background"
              testIdPrefix="props-background"
            />
            {/* Render top-level (non-array) color-picker field editors */}
            {Object.entries(configuredFields)
              .filter(([fieldPath, editorTypeRaw]) => {
                if (fieldPath.includes("[]")) return false;
                if (fieldPath === "background") return false;
                if (fieldPath.startsWith("default_")) return false;
                const { type: edType } = parseEditorType(editorTypeRaw);
                return edType === "color-picker";
              })
              .map(([fieldPath, editorTypeRaw]) => {
                const { variant: edVariant } = parseEditorType(editorTypeRaw);
                const currentValue = parsedSection ? String((parsedSection as Record<string, unknown>)[fieldPath] || "") : "";
                const fieldLabelMap: Record<string, string> = {
                  form_background: "Fondo del formulario",
                  terms_color: "Color de términos y condiciones",
                  title_color: "Color de título",
                  subtitle_color: "Color de subtítulo",
                  text_color: "Color de texto",
                };
                const label = fieldLabelMap[fieldPath] || fieldPath.replace(/_/g, " ");
                return (
                  <div key={fieldPath} className="mt-3">
                    <ColorPicker
                      value={currentValue}
                      onChange={(value) => updateProperty(fieldPath, value)}
                      type={(edVariant as "background" | "accent" | "text") || "background"}
                      label={label}
                      testIdPrefix={`props-${fieldPath}`}
                    />
                  </div>
                );
              })}
            {/* Render grouped array item editors (when multiple field-editors exist for the same array) */}
            {(() => {
              const arrayFieldGroups: Record<string, { fieldName: string; editorType: string; variant?: string; fullPath: string }[]> = {};
              Object.entries(configuredFields).forEach(([fieldPath, editorTypeRaw]) => {
                if (/^[\w]+\[\]\.[\w]+\[\]\./.test(fieldPath)) return;
                const match = fieldPath.match(/^([\w.]+)\[\]\.(.+)$/);
                if (!match) return;
                const [, arrPath, fieldName] = match;
                if (!arrayFieldGroups[arrPath]) arrayFieldGroups[arrPath] = [];
                const { type: edType, variant: edVariant } = parseEditorType(editorTypeRaw);
                arrayFieldGroups[arrPath].push({ fieldName, editorType: edType, variant: edVariant, fullPath: fieldPath });
              });

              const supportedGroupedTypes = new Set(["color-picker", "image-picker", "link-picker", "rich-text-editor"]);
              const groupedArrayPaths = new Set(
                Object.entries(arrayFieldGroups)
                  .filter(([, fields]) => fields.length >= 2 && fields.every(f => supportedGroupedTypes.has(f.editorType)))
                  .map(([arrPath]) => arrPath)
              );

              return Array.from(groupedArrayPaths).map((arrPath) => {
                const fields = arrayFieldGroups[arrPath];
                const getArrayDataForGroup = () => {
                  if (!parsedSection) return [];
                  const pathParts = arrPath.split(".");
                  let current: unknown = parsedSection;
                  for (const part of pathParts) {
                    if (!current || typeof current !== "object") return [];
                    current = (current as Record<string, unknown>)[part];
                  }
                  return Array.isArray(current) ? current as Record<string, unknown>[] : [];
                };
                const arrData = getArrayDataForGroup();
                if (arrData.length === 0) return null;

                const arrayLabel = arrPath.split(".").pop() || arrPath;

                const fieldLabelMap: Record<string, string> = {
                  name: "Nombre",
                  title: "Título",
                  role: "Rol / Cargo",
                  company: "Empresa",
                  comment: "Comentario",
                  excerpt: "Extracto",
                  rating: "Calificación",
                  box_color: "Fondo de tarjeta",
                  name_color: "Color de nombre",
                  title_color: "Color de título",
                  role_color: "Color de rol",
                  comment_color: "Color de comentario",
                  excerpt_color: "Color de extracto",
                  star_color: "Color de estrellas",
                  linkedin_color: "Color de LinkedIn",
                  link_color: "Color de enlace",
                  avatar: "Foto de perfil",
                  logo: "Logo",
                  linkedin_url: "LinkedIn URL",
                  link_text: "Texto del enlace",
                  link_url: "URL del enlace",
                  "media.url": "Video / Media URL",
                };

                const hiddenFields = new Set(["type", "media.type", "media.ratio", "ratio"]);

                const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
                  const parts = path.split(".");
                  let cur: unknown = obj;
                  for (const p of parts) {
                    if (!cur || typeof cur !== "object") return undefined;
                    cur = (cur as Record<string, unknown>)[p];
                  }
                  return cur;
                };

                const updateNestedField = (idx: number, fieldName: string, value: unknown) => {
                  if (fieldName.includes(".")) {
                    const parts = fieldName.split(".");
                    try {
                      const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
                      if (!parsed || typeof parsed !== "object") return;
                      pushUndoState(yamlContent);
                      const arrParts = arrPath.split(".");
                      let cur: unknown = parsed;
                      for (const p of arrParts) {
                        if (!cur || typeof cur !== "object") return;
                        cur = (cur as Record<string, unknown>)[p];
                      }
                      if (!Array.isArray(cur)) return;
                      let target: unknown = cur[idx];
                      for (let i = 0; i < parts.length - 1; i++) {
                        if (!target || typeof target !== "object") return;
                        if (!(parts[i] in (target as Record<string, unknown>))) {
                          (target as Record<string, unknown>)[parts[i]] = {};
                        }
                        target = (target as Record<string, unknown>)[parts[i]];
                      }
                      if (target && typeof target === "object") {
                        (target as Record<string, unknown>)[parts[parts.length - 1]] = value;
                      }
                      const newYaml = safeYamlDump(parsed, { lineWidth: -1, noRefs: true, quotingType: '"' });
                      setYamlContent(newYaml);
                      setHasChanges(true);
                      setParseError(null);
                      if (onPreviewChange) onPreviewChange(parsed as Section);
                    } catch (e) { console.error("Error updating nested field:", e); }
                  } else {
                    if (typeof value === "string" || typeof value === "number") {
                      updateArrayItemField(arrPath, idx, fieldName, value);
                    }
                  }
                };

                const collectItemKeys = (items: Record<string, unknown>[]): string[] => {
                  const keySet = new Set<string>();
                  items.forEach(item => {
                    const flattenKeys = (obj: Record<string, unknown>, prefix: string) => {
                      Object.keys(obj).forEach(k => {
                        const path = prefix ? `${prefix}.${k}` : k;
                        const val = obj[k];
                        if (val && typeof val === "object" && !Array.isArray(val)) {
                          flattenKeys(val as Record<string, unknown>, path);
                        } else {
                          keySet.add(path);
                        }
                      });
                    };
                    flattenKeys(item, "");
                  });
                  return Array.from(keySet);
                };

                const allItemKeys = collectItemKeys(arrData);
                const configuredFieldNames = new Set(fields.map(f => f.fieldName));
                const textFields = allItemKeys.filter(k => !configuredFieldNames.has(k) && !hiddenFields.has(k));

                const fieldOrder: string[] = [
                  ...textFields,
                  ...fields.map(f => f.fieldName).filter(fn => fn === "avatar"),
                  ...fields.map(f => f.fieldName).filter(fn => fn !== "avatar" && !fn.includes("color")),
                  ...fields.map(f => f.fieldName).filter(fn => fn.includes("color")),
                ];

                const buildDefaultItem = (): Record<string, unknown> => {
                  if (arrData.length === 0) return {};
                  const template: Record<string, unknown> = {};
                  const sample = arrData[0];
                  Object.keys(sample).forEach(k => {
                    const val = sample[k];
                    if (typeof val === "string") template[k] = "";
                    else if (typeof val === "number") template[k] = 0;
                    else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
                      const nested: Record<string, unknown> = {};
                      Object.keys(val as Record<string, unknown>).forEach(nk => {
                        const nv = (val as Record<string, unknown>)[nk];
                        if (typeof nv === "string") nested[nk] = "";
                        else if (typeof nv === "number") nested[nk] = 0;
                      });
                      template[k] = nested;
                    }
                  });
                  const nameKey = "name" in template ? "name" : "title" in template ? "title" : null;
                  if (nameKey) template[nameKey] = `Nuevo item ${arrData.length + 1}`;
                  return template;
                };

                return (
                  <div key={`grouped-${arrPath}`} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium capitalize">
                        {arrayLabel} ({arrData.length})
                      </Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addArrayItem(arrPath, buildDefaultItem())}
                        data-testid={`props-grouped-add-${arrPath}`}
                      >
                        <IconPlus className="h-4 w-4 mr-1" />
                        Agregar
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {arrData.map((item, index) => {
                        const itemLabel = (item.name as string) || (item.title as string) || (item.label as string) || `Item ${index + 1}`;
                        const avatarSrc = (item.avatar as string) || (item.logo as string) || "";
                        const displayAvatarSrc = imageRegistry?.images?.[avatarSrc]?.src || avatarSrc;
                        const isLogo = !item.avatar && !!(item.logo as string);

                        return (
                          <Collapsible key={index} className="border rounded-md">
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                                data-testid={`props-grouped-item-${arrPath}-${index}-trigger`}
                              >
                                {avatarSrc ? (
                                  <div className={`w-8 h-8 flex-shrink-0 overflow-hidden border ${isLogo ? "rounded-md bg-background p-1" : "rounded-full bg-muted"}`}>
                                    <img src={displayAvatarSrc} alt={itemLabel} className={`w-full h-full ${isLogo ? "object-contain" : "object-cover"}`} />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-muted border flex-shrink-0 flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                    {itemLabel.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                                  </div>
                                )}
                                <span className="flex-1 text-left text-sm font-medium truncate">
                                  {itemLabel}
                                </span>
                                <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="p-3 pt-0 space-y-3 border-t">
                                <div className="flex justify-end">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive h-7 px-2 text-xs"
                                    onClick={() => removeArrayItem(arrPath, index)}
                                    data-testid={`props-grouped-delete-${arrPath}-${index}`}
                                  >
                                    <IconTrash className="h-3.5 w-3.5 mr-1" />
                                    Eliminar
                                  </Button>
                                </div>
                                {fieldOrder.map((fieldKey) => {
                                  const currentValue = String(getNestedValue(item, fieldKey) ?? "");
                                  const label = fieldLabelMap[fieldKey] || fieldKey.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                                  const configuredField = fields.find(f => f.fieldName === fieldKey);

                                  if (configuredField) {
                                    if (configuredField.editorType === "icon-picker") {
                                      return (
                                        <div key={fieldKey} className="space-y-1">
                                          <Label className="text-xs text-muted-foreground">{label}</Label>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setIconPickerTarget({
                                                arrayField: arrPath,
                                                index,
                                                field: fieldKey,
                                                label: itemLabel,
                                                currentIcon: currentValue,
                                              });
                                              setIconPickerOpen(true);
                                            }}
                                            className="flex items-center justify-center w-10 h-10 rounded border bg-muted/30 hover:bg-muted transition-colors"
                                            data-testid={`props-grouped-icon-${fieldKey}-${index}`}
                                            title={`${itemLabel}: ${currentValue || "no icon"}`}
                                          >
                                            {renderIconByName(currentValue)}
                                          </button>
                                        </div>
                                      );
                                    }
                                    if (configuredField.editorType === "color-picker") {
                                      const colorType = (configuredField.variant as ColorPickerVariant) || "accent";
                                      return (
                                        <div key={fieldKey} className="space-y-1">
                                          <Label className="text-xs text-muted-foreground">{label}</Label>
                                          <ColorPicker
                                            value={currentValue}
                                            onChange={(value) => updateNestedField(index, fieldKey, value)}
                                            type={colorType}
                                            label=" "
                                            allowNone={true}
                                            allowCustom={true}
                                            testIdPrefix={`props-grouped-${fieldKey}-${index}`}
                                          />
                                        </div>
                                      );
                                    }

                                    if (configuredField.editorType === "image-picker") {
                                      const displaySrc = imageRegistry?.images?.[currentValue]?.src || currentValue;
                                      return (
                                        <div key={fieldKey} className="space-y-1">
                                          <Label className="text-xs text-muted-foreground">{label}</Label>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setImagePickerTarget({
                                                  arrayPath: arrPath,
                                                  index,
                                                  srcField: fieldKey,
                                                  currentSrc: currentValue,
                                                  currentAlt: (item.name as string) || "",
                                                  tagFilter: configuredField.variant,
                                                });
                                                setImagePickerOpen(true);
                                              }}
                                              className="relative w-12 h-12 rounded-md border border-input bg-muted/50 hover:bg-muted transition-colors overflow-hidden group"
                                              data-testid={`props-grouped-image-${fieldKey}-${index}`}
                                            >
                                              {currentValue ? (
                                                <>
                                                  <img src={displaySrc} alt={label} className="w-full h-full object-cover" />
                                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <IconPhoto className="h-4 w-4 text-white" />
                                                  </div>
                                                </>
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                  <IconPhoto className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                              )}
                                            </button>
                                            {currentValue && (
                                              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                                {currentValue.split("/").pop() || currentValue}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    }

                                    if (configuredField.editorType === "link-picker") {
                                      return (
                                        <div key={fieldKey} className="space-y-1">
                                          <Label className="text-xs text-muted-foreground">{label}</Label>
                                          <LinkPicker
                                            value={currentValue}
                                            onChange={(url) => updateNestedField(index, fieldKey, url)}
                                            locale={locale}
                                            allSections={allSections}
                                            testId={`props-grouped-link-${fieldKey}-${index}`}
                                          />
                                        </div>
                                      );
                                    }
                                    if (configuredField.editorType === "rich-text-editor") {
                                      return (
                                        <div key={fieldKey} className="space-y-1">
                                          <Label className="text-xs text-muted-foreground">{label}</Label>
                                          <RichTextArea
                                            key={`${sectionIndex}-${arrPath}-${index}-${fieldKey}`}
                                            value={currentValue}
                                            onChange={(html) => updateNestedField(index, fieldKey, html)}
                                            placeholder={`Edit ${label}…`}
                                            minHeight="80px"
                                            locale={locale}
                                            data-testid={`props-grouped-richtext-${fieldKey}-${index}`}
                                          />
                                        </div>
                                      );
                                    }
                                    return null;
                                  }

                                  const rawValue = getNestedValue(item, fieldKey);
                                  if (typeof rawValue === "number" || fieldKey === "rating") {
                                    return (
                                      <div key={fieldKey} className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">{label}</Label>
                                        <Input
                                          type="number"
                                          value={rawValue !== undefined ? String(rawValue) : ""}
                                          onChange={(e) => {
                                            const num = e.target.value === "" ? undefined : Number(e.target.value);
                                            updateNestedField(index, fieldKey, num);
                                          }}
                                          min={0}
                                          max={fieldKey === "rating" ? 5 : undefined}
                                          className="h-8 text-sm"
                                          data-testid={`props-grouped-number-${fieldKey}-${index}`}
                                        />
                                      </div>
                                    );
                                  }

                                  if (fieldKey === "comment" || (typeof rawValue === "string" && rawValue.length > 80)) {
                                    return (
                                      <div key={fieldKey} className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">{label}</Label>
                                        <Textarea
                                          value={currentValue}
                                          onChange={(e) => updateNestedField(index, fieldKey, e.target.value)}
                                          rows={3}
                                          className="text-sm resize-none"
                                          data-testid={`props-grouped-text-${fieldKey}-${index}`}
                                        />
                                      </div>
                                    );
                                  }

                                  return (
                                    <div key={fieldKey} className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">{label}</Label>
                                      <Input
                                        value={currentValue}
                                        onChange={(e) => updateNestedField(index, fieldKey, e.target.value)}
                                        className="h-8 text-sm"
                                        data-testid={`props-grouped-input-${fieldKey}-${index}`}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
            {/* Render double-nested array item editors (e.g., slides[].institution_logos[].image_id) */}
            {(() => {
              const nestedArrayGroups: Record<string, { parentArr: string; nestedArr: string; leafField: string; editorType: string; variant?: string }[]> = {};
              Object.entries(configuredFields).forEach(([fieldPath, editorTypeRaw]) => {
                const nestedMatch = fieldPath.match(/^([\w]+)\[\]\.([\w]+)\[\]\.(.+)$/);
                if (!nestedMatch) return;
                const [, parentArr, nestedArr, leafField] = nestedMatch;
                const groupKey = `${parentArr}[].${nestedArr}`;
                if (!nestedArrayGroups[groupKey]) nestedArrayGroups[groupKey] = [];
                const { type: edType, variant: edVariant } = parseEditorType(editorTypeRaw);
                nestedArrayGroups[groupKey].push({ parentArr, nestedArr, leafField, editorType: edType, variant: edVariant });
              });

              if (Object.keys(nestedArrayGroups).length === 0) return null;

              return Object.entries(nestedArrayGroups).map(([groupKey, fields]) => {
                if (!parsedSection) return null;
                const { parentArr, nestedArr } = fields[0];
                const parentData = (parsedSection as Record<string, unknown>)[parentArr];
                if (!Array.isArray(parentData)) return null;

                const nestedHiddenFields = new Set(["type"]);

                return (
                  <div key={`nested-${groupKey}`} className="space-y-3">
                    {parentData.map((parentItem, parentIdx) => {
                      const parentItemObj = parentItem as Record<string, unknown>;
                      const nestedData = parentItemObj[nestedArr];
                      if (!Array.isArray(nestedData)) return null;
                      const nestedItems = nestedData as Record<string, unknown>[];

                      const parentLabel = (parentItemObj.title as string) || (parentItemObj.name as string) || `Slide ${parentIdx + 1}`;
                      const resolvedArrPath = `${parentArr}.${parentIdx}.${nestedArr}`;

                      const configuredLeafNames = new Set(fields.map(f => f.leafField));
                      const collectNestedKeys = (items: Record<string, unknown>[]): string[] => {
                        const keySet = new Set<string>();
                        items.forEach(item => {
                          Object.keys(item).forEach(k => {
                            if (!configuredLeafNames.has(k) && !nestedHiddenFields.has(k) && typeof item[k] !== "object") {
                              keySet.add(k);
                            }
                          });
                        });
                        return Array.from(keySet);
                      };
                      const extraTextFields = collectNestedKeys(nestedItems);

                      const fieldOrder = [
                        ...extraTextFields,
                        ...fields.map(f => f.leafField),
                      ];

                      const buildNestedDefault = (): Record<string, unknown> => {
                        if (nestedItems.length === 0) return {};
                        const template: Record<string, unknown> = {};
                        Object.keys(nestedItems[0]).forEach(k => {
                          const val = nestedItems[0][k];
                          if (typeof val === "string") template[k] = "";
                          else if (typeof val === "number") template[k] = 0;
                        });
                        return template;
                      };

                      return (
                        <div key={`nested-${groupKey}-${parentIdx}`} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">
                              {nestedArr.replace(/_/g, " ")} — {parentLabel} ({nestedItems.length})
                            </Label>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addArrayItem(resolvedArrPath, buildNestedDefault())}
                              data-testid={`props-nested-add-${resolvedArrPath}`}
                            >
                              <IconPlus className="h-4 w-4 mr-1" />
                              Agregar
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {nestedItems.map((nestedItem, nestedIdx) => {
                              const itemLabel = (nestedItem.alt as string) || (nestedItem.name as string) || (nestedItem.title as string) || `Item ${nestedIdx + 1}`;
                              const logoSrc = (nestedItem.image_id as string) || (nestedItem.logo as string) || "";
                              const displayLogoSrc = imageRegistry?.images?.[logoSrc]?.src || logoSrc;

                              return (
                                <Collapsible key={nestedIdx} className="border rounded-md">
                                  <CollapsibleTrigger asChild>
                                    <button
                                      type="button"
                                      className="w-full flex items-center gap-3 p-2 hover:bg-muted/50 transition-colors"
                                      data-testid={`props-nested-item-${resolvedArrPath}-${nestedIdx}-trigger`}
                                    >
                                      {logoSrc ? (
                                        <div className="w-8 h-8 flex-shrink-0 overflow-hidden border rounded-md bg-background p-1">
                                          <img src={displayLogoSrc} alt={itemLabel} className="w-full h-full object-contain" />
                                        </div>
                                      ) : (
                                        <div className="w-8 h-8 rounded-md bg-muted border flex-shrink-0 flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                          {itemLabel.slice(0, 2).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="flex-1 text-left text-xs font-medium truncate">{itemLabel}</span>
                                      <IconChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="p-2 pt-0 space-y-2 border-t">
                                      <div className="flex justify-end">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-destructive h-6 px-2 text-xs"
                                          onClick={() => removeArrayItem(resolvedArrPath, nestedIdx)}
                                          data-testid={`props-nested-delete-${resolvedArrPath}-${nestedIdx}`}
                                        >
                                          <IconTrash className="h-3.5 w-3.5 mr-1" />
                                          Eliminar
                                        </Button>
                                      </div>
                                      {fieldOrder.map((fieldKey) => {
                                        const currentValue = String(nestedItem[fieldKey] ?? "");
                                        const label = fieldKey.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                                        const configuredField = fields.find(f => f.leafField === fieldKey);

                                        if (configuredField?.editorType === "icon-picker") {
                                          return (
                                            <div key={fieldKey} className="space-y-1">
                                              <Label className="text-xs text-muted-foreground">{label}</Label>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setIconPickerTarget({
                                                    arrayField: resolvedArrPath,
                                                    index: nestedIdx,
                                                    field: fieldKey,
                                                    label: `${itemLabel} > ${label}`,
                                                    currentIcon: currentValue,
                                                  });
                                                  setIconPickerOpen(true);
                                                }}
                                                className="flex items-center justify-center w-10 h-10 rounded border bg-muted/30 hover:bg-muted transition-colors"
                                                data-testid={`props-nested-icon-${fieldKey}-${nestedIdx}`}
                                                title={`${label}: ${currentValue || "no icon"}`}
                                              >
                                                {renderIconByName(currentValue)}
                                              </button>
                                            </div>
                                          );
                                        }

                                        if (configuredField?.editorType === "image-picker") {
                                          const displaySrc = imageRegistry?.images?.[currentValue]?.src || currentValue;
                                          return (
                                            <div key={fieldKey} className="space-y-1">
                                              <Label className="text-xs text-muted-foreground">{label}</Label>
                                              <div className="flex items-center gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setImagePickerTarget({
                                                      arrayPath: resolvedArrPath,
                                                      index: nestedIdx,
                                                      srcField: fieldKey,
                                                      currentSrc: currentValue,
                                                      currentAlt: (nestedItem.alt as string) || "",
                                                      tagFilter: configuredField.variant,
                                                    });
                                                    setImagePickerOpen(true);
                                                  }}
                                                  className="relative w-10 h-10 rounded-md border border-input bg-muted/50 hover:bg-muted transition-colors overflow-hidden group"
                                                  data-testid={`props-nested-image-${fieldKey}-${nestedIdx}`}
                                                >
                                                  {currentValue ? (
                                                    <>
                                                      <img src={displaySrc} alt={label} className="w-full h-full object-contain p-0.5" />
                                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <IconPhoto className="h-3.5 w-3.5 text-white" />
                                                      </div>
                                                    </>
                                                  ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                      <IconPhoto className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                  )}
                                                </button>
                                                {currentValue && (
                                                  <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                                                    {currentValue}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        }

                                        if (typeof nestedItem[fieldKey] === "number") {
                                          return (
                                            <div key={fieldKey} className="space-y-1">
                                              <Label className="text-xs text-muted-foreground">{label}</Label>
                                              <Input
                                                type="number"
                                                value={currentValue}
                                                onChange={(e) => {
                                                  const num = e.target.value === "" ? undefined : Number(e.target.value);
                                                  updateArrayItemField(resolvedArrPath, nestedIdx, fieldKey, num as number);
                                                }}
                                                className="h-7 text-xs"
                                                data-testid={`props-nested-number-${fieldKey}-${nestedIdx}`}
                                              />
                                            </div>
                                          );
                                        }

                                        return (
                                          <div key={fieldKey} className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">{label}</Label>
                                            <Input
                                              value={currentValue}
                                              onChange={(e) => updateArrayItemField(resolvedArrPath, nestedIdx, fieldKey, e.target.value)}
                                              className="h-7 text-xs"
                                              data-testid={`props-nested-input-${fieldKey}-${nestedIdx}`}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
            {/* Render array fields with configured editors */}
            {Object.entries(configuredFields).map(
              ([fieldPath, editorTypeRaw]) => {
                // Skip double-nested array fields (handled above)
                if (/^[\w]+\[\]\.[\w]+\[\]\./.test(fieldPath)) return null;
                // Skip fields that are already rendered in grouped collapsible items above
                const groupedSkipMatch = fieldPath.match(/^([\w.]+)\[\]\./);
                if (groupedSkipMatch) {
                  const arrPathCheck = groupedSkipMatch[1];
                  const supportedTypes = new Set(["color-picker", "image-picker", "link-picker", "rich-text-editor"]);
                  const allForArr = Object.entries(configuredFields).filter(([fp]) => fp.startsWith(`${arrPathCheck}[].`));
                  const allSupported = allForArr.every(([, et]) => supportedTypes.has(parseEditorType(et).type));
                  if (allForArr.length >= 2 && allSupported) return null;
                }

                // Parse editor type with optional variant (e.g., "color-picker:background")
                const { type: editorType, variant } =
                  parseEditorType(editorTypeRaw);

                // Handle simple field paths (e.g., "image" or "nested.image")
                const isSimpleField = !fieldPath.includes("[]");
                if (isSimpleField && editorType === "image-picker") {
                  // Get the current value by traversing the path
                  const getSimpleFieldValue = () => {
                    if (!parsedSection) return "";
                    const pathParts = fieldPath.split(".");
                    let current: unknown = parsedSection;
                    for (const part of pathParts) {
                      if (!current || typeof current !== "object") return "";
                      current = (current as Record<string, unknown>)[part];
                    }
                    return (current as string) || "";
                  };
                  
                  const currentValue = getSimpleFieldValue();
                  const fieldLabel = fieldPath.split(".").pop() || fieldPath;
                  // For fields ending in _id, look up the actual image URL from the registry
                  const isIdField = fieldPath.endsWith("_id");
                  const displaySrc = isIdField 
                    ? (imageRegistry?.images?.[currentValue]?.src || currentValue)
                    : currentValue;
                  const displayLabel = isIdField 
                    ? currentValue // Show the ID as the label for ID fields
                    : (currentValue.split("/").pop() || currentValue);
                  
                  return (
                    <div key={fieldPath} className="space-y-2">
                      <Label className="text-sm font-medium capitalize">
                        {fieldLabel.replace(/_/g, " ")}
                      </Label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setImagePickerTarget({
                              fieldPath,
                              label: fieldLabel,
                              currentSrc: currentValue,
                              currentAlt: "",
                              tagFilter: variant, // e.g., "logo" from "image-picker:logo"
                            });
                            setImagePickerOpen(true);
                          }}
                          className="relative w-16 h-16 rounded-md border border-input bg-muted/50 hover:bg-muted transition-colors overflow-hidden group"
                          data-testid={`props-image-${fieldLabel}`}
                          title={`Change ${fieldLabel}`}
                        >
                          {currentValue ? (
                            <>
                              <img
                                src={displaySrc}
                                alt={fieldLabel}
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
                        {currentValue && (
                          <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {displayLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                // Handle simple field paths with image-with-style-picker (e.g., "left.image" or just "image")
                if (isSimpleField && editorType === "image-with-style-picker") {
                  const getNestedValue = (path: string, defaultValue: unknown = "") => {
                    if (!parsedSection) return defaultValue;
                    if (!path) return defaultValue;
                    const pathParts = path.split(".");
                    let current: unknown = parsedSection;
                    for (const part of pathParts) {
                      if (!current || typeof current !== "object") return defaultValue;
                      current = (current as Record<string, unknown>)[part];
                    }
                    return current ?? defaultValue;
                  };
                  
                  const pathParts = fieldPath.split(".");
                  const parentPath = pathParts.slice(0, -1).join(".");
                  const side = pathParts[0]; // "left" or "right" or the field itself
                  
                  // For simple fields like "image" (no parent), use direct field names
                  // For nested fields like "left.image", use parent prefix
                  const hasParent = parentPath.length > 0;
                  const fieldPrefix = hasParent ? `${parentPath}.` : "";
                  
                  const currentValue = getNestedValue(fieldPath, "") as string;
                  const currentAlt = getNestedValue(`${fieldPrefix}image_alt`, "") as string;
                  const currentObjectFit = getNestedValue(`${fieldPrefix}image_object_fit`, "") as string;
                  const currentObjectPosition = getNestedValue(`${fieldPrefix}image_object_position`, "") as string;
                  
                  const fieldLabel = side === "left" ? "Imagen Izquierda" : side === "right" ? "Imagen Derecha" : side === "image" ? "Imagen" : fieldPath.split(".").pop() || fieldPath;
                  
                  return (
                    <Collapsible key={fieldPath} className="border rounded-md">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                          data-testid={`props-image-style-${side}-trigger`}
                        >
                          <div className="w-10 h-10 rounded-md overflow-hidden bg-muted border flex-shrink-0">
                            {currentValue ? (
                              <img
                                src={currentValue}
                                alt={currentAlt || fieldLabel}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <IconPhoto className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <span className="flex-1 text-left text-sm font-medium">
                            {fieldLabel}
                          </span>
                          <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-3 pt-0 space-y-3 border-t">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setImagePickerTarget({
                                  fieldPath,
                                  label: fieldLabel,
                                  currentSrc: currentValue,
                                  currentAlt,
                                  tagFilter: variant,
                                });
                                setImagePickerOpen(true);
                              }}
                              className="relative w-16 h-16 rounded-md border border-input bg-muted/50 hover:bg-muted transition-colors overflow-hidden group"
                              data-testid={`props-image-style-${side}-picker`}
                              title="Cambiar imagen"
                            >
                              {currentValue ? (
                                <>
                                  <img
                                    src={currentValue}
                                    alt={currentAlt}
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
                            <div className="flex-1 space-y-1">
                              <Label className="text-xs text-muted-foreground">Alt text</Label>
                              <Input
                                value={currentAlt}
                                onChange={(e) => updateProperty(`${fieldPrefix}image_alt`, e.target.value)}
                                placeholder="Descripción de la imagen"
                                className="h-8 text-sm"
                                data-testid={`props-image-style-${side}-alt`}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Object Fit</Label>
                              <Select
                                value={currentObjectFit || "cover"}
                                onValueChange={(value) => updateProperty(`${fieldPrefix}image_object_fit`, value)}
                              >
                                <SelectTrigger className="h-8 text-sm" data-testid={`props-image-style-${side}-object-fit`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cover">Cover (recorta)</SelectItem>
                                  <SelectItem value="contain">Contain (completa)</SelectItem>
                                  <SelectItem value="fill">Fill (estirar)</SelectItem>
                                  <SelectItem value="none">None (original)</SelectItem>
                                  <SelectItem value="scale-down">Scale Down</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Posición (X Y)</Label>
                              <Input
                                value={currentObjectPosition}
                                onChange={(e) => updateProperty(`${fieldPrefix}image_object_position`, e.target.value)}
                                placeholder="center center"
                                className="h-8 text-sm"
                                data-testid={`props-image-style-${side}-object-position`}
                              />
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                }

                // Parse field path - supports single level like "features[].icon"
                // and multi-level nested arrays like "courses[].badges[].icon"
                const arrayBracketCount = (fieldPath.match(/\[\]/g) || []).length;
                
                // Multi-level nested array path (e.g., "courses[].badges[].icon")
                if (arrayBracketCount > 1) {
                  const segments = fieldPath.split("[].");
                  const itemField = segments[segments.length - 1];
                  const arraySegments = segments.slice(0, -1);
                  
                  const getNestedLabel = (item: Record<string, unknown>) =>
                    (item.tab_label as string) || (item.title as string) || (item.label as string) || (item.name as string) || (item.text as string) || "";
                  
                  type NestedItem = { parentPath: string[]; parentIndices: number[]; parentLabel: string; item: Record<string, unknown>; };
                  
                  const collectLeafItems = (): NestedItem[] => {
                    if (!parsedSection) return [];
                    const results: NestedItem[] = [];
                    
                    const traverse = (
                      current: unknown,
                      segIdx: number,
                      path: string[],
                      indices: number[],
                      labelParts: string[],
                    ) => {
                      if (segIdx >= arraySegments.length) {
                        if (current && typeof current === "object" && !Array.isArray(current)) {
                          results.push({
                            parentPath: path,
                            parentIndices: indices,
                            parentLabel: labelParts.join(" > "),
                            item: current as Record<string, unknown>,
                          });
                        }
                        return;
                      }
                      
                      const segment = arraySegments[segIdx];
                      const segParts = segment.split(".");
                      let obj: unknown = current;
                      for (const part of segParts) {
                        if (!obj || typeof obj !== "object") return;
                        obj = (obj as Record<string, unknown>)[part];
                      }
                      
                      if (!Array.isArray(obj)) return;
                      
                      obj.forEach((arrayItem, idx) => {
                        const label = getNestedLabel(arrayItem as Record<string, unknown>) || `${segParts[segParts.length - 1]} ${idx + 1}`;
                        traverse(
                          arrayItem,
                          segIdx + 1,
                          [...path, segment],
                          [...indices, idx],
                          [...labelParts, label],
                        );
                      });
                    };
                    
                    traverse(parsedSection, 0, [], [], []);
                    return results;
                  };
                  
                  const leafItems = collectLeafItems();
                  if (leafItems.length === 0 && editorType !== "image-with-style-picker") return null;
                  
                  const lastSegmentLabel = arraySegments[arraySegments.length - 1].split(".").pop() || "";
                  
                  const updateNestedField = (nestedItem: NestedItem, value: string) => {
                    try {
                      const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
                      if (!parsed || typeof parsed !== "object") return;
                      
                      pushUndoState(yamlContent);
                      
                      let current: unknown = parsed;
                      for (let i = 0; i < nestedItem.parentPath.length; i++) {
                        const segParts = nestedItem.parentPath[i].split(".");
                        for (const part of segParts) {
                          if (!current || typeof current !== "object") return;
                          current = (current as Record<string, unknown>)[part];
                        }
                        if (!Array.isArray(current)) return;
                        current = current[nestedItem.parentIndices[i]];
                      }
                      
                      if (!current || typeof current !== "object") return;
                      (current as Record<string, unknown>)[itemField] = value;
                      
                      const newYaml = safeYamlDump(parsed, { lineWidth: -1, noRefs: true, quotingType: '"' });
                      setYamlContent(newYaml);
                      setHasChanges(true);
                      setParseError(null);
                      if (onPreviewChange) onPreviewChange(parsed as Section);
                    } catch (error) {
                      console.error("Error updating nested array item:", error);
                    }
                  };
                  
                  if (editorType === "icon-picker") {
                    const groupedByParent: Record<string, NestedItem[]> = {};
                    leafItems.forEach((leaf) => {
                      const topLabel = leaf.parentLabel.split(" > ")[0] || "Items";
                      if (!groupedByParent[topLabel]) groupedByParent[topLabel] = [];
                      groupedByParent[topLabel].push(leaf);
                    });
                    
                    return (
                      <div key={fieldPath} className="space-y-3">
                        <Label className="text-sm font-medium capitalize">
                          {lastSegmentLabel} Icons
                        </Label>
                        {Object.entries(groupedByParent).map(([groupLabel, items]) => (
                          <div key={groupLabel} className="space-y-1">
                            <span className="text-xs text-muted-foreground">{groupLabel}</span>
                            <div className="flex flex-wrap gap-2">
                              {items.map((leaf, idx) => {
                                const currentValue = (leaf.item[itemField] as string) || "";
                                const leafLabel = leaf.parentLabel.split(" > ").slice(1).join(" > ") || `Item ${idx + 1}`;
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      setIconPickerTarget({
                                        arrayField: "__nested__",
                                        index: 0,
                                        field: itemField,
                                        label: leaf.parentLabel,
                                        currentIcon: currentValue,
                                      });
                                      setNestedUpdateFn(() => (value: string) => updateNestedField(leaf, value));
                                      setIconPickerOpen(true);
                                    }}
                                    className="flex items-center justify-center w-10 h-10 rounded border bg-muted/30 hover:bg-muted transition-colors"
                                    data-testid={`props-icon-${lastSegmentLabel}-nested-${idx}`}
                                    title={`${leafLabel}: ${currentValue || "no icon"}`}
                                  >
                                    {renderIconByName(currentValue)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  
                  if (editorType === "color-picker") {
                    const colorType = (variant as ColorPickerVariant) || "accent";
                    return (
                      <div key={fieldPath} className="space-y-3">
                        <Label className="text-sm font-medium capitalize">
                          {lastSegmentLabel} Colors
                        </Label>
                        <div className="space-y-2">
                          {leafItems.map((leaf, idx) => {
                            const currentValue = (leaf.item[itemField] as string) || "";
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground min-w-[80px] truncate">
                                  {leaf.parentLabel}
                                </span>
                                <ColorPicker
                                  value={currentValue}
                                  onChange={(value) => updateNestedField(leaf, value)}
                                  type={colorType}
                                  label=" "
                                  allowNone={true}
                                  allowCustom={true}
                                  testIdPrefix={`props-color-nested-${idx}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (editorType === "image-picker") {
                    const groupedByParent: Record<string, NestedItem[]> = {};
                    leafItems.forEach((leaf) => {
                      const topLabel = leaf.parentLabel.split(" > ")[0] || "Items";
                      if (!groupedByParent[topLabel]) groupedByParent[topLabel] = [];
                      groupedByParent[topLabel].push(leaf);
                    });

                    return (
                      <div key={fieldPath} className="space-y-3">
                        <Label className="text-sm font-medium capitalize">
                          {lastSegmentLabel.replace(/_/g, " ")}
                        </Label>
                        {Object.entries(groupedByParent).map(([groupLabel, items]) => (
                          <div key={groupLabel} className="space-y-1">
                            <span className="text-xs text-muted-foreground">{groupLabel}</span>
                            <div className="flex flex-wrap gap-2">
                              {items.map((leaf, idx) => {
                                const currentValue = (leaf.item[itemField] as string) || "";
                                const altValue = (leaf.item.alt as string) || "";
                                const displaySrc = imageRegistry?.images?.[currentValue]?.src || currentValue;
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      setImagePickerTarget({
                                        arrayPath: "__nested__",
                                        index: 0,
                                        srcField: itemField,
                                        currentSrc: currentValue,
                                        currentAlt: altValue,
                                        tagFilter: variant,
                                      });
                                      setNestedUpdateFn(() => (value: string) => updateNestedField(leaf, value));
                                      setImagePickerOpen(true);
                                    }}
                                    className="w-12 h-12 rounded-md overflow-hidden bg-muted border border-border hover:border-primary transition-colors flex-shrink-0"
                                    data-testid={`props-image-${lastSegmentLabel}-nested-${idx}`}
                                    title={altValue || `Image ${idx + 1}`}
                                  >
                                    {currentValue ? (
                                      <img
                                        src={displaySrc}
                                        alt={altValue || `Image ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                        ?
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  
                  return null;
                }
                
                // Handle simple field paths with rich-text (e.g., "subtitle", "description")
                if (isSimpleField && editorType === "rich-text-editor") {
                  const getSimpleFieldValue = () => {
                    if (!parsedSection) return "";
                    const pathParts = fieldPath.split(".");
                    let current: unknown = parsedSection;
                    for (const part of pathParts) {
                      if (!current || typeof current !== "object") return "";
                      current = (current as Record<string, unknown>)[part];
                    }
                    return (current as string) || "";
                  };
                  const currentValue = getSimpleFieldValue();
                  const fieldLabel = fieldPath.split(".").pop() || fieldPath;
                  return (
                    <div key={fieldPath} className="space-y-2">
                      <Label className="text-sm font-medium capitalize">
                        {fieldLabel.replace(/_/g, " ")}
                      </Label>
                      <RichTextArea
                        key={`${sectionIndex}-${fieldPath}`}
                        value={currentValue}
                        onChange={(html) => updateProperty(fieldPath, html)}
                        placeholder={`Edit ${fieldLabel.replace(/_/g, " ")}…`}
                        minHeight="120px"
                        locale={locale}
                        data-testid={`props-rich-text-${fieldLabel}`}
                      />
                    </div>
                  );
                }

                // Handle simple field paths with markdown editor (e.g., "content")
                if (isSimpleField && editorType === "markdown") {
                  const getSimpleFieldValue = () => {
                    if (!parsedSection) return "";
                    const pathParts = fieldPath.split(".");
                    let current: unknown = parsedSection;
                    for (const part of pathParts) {
                      if (!current || typeof current !== "object") return "";
                      current = (current as Record<string, unknown>)[part];
                    }
                    return (current as string) || "";
                  };
                  const currentValue = getSimpleFieldValue();
                  const fieldLabel = fieldPath.split(".").pop() || fieldPath;
                  return (
                    <div key={fieldPath} className="space-y-2">
                      <MarkdownEditorField
                        key={`${sectionIndex}-${fieldPath}`}
                        value={currentValue}
                        onChange={(md) => updateProperty(fieldPath, md)}
                        label={fieldLabel.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        data-testid={`props-markdown-${fieldLabel}`}
                      />
                    </div>
                  );
                }

                // Handle simple field paths with boolean toggle (e.g., "layout_reversed")
                if (isSimpleField && editorType === "boolean-toggle") {
                  const getSimpleFieldValue = () => {
                    if (!parsedSection) return false;
                    const pathParts = fieldPath.split(".");
                    let current: unknown = parsedSection;
                    for (const part of pathParts) {
                      if (!current || typeof current !== "object") return false;
                      current = (current as Record<string, unknown>)[part];
                    }
                    return current === true || current === "true";
                  };
                  const currentValue = getSimpleFieldValue();
                  const fieldLabel = fieldPath.split(".").pop() || fieldPath;
                  return (
                    <div key={fieldPath} className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Label className="text-sm font-medium capitalize">
                          {fieldLabel.replace(/_/g, " ")}
                        </Label>
                        <Switch
                          checked={currentValue}
                          onCheckedChange={(checked) => updatePropertyWithValue(fieldPath, checked)}
                          data-testid={`props-toggle-${fieldLabel}`}
                        />
                      </div>
                    </div>
                  );
                }


                // Parse field path like "features[].icon" or "signup_card.features[].icon"
                // Matches: optional.nested.path.arrayName[].fieldName
                const match = fieldPath.match(/^([\w.]+)\[\]\.(\w+)$/);
                if (!match) return null;

                const [, arrayPath, itemField] = match;
                
                const getArrayData = () => {
                  if (!parsedSection) return undefined;
                  const pathParts = arrayPath.split(".");
                  let current: Record<string, unknown> = parsedSection as Record<string, unknown>;
                  
                  for (const part of pathParts) {
                    if (!current || typeof current !== "object") return undefined;
                    current = current[part] as Record<string, unknown>;
                  }
                  
                  return current as unknown as Record<string, unknown>[] | undefined;
                };
                
                const arrayData = getArrayData();
                
                if (arrayData === undefined && editorType !== "image-with-style-picker") return null;
                
                const safeArrayData = Array.isArray(arrayData) ? arrayData : [];
                
                const arrayFieldLabel = arrayPath.split(".").pop() || arrayPath;

                if (editorType === "icon-picker") {
                  return (
                    <div key={fieldPath} className="space-y-2">
                      <Label className="text-sm font-medium capitalize">
                        {arrayFieldLabel} Icons
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {safeArrayData.map((item, index) => {
                          const currentValue =
                            (item[itemField] as string) || "";
                          const itemLabel =
                            (item.tab_label as string) ||
                            (item.title as string) ||
                            (item.label as string) ||
                            (item.name as string) ||
                            `Item ${index + 1}`;

                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                setIconPickerTarget({
                                  arrayField: arrayPath,
                                  index,
                                  field: itemField,
                                  label: itemLabel,
                                  currentIcon: currentValue,
                                });
                                setIconPickerOpen(true);
                              }}
                              className="flex items-center justify-center w-10 h-10 rounded border bg-muted/30 hover:bg-muted transition-colors"
                              data-testid={`props-icon-${arrayFieldLabel}-${index}`}
                              title={`${itemLabel}: ${currentValue || "no icon"}`}
                            >
                              {renderIconByName(currentValue)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if (editorType === "color-picker") {
                  const colorType = (variant as ColorPickerVariant) || "accent";

                  return (
                    <div key={fieldPath} className="space-y-3">
                      <Label className="text-sm font-medium capitalize">
                        {arrayFieldLabel} Colors
                      </Label>
                      <div className="space-y-2">
                        {safeArrayData.map((item, index) => {
                          const currentValue =
                            (item[itemField] as string) || "";
                          const itemLabel =
                            (item.tab_label as string) ||
                            (item.title as string) ||
                            (item.label as string) ||
                            (item.name as string) ||
                            `Item ${index + 1}`;

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-2"
                            >
                              <span className="text-sm text-muted-foreground min-w-[80px] truncate">
                                {itemLabel}
                              </span>
                              <ColorPicker
                                value={currentValue}
                                onChange={(value) =>
                                  updateArrayItemField(
                                    arrayPath,
                                    index,
                                    itemField,
                                    value,
                                  )
                                }
                                type={colorType}
                                label=" "
                                allowNone={true}
                                allowCustom={true}
                                testIdPrefix={`props-color-${arrayFieldLabel}-${index}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if (editorType === "image-picker") {
                  // Check if this is a logo picker for items with logoHeight (works for hero marquee, awards_marquee, etc.)
                  // Detects if items have "logo" field and any item has "logoHeight" defined
                  const isLogoMarquee = itemField === "logo" && 
                    safeArrayData.some((item) => "logoHeight" in item || "logo" in item);
                  
                  if (isLogoMarquee) {
                    // Use collapsible sections for logo marquee items
                    return (
                      <div key={fieldPath} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">
                            Marquee Logos ({safeArrayData.length})
                          </Label>
                        </div>
                        <div className="space-y-2">
                          {safeArrayData.map((item, index) => {
                            const currentValue = (item[itemField] as string) || "";
                            const altValue = (item.alt as string) || "";
                            const logoHeight = (item.logoHeight as string) || "";
                            const displaySrc = imageRegistry?.images?.[currentValue]?.src || currentValue;

                            return (
                              <Collapsible key={index} className="border rounded-md">
                                <CollapsibleTrigger asChild>
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                                    data-testid={`props-logo-marquee-${index}-trigger`}
                                  >
                                    <div className="w-10 h-10 rounded-md overflow-hidden bg-muted border flex-shrink-0">
                                      {currentValue ? (
                                        <img
                                          src={displaySrc}
                                          alt={altValue || `Logo ${index + 1}`}
                                          className="w-full h-full object-contain p-1"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <IconPhoto className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                      )}
                                    </div>
                                    <span className="flex-1 text-left text-sm font-medium">
                                      {altValue || `Logo ${index + 1}`}
                                    </span>
                                    <IconChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                  </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="p-3 pt-0 space-y-3 border-t">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setImagePickerTarget({
                                            arrayPath,
                                            index,
                                            srcField: itemField,
                                            currentSrc: currentValue,
                                            currentAlt: altValue,
                                            tagFilter: "logo",
                                          });
                                          setImagePickerOpen(true);
                                        }}
                                        className="relative w-16 h-16 rounded-md border border-input bg-muted/50 hover:bg-muted transition-colors overflow-hidden group"
                                        data-testid={`props-logo-marquee-${index}-picker`}
                                        title="Change logo"
                                      >
                                        {currentValue ? (
                                          <>
                                            <img
                                              src={displaySrc}
                                              alt={altValue}
                                              className="w-full h-full object-contain p-1"
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
                                      <div className="flex-1 space-y-1">
                                        <Label className="text-xs text-muted-foreground">Alt text</Label>
                                        <Input
                                          value={altValue}
                                          onChange={(e) => updateArrayItemField(arrayPath, index, "alt", e.target.value)}
                                          placeholder="Logo description"
                                          className="h-8 text-sm"
                                          data-testid={`props-logo-marquee-${index}-alt`}
                                        />
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeArrayItem(arrayPath, index)}
                                        className="text-muted-foreground hover:text-destructive"
                                        data-testid={`props-logo-marquee-${index}-delete`}
                                        title="Remove logo"
                                      >
                                        <IconTrash className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">Logo Height (CSS classes)</Label>
                                      <Input
                                        value={logoHeight}
                                        onChange={(e) => updateArrayItemField(arrayPath, index, "logoHeight", e.target.value)}
                                        placeholder="h-10 md:h-14"
                                        className="h-8 text-sm"
                                        data-testid={`props-logo-marquee-${index}-height`}
                                      />
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const defaultItem: Record<string, unknown> = {
                                id: "",
                                [itemField]: "",
                                alt: "",
                                logoHeight: "56px",
                              };
                              addArrayItem(arrayPath, defaultItem);
                            }}
                            className="w-full"
                            data-testid="props-logo-marquee-add"
                          >
                            <IconPlus className="h-4 w-4 mr-1" />
                            Add Logo
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  
                  // Default image-picker behavior (simple thumbnails)
                  return (
                    <div key={fieldPath} className="space-y-2">
                      <Label className="text-sm font-medium capitalize">
                        {arrayFieldLabel.replace(/_/g, " ")}
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {safeArrayData.map((item, index) => {
                          const currentValue =
                            (item[itemField] as string) || "";
                          const altValue = (item.alt as string) || "";
                          // For ID fields, look up the actual src from registry
                          const displaySrc = imageRegistry?.images?.[currentValue]?.src || currentValue;

                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                setImagePickerTarget({
                                  arrayPath,
                                  index,
                                  srcField: itemField,
                                  currentSrc: currentValue,
                                  currentAlt: altValue,
                                  tagFilter: variant, // e.g., "logo" from "image-picker:logo"
                                });
                                setImagePickerOpen(true);
                              }}
                              className="w-12 h-12 rounded-md overflow-hidden bg-muted border border-border hover:border-primary transition-colors flex-shrink-0 relative group"
                              data-testid={`props-image-${arrayFieldLabel}-${index}`}
                              title={altValue || `Image ${index + 1}`}
                            >
                              {currentValue ? (
                                <img
                                  src={displaySrc}
                                  alt={altValue || `Image ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                  ?
                                </div>
                              )}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            const defaultItem: Record<string, unknown> = {
                              [itemField]: "",
                              alt: "",
                            };
                            addArrayItem(arrayPath, defaultItem);
                          }}
                          className="w-12 h-12 rounded-md border border-dashed border-muted-foreground/50 bg-transparent hover:bg-muted/30 hover:border-muted-foreground transition-colors flex items-center justify-center"
                          data-testid={`props-image-${arrayFieldLabel}-add`}
                          title="Add image"
                        >
                          <IconPlus className="h-5 w-5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  );
                }

                if (editorType === "rich-text-editor") {
                  return (
                    <div key={fieldPath} className="space-y-3">
                      <Label className="text-sm font-medium capitalize">
                        {arrayFieldLabel} Text
                      </Label>
                      <div className="space-y-2">
                        {safeArrayData.map((item, index) => {
                          const currentValue =
                            (item[itemField] as string) || "";
                          const itemLabel =
                            (item.tab_label as string) ||
                            (item.title as string) ||
                            (item.label as string) ||
                            (item.name as string) ||
                            `Item ${index + 1}`;

                          return (
                            <div key={index} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                {itemLabel}
                              </Label>
                              <RichTextArea
                                key={`${sectionIndex}-${arrayPath}-${index}-${itemField}`}
                                value={currentValue}
                                onChange={(html) =>
                                  updateArrayItemField(arrayPath, index, itemField, html)
                                }
                                placeholder={`Edit ${itemLabel}…`}
                                minHeight="80px"
                                locale={locale}
                                data-testid={`props-richtext-${arrayFieldLabel}-${index}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if (editorType === "image-with-style-picker") {
                  const MAX_IMAGES = 4;
                  const hasImages = safeArrayData.length > 0;
                  
                  // Detect if this is a "tabs" array (bullet_tabs_showcase) which has limited styling options
                  // vs a regular "images" array which has full styling options
                  const isTabsArray = arrayPath === "tabs" || arrayPath.endsWith(".tabs");
                  
                  // For tabs: use image_object_fit/image_object_position (schema naming)
                  // For images: use object_fit/object_position
                  const objectFitField = isTabsArray ? "image_object_fit" : "object_fit";
                  const objectPositionField = isTabsArray ? "image_object_position" : "object_position";
                  
                  const initializeDefaultImages = () => {
                    const defaultImages = [
                      { src: "", alt: "Student 1", object_fit: "cover", object_position: "center top", border_radius: "0.5rem" },
                      { src: "", alt: "Student 2", object_fit: "cover", object_position: "center top", border_radius: "0.5rem" },
                      { src: "", alt: "Student 3", object_fit: "cover", object_position: "center top", border_radius: "0.5rem" },
                      { src: "", alt: "Student 4", object_fit: "cover", object_position: "center top", border_radius: "0.5rem" },
                    ];
                    updateArrayField(arrayPath, defaultImages);
                  };

                  return (
                    <div key={fieldPath} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          {isTabsArray ? `Imágenes de Tabs (${safeArrayData.length})` : `Imágenes (${safeArrayData.length}/${MAX_IMAGES})`}
                        </Label>
                        {!hasImages && !isTabsArray && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={initializeDefaultImages}
                            data-testid="props-image-style-init"
                          >
                            <IconPlus className="h-4 w-4 mr-1" />
                            Inicializar imágenes
                          </Button>
                        )}
                      </div>
                      
                      {!hasImages && !isTabsArray && (
                        <div className="p-4 border border-dashed rounded-md text-center text-sm text-muted-foreground">
                          <IconPhoto className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Este componente usa imágenes por defecto.</p>
                          <p>Haz clic en "Inicializar imágenes" para personalizarlas.</p>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        {safeArrayData.map((item, index) => {
                          const currentSrc = (item[itemField] as string) || "";
                          const currentAlt = (item.alt as string) || "";
                          const displaySrc = imageRegistry?.images?.[currentSrc]?.src || currentSrc;

                          return (
                            <Collapsible key={index} className="border rounded-md">
                              <CollapsibleTrigger asChild>
                                <button
                                  type="button"
                                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                                  data-testid={`props-image-style-${index}-trigger`}
                                >
                                  <div className="w-10 h-10 rounded-md overflow-hidden bg-muted border flex-shrink-0">
                                    {currentSrc ? (
                                      <img
                                        src={displaySrc}
                                        alt={currentAlt || `Imagen ${index + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <IconPhoto className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                  <span className="flex-1 text-left text-sm font-medium">
                                    Imagen {index + 1}
                                  </span>
                                  <IconChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="p-3 pt-0 space-y-3 border-t">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setImagePickerTarget({
                                          arrayPath,
                                          index,
                                          srcField: itemField,
                                          currentSrc,
                                          currentAlt,
                                          tagFilter: variant,
                                        });
                                        setImagePickerOpen(true);
                                      }}
                                      className="relative w-16 h-16 rounded-md border border-input bg-muted/50 hover:bg-muted transition-colors overflow-hidden group"
                                      data-testid={`props-image-style-${index}-picker`}
                                      title="Cambiar imagen"
                                    >
                                      {currentSrc ? (
                                        <>
                                          <img
                                            src={displaySrc}
                                            alt={currentAlt}
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
                                    <div className="flex-1 space-y-1">
                                      <Label className="text-xs text-muted-foreground">Alt text</Label>
                                      <Input
                                        value={currentAlt}
                                        onChange={(e) => updateArrayItemField(arrayPath, index, "alt", e.target.value)}
                                        placeholder="Descripción de la imagen"
                                        className="h-8 text-sm"
                                        data-testid={`props-image-style-${index}-alt`}
                                      />
                                    </div>
                                    {!isTabsArray && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeArrayItem(arrayPath, index)}
                                        className="text-muted-foreground hover:text-destructive"
                                        data-testid={`props-image-style-${index}-delete`}
                                        title="Eliminar imagen"
                                      >
                                        <IconTrash className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">Object Fit</Label>
                                      <Select
                                        value={(item[objectFitField] as string) || "cover"}
                                        onValueChange={(value) => updateArrayItemField(arrayPath, index, objectFitField, value)}
                                      >
                                        <SelectTrigger className="h-8 text-sm" data-testid={`props-image-style-${index}-object-fit`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="cover">Cover</SelectItem>
                                          <SelectItem value="contain">Contain</SelectItem>
                                          <SelectItem value="fill">Fill</SelectItem>
                                          <SelectItem value="none">None</SelectItem>
                                          <SelectItem value="scale-down">Scale Down</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">Object Position</Label>
                                      <Input
                                        value={(item[objectPositionField] as string) ?? ""}
                                        onChange={(e) => updateArrayItemField(arrayPath, index, objectPositionField, e.target.value)}
                                        placeholder="center top"
                                        className="h-8 text-sm"
                                        data-testid={`props-image-style-${index}-object-position`}
                                      />
                                    </div>

                                    {!isTabsArray && (
                                      <>
                                        <div className="space-y-1">
                                          <Label className="text-xs text-muted-foreground">Border Radius</Label>
                                          <Input
                                            value={(item.border_radius as string) ?? ""}
                                            onChange={(e) => updateArrayItemField(arrayPath, index, "border_radius", e.target.value)}
                                            placeholder="0.5rem"
                                            className="h-8 text-sm"
                                            data-testid={`props-image-style-${index}-border-radius`}
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <Label className="text-xs text-muted-foreground">Opacidad</Label>
                                          <Input
                                            type="number"
                                            min={0}
                                            max={1}
                                            step={0.1}
                                            value={(item.opacity as number) ?? 1}
                                            onChange={(e) => updateArrayItemField(arrayPath, index, "opacity", parseFloat(e.target.value) || 1)}
                                            placeholder="1"
                                            className="h-8 text-sm"
                                            data-testid={`props-image-style-${index}-opacity`}
                                          />
                                        </div>
                                      </>
                                    )}
                                  </div>

                                  {!isTabsArray && (
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">CSS Filter</Label>
                                        <Input
                                          value={(item.filter as string) || ""}
                                          onChange={(e) => updateArrayItemField(arrayPath, index, "filter", e.target.value)}
                                          placeholder="grayscale(50%)"
                                          className="h-8 text-sm"
                                          data-testid={`props-image-style-${index}-filter`}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Altura</Label>
                                        <Input
                                          value={(item.height as string) || ""}
                                          onChange={(e) => updateArrayItemField(arrayPath, index, "height", e.target.value)}
                                          placeholder="400px, 20rem..."
                                          className="h-8 text-sm"
                                          data-testid={`props-image-style-${index}-height`}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}

                        {!isTabsArray && safeArrayData.length > 0 && safeArrayData.length < MAX_IMAGES && (
                          <button
                            type="button"
                            onClick={() => {
                              const defaultItem: Record<string, unknown> = {
                                src: "",
                                alt: `Student ${safeArrayData.length + 1}`,
                                object_fit: "cover",
                                object_position: "center top",
                                border_radius: "0.5rem",
                              };
                              addArrayItem(arrayPath, defaultItem);
                            }}
                            className="w-full py-2 rounded-md border border-dashed border-muted-foreground/50 bg-transparent hover:bg-muted/30 hover:border-muted-foreground transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground"
                            data-testid="props-image-style-add"
                            title="Añadir imagen"
                          >
                            <IconPlus className="h-4 w-4" />
                            Añadir imagen ({safeArrayData.length}/{MAX_IMAGES})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                return null;
              },
            )}
          </div>
        </TabsContent>
      </Tabs>

      {parseError && (
        <div className="p-2 bg-destructive/10 text-destructive text-sm border-t">
          {parseError}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t bg-muted/30">
        <div className="text-sm">
          {saveError ? (
            <span className="text-destructive">{saveError}</span>
          ) : hasChanges ? (
            <span className="text-muted-foreground">Unsaved changes</span>
          ) : (
            <span className="text-muted-foreground">No changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel-edit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!!parseError || isSaving}
            data-testid="button-save-section"
          >
            {isSaving ? (
              <>
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <IconDeviceFloppy className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Icon Picker Modal */}
      <IconPickerModal
        open={iconPickerOpen}
        onOpenChange={setIconPickerOpen}
        currentValue={iconPickerTarget?.currentIcon || ""}
        itemLabel={iconPickerTarget?.label}
        onSelect={handleIconSelect}
      />

      {/* Image Picker Modal */}
      <Dialog open={imagePickerOpen} onOpenChange={(open) => {
        setImagePickerOpen(open);
        if (!open) {
          setImageGallerySearch("");
          setImagePickerMode("browse");
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {imagePickerTarget?.tagFilter 
                ? `Select ${imagePickerTarget.tagFilter.charAt(0).toUpperCase() + imagePickerTarget.tagFilter.slice(1)}` 
                : "Select Image"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
            <div className="flex rounded-md border overflow-visible">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={`flex-1 rounded-none toggle-elevate ${imagePickerMode === "browse" ? "toggle-elevated bg-muted" : ""}`}
                onClick={() => setImagePickerMode("browse")}
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
                className={`flex-1 rounded-none toggle-elevate ${imagePickerMode === "upload" ? "toggle-elevated bg-muted" : ""}`}
                onClick={() => setImagePickerMode("upload")}
                data-testid="button-picker-upload"
              >
                <IconUpload className="h-4 w-4 mr-1.5" />
                Upload
              </Button>
            </div>

            {imagePickerMode === "browse" ? (
              <>
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search images..."
                    value={imageGallerySearch}
                    onChange={(e) => setImageGallerySearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-image-gallery-search"
                  />
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="columns-4 sm:columns-5 md:columns-6 gap-2">
                    {filteredGalleryImages.slice(0, visibleImageCount).map(([id, img]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          if (imagePickerTarget) {
                            const fieldName = imagePickerTarget.srcField || imagePickerTarget.fieldPath || "";
                            const isIdField = fieldName.endsWith("_id");
                            setImagePickerTarget({
                              ...imagePickerTarget,
                              currentSrc: isIdField ? id : img.src,
                              currentAlt: img.alt,
                              currentRegistryId: id,
                            });
                          }
                        }}
                        className={`mb-2 rounded-md overflow-hidden bg-muted border-2 transition-colors block w-full ${
                          imagePickerTarget?.currentSrc === img.src || imagePickerTarget?.currentSrc === id
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
                  {visibleImageCount < filteredGalleryImages.length && (
                    <div className="py-3 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleImageCount((prev) => Math.min(prev + 24, filteredGalleryImages.length))}
                        data-testid="button-load-more-images"
                      >
                        Load more ({filteredGalleryImages.length - visibleImageCount} remaining)
                      </Button>
                    </div>
                  )}
                  {filteredGalleryImages.length === 0 && (
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
                        if (e.target.files?.length) handleImageUpload(e.target.files);
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
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        if (e.dataTransfer.files.length) handleImageUpload(e.dataTransfer.files);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="dropzone-upload"
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <IconCloudUpload className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium">Drop an image here or click to browse</p>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG, WebP, SVG, AVIF, GIF (max 10 MB)
                          </p>
                          {hasCloudProvider && mediaStatus?.gcs && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Uploading to {mediaStatus.gcs.bucket}/{mediaStatus.gcs.basePath}
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
                    <p className="text-sm font-medium">No storage provider configured</p>
                    <p className="text-sm text-muted-foreground">
                      Drop images directly into the <code className="bg-muted px-1 rounded text-xs">marketing-content/images/</code> folder,
                      then scan the registry to include them. Or configure a cloud provider in the Media Gallery settings.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Selected image preview and fields */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded-md overflow-hidden bg-muted border flex-shrink-0">
                  {imagePickerTarget?.currentSrc ? (
                    <img
                      src={
                        // If currentSrc is an ID, look up the actual src from registry
                        imageRegistry?.images?.[imagePickerTarget.currentSrc]?.src || imagePickerTarget.currentSrc
                      }
                      alt={imagePickerTarget.currentAlt || "Preview"}
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
                    value={imagePickerTarget?.currentSrc || ""}
                    onChange={(e) => {
                      if (imagePickerTarget) {
                        setImagePickerTarget({
                          ...imagePickerTarget,
                          currentSrc: e.target.value,
                        });
                      }
                    }}
                    placeholder="Image URL"
                    className="text-sm"
                    data-testid="input-image-url"
                  />
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 bg-muted text-muted-foreground text-xs select-none">
                      Alt
                    </span>
                    <Input
                      value={imagePickerTarget?.currentAlt || ""}
                      onChange={(e) => {
                        if (imagePickerTarget) {
                          setImagePickerTarget({
                            ...imagePickerTarget,
                            currentAlt: e.target.value,
                          });
                        }
                      }}
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
              onClick={() => {
                if (imagePickerTarget) {
                  if (nestedUpdateFn) {
                    nestedUpdateFn("");
                    setNestedUpdateFn(null);
                  } else if (imagePickerTarget.fieldPath) {
                    // Simple field - clear the value
                    updateProperty(imagePickerTarget.fieldPath, "");
                  } else if (imagePickerTarget.arrayPath && imagePickerTarget.index !== undefined) {
                    // Array field - remove this item
                    const pathParts = imagePickerTarget.arrayPath.split(".");
                    let current: Record<string, unknown> | null = parsedSection;
                    for (let i = 0; i < pathParts.length - 1 && current; i++) {
                      current = current[pathParts[i]] as Record<string, unknown> | null;
                    }
                    const arrayField = pathParts[pathParts.length - 1];
                    const array = current?.[arrayField] as Record<string, unknown>[] || [];
                    const newArray = [...array];
                    newArray.splice(imagePickerTarget.index, 1);
                    updateArrayField(imagePickerTarget.arrayPath, newArray);
                  }
                }
                setImagePickerOpen(false);
                setImagePickerTarget(null);
              }}
              data-testid="button-image-remove"
            >
              <IconX className="h-4 w-4 mr-2" />
              Remove
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setImagePickerOpen(false);
                  setImagePickerTarget(null);
                }}
                data-testid="button-image-cancel"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (imagePickerTarget) {
                    if (nestedUpdateFn) {
                      nestedUpdateFn(imagePickerTarget.currentSrc);
                      setNestedUpdateFn(null);
                    } else if (imagePickerTarget.fieldPath) {
                      // Simple field - update directly
                      updateProperty(imagePickerTarget.fieldPath, imagePickerTarget.currentSrc);
                    } else if (imagePickerTarget.arrayPath !== undefined && imagePickerTarget.index !== undefined && imagePickerTarget.srcField) {
                      const updates: Record<string, string> = {
                        [imagePickerTarget.srcField]: imagePickerTarget.currentSrc,
                        alt: imagePickerTarget.currentAlt,
                      };
                      if (imagePickerTarget.currentRegistryId) {
                        updates.id = imagePickerTarget.currentRegistryId.replace(/_/g, "-");
                      }
                      updateArrayItemFields(
                        imagePickerTarget.arrayPath,
                        imagePickerTarget.index,
                        updates,
                      );
                    }
                  }
                  setImagePickerOpen(false);
                  setImagePickerTarget(null);
                }}
                data-testid="button-image-save"
              >
                <IconCheck className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
