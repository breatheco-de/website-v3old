import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  IconExternalLink,
  IconLink,
  IconLinkOff,
  IconInfoCircle,
} from "@tabler/icons-react";
import { IconQuestionMark } from "@tabler/icons-react";
import { getIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ColorPicker } from "@/components/ui/color-picker";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { editContent } from "@/lib/contentApi";
import { emitContentUpdated, registerEditorDirtyCheck } from "@/lib/contentEvents";
import {
  parseEditorType,
  type ColorPickerVariant,
  type EditorType,
} from "@/lib/field-editor-registry";
import { IconPickerModal } from "./IconPickerModal";
import { RelatedFeaturesPicker } from "./RelatedFeaturesPicker";
import { TestimonialItemsPreview } from "./TestimonialItemsPreview";
import { TableContentEditor } from "./TableContentEditor";
import { FaqItemsVisibility } from "./FaqItemsVisibility";
import { RichTextArea } from "./RichTextArea";
import { MarkdownEditorField } from "./MarkdownEditorField";
import { SectionBindingDialog } from "./SectionBindingDialog";
import { LinkPicker } from "./LinkPicker";
import { ImageWithStylePicker } from "./ImageWithStylePicker";
import type { Section, SectionLayout, ImageRegistry } from "@shared/schema";
import { locations as allLocations, getLocationBySlug } from "@/lib/locations";
import type { Location } from "@shared/session";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconSearch, IconUpload, IconCloudUpload, IconVideo } from "@tabler/icons-react";
import CodeMirror from "@uiw/react-codemirror";
import type { EditorView } from "@codemirror/view";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";
import { variableHighlightPlugin } from "@/lib/cm-variable-highlight";
import * as yamlParser from "js-yaml";
import {
  escapeTemplateVars,
  escapeObjectVars,
  unescapeObjectVars,
  unescapeYamlDump,
} from "@shared/templateVars";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import ReactCrop from "react-image-crop";
import type { Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

function safeYamlLoad(yamlStr: string): unknown {
  const { escaped, map } = escapeTemplateVars(yamlStr);
  const parsed = yamlParser.load(escaped);
  return unescapeObjectVars(parsed, map);
}

function safeYamlDump(obj: unknown, opts?: yamlParser.DumpOptions): string {
  const { escaped, map } = escapeObjectVars(obj);
  const dumped = yamlParser.dump(escaped, opts);
  return unescapeYamlDump(dumped, map);
}

function stripTransientDynamicKeys(section: unknown): unknown {
  if (!section || typeof section !== "object") return section;
  const sec = section as Record<string, unknown>;
  if (!sec.dynamic_entries) return section;
  const { items: _items, _dynamic_meta: _meta, ...authored } = sec;
  return authored;
}
import { usePageHistoryOptional } from "@/contexts/PageHistoryContext";
import { useImagePickerContext } from "@/contexts/ImagePickerContext";
import type { ImagePickerTarget } from "@/contexts/ImagePickerContext";

const TECHNICAL_SUFFIXES = new Set(["src", "url", "id", "href"]);
const POSITIONAL_LABELS: Record<string, string> = {
  left: "Izquierda",
  right: "Derecha",
};
const ACRONYMS = new Set(["url", "cta", "id", "api", "seo"]);

function getFieldLabel(fieldPath: string): string {
  const segments = fieldPath.split(".");
  const filtered = segments.filter(
    (s) => !TECHNICAL_SUFFIXES.has(s.toLowerCase()),
  );
  const meaningful = filtered.length > 0 ? filtered : segments;

  const positionalIdx = meaningful.findIndex(
    (s) => s.toLowerCase() in POSITIONAL_LABELS,
  );
  let suffix = "";
  if (positionalIdx !== -1) {
    suffix = ` ${POSITIONAL_LABELS[meaningful[positionalIdx].toLowerCase()]}`;
    meaningful.splice(positionalIdx, 1);
  }

  const label = meaningful
    .map((s) => s.replace(/_/g, " "))
    .join(" ")
    .split(" ")
    .map((w) =>
      ACRONYMS.has(w.toLowerCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");

  return (label + suffix).trim() || fieldPath;
}

interface SectionEditorPanelProps {
  section: Section;
  sectionIndex: number;
  contentType?: string;
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
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

interface ShowOnLocationsPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
}

function ShowOnLocationsPicker({
  value,
  onChange,
}: ShowOnLocationsPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const hasLocations = value.length > 0;

  const grouped = useMemo(() => {
    const groups: Record<string, Location[]> = {};
    const searchLower = search.toLowerCase();
    for (const loc of allLocations) {
      if (loc.visibility !== "listed") continue;
      if (
        searchLower &&
        !loc.name.toLowerCase().includes(searchLower) &&
        !loc.country.toLowerCase().includes(searchLower) &&
        !loc.slug.toLowerCase().includes(searchLower)
      )
        continue;
      const region = loc.region;
      if (!groups[region]) groups[region] = [];
      groups[region].push(loc);
    }
    return groups;
  }, [search]);

  const regionLabels: Record<string, string> = {
    "usa-canada": "USA & Canada",
    latam: "Latin America",
    europe: "Europe",
    online: "Online",
  };

  const toggleLocation = (slug: string) => {
    if (value.includes(slug)) {
      onChange(value.filter((s) => s !== slug));
    } else {
      onChange([...value, slug]);
    }
  };

  const removeLocation = (slug: string) => {
    onChange(value.filter((s) => s !== slug));
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
                            isSelected
                              ? "bg-primary/10 text-foreground"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                          data-testid={`button-location-toggle-${loc.slug}`}
                        >
                          <span className="text-base leading-none">
                            {countryCodeToFlag(loc.country_code)}
                          </span>
                          <span className="flex-1 text-left truncate">
                            {loc.name}, {loc.country}
                          </span>
                          {isSelected && (
                            <IconCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {Object.keys(grouped).length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No locations found
                  </div>
                )}
              </div>
            </ScrollArea>
            {hasLocations && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive"
                  onClick={() => {
                    onChange([]);
                    setOpen(false);
                  }}
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
                <span className="text-xs leading-none">
                  {countryCodeToFlag(loc.country_code)}
                </span>
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
  options: { id: string; label: string; preview?: () => JSX.Element }[];
  label?: string;
}

function VariantPicker({
  value,
  onChange,
  options,
  label = "Variant",
}: VariantPickerProps) {
  const currentValue = value || options[0]?.id || "";
  const hasPreview = options.some((o) => o.preview);

  if (hasPreview) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="grid grid-cols-2 gap-2">
          {options.map((option) => {
            const isSelected = currentValue === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange(option.id)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-md border-2 transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
                data-testid={`props-variant-${option.id}`}
              >
                {option.preview && (
                  <div className="w-full pointer-events-none">
                    {option.preview()}
                  </div>
                )}
                <span className={`text-xs font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

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

function TableVariantPreview({ variant }: { variant: string }) {
  const rows = [0, 1, 2];
  if (variant === "default") {
    return (
      <div className="rounded border overflow-hidden">
        <div className="flex bg-muted/50 border-b">
          <div className="flex-1 h-2 m-1.5 rounded bg-muted-foreground/20" />
          <div className="flex-1 h-2 m-1.5 rounded bg-muted-foreground/20" />
          <div className="flex-1 h-2 m-1.5 rounded bg-muted-foreground/20" />
        </div>
        {rows.map((i) => (
          <div key={i} className="flex border-b last:border-0">
            <div className="flex-1 h-2 m-1.5 rounded bg-muted-foreground/10" />
            <div className="flex-1 h-2 m-1.5 rounded bg-muted-foreground/10" />
            <div className="flex-1 h-2 m-1.5 rounded bg-muted-foreground/10" />
          </div>
        ))}
      </div>
    );
  }
  if (variant === "striped") {
    return (
      <div className="rounded border overflow-hidden">
        <div className="flex bg-primary">
          <div className="flex-1 h-2 m-1.5 rounded bg-primary-foreground/30" />
          <div className="flex-1 h-2 m-1.5 rounded bg-primary-foreground/30" />
          <div className="flex-1 h-2 m-1.5 rounded bg-primary-foreground/30" />
        </div>
        {rows.map((i) => (
          <div key={i} className={`flex ${i % 2 === 1 ? "bg-muted/30" : ""}`}>
            <div className="flex-1 h-2 m-1.5 rounded bg-muted-foreground/10" />
            <div className="flex-1 h-2 m-1.5 rounded bg-muted-foreground/10" />
            <div className="flex-1 h-2 m-1.5 rounded bg-muted-foreground/10" />
          </div>
        ))}
      </div>
    );
  }
  if (variant === "cards") {
    return (
      <div className="flex flex-col gap-1">
        {rows.map((i) => (
          <div key={i} className="rounded border p-1.5 space-y-1">
            <div className="flex justify-between gap-2">
              <div className="w-8 h-1.5 rounded bg-muted-foreground/20" />
              <div className="w-12 h-1.5 rounded bg-muted-foreground/10" />
            </div>
            <div className="flex justify-between gap-2">
              <div className="w-6 h-1.5 rounded bg-muted-foreground/20" />
              <div className="w-10 h-1.5 rounded bg-muted-foreground/10" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (variant === "comparison") {
    return (
      <div className="rounded-lg overflow-hidden shadow-sm ring-1 ring-black/5">
        <div className="flex bg-primary">
          <div className="flex-1 h-2.5 m-1 rounded bg-primary-foreground/30" />
          <div className="flex-1 h-2.5 m-1 rounded bg-primary-foreground/30" />
          <div className="flex-1 h-2.5 m-1 rounded bg-primary-foreground/30" />
        </div>
        {rows.map((i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "" : "bg-primary/5"}`}>
            <div className="flex-1 h-2 m-1 rounded bg-muted-foreground/10" />
            <div className="flex-1 h-2 m-1 rounded bg-muted-foreground/15" />
            <div className="flex-1 h-2 m-1 rounded bg-muted-foreground/10" />
          </div>
        ))}
      </div>
    );
  }
  return null;
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

  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;
  useEffect(() => {
    registerEditorDirtyCheck(() => hasChangesRef.current);
    return () => registerEditorDirtyCheck(null);
  }, []);

  // Binding state
  const bindingQueryClient = useQueryClient();
  const [bindingDialogOpen, setBindingDialogOpen] = useState(false);
  const [bindingConfirmOpen, setBindingConfirmOpen] = useState(false);

  const sectionComponentType = (section as Record<string, unknown>)?.type as string || "";

  const { data: bindingData, refetch: refetchBinding } = useQuery({
    queryKey: ["/api/bindings/section", contentType, slug, sectionIndex, locale],
    queryFn: async () => {
      if (!contentType || !slug) return { group: null };
      const res = await fetch(`/api/bindings/section?contentType=${contentType}&slug=${slug}&sectionIndex=${sectionIndex}&locale=${locale || ""}`);
      return res.json();
    },
    enabled: !!contentType && !!slug,
  });

  const bindingGroup = bindingData?.group as {
    id: string;
    name?: string;
    component: string;
    locale: string;
    members: Array<{ contentType: string; slug: string; sectionIndex: number }>;
  } | null;

  const boundSiblings = useMemo(() => {
    if (!bindingGroup) return [];
    return bindingGroup.members.filter(
      m => !(m.contentType === contentType && m.slug === slug && m.sectionIndex === sectionIndex)
    );
  }, [bindingGroup, contentType, slug, sectionIndex]);

  // Icon picker state
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<{
    arrayField: string;
    index: number;
    field: string;
    label: string;
    currentIcon: string;
  } | null>(null);
  const [nestedUpdateFn, setNestedUpdateFn] = useState<
    ((value: string) => void) | null
  >(null);

  // Image picker modal state
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<ImagePickerTarget | null>(null);
  const [imageGallerySearch, setImageGallerySearch] = useState("");
  const [visibleImageCount, setVisibleImageCount] = useState(48);
  const [tableEditorMode, setTableEditorMode] = useState<
    "content" | "filter" | null
  >(null);
  const [imagePickerMode, setImagePickerMode] = useState<"browse" | "upload">(
    "browse",
  );
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Register this panel's image picker into the global ImagePickerContext
  const imagePickerCtx = useImagePickerContext();
  const setImagePickerOpenRef = useRef(setImagePickerOpen);
  const setImagePickerTargetRef = useRef(setImagePickerTarget);
  setImagePickerOpenRef.current = setImagePickerOpen;
  setImagePickerTargetRef.current = setImagePickerTarget;
  useEffect(() => {
    if (!imagePickerCtx) return;
    imagePickerCtx.registerPicker({
      openPicker: (target: ImagePickerTarget) => {
        setImagePickerTargetRef.current(target);
        setImagePickerOpenRef.current(true);
      },
    });
    return () => {
      imagePickerCtx.registerPicker(null);
    };
  }, [imagePickerCtx]);

  // Crop panel state
  const [cropPanelOpen, setCropPanelOpen] = useState(false);
  const [cropState, setCropState] = useState<Crop>({ unit: "%", x: 0, y: 0, width: 100, height: 100 });
  const [cropTargetWidth, setCropTargetWidth] = useState(800);
  const [cropTargetHeight, setCropTargetHeight] = useState(600);
  const [cropAspectLock, setCropAspectLock] = useState(false);
  const [cropQuality, setCropQuality] = useState(85);
  const [cropProcessing, setCropProcessing] = useState(false);

  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [videoPickerTarget, setVideoPickerTarget] = useState<{
    fieldPath?: string;
    label?: string;
    currentUrl: string;
    arrayPath?: string;
    index?: number;
    field?: string;
  } | null>(null);
  const [videoPickerMode, setVideoPickerMode] = useState<"browse" | "upload" | "url">("url");
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoDragOver, setVideoDragOver] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [videoGallerySearch, setVideoGallerySearch] = useState("");
  const [visibleVideoCount, setVisibleVideoCount] = useState(48);
  const editorViewRef = useRef<EditorView | null>(null);

  const handleUndoRedoRestore = useCallback(
    (content: string) => {
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
    },
    [onPreviewChange],
  );

  const {
    pushState: pushUndoState,
    canUndo,
    canRedo,
    undo,
    redo,
    clear: clearUndoHistory,
  } = useUndoRedo(yamlContent, handleUndoRedoRestore, {
    enableKeyboardShortcuts: true,
  });

  const pageHistory = usePageHistoryOptional();

  // Store initial state when section loads for undo capability
  const initialYamlRef = useRef<string | null>(null);

  // Clear undo history and store initial state when section changes
  useEffect(() => {
    clearUndoHistory();
    // Store the initial YAML so we can undo back to it
    try {
      const sectionForEditor = stripTransientDynamicKeys(section);
      const yamlStr = safeYamlDump(sectionForEditor, {
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
      const {
        sectionIndex: idx,
        originalText,
        templateSyntax,
        selectionFrom,
        selectionTo,
      } = detail;
      if (idx !== sectionIndex) return;

      detail._handled = true;

      const view = editorViewRef.current;
      if (view) {
        const doc = view.state.doc.toString();
        let from: number;
        let to: number;

        if (
          selectionFrom !== undefined &&
          selectionTo !== undefined &&
          selectionFrom >= 0 &&
          selectionTo <= doc.length &&
          doc.slice(selectionFrom, selectionTo) === originalText
        ) {
          from = selectionFrom;
          to = selectionTo;
        } else {
          const pos = doc.indexOf(originalText);
          if (pos === -1) {
            toast({
              title: "Text not found",
              description:
                "The selected text was not found in the YAML content.",
              variant: "destructive",
            });
            return;
          }
          from = pos;
          to = pos + originalText.length;
        }

        view.dispatch({
          changes: { from, to, insert: templateSyntax },
        });
        toast({
          title: "Variable inserted",
          description: "Text replaced with variable template.",
        });
      } else {
        setYamlContent((prev) => {
          if (!prev.includes(originalText)) {
            toast({
              title: "Text not found",
              description:
                "The selected text was not found in the YAML content.",
              variant: "destructive",
            });
            return prev;
          }
          const updated = prev.replace(originalText, templateSyntax);
          setHasChanges(true);
          setParseError(null);
          try {
            const parsed = safeYamlLoad(updated) as Record<string, unknown>;
            if (onPreviewChange) onPreviewChange(parsed as Section);
          } catch {
            /* ignore parse errors during preview */
          }
          toast({
            title: "Variable inserted",
            description: "Text replaced with variable template.",
          });
          return updated;
        });
      }
    };

    window.addEventListener("variable-created-replace", handler);
    return () =>
      window.removeEventListener("variable-created-replace", handler);
  }, [sectionIndex, toast, onPreviewChange]);

  // Fetch image registry for gallery picker
  const { data: imageRegistry, refetch: refetchRegistry } =
    useQuery<ImageRegistry>({
      queryKey: ["/api/image-registry"],
    });

  const { data: mediaStatus } = useQuery<{
    defaultProvider: string;
    providers: string[];
    gcs?: { bucket: string; basePath: string; projectId?: string };
  }>({
    queryKey: ["/api/media/status"],
  });

  const hasCloudProvider = (mediaStatus?.providers ?? []).some(
    (p) => p !== "local",
  );

  const handleImageUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!files.length || !imagePickerTarget) return;
      const file = files[0];
      const allowed = [
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".svg",
        ".avif",
        ".gif",
      ];
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
      if (!allowed.includes(ext)) {
        toast({
          title: "Unsupported file type",
          description: `${ext} files are not supported`,
          variant: "destructive",
        });
        return;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const resp = await fetch("/api/image-registry/upload", {
          method: "POST",
          body: formData,
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || "Upload failed");
        }
        const result = (await resp.json()) as {
          id: string;
          src: string;
          alt: string;
          duplicate?: boolean;
          existingId?: string;
        };
        await refetchRegistry();
        const fieldName =
          imagePickerTarget.srcField || imagePickerTarget.fieldPath || "";
        const isIdField = fieldName.endsWith("_id");
        setImagePickerTarget({
          ...imagePickerTarget,
          currentSrc: isIdField ? result.id : result.src,
          currentAlt: result.alt,
          currentRegistryId: result.id,
        });
        setImagePickerMode("browse");
        if (result.duplicate) {
          toast({
            title: "Image already exists",
            description: `This image is already registered as "${result.existingId}". Using the existing one.`,
          });
        } else {
          toast({
            title: "Image uploaded",
            description: `Registered as "${result.id}"`,
          });
        }
      } catch (err: any) {
        toast({
          title: "Upload failed",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [imagePickerTarget, refetchRegistry, toast],
  );

  const handleVideoUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!files.length || !videoPickerTarget) return;
      const file = files[0];
      const allowed = [".mp4", ".webm", ".mov", ".ogg", ".m4v"];
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
      if (!allowed.includes(ext)) {
        toast({
          title: "Unsupported file type",
          description: `${ext} files are not supported. Use MP4, WebM, MOV, or OGG.`,
          variant: "destructive",
        });
        return;
      }
      setVideoUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const resp = await fetch("/api/image-registry/upload", {
          method: "POST",
          body: formData,
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || "Upload failed");
        }
        const result = (await resp.json()) as {
          id: string;
          src: string;
          alt: string;
          duplicate?: boolean;
          existingId?: string;
        };
        await refetchRegistry();
        setVideoPickerTarget({
          ...videoPickerTarget,
          currentUrl: result.src,
        });
        setVideoPickerMode("url");
        if (result.duplicate) {
          toast({
            title: "Video already exists",
            description: `This video is already registered as "${result.existingId}". Using the existing one.`,
          });
        } else {
          toast({
            title: "Video uploaded",
            description: `Registered as "${result.id}"`,
          });
        }
      } catch (err: any) {
        toast({
          title: "Upload failed",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setVideoUploading(false);
      }
    },
    [videoPickerTarget, refetchRegistry, toast],
  );

  const filteredGalleryVideos = useMemo(() => {
    if (!imageRegistry?.images) return [];
    const videoExts = [".mp4", ".webm", ".mov", ".ogg", ".m4v"];
    const searchLower = videoGallerySearch.toLowerCase();
    return Object.entries(imageRegistry.images)
      .filter(([id, img]) => {
        const isVideo = videoExts.some((ext) => img.src.toLowerCase().endsWith(ext));
        if (!isVideo) return false;
        if (!searchLower) return true;
        return (
          id.toLowerCase().includes(searchLower) ||
          img.alt.toLowerCase().includes(searchLower) ||
          img.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
        );
      })
      .sort((a, b) => (b[1].usage_count ?? 0) - (a[1].usage_count ?? 0));
  }, [imageRegistry, videoGallerySearch]);

  useEffect(() => {
    setVisibleVideoCount(48);
  }, [videoGallerySearch, videoPickerOpen]);

  // Filter and sort gallery images by usage count (most used first)
  const filteredGalleryImages = useMemo(() => {
    if (!imageRegistry?.images) return [];
    const searchLower = imageGallerySearch.toLowerCase();
    const tagFilter = imagePickerTarget?.tagFilter?.toLowerCase();
    return Object.entries(imageRegistry.images)
      .filter(([id, img]) => {
        // Apply tag filter first (e.g., "logo" to show only logos)
        if (
          tagFilter &&
          !img.tags?.some((tag) => tag.toLowerCase() === tagFilter)
        ) {
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
  const currentShowOnLocations =
    (parsedSection?.showOnLocations as string[]) || [];

  // Initialize YAML content from section
  useEffect(() => {
    try {
      const sectionForEditor = stripTransientDynamicKeys(section);
      const yamlStr = safeYamlDump(sectionForEditor, {
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

          // Clean up empty parent objects after deletion
          if (!value) {
            for (let i = pathParts.length - 2; i >= 0; i--) {
              const parentPath = pathParts.slice(0, i);
              let parent: Record<string, unknown> = parsed;
              for (const p of parentPath) {
                parent = parent[p] as Record<string, unknown>;
              }
              const child = parent[pathParts[i]];
              if (child && typeof child === "object" && Object.keys(child as Record<string, unknown>).length === 0) {
                delete parent[pathParts[i]];
              } else {
                break;
              }
            }
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
            // Clean up empty parent objects after deletion
            if (!value && value !== false && value !== 0) {
              for (let i = pathParts.length - 2; i >= 0; i--) {
                const parentPath = pathParts.slice(0, i);
                let parent: Record<string, unknown> = parsed;
                for (const p of parentPath) {
                  parent = parent[p] as Record<string, unknown>;
                }
                const child = parent[pathParts[i]];
                if (child && typeof child === "object" && Object.keys(child as Record<string, unknown>).length === 0) {
                  delete parent[pathParts[i]];
                } else {
                  break;
                }
              }
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
          valueToInsert: string[],
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
            return inserted
              ? fallback
              : { ...result, [keyToInsert]: valueToInsert };
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
    (
      arrayPath: string,
      index: number,
      field: string,
      value: string | number | boolean | undefined,
    ) => {
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

        const fieldParts = field.split(".");
        if (fieldParts.length > 1) {
          let target: Record<string, unknown> = array[index];
          for (let i = 0; i < fieldParts.length - 1; i++) {
            if (!target[fieldParts[i]] || typeof target[fieldParts[i]] !== "object") {
              target[fieldParts[i]] = {};
            }
            target = target[fieldParts[i]] as Record<string, unknown>;
          }
          if (value === undefined) {
            delete target[fieldParts[fieldParts.length - 1]];
          } else {
            target[fieldParts[fieldParts.length - 1]] = value;
          }
        } else {
          if (value === undefined) {
            delete array[index][field];
          } else {
            array[index][field] = value;
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
        const array = current[arrayField] as
          | Record<string, unknown>[]
          | undefined;
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
        let array = current[arrayField] as
          | Record<string, unknown>[]
          | undefined;

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
        const array = current[arrayField] as
          | Record<string, unknown>[]
          | undefined;

        if (
          !Array.isArray(array) ||
          indexToRemove < 0 ||
          indexToRemove >= array.length
        )
          return;

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

  const { data: themeConfig } = useQuery<{
    button_variants?: { id: string; label: string }[];
    fontSizes?: { id: string; label: string; value: string; tailwind: string }[];
  }>({
    queryKey: ["/api/theme"],
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
      pageHistory.pushSnapshot(
        allSections,
        `Antes de editar sección ${sectionIndex + 1}`,
      );
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
  const executeSave = useCallback(async () => {
    const result = await saveToServer();
    if (result && result.success) {
      if (result.warning) {
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

  const handleSave = useCallback(async () => {
    if (boundSiblings.length > 0) {
      setBindingConfirmOpen(true);
      return;
    }
    await executeSave();
  }, [boundSiblings.length, executeSave]);

  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close without saving?",
      );
      if (!confirmed) return;
    }
    setTableEditorMode(null);
    if (onPreviewChange) {
      onPreviewChange(null);
    }
    onClose();
  }, [hasChanges, onClose, onPreviewChange]);

  const STORAGE_KEY = "section-editor-width";
  const DEFAULT_WIDTH = 480;
  const MIN_WIDTH = 320;
  const MAX_WIDTH_RATIO = 0.8;

  const [panelWidth, setPanelWidth] = useState(() => {
    const screenCap = typeof window !== 'undefined' ? window.innerWidth : DEFAULT_WIDTH;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= MIN_WIDTH) return Math.min(parsed, screenCap);
      }
    } catch {}
    return Math.min(DEFAULT_WIDTH, screenCap);
  });
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(DEFAULT_WIDTH);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(panelWidth));
    } catch {}
  }, [panelWidth]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = panelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = dragStartXRef.current - ev.clientX;
      const maxW = window.innerWidth * MAX_WIDTH_RATIO;
      const newWidth = Math.max(MIN_WIDTH, Math.min(maxW, dragStartWidthRef.current + delta));
      setPanelWidth(newWidth);
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [panelWidth]);

  return (
    <div
      className="fixed right-0 top-0 bottom-0 bg-background border-l shadow-xl z-[9999] flex flex-col"
      style={{ width: `${Math.min(panelWidth, typeof window !== 'undefined' ? window.innerWidth : panelWidth)}px` }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 hover:bg-primary/20 active:bg-primary/30 transition-colors"
        onMouseDown={handleDragStart}
        data-testid="panel-resize-handle"
      />
      {/* Header */}
      <div className="flex items-center justify-between px-4 border-b" style={{ paddingTop: "5px", paddingBottom: "5px" }}>
        <div>
          <h2 className="font-semibold" style={{ fontSize: "25px", lineHeight: "1.2" }}>Edit Section</h2>
          <p className="text-sm text-muted-foreground">
            {sectionType}{parsedSection?.variant ? ` — ${parsedSection.variant}` : ""} (Section {sectionIndex + 1})
          </p>
        </div>
        <div className="flex items-center gap-1">
          {contentType && slug && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => { refetchBinding(); setBindingDialogOpen(true); }}
              title={bindingGroup ? `Bound to ${boundSiblings.length} page${boundSiblings.length !== 1 ? 's' : ''} — click to manage` : "Manage bindings"}
              className="relative"
              data-testid="button-binding-header"
            >
              {bindingGroup ? (
                <>
                  <IconLink className="h-4 w-4" />
                  <span
                    className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-amber-950 min-w-[16px] px-0.5 leading-none py-0.5"
                    data-testid="badge-binding-count"
                  >
                    {bindingGroup.members.length}
                  </span>
                </>
              ) : (
                <IconLinkOff className="h-4 w-4" />
              )}
            </Button>
          )}
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

      {/* Binding Banner - warning style, full width, inside header area */}
      {boundSiblings.length > 0 && (
        <div
          className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-xs flex items-center gap-2 cursor-pointer hover-elevate"
          onClick={() => { refetchBinding(); setBindingDialogOpen(true); }}
          data-testid="binding-banner"
        >
          <IconAlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-amber-800 dark:text-amber-200">
            Synced with {boundSiblings.length} page{boundSiblings.length > 1 ? "s" : ""}: {boundSiblings.map(s => s.slug).join(", ")}
          </span>
        </div>
      )}

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
              onCreateEditor={(view) => {
                editorViewRef.current = view;
              }}
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
              onChange={(value) =>
                updateArrayProperty("showOnLocations", value)
              }
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
              <>
                <RelatedFeaturesPicker
                  value={(parsedSection?.related_features as string[]) || []}
                  onChange={(value) =>
                    updateArrayProperty("related_features", value)
                  }
                  locale={locale}
                />
                <FaqItemsVisibility
                  relatedFeatures={(parsedSection?.related_features as string[]) || []}
                  locale={locale || "en"}
                  inlineItems={
                    (parsedSection?.items as Array<{ question: string; answer: string }>) || undefined
                  }
                  itemOverrides={
                    (parsedSection?.item_overrides as Record<string, { hideOnLocations?: string[] }>) || {}
                  }
                  onChange={(overrides) => {
                    try {
                      const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
                      if (!parsed || typeof parsed !== "object") return;
                      pushUndoState(yamlContent);
                      if (Object.keys(overrides).length === 0) {
                        delete parsed.item_overrides;
                      } else {
                        parsed.item_overrides = overrides;
                      }
                      const newYaml = safeYamlDump(parsed, { lineWidth: -1, noRefs: true, quotingType: '"' });
                      setYamlContent(newYaml);
                      setHasChanges(true);
                      setParseError(null);
                      if (onPreviewChange) onPreviewChange(parsed as Section);
                    } catch (err) {
                      console.error("Error updating item_overrides:", err);
                    }
                  }}
                />
              </>
            )}
            {/* Testimonials (grid, carousel, slide) related features picker */}
            {["testimonials_grid", "testimonials", "testimonials_slide"].includes(sectionType) && (
              <>
                <div
                  className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2"
                  data-testid="alert-testimonials-edit-info"
                >
                  <IconAlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    {locale === "es"
                      ? sectionType === "testimonials_grid"
                        ? "Los testimonios se cargan del banco centralizado y se filtran por las características seleccionadas."
                        : "Cuando se seleccionan características, los testimonios se cargan del banco centralizado. Sin características, se usan los items por defecto."
                      : sectionType === "testimonials_grid"
                        ? "Testimonials are loaded from the centralized bank and filtered by the selected features."
                        : "When features are selected, testimonials load from the centralized bank. Without features, default items are used."}
                  </p>
                </div>
                <RelatedFeaturesPicker
                  value={(parsedSection?.related_features as string[]) || []}
                  onChange={(value) =>
                    updateArrayProperty("related_features", value)
                  }
                  locale={locale}
                  context="testimonials"
                />
                <TestimonialItemsPreview
                  relatedFeatures={
                    (parsedSection?.related_features as string[]) || []
                  }
                  itemStyles={
                    sectionType === "testimonials_grid"
                      ? (parsedSection?.item_styles as Record<
                          string,
                          {
                            box_color?: string;
                            name_color?: string;
                            comment_color?: string;
                          }
                        >) || {}
                      : {}
                  }
                  locale={locale || "en"}
                  onUpdateItemStyle={
                    sectionType === "testimonials_grid"
                      ? (studentName, prop, value) => {
                          updateProperty(`item_styles.${studentName}.${prop}`, value);
                        }
                      : undefined
                  }
                  readOnly={sectionType !== "testimonials_grid"}
                />
              </>
            )}
            {sectionType === "dynamic_table" && (
              <VariantPicker
                value={(parsedSection?.variant as string) || "default"}
                onChange={(value) => updateProperty("variant", value)}
                options={[
                  { id: "default", label: "Default", preview: () => <TableVariantPreview variant="default" /> },
                  { id: "striped", label: "Striped", preview: () => <TableVariantPreview variant="striped" /> },
                  { id: "cards", label: "Cards", preview: () => <TableVariantPreview variant="cards" /> },
                  { id: "comparison", label: "Comparison", preview: () => <TableVariantPreview variant="comparison" /> },
                ]}
              />
            )}
            {sectionType === "dynamic_table" && parsedSection?.endpoint && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Max Rows</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Show all rows"
                    value={
                      parsedSection?.max_rows != null
                        ? String(parsedSection.max_rows)
                        : ""
                    }
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (val === "") {
                        updatePropertyWithValue("max_rows", undefined);
                      } else {
                        const n = parseInt(val, 10);
                        if (!isNaN(n) && n > 0)
                          updatePropertyWithValue("max_rows", n);
                      }
                    }}
                    data-testid="input-max-rows"
                  />
                  <p className="text-xs text-muted-foreground">
                    Limit visible rows. Users can expand to see all.
                  </p>
                </div>

                <div className="space-y-2 border-t pt-3 mt-3">
                  <Label className="text-xs font-medium">Row Action Button</Label>
                  {parsedSection?.action ? (
                    <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <IconExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-foreground">Action configured</span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            try {
                              const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
                              if (!parsed || typeof parsed !== "object") return;
                              pushUndoState(yamlContent);
                              delete parsed.action;
                              const newYaml = safeYamlDump(parsed, { lineWidth: -1, noRefs: true, quotingType: '"' });
                              setYamlContent(newYaml);
                              setHasChanges(true);
                              setParseError(null);
                              if (onPreviewChange) onPreviewChange(parsed as Section);
                            } catch (err) {
                              console.error("Error removing action:", err);
                            }
                          }}
                          data-testid="button-remove-action"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Button Label</Label>
                          <Input
                            value={(parsedSection.action as { label?: string })?.label || ""}
                            placeholder="e.g. View, Apply, Details"
                            onChange={(e) => {
                              try {
                                const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
                                if (!parsed || typeof parsed !== "object") return;
                                pushUndoState(yamlContent);
                                const action = (parsed.action || {}) as Record<string, string>;
                                action.label = e.target.value;
                                parsed.action = action;
                                const newYaml = safeYamlDump(parsed, { lineWidth: -1, noRefs: true, quotingType: '"' });
                                setYamlContent(newYaml);
                                setHasChanges(true);
                                setParseError(null);
                                if (onPreviewChange) onPreviewChange(parsed as Section);
                              } catch (err) {
                                console.error("Error updating action label:", err);
                              }
                            }}
                            className="text-xs"
                            data-testid="input-action-label"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">URL Template</Label>
                          <Input
                            value={(parsedSection.action as { href?: string })?.href || ""}
                            placeholder="e.g. https://example.com/item/{id}"
                            onChange={(e) => {
                              try {
                                const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
                                if (!parsed || typeof parsed !== "object") return;
                                pushUndoState(yamlContent);
                                const action = (parsed.action || {}) as Record<string, string>;
                                action.href = e.target.value;
                                parsed.action = action;
                                const newYaml = safeYamlDump(parsed, { lineWidth: -1, noRefs: true, quotingType: '"' });
                                setYamlContent(newYaml);
                                setHasChanges(true);
                                setParseError(null);
                                if (onPreviewChange) onPreviewChange(parsed as Section);
                              } catch (err) {
                                console.error("Error updating action href:", err);
                              }
                            }}
                            className="text-xs"
                            data-testid="input-action-href"
                          />
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Use {"{columnKey}"} for dynamic values, e.g. {"{id}"} or {"{slug}"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        try {
                          const parsed = safeYamlLoad(yamlContent) as Record<string, unknown>;
                          if (!parsed || typeof parsed !== "object") return;
                          pushUndoState(yamlContent);
                          parsed.action = { label: "View", href: "" };
                          const newYaml = safeYamlDump(parsed, { lineWidth: -1, noRefs: true, quotingType: '"' });
                          setYamlContent(newYaml);
                          setHasChanges(true);
                          setParseError(null);
                          if (onPreviewChange) onPreviewChange(parsed as Section);
                        } catch (err) {
                          console.error("Error adding action:", err);
                        }
                      }}
                      data-testid="button-add-action"
                    >
                      <IconPlus className="h-3.5 w-3.5 mr-1" />
                      Add Action Button
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Adds a button column to each row linking to a URL.
                  </p>
                </div>

                <div className="space-y-3 border-t pt-3 mt-3">
                  <div
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${tableEditorMode === "content" ? "border-primary bg-primary/5" : "hover-elevate"}`}
                    onClick={() =>
                      setTableEditorMode(
                        tableEditorMode === "content" ? null : "content",
                      )
                    }
                    data-testid="button-table-content-filter"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <IconSettings className="h-4 w-4 text-foreground flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        Content Filter
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {locale === "es"
                        ? "Usa IA para elegir qué columnas mostrar, renombrarlas, reordenarlas o cambiar cómo se muestran los valores. Controla la apariencia de la tabla."
                        : "Use AI to choose which columns to display, rename them, reorder, or change how values are shown. Controls the table's appearance."}
                    </p>
                  </div>
                  <div
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${tableEditorMode === "filter" ? "border-primary bg-primary/5" : "hover-elevate"}`}
                    onClick={() =>
                      setTableEditorMode(
                        tableEditorMode === "filter" ? null : "filter",
                      )
                    }
                    data-testid="button-table-global-filter"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <IconCode className="h-4 w-4 text-foreground flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        Global Filter
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {locale === "es"
                        ? "Usa IA para filtrar qué filas se muestran en la tabla. Soporta filtrado por región del visitante (país, idioma, zona horaria). Controla qué datos son visibles, no cómo se ven."
                        : "Use AI to filter which rows appear in the table. Supports visitor-aware filtering (country, language, timezone). Controls which data is visible — not how it looks."}
                    </p>
                  </div>
                </div>

                {tableEditorMode === "content" && (
                  <TableContentEditor
                    key={`content-${parsedSection.endpoint}`}
                    mode="content"
                    endpoint={parsedSection.endpoint as string}
                    dataPath={parsedSection.data_path as string | undefined}
                    currentColumns={
                      (parsedSection.columns as Array<{
                        key: string;
                        label: string;
                        type:
                          | "text"
                          | "number"
                          | "date"
                          | "image"
                          | "link"
                          | "boolean";
                      }>) || []
                    }
                    currentTitle={parsedSection.title as string | undefined}
                    currentFilter={
                      parsedSection.global_filter as string | undefined
                    }
                    locale={locale}
                    onApplyContent={(config) => {
                      try {
                        const parsed = safeYamlLoad(yamlContent) as Record<
                          string,
                          unknown
                        >;
                        if (!parsed || typeof parsed !== "object") return;
                        pushUndoState(yamlContent);
                        parsed.columns = config.columns;
                        if (config.title) {
                          parsed.title = config.title;
                        } else {
                          delete parsed.title;
                        }
                        const newYaml = safeYamlDump(parsed, {
                          lineWidth: -1,
                          noRefs: true,
                          quotingType: '"',
                        });
                        setYamlContent(newYaml);
                        setHasChanges(true);
                        setParseError(null);
                        if (onPreviewChange) onPreviewChange(parsed as Section);
                      } catch (err) {
                        console.error("Error applying table config:", err);
                      }
                    }}
                    onApplyFilter={() => {}}
                    onRemoveFilter={() => {}}
                    onClose={() => setTableEditorMode(null)}
                  />
                )}

                {tableEditorMode === "filter" && (
                  <TableContentEditor
                    key={`filter-${parsedSection.endpoint}`}
                    mode="filter"
                    endpoint={parsedSection.endpoint as string}
                    dataPath={parsedSection.data_path as string | undefined}
                    currentColumns={
                      (parsedSection.columns as Array<{
                        key: string;
                        label: string;
                        type:
                          | "text"
                          | "number"
                          | "date"
                          | "image"
                          | "link"
                          | "boolean";
                      }>) || []
                    }
                    currentTitle={parsedSection.title as string | undefined}
                    currentFilter={
                      parsedSection.global_filter as string | undefined
                    }
                    locale={locale}
                    onApplyContent={() => {}}
                    onApplyFilter={(filterBase64) => {
                      try {
                        const parsed = safeYamlLoad(yamlContent) as Record<
                          string,
                          unknown
                        >;
                        if (!parsed || typeof parsed !== "object") return;
                        pushUndoState(yamlContent);
                        parsed.global_filter = filterBase64;
                        const newYaml = safeYamlDump(parsed, {
                          lineWidth: -1,
                          noRefs: true,
                          quotingType: '"',
                        });
                        setYamlContent(newYaml);
                        setHasChanges(true);
                        setParseError(null);
                        if (onPreviewChange) onPreviewChange(parsed as Section);
                      } catch (err) {
                        console.error("Error applying global filter:", err);
                      }
                    }}
                    onRemoveFilter={() => {
                      try {
                        const parsed = safeYamlLoad(yamlContent) as Record<
                          string,
                          unknown
                        >;
                        if (!parsed || typeof parsed !== "object") return;
                        pushUndoState(yamlContent);
                        delete parsed.global_filter;
                        const newYaml = safeYamlDump(parsed, {
                          lineWidth: -1,
                          noRefs: true,
                          quotingType: '"',
                        });
                        setYamlContent(newYaml);
                        setHasChanges(true);
                        setParseError(null);
                        if (onPreviewChange) onPreviewChange(parsed as Section);
                      } catch (err) {
                        console.error("Error removing global filter:", err);
                      }
                    }}
                    onClose={() => setTableEditorMode(null)}
                  />
                )}
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
                const currentValue = parsedSection
                  ? String(
                      (parsedSection as Record<string, unknown>)[fieldPath] ||
                        "",
                    )
                  : "";
                const label = getFieldLabel(fieldPath);
                return (
                  <div key={fieldPath} className="mt-3">
                    <ColorPicker
                      value={currentValue}
                      onChange={(value) => updateProperty(fieldPath, value)}
                      type={
                        (edVariant as "background" | "accent" | "text") ||
                        "background"
                      }
                      label={label}
                      testIdPrefix={`props-${fieldPath}`}
                    />
                  </div>
                );
              })}
            {/* Render top-level (non-array) image-picker field editors */}
            {Object.entries(configuredFields)
              .filter(([fieldPath, editorTypeRaw]) => {
                if (fieldPath.includes("[]")) return false;
                const { type: edType } = parseEditorType(editorTypeRaw);
                return edType === "image-picker";
              })
              .map(([fieldPath, editorTypeRaw]) => {
                const { variant } = parseEditorType(editorTypeRaw);
                const getFieldValue = () => {
                  if (!parsedSection) return "";
                  const pathParts = fieldPath.split(".");
                  let current: unknown = parsedSection;
                  for (const part of pathParts) {
                    if (!current || typeof current !== "object") return "";
                    current = (current as Record<string, unknown>)[part];
                  }
                  return (current as string) || "";
                };
                const currentValue = getFieldValue();
                const fieldLabel = getFieldLabel(fieldPath);
                const isIdField = fieldPath.endsWith("_id");
                const displaySrc = isIdField
                  ? imageRegistry?.images?.[currentValue]?.src || currentValue
                  : currentValue;
                const displayLabel = isIdField
                  ? currentValue
                  : currentValue.split("/").pop() || currentValue;

                return (
                  <div key={fieldPath} className="space-y-2 mt-3">
                    <Label className="text-sm font-medium">
                      {fieldLabel}
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
                            tagFilter: variant,
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
              })}
            {/* Render top-level (non-array) video-picker field editors */}
            {Object.entries(configuredFields)
              .filter(([fieldPath, editorTypeRaw]) => {
                if (fieldPath.includes("[]")) return false;
                const { type: edType } = parseEditorType(editorTypeRaw);
                return edType === "video-picker";
              })
              .map(([fieldPath]) => {
                const getFieldValue = () => {
                  if (!parsedSection) return "";
                  const pathParts = fieldPath.split(".");
                  let current: unknown = parsedSection;
                  for (const part of pathParts) {
                    if (!current || typeof current !== "object") return "";
                    current = (current as Record<string, unknown>)[part];
                  }
                  return (current as string) || "";
                };
                const currentValue = getFieldValue();
                const fieldLabel = getFieldLabel(fieldPath);

                const pathParts = fieldPath.split(".");
                const parentPrefix = pathParts.length > 1
                  ? pathParts.slice(0, -1).join(".") + "."
                  : "";

                const getVideoSiblingValue = (prop: string): unknown => {
                  if (!parsedSection) return undefined;
                  const siblingPath = parentPrefix + prop;
                  const parts = siblingPath.split(".");
                  let current: unknown = parsedSection;
                  for (const part of parts) {
                    if (!current || typeof current !== "object") return undefined;
                    current = (current as Record<string, unknown>)[part];
                  }
                  return current;
                };

                const currentRatio = (getVideoSiblingValue("ratio") as string) || "";
                const currentMuted = getVideoSiblingValue("muted");
                const currentAutoplay = getVideoSiblingValue("autoplay");
                const currentLoop = getVideoSiblingValue("loop");
                const currentPreviewImage = (getVideoSiblingValue("preview_image_url") as string) || "";

                const parentLabel = getFieldLabel(
                  parentPrefix ? parentPrefix.replace(/\.$/, "") : "video"
                );

                return (
                  <Collapsible key={fieldPath} className="border rounded-md">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                        data-testid={`props-video-${fieldLabel}-trigger`}
                      >
                        <div className="w-10 h-10 rounded-md overflow-hidden bg-muted border flex-shrink-0 flex items-center justify-center">
                          <IconVideo className={`h-5 w-5 ${currentValue ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <span className="text-sm font-medium capitalize block">
                            {parentLabel.replace(/_/g, " ")}
                          </span>
                          {currentValue && (
                            <span className="text-xs text-muted-foreground truncate block">
                              {currentValue.split("/").pop() || currentValue}
                            </span>
                          )}
                        </div>
                        <IconChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-3 pt-0 space-y-3 border-t">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setVideoPickerTarget({
                                fieldPath,
                                label: fieldLabel,
                                currentUrl: currentValue,
                              });
                              setVideoPickerOpen(true);
                            }}
                            className="relative w-16 h-16 rounded-md border border-input bg-muted/50 hover:bg-muted transition-colors overflow-hidden group"
                            data-testid={`props-video-${fieldLabel}-picker`}
                            title="Change video"
                          >
                            {currentValue ? (
                              <>
                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                  <IconVideo className="h-6 w-6 text-primary" />
                                </div>
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <IconVideo className="h-5 w-5 text-white" />
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <IconVideo className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            {currentValue ? (
                              <span className="text-xs text-muted-foreground break-all line-clamp-3">
                                {currentValue}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                No video selected
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setImagePickerTarget({
                                  fieldPath: parentPrefix + "preview_image_url",
                                  label: "Preview Image",
                                  currentSrc: currentPreviewImage,
                                  currentAlt: "",
                                });
                                setImagePickerOpen(true);
                              }}
                              className="relative w-16 h-16 rounded-md border border-input bg-muted/50 hover:bg-muted transition-colors overflow-hidden group flex-shrink-0"
                              data-testid={`props-video-${fieldLabel}-preview-image`}
                              title="Change preview image"
                            >
                              {currentPreviewImage ? (
                                <>
                                  <img
                                    src={currentPreviewImage}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                  />
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
                            <div className="flex-1 min-w-0">
                              {currentPreviewImage ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground truncate flex-1">
                                    {currentPreviewImage.split("/").pop() || currentPreviewImage}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 flex-shrink-0"
                                    onClick={() => updateProperty(parentPrefix + "preview_image_url", "")}
                                    data-testid={`props-video-${fieldLabel}-preview-image-clear`}
                                  >
                                    <IconX className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  No preview image selected
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Aspect Ratio
                          </Label>
                          <Select
                            value={currentRatio || "16:9"}
                            onValueChange={(value) =>
                              updateProperty(parentPrefix + "ratio", value)
                            }
                          >
                            <SelectTrigger
                              className="h-8 text-sm"
                              data-testid={`props-video-${fieldLabel}-ratio`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                              <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                              <SelectItem value="4:3">4:3 (Classic)</SelectItem>
                              <SelectItem value="1:1">1:1 (Square)</SelectItem>
                              <SelectItem value="21:9">21:9 (Ultra-wide)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Playback Options
                          </Label>
                          <div className="grid grid-cols-1 gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-sm">Muted</Label>
                              <Switch
                                checked={currentMuted !== false}
                                onCheckedChange={(checked) =>
                                  updatePropertyWithValue(parentPrefix + "muted", checked)
                                }
                                data-testid={`props-video-${fieldLabel}-muted`}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-sm">Autoplay</Label>
                              <Switch
                                checked={currentAutoplay === true}
                                onCheckedChange={(checked) =>
                                  updatePropertyWithValue(parentPrefix + "autoplay", checked)
                                }
                                data-testid={`props-video-${fieldLabel}-autoplay`}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-sm">Loop</Label>
                              <Switch
                                checked={currentLoop !== false}
                                onCheckedChange={(checked) =>
                                  updatePropertyWithValue(parentPrefix + "loop", checked)
                                }
                                data-testid={`props-video-${fieldLabel}-loop`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            {/* Render grouped array item editors (when multiple field-editors exist for the same array) */}
            {(() => {
              const arrayFieldGroups: Record<
                string,
                {
                  fieldName: string;
                  editorType: string;
                  variant?: string;
                  fullPath: string;
                }[]
              > = {};
              Object.entries(configuredFields).forEach(
                ([fieldPath, editorTypeRaw]) => {
                  if (/^[\w]+\[\]\.[\w]+\[\]\./.test(fieldPath)) return;
                  const match = fieldPath.match(/^([\w.]+)\[\]\.(.+)$/);
                  if (!match) return;
                  const [, arrPath, fieldName] = match;
                  if (!arrayFieldGroups[arrPath])
                    arrayFieldGroups[arrPath] = [];
                  const { type: edType, variant: edVariant } =
                    parseEditorType(editorTypeRaw);
                  arrayFieldGroups[arrPath].push({
                    fieldName,
                    editorType: edType,
                    variant: edVariant,
                    fullPath: fieldPath,
                  });
                },
              );

              const supportedGroupedTypes = new Set([
                "color-picker",
                "image-picker",
                "link-picker",
                "rich-text-editor",
                "variant-picker",
              ]);
              const groupedArrayPaths = new Set(
                Object.entries(arrayFieldGroups)
                  .filter(
                    ([, fields]) =>
                      fields.length >= 2 &&
                      fields.every((f) =>
                        supportedGroupedTypes.has(f.editorType),
                      ),
                  )
                  .map(([arrPath]) => arrPath),
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
                  return Array.isArray(current)
                    ? (current as Record<string, unknown>[])
                    : [];
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
                  logo_height: "Altura del logo (px)",
                  "media.url": "Video / Media URL",
                };

                const hiddenFields = new Set([
                  "type",
                  "media.type",
                  "media.ratio",
                  "ratio",
                  "logo_height",
                ]);
                if (fields.some((f) => f.fieldName === "button_variant")) {
                  hiddenFields.add("variant");
                }

                const getNestedValue = (
                  obj: Record<string, unknown>,
                  path: string,
                ): unknown => {
                  const parts = path.split(".");
                  let cur: unknown = obj;
                  for (const p of parts) {
                    if (!cur || typeof cur !== "object") return undefined;
                    cur = (cur as Record<string, unknown>)[p];
                  }
                  return cur;
                };

                const updateNestedField = (
                  idx: number,
                  fieldName: string,
                  value: unknown,
                ) => {
                  if (fieldName.includes(".")) {
                    const parts = fieldName.split(".");
                    try {
                      const parsed = safeYamlLoad(yamlContent) as Record<
                        string,
                        unknown
                      >;
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
                        if (
                          !(parts[i] in (target as Record<string, unknown>))
                        ) {
                          (target as Record<string, unknown>)[parts[i]] = {};
                        }
                        target = (target as Record<string, unknown>)[parts[i]];
                      }
                      if (target && typeof target === "object") {
                        (target as Record<string, unknown>)[
                          parts[parts.length - 1]
                        ] = value;
                      }
                      const newYaml = safeYamlDump(parsed, {
                        lineWidth: -1,
                        noRefs: true,
                        quotingType: '"',
                      });
                      setYamlContent(newYaml);
                      setHasChanges(true);
                      setParseError(null);
                      if (onPreviewChange) onPreviewChange(parsed as Section);
                    } catch (e) {
                      console.error("Error updating nested field:", e);
                    }
                  } else {
                    if (
                      typeof value === "string" ||
                      typeof value === "number" ||
                      value === undefined
                    ) {
                      updateArrayItemField(arrPath, idx, fieldName, value as string | number | boolean | undefined);
                    }
                  }
                };

                const collectItemKeys = (
                  items: Record<string, unknown>[],
                ): string[] => {
                  const keySet = new Set<string>();
                  items.forEach((item) => {
                    const flattenKeys = (
                      obj: Record<string, unknown>,
                      prefix: string,
                    ) => {
                      Object.keys(obj).forEach((k) => {
                        const path = prefix ? `${prefix}.${k}` : k;
                        const val = obj[k];
                        if (
                          val &&
                          typeof val === "object" &&
                          !Array.isArray(val)
                        ) {
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
                const configuredFieldNames = new Set(
                  fields.map((f) => f.fieldName),
                );
                const textFields = allItemKeys.filter(
                  (k) => !configuredFieldNames.has(k) && !hiddenFields.has(k),
                );

                const fieldOrder: string[] = [
                  ...textFields,
                  ...fields
                    .map((f) => f.fieldName)
                    .filter((fn) => fn === "avatar"),
                  ...fields
                    .map((f) => f.fieldName)
                    .filter((fn) => fn !== "avatar" && !fn.includes("color")),
                  ...fields
                    .map((f) => f.fieldName)
                    .filter((fn) => fn.includes("color")),
                ];

                const buildDefaultItem = (): Record<string, unknown> => {
                  if (arrData.length === 0) return {};
                  const template: Record<string, unknown> = {};
                  const sample = arrData[0];
                  Object.keys(sample).forEach((k) => {
                    const val = sample[k];
                    if (typeof val === "string") template[k] = "";
                    else if (typeof val === "number") template[k] = 0;
                    else if (
                      typeof val === "object" &&
                      val !== null &&
                      !Array.isArray(val)
                    ) {
                      const nested: Record<string, unknown> = {};
                      Object.keys(val as Record<string, unknown>).forEach(
                        (nk) => {
                          const nv = (val as Record<string, unknown>)[nk];
                          if (typeof nv === "string") nested[nk] = "";
                          else if (typeof nv === "number") nested[nk] = 0;
                        },
                      );
                      template[k] = nested;
                    }
                  });
                  const nameKey =
                    "name" in template
                      ? "name"
                      : "title" in template
                        ? "title"
                        : null;
                  if (nameKey)
                    template[nameKey] = `Nuevo item ${arrData.length + 1}`;
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
                        onClick={() =>
                          addArrayItem(arrPath, buildDefaultItem())
                        }
                        data-testid={`props-grouped-add-${arrPath}`}
                      >
                        <IconPlus className="h-4 w-4 mr-1" />
                        Agregar
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {arrData.map((item, index) => {
                        const itemLabel =
                          (item.name as string) ||
                          (item.title as string) ||
                          (item.label as string) ||
                          `Item ${index + 1}`;
                        const avatarSrc =
                          (item.avatar as string) ||
                          (item.logo as string) ||
                          "";
                        const displayAvatarSrc =
                          imageRegistry?.images?.[avatarSrc]?.src || avatarSrc;
                        const isLogo = !item.avatar && !!(item.logo as string);

                        return (
                          <Collapsible
                            key={index}
                            className="border rounded-md"
                          >
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                                data-testid={`props-grouped-item-${arrPath}-${index}-trigger`}
                              >
                                {avatarSrc ? (
                                  <div
                                    className={`w-8 h-8 flex-shrink-0 overflow-hidden border ${isLogo ? "rounded-md bg-background p-1" : "rounded-full bg-muted"}`}
                                  >
                                    <img
                                      src={displayAvatarSrc}
                                      alt={itemLabel}
                                      className={`w-full h-full ${isLogo ? "object-contain" : "object-cover"}`}
                                    />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-muted border flex-shrink-0 flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                    {itemLabel
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2)}
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
                                    onClick={() =>
                                      removeArrayItem(arrPath, index)
                                    }
                                    data-testid={`props-grouped-delete-${arrPath}-${index}`}
                                  >
                                    <IconTrash className="h-3.5 w-3.5 mr-1" />
                                    Eliminar
                                  </Button>
                                </div>
                                {fieldOrder.map((fieldKey) => {
                                  const currentValue = String(
                                    getNestedValue(item, fieldKey) ?? "",
                                  );
                                  const label =
                                    fieldLabelMap[fieldKey] ||
                                    fieldKey
                                      .replace(/_/g, " ")
                                      .replace(/\b\w/g, (c) => c.toUpperCase());
                                  const configuredField = fields.find(
                                    (f) => f.fieldName === fieldKey,
                                  );

                                  if (configuredField) {
                                    if (
                                      configuredField.editorType ===
                                      "icon-picker"
                                    ) {
                                      return (
                                        <div
                                          key={fieldKey}
                                          className="space-y-1"
                                        >
                                          <Label className="text-xs text-muted-foreground">
                                            {label}
                                          </Label>
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
                                    if (
                                      configuredField.editorType ===
                                      "color-picker"
                                    ) {
                                      const colorType =
                                        (configuredField.variant as ColorPickerVariant) ||
                                        "accent";
                                      return (
                                        <div
                                          key={fieldKey}
                                          className="space-y-1"
                                        >
                                          <Label className="text-xs text-muted-foreground">
                                            {label}
                                          </Label>
                                          <ColorPicker
                                            value={currentValue}
                                            onChange={(value) =>
                                              updateNestedField(
                                                index,
                                                fieldKey,
                                                value,
                                              )
                                            }
                                            type={colorType}
                                            label=" "
                                            allowNone={true}
                                            allowCustom={true}
                                            testIdPrefix={`props-grouped-${fieldKey}-${index}`}
                                          />
                                        </div>
                                      );
                                    }

                                    if (
                                      configuredField.editorType ===
                                      "image-picker"
                                    ) {
                                      const displaySrc =
                                        imageRegistry?.images?.[currentValue]
                                          ?.src || currentValue;
                                      return (
                                        <div
                                          key={fieldKey}
                                          className="space-y-1"
                                        >
                                          <Label className="text-xs text-muted-foreground">
                                            {label}
                                          </Label>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setImagePickerTarget({
                                                  arrayPath: arrPath,
                                                  index,
                                                  srcField: fieldKey,
                                                  currentSrc: currentValue,
                                                  currentAlt:
                                                    (item.name as string) || "",
                                                  tagFilter:
                                                    configuredField.variant,
                                                });
                                                setImagePickerOpen(true);
                                              }}
                                              className="relative w-12 h-12 rounded-md border border-input bg-muted/50 hover:bg-muted transition-colors overflow-hidden group"
                                              data-testid={`props-grouped-image-${fieldKey}-${index}`}
                                            >
                                              {currentValue ? (
                                                <>
                                                  <img
                                                    src={displaySrc}
                                                    alt={label}
                                                    className="w-full h-full object-cover"
                                                  />
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
                                                {currentValue
                                                  .split("/")
                                                  .pop() || currentValue}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    }

                                    if (
                                      configuredField.editorType ===
                                      "link-picker"
                                    ) {
                                      return (
                                        <div
                                          key={fieldKey}
                                          className="space-y-1"
                                        >
                                          <Label className="text-xs text-muted-foreground">
                                            {label}
                                          </Label>
                                          <LinkPicker
                                            value={currentValue}
                                            onChange={(url) =>
                                              updateNestedField(
                                                index,
                                                fieldKey,
                                                url,
                                              )
                                            }
                                            locale={locale}
                                            allSections={allSections}
                                            testId={`props-grouped-link-${fieldKey}-${index}`}
                                          />
                                        </div>
                                      );
                                    }
                                    if (
                                      configuredField.editorType ===
                                      "rich-text-editor"
                                    ) {
                                      return (
                                        <div
                                          key={fieldKey}
                                          className="space-y-1"
                                        >
                                          <Label className="text-xs text-muted-foreground">
                                            {label}
                                          </Label>
                                          <RichTextArea
                                            key={`${sectionIndex}-${arrPath}-${index}-${fieldKey}`}
                                            value={currentValue}
                                            onChange={(html) =>
                                              updateNestedField(
                                                index,
                                                fieldKey,
                                                html,
                                              )
                                            }
                                            placeholder={`Edit ${label}…`}
                                            minHeight="80px"
                                            locale={locale}
                                            data-testid={`props-grouped-richtext-${fieldKey}-${index}`}
                                          />
                                        </div>
                                      );
                                    }
                                    if (
                                      configuredField.editorType ===
                                      "variant-picker"
                                    ) {
                                      const variantOptions =
                                        themeConfig?.button_variants ?? [];
                                      return (
                                        <div
                                          key={fieldKey}
                                          className="space-y-1"
                                        >
                                          <Label className="text-xs text-muted-foreground">
                                            {label}
                                          </Label>
                                          <VariantPicker
                                            value={currentValue || ""}
                                            onChange={(v) =>
                                              updateNestedField(
                                                index,
                                                fieldKey,
                                                v,
                                              )
                                            }
                                            options={variantOptions}
                                            label=""
                                          />
                                        </div>
                                      );
                                    }
                                    return null;
                                  }

                                  const rawValue = getNestedValue(
                                    item,
                                    fieldKey,
                                  );
                                  if (
                                    typeof rawValue === "number" ||
                                    fieldKey === "rating"
                                  ) {
                                    return (
                                      <div key={fieldKey} className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">
                                          {label}
                                        </Label>
                                        <Input
                                          type="number"
                                          value={
                                            rawValue !== undefined
                                              ? String(rawValue)
                                              : ""
                                          }
                                          onChange={(e) => {
                                            const num =
                                              e.target.value === ""
                                                ? undefined
                                                : Number(e.target.value);
                                            updateNestedField(
                                              index,
                                              fieldKey,
                                              num,
                                            );
                                          }}
                                          min={0}
                                          max={
                                            fieldKey === "rating"
                                              ? 5
                                              : undefined
                                          }
                                          className="h-8 text-sm"
                                          data-testid={`props-grouped-number-${fieldKey}-${index}`}
                                        />
                                      </div>
                                    );
                                  }

                                  if (
                                    fieldKey === "client_comments" ||
                                    (typeof rawValue === "string" &&
                                      rawValue.length > 80)
                                  ) {
                                    return (
                                      <div key={fieldKey} className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">
                                          {label}
                                        </Label>
                                        <Textarea
                                          value={currentValue}
                                          onChange={(e) =>
                                            updateNestedField(
                                              index,
                                              fieldKey,
                                              e.target.value,
                                            )
                                          }
                                          rows={3}
                                          className="text-sm resize-none"
                                          data-testid={`props-grouped-text-${fieldKey}-${index}`}
                                        />
                                      </div>
                                    );
                                  }

                                  return (
                                    <div key={fieldKey} className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">
                                        {label}
                                      </Label>
                                      <Input
                                        value={currentValue}
                                        onChange={(e) =>
                                          updateNestedField(
                                            index,
                                            fieldKey,
                                            e.target.value,
                                          )
                                        }
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
              const nestedArrayGroups: Record<
                string,
                {
                  parentArr: string;
                  nestedArr: string;
                  leafField: string;
                  editorType: string;
                  variant?: string;
                }[]
              > = {};
              Object.entries(configuredFields).forEach(
                ([fieldPath, editorTypeRaw]) => {
                  const nestedMatch = fieldPath.match(
                    /^([\w]+)\[\]\.([\w]+)\[\]\.(.+)$/,
                  );
                  if (!nestedMatch) return;
                  const [, parentArr, nestedArr, leafField] = nestedMatch;
                  const groupKey = `${parentArr}[].${nestedArr}`;
                  if (!nestedArrayGroups[groupKey])
                    nestedArrayGroups[groupKey] = [];
                  const { type: edType, variant: edVariant } =
                    parseEditorType(editorTypeRaw);
                  nestedArrayGroups[groupKey].push({
                    parentArr,
                    nestedArr,
                    leafField,
                    editorType: edType,
                    variant: edVariant,
                  });
                },
              );

              if (Object.keys(nestedArrayGroups).length === 0) return null;

              return Object.entries(nestedArrayGroups).map(
                ([groupKey, fields]) => {
                  if (!parsedSection) return null;
                  const { parentArr, nestedArr } = fields[0];
                  const parentData = (parsedSection as Record<string, unknown>)[
                    parentArr
                  ];
                  if (!Array.isArray(parentData)) return null;

                  const nestedHiddenFields = new Set(["type"]);

                  return (
                    <div key={`nested-${groupKey}`} className="space-y-3">
                      {parentData.map((parentItem, parentIdx) => {
                        const parentItemObj = parentItem as Record<
                          string,
                          unknown
                        >;
                        const nestedData = parentItemObj[nestedArr];
                        if (!Array.isArray(nestedData)) return null;
                        const nestedItems = nestedData as Record<
                          string,
                          unknown
                        >[];

                        const parentLabel =
                          (parentItemObj.title as string) ||
                          (parentItemObj.name as string) ||
                          `Slide ${parentIdx + 1}`;
                        const resolvedArrPath = `${parentArr}.${parentIdx}.${nestedArr}`;

                        const configuredLeafNames = new Set(
                          fields.map((f) => f.leafField),
                        );
                        const collectNestedKeys = (
                          items: Record<string, unknown>[],
                        ): string[] => {
                          const keySet = new Set<string>();
                          items.forEach((item) => {
                            Object.keys(item).forEach((k) => {
                              if (
                                !configuredLeafNames.has(k) &&
                                !nestedHiddenFields.has(k) &&
                                typeof item[k] !== "object"
                              ) {
                                keySet.add(k);
                              }
                            });
                          });
                          return Array.from(keySet);
                        };
                        const extraTextFields = collectNestedKeys(nestedItems);

                        const fieldOrder = [
                          ...extraTextFields,
                          ...fields.map((f) => f.leafField),
                        ];

                        const buildNestedDefault = (): Record<
                          string,
                          unknown
                        > => {
                          if (nestedItems.length === 0) return {};
                          const template: Record<string, unknown> = {};
                          Object.keys(nestedItems[0]).forEach((k) => {
                            const val = nestedItems[0][k];
                            if (typeof val === "string") template[k] = "";
                            else if (typeof val === "number") template[k] = 0;
                          });
                          return template;
                        };

                        return (
                          <div
                            key={`nested-${groupKey}-${parentIdx}`}
                            className="space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-muted-foreground">
                                {nestedArr.replace(/_/g, " ")} — {parentLabel} (
                                {nestedItems.length})
                              </Label>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  addArrayItem(
                                    resolvedArrPath,
                                    buildNestedDefault(),
                                  )
                                }
                                data-testid={`props-nested-add-${resolvedArrPath}`}
                              >
                                <IconPlus className="h-4 w-4 mr-1" />
                                Agregar
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {nestedItems.map((nestedItem, nestedIdx) => {
                                const itemLabel =
                                  (nestedItem.alt as string) ||
                                  (nestedItem.name as string) ||
                                  (nestedItem.title as string) ||
                                  `Item ${nestedIdx + 1}`;
                                const logoSrc =
                                  (nestedItem.image_id as string) ||
                                  (nestedItem.logo as string) ||
                                  "";
                                const displayLogoSrc =
                                  imageRegistry?.images?.[logoSrc]?.src ||
                                  logoSrc;

                                return (
                                  <Collapsible
                                    key={nestedIdx}
                                    className="border rounded-md"
                                  >
                                    <CollapsibleTrigger asChild>
                                      <button
                                        type="button"
                                        className="w-full flex items-center gap-3 p-2 hover:bg-muted/50 transition-colors"
                                        data-testid={`props-nested-item-${resolvedArrPath}-${nestedIdx}-trigger`}
                                      >
                                        {logoSrc ? (
                                          <div className="w-8 h-8 flex-shrink-0 overflow-hidden border rounded-md bg-background p-1">
                                            <img
                                              src={displayLogoSrc}
                                              alt={itemLabel}
                                              className="w-full h-full object-contain"
                                            />
                                          </div>
                                        ) : (
                                          <div className="w-8 h-8 rounded-md bg-muted border flex-shrink-0 flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                            {itemLabel
                                              .slice(0, 2)
                                              .toUpperCase()}
                                          </div>
                                        )}
                                        <span className="flex-1 text-left text-xs font-medium truncate">
                                          {itemLabel}
                                        </span>
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
                                            onClick={() =>
                                              removeArrayItem(
                                                resolvedArrPath,
                                                nestedIdx,
                                              )
                                            }
                                            data-testid={`props-nested-delete-${resolvedArrPath}-${nestedIdx}`}
                                          >
                                            <IconTrash className="h-3.5 w-3.5 mr-1" />
                                            Eliminar
                                          </Button>
                                        </div>
                                        {fieldOrder.map((fieldKey) => {
                                          const currentValue = String(
                                            nestedItem[fieldKey] ?? "",
                                          );
                                          const label = fieldKey
                                            .replace(/_/g, " ")
                                            .replace(/\b\w/g, (c) =>
                                              c.toUpperCase(),
                                            );
                                          const configuredField = fields.find(
                                            (f) => f.leafField === fieldKey,
                                          );

                                          if (
                                            configuredField?.editorType ===
                                            "icon-picker"
                                          ) {
                                            return (
                                              <div
                                                key={fieldKey}
                                                className="space-y-1"
                                              >
                                                <Label className="text-xs text-muted-foreground">
                                                  {label}
                                                </Label>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setIconPickerTarget({
                                                      arrayField:
                                                        resolvedArrPath,
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
                                                  {renderIconByName(
                                                    currentValue,
                                                  )}
                                                </button>
                                              </div>
                                            );
                                          }

                                          if (
                                            configuredField?.editorType ===
                                            "image-picker"
                                          ) {
                                            const displaySrc =
                                              imageRegistry?.images?.[
                                                currentValue
                                              ]?.src || currentValue;
                                            return (
                                              <div
                                                key={fieldKey}
                                                className="space-y-1"
                                              >
                                                <Label className="text-xs text-muted-foreground">
                                                  {label}
                                                </Label>
                                                <div className="flex items-center gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setImagePickerTarget({
                                                        arrayPath:
                                                          resolvedArrPath,
                                                        index: nestedIdx,
                                                        srcField: fieldKey,
                                                        currentSrc:
                                                          currentValue,
                                                        currentAlt:
                                                          (nestedItem.alt as string) ||
                                                          "",
                                                        tagFilter:
                                                          configuredField.variant,
                                                      });
                                                      setImagePickerOpen(true);
                                                    }}
                                                    className="relative w-10 h-10 rounded-md border border-input bg-muted/50 hover:bg-muted transition-colors overflow-hidden group"
                                                    data-testid={`props-nested-image-${fieldKey}-${nestedIdx}`}
                                                  >
                                                    {currentValue ? (
                                                      <>
                                                        <img
                                                          src={displaySrc}
                                                          alt={label}
                                                          className="w-full h-full object-contain p-0.5"
                                                        />
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

                                          if (
                                            typeof nestedItem[fieldKey] ===
                                            "number"
                                          ) {
                                            return (
                                              <div
                                                key={fieldKey}
                                                className="space-y-1"
                                              >
                                                <Label className="text-xs text-muted-foreground">
                                                  {label}
                                                </Label>
                                                <Input
                                                  type="number"
                                                  value={currentValue}
                                                  onChange={(e) => {
                                                    const num =
                                                      e.target.value === ""
                                                        ? undefined
                                                        : Number(
                                                            e.target.value,
                                                          );
                                                    updateArrayItemField(
                                                      resolvedArrPath,
                                                      nestedIdx,
                                                      fieldKey,
                                                      num as number,
                                                    );
                                                  }}
                                                  className="h-7 text-xs"
                                                  data-testid={`props-nested-number-${fieldKey}-${nestedIdx}`}
                                                />
                                              </div>
                                            );
                                          }

                                          return (
                                            <div
                                              key={fieldKey}
                                              className="space-y-1"
                                            >
                                              <Label className="text-xs text-muted-foreground">
                                                {label}
                                              </Label>
                                              <Input
                                                value={currentValue}
                                                onChange={(e) =>
                                                  updateArrayItemField(
                                                    resolvedArrPath,
                                                    nestedIdx,
                                                    fieldKey,
                                                    e.target.value,
                                                  )
                                                }
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
                },
              );
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
                  const supportedTypes = new Set([
                    "color-picker",
                    "image-picker",
                    "video-picker",
                    "link-picker",
                    "rich-text-editor",
                    "variant-picker",
                  ]);
                  const allForArr = Object.entries(configuredFields).filter(
                    ([fp]) => fp.startsWith(`${arrPathCheck}[].`),
                  );
                  const allSupported = allForArr.every(([, et]) =>
                    supportedTypes.has(parseEditorType(et).type),
                  );
                  if (allForArr.length >= 2 && allSupported) return null;
                }

                // Parse editor type with optional variant (e.g., "color-picker:background")
                const { type: editorType, variant } =
                  parseEditorType(editorTypeRaw);

                // Handle simple field paths (e.g., "image" or "nested.image")
                const isSimpleField = !fieldPath.includes("[]");
                // Simple image-picker and video-picker are already rendered by the dedicated top-level loops above
                if (isSimpleField && (editorType === "image-picker" || editorType === "video-picker")) {
                  return null;
                }

                // For dotted simple fields like "cta_button.url", skip if the parent object doesn't exist in the YAML
                if (isSimpleField && fieldPath.includes(".")) {
                  const parentParts = fieldPath.split(".");
                  let parentExists: unknown = parsedSection;
                  for (let i = 0; i < parentParts.length - 1; i++) {
                    if (!parentExists || typeof parentExists !== "object") {
                      parentExists = undefined;
                      break;
                    }
                    parentExists = (parentExists as Record<string, unknown>)[parentParts[i]];
                  }
                  if (parentExists === undefined || parentExists === null) return null;
                }

                if (isSimpleField && editorType === "link-picker") {
                  const getSimpleLinkValue = () => {
                    if (!parsedSection) return "";
                    const pathParts = fieldPath.split(".");
                    let current: unknown = parsedSection;
                    for (const part of pathParts) {
                      if (!current || typeof current !== "object") return "";
                      current = (current as Record<string, unknown>)[part];
                    }
                    return (current as string) || "";
                  };

                  const currentValue = getSimpleLinkValue();
                  const fieldLabel = getFieldLabel(fieldPath);

                  return (
                    <div key={fieldPath} className="space-y-2">
                      <Label className="text-sm font-medium">
                        {fieldLabel}
                      </Label>
                      <LinkPicker
                        value={currentValue}
                        onChange={(url) => updateProperty(fieldPath, url)}
                        locale={locale}
                        allSections={allSections}
                        testId={`props-link-${fieldPath.replace(/\./g, "-")}`}
                      />
                    </div>
                  );
                }

                // Handle simple field paths with image-with-style-picker (e.g., "left.image" or just "image")
                if (isSimpleField && editorType === "image-with-style-picker") {
                  const getNestedValue = (
                    path: string,
                    defaultValue: unknown = "",
                  ) => {
                    if (!parsedSection) return defaultValue;
                    if (!path) return defaultValue;
                    const pathParts = path.split(".");
                    let current: unknown = parsedSection;
                    for (const part of pathParts) {
                      if (!current || typeof current !== "object")
                        return defaultValue;
                      current = (current as Record<string, unknown>)[part];
                    }
                    return current ?? defaultValue;
                  };

                  const pathParts = fieldPath.split(".");
                  const parentPath = pathParts.slice(0, -1).join(".");
                  const side = pathParts[0];

                  const hasParent = parentPath.length > 0;
                  const fieldPrefix = hasParent ? `${parentPath}.` : "";

                  const rawValue = getNestedValue(fieldPath, "");
                  const currentValue = typeof rawValue === "string"
                    ? rawValue
                    : (rawValue && typeof rawValue === "object" && "src" in (rawValue as Record<string, unknown>))
                      ? String((rawValue as Record<string, unknown>).src || "")
                      : "";
                  const currentAlt = (getNestedValue(
                    `${fieldPrefix}image_alt`,
                    "",
                  ) as string) || (
                    typeof rawValue === "object" && rawValue && "alt" in (rawValue as Record<string, unknown>)
                      ? String((rawValue as Record<string, unknown>).alt || "")
                      : ""
                  );
                  const currentObjectFit = getNestedValue(
                    `${fieldPrefix}image_object_fit`,
                    "",
                  ) as string;
                  const currentObjectPosition = getNestedValue(
                    `${fieldPrefix}image_object_position`,
                    "",
                  ) as string;

                  const fieldLabel = getFieldLabel(fieldPath);

                  return (
                    <ImageWithStylePicker
                      key={fieldPath}
                      label={fieldLabel}
                      value={currentValue}
                      alt={currentAlt}
                      objectFit={currentObjectFit}
                      objectPosition={currentObjectPosition}
                      tagFilter={variant}
                      testId={`props-image-style-${side}`}
                      onChangeSrc={(src, newAlt) => {
                        updateProperty(fieldPath, src);
                        if (newAlt) updateProperty(`${fieldPrefix}image_alt`, newAlt);
                      }}
                      onChangeAlt={(newAlt) =>
                        updateProperty(`${fieldPrefix}image_alt`, newAlt)
                      }
                      onChangeObjectFit={(fit) =>
                        updateProperty(`${fieldPrefix}image_object_fit`, fit)
                      }
                      onChangeObjectPosition={(pos) =>
                        updateProperty(`${fieldPrefix}image_object_position`, pos)
                      }
                      onRemove={() => updateProperty(fieldPath, "")}
                    />
                  );
                }

                // Parse field path - supports single level like "features[].icon"
                // and multi-level nested arrays like "courses[].badges[].icon"
                const arrayBracketCount = (fieldPath.match(/\[\]/g) || [])
                  .length;

                // Multi-level nested array path (e.g., "courses[].badges[].icon")
                if (arrayBracketCount > 1) {
                  const segments = fieldPath.split("[].");
                  const itemField = segments[segments.length - 1];
                  const arraySegments = segments.slice(0, -1);

                  const getNestedLabel = (item: Record<string, unknown>) =>
                    (item.tab_label as string) ||
                    (item.title as string) ||
                    (item.label as string) ||
                    (item.name as string) ||
                    (item.text as string) ||
                    "";

                  type NestedItem = {
                    parentPath: string[];
                    parentIndices: number[];
                    parentLabel: string;
                    item: Record<string, unknown>;
                  };

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
                        if (
                          current &&
                          typeof current === "object" &&
                          !Array.isArray(current)
                        ) {
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
                        const label =
                          getNestedLabel(
                            arrayItem as Record<string, unknown>,
                          ) || `${segParts[segParts.length - 1]} ${idx + 1}`;
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
                  if (
                    leafItems.length === 0 &&
                    editorType !== "image-with-style-picker"
                  )
                    return null;

                  const lastSegmentLabel =
                    arraySegments[arraySegments.length - 1].split(".").pop() ||
                    "";

                  const updateNestedField = (
                    nestedItem: NestedItem,
                    value: string | number | boolean,
                  ) => {
                    try {
                      const parsed = safeYamlLoad(yamlContent) as Record<
                        string,
                        unknown
                      >;
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

                      const newYaml = safeYamlDump(parsed, {
                        lineWidth: -1,
                        noRefs: true,
                        quotingType: '"',
                      });
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
                      const topLabel =
                        leaf.parentLabel.split(" > ")[0] || "Items";
                      if (!groupedByParent[topLabel])
                        groupedByParent[topLabel] = [];
                      groupedByParent[topLabel].push(leaf);
                    });

                    return (
                      <div key={fieldPath} className="space-y-3">
                        <Label className="text-sm font-medium capitalize">
                          {lastSegmentLabel} Icons
                        </Label>
                        {Object.entries(groupedByParent).map(
                          ([groupLabel, items]) => (
                            <div key={groupLabel} className="space-y-1">
                              <span className="text-xs text-muted-foreground">
                                {groupLabel}
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {items.map((leaf, idx) => {
                                  const currentValue =
                                    (leaf.item[itemField] as string) || "";
                                  const leafLabel =
                                    leaf.parentLabel
                                      .split(" > ")
                                      .slice(1)
                                      .join(" > ") || `Item ${idx + 1}`;
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
                                        setNestedUpdateFn(
                                          () => (value: string) =>
                                            updateNestedField(leaf, value),
                                        );
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
                          ),
                        )}
                      </div>
                    );
                  }

                  if (editorType === "image-picker") {
                    const groupedByParent: Record<string, NestedItem[]> = {};
                    leafItems.forEach((leaf) => {
                      const topLabel =
                        leaf.parentLabel.split(" > ")[0] || "Items";
                      if (!groupedByParent[topLabel])
                        groupedByParent[topLabel] = [];
                      groupedByParent[topLabel].push(leaf);
                    });

                    return (
                      <div key={fieldPath} className="space-y-3">
                        <Label className="text-sm font-medium capitalize">
                          {lastSegmentLabel.replace(/_/g, " ")}
                        </Label>
                        {Object.entries(groupedByParent).map(
                          ([groupLabel, items]) => (
                            <div key={groupLabel} className="space-y-1">
                              <span className="text-xs text-muted-foreground">
                                {groupLabel}
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {items.map((leaf, idx) => {
                                  const currentValue =
                                    (leaf.item[itemField] as string) || "";
                                  const altValue =
                                    (leaf.item.alt as string) || "";
                                  const displaySrc =
                                    imageRegistry?.images?.[currentValue]
                                      ?.src || currentValue;
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
                                        setNestedUpdateFn(
                                          () => (value: string) =>
                                            updateNestedField(leaf, value),
                                        );
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
                          ),
                        )}
                      </div>
                    );
                  }

                  {
                    const renderNestedItemEditor = (
                      leaf: { parentPath: string[]; parentIndices: number[]; parentLabel: string; item: Record<string, unknown> },
                      idx: number,
                    ) => {
                      const currentValue = (leaf.item[itemField] as string) || "";
                      const leafLabel = leaf.parentLabel || `Item ${idx + 1}`;
                      const handleNestedChange = (val: string | number | boolean) => updateNestedField(leaf, val);

                      switch (editorType) {
                        case "color-picker": {
                          const colorType = (variant as ColorPickerVariant) || "accent";
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground min-w-[80px] truncate">{leafLabel}</span>
                              <ColorPicker
                                value={currentValue}
                                onChange={(v) => handleNestedChange(v)}
                                type={colorType}
                                label=" "
                                allowNone={true}
                                allowCustom={true}
                                testIdPrefix={`props-color-nested-${idx}`}
                              />
                            </div>
                          );
                        }
                        case "link-picker":
                          return (
                            <div key={idx} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{leafLabel}</Label>
                              <LinkPicker
                                value={currentValue}
                                onChange={(url) => handleNestedChange(url)}
                                locale={locale}
                                allSections={allSections}
                                testId={`props-link-nested-${idx}`}
                              />
                            </div>
                          );
                        case "rich-text-editor":
                          return (
                            <div key={idx} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{leafLabel}</Label>
                              <RichTextArea
                                value={currentValue}
                                onChange={(html) => handleNestedChange(html)}
                                placeholder={`Edit ${leafLabel}…`}
                                minHeight="80px"
                                locale={locale}
                              />
                            </div>
                          );
                        case "boolean-toggle": {
                          const boolValue = leaf.item[itemField] === true || leaf.item[itemField] === "true";
                          return (
                            <div key={idx} className="flex items-center gap-3">
                              <Label className="text-sm text-muted-foreground">{leafLabel}</Label>
                              <Switch
                                checked={boolValue}
                                onCheckedChange={(checked) => handleNestedChange(checked)}
                              />
                            </div>
                          );
                        }
                        default:
                          return (
                            <div key={idx} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{leafLabel}</Label>
                              <Input
                                value={currentValue}
                                onChange={(e) => handleNestedChange(e.target.value)}
                                className="h-8 text-sm"
                                data-testid={`props-${editorType}-nested-${idx}`}
                              />
                            </div>
                          );
                      }
                    };

                    return (
                      <div key={fieldPath} className="space-y-3">
                        <Label className="text-sm font-medium capitalize">
                          {lastSegmentLabel.replace(/_/g, " ")}
                        </Label>
                        <div className="space-y-2">
                          {leafItems.map((leaf, idx) => renderNestedItemEditor(leaf, idx))}
                        </div>
                      </div>
                    );
                  }
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
                  const fieldLabel = getFieldLabel(fieldPath);
                  return (
                    <div key={fieldPath} className="space-y-2">
                      <Label className="text-sm font-medium">
                        {fieldLabel}
                      </Label>
                      <RichTextArea
                        key={`${sectionIndex}-${fieldPath}`}
                        value={currentValue}
                        onChange={(html) => updateProperty(fieldPath, html)}
                        placeholder={`Edit ${fieldLabel}…`}
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
                  const fieldLabel = getFieldLabel(fieldPath);
                  return (
                    <div key={fieldPath} className="space-y-2">
                      <MarkdownEditorField
                        key={`${sectionIndex}-${fieldPath}`}
                        value={currentValue}
                        onChange={(md) => updateProperty(fieldPath, md)}
                        label={fieldLabel}
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
                  const fieldLabel = getFieldLabel(fieldPath);
                  return (
                    <div key={fieldPath} className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Label className="text-sm font-medium">
                          {fieldLabel}
                        </Label>
                        <Switch
                          checked={currentValue}
                          onCheckedChange={(checked) =>
                            updatePropertyWithValue(fieldPath, checked)
                          }
                          data-testid={`props-toggle-${fieldLabel}`}
                        />
                      </div>
                    </div>
                  );
                }

                if (isSimpleField && editorType === "string-picker") {
                  const options = variant ? variant.split(",") : [];
                  const getSimpleStringValue = () => {
                    if (!parsedSection) return "";
                    const pathParts = fieldPath.split(".");
                    let current: unknown = parsedSection;
                    for (const part of pathParts) {
                      if (!current || typeof current !== "object") return "";
                      current = (current as Record<string, unknown>)[part];
                    }
                    return typeof current === "string" ? current : "";
                  };
                  const currentValue = getSimpleStringValue();
                  const fieldLabel = getFieldLabel(fieldPath);
                  return (
                    <div key={fieldPath} className="space-y-2">
                      <Label className="text-sm font-medium">{fieldLabel}</Label>
                      <Select
                        value={currentValue || options[0] || ""}
                        onValueChange={(val) => updatePropertyWithValue(fieldPath, val)}
                      >
                        <SelectTrigger data-testid={`props-select-${fieldLabel}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                if (isSimpleField && editorType === "font-size-picker") {
                  const fontSizes = themeConfig?.fontSizes ?? [];
                  const getSimpleStringValue = () => {
                    if (!parsedSection) return "";
                    const pathParts = fieldPath.split(".");
                    let current: unknown = parsedSection;
                    for (const part of pathParts) {
                      if (!current || typeof current !== "object") return "";
                      current = (current as Record<string, unknown>)[part];
                    }
                    return typeof current === "string" ? current : "";
                  };
                  const currentValue = getSimpleStringValue();
                  const fieldLabel = getFieldLabel(fieldPath);
                  return (
                    <div key={fieldPath} className="space-y-2">
                      <Label className="text-sm font-medium">{fieldLabel}</Label>
                      <Select
                        value={currentValue || ""}
                        onValueChange={(val) => updatePropertyWithValue(fieldPath, val)}
                      >
                        <SelectTrigger data-testid={`props-select-${fieldLabel}`}>
                          <SelectValue placeholder="Default" />
                        </SelectTrigger>
                        <SelectContent>
                          {fontSizes.map((size) => (
                            <SelectItem key={size.id} value={size.tailwind}>
                              <span className="flex items-center gap-2">
                                <span style={{ fontSize: size.value }} className="leading-none">{size.label}</span>
                                <span className="text-muted-foreground text-xs">{size.tailwind}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                // Handle cta-picker: "cta_buttons[]" or "features[].cta"
                if (editorType === "cta-picker") {
                  // Match "arrayName[]" or "path.arrayName[].subField"
                  const ctaMatchWhole = fieldPath.match(/^([\w.]+)\[\]$/);
                  const ctaMatchNested = fieldPath.match(/^([\w.]+)\[\]\.([\w.]+)$/);

                  if (ctaMatchWhole || ctaMatchNested) {
                    const ctaArrayPath = ctaMatchWhole ? ctaMatchWhole[1] : ctaMatchNested![1];
                    const ctaSubPath = ctaMatchNested ? ctaMatchNested[2] : null;

                    const getCtaArrayData = () => {
                      if (!parsedSection) return undefined;
                      const pathParts = ctaArrayPath.split(".");
                      let current: Record<string, unknown> = parsedSection as Record<string, unknown>;
                      for (const part of pathParts) {
                        if (!current || typeof current !== "object") return undefined;
                        current = current[part] as Record<string, unknown>;
                      }
                      return current as unknown as Record<string, unknown>[] | undefined;
                    };

                    const ctaArrayData = getCtaArrayData();
                    const safeCtaArray = Array.isArray(ctaArrayData) ? ctaArrayData : [];

                    const getCtaField = (item: Record<string, unknown>, field: string): string => {
                      if (ctaSubPath) {
                        const sub = item[ctaSubPath] as Record<string, unknown> | undefined;
                        return (sub?.[field] as string) || "";
                      }
                      return (item[field] as string) || "";
                    };

                    const updateCtaField = (index: number, field: string, value: string) => {
                      const fullField = ctaSubPath ? `${ctaSubPath}.${field}` : field;
                      updateArrayItemField(ctaArrayPath, index, fullField, value);
                    };

                    const ctaLabel = getFieldLabel(ctaSubPath || ctaArrayPath);

                    return (
                      <div key={fieldPath} className="space-y-3">
                        <Label className="text-sm font-medium capitalize">
                          {ctaLabel.replace(/_/g, " ")} ({safeCtaArray.length})
                        </Label>
                        <div className="space-y-2">
                          {safeCtaArray.map((item, index) => {
                            const btnText = getCtaField(item, "text") || (item.title as string) || `CTA ${index + 1}`;
                            const btnUrl = getCtaField(item, "url");
                            const btnIcon = getCtaField(item, "icon");
                            const btnVariant = getCtaField(item, "variant");

                            return (
                              <Collapsible key={index} className="border rounded-md">
                                <CollapsibleTrigger asChild>
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                                    data-testid={`props-cta-${index}-trigger`}
                                  >
                                    <div className="w-8 h-8 rounded-md bg-muted border flex-shrink-0 flex items-center justify-center">
                                      {btnIcon ? (
                                        renderIconByName(btnIcon)
                                      ) : (
                                        <span className="text-xs text-muted-foreground">#{index + 1}</span>
                                      )}
                                    </div>
                                    <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                                  </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="p-3 pt-0 space-y-3 border-t">
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">Text</Label>
                                      <Input
                                        value={btnText}
                                        onChange={(e) => updateCtaField(index, "text", e.target.value)}
                                        placeholder="Button text"
                                        data-testid={`props-cta-${index}-text`}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">URL</Label>
                                      <LinkPicker
                                        value={btnUrl}
                                        onChange={(url) => updateCtaField(index, "url", url)}
                                        locale={locale}
                                        allSections={allSections}
                                        testId={`props-cta-${index}-url`}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">Variant</Label>
                                      <Select
                                        value={btnVariant || "primary"}
                                        onValueChange={(val) => updateCtaField(index, "variant", val)}
                                      >
                                        <SelectTrigger data-testid={`props-cta-${index}-variant`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="primary">Primary</SelectItem>
                                          <SelectItem value="secondary">Secondary</SelectItem>
                                          <SelectItem value="outline">Outline</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">Icon</Label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIconPickerTarget({
                                            arrayField: ctaArrayPath,
                                            index,
                                            field: ctaSubPath ? `${ctaSubPath}.icon` : "icon",
                                            label: btnText,
                                            currentIcon: btnIcon,
                                          });
                                          setIconPickerOpen(true);
                                        }}
                                        className="flex items-center gap-2 w-full transition-colors"
                                        data-testid={`props-cta-${index}-icon`}
                                      >
                                        <div className="w-8 h-8 rounded border bg-background flex items-center justify-center flex-shrink-0">
                                          {btnIcon ? renderIconByName(btnIcon) : (
                                            <IconPlus className="h-4 w-4 text-muted-foreground" />
                                          )}
                                        </div>
                                        <span className="text-sm text-muted-foreground flex-1 text-left truncate">
                                          {btnIcon || "No icon"}
                                        </span>
                                      </button>
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                }

                // Parse field path like "features[].icon" or "signup_card.features[].icon"
                // Matches: optional.nested.path.arrayName[].fieldName
                const match = fieldPath.match(/^([\w.]+)\[\]\.([\w.]+)$/);
                if (!match) return null;

                const [, arrayPath, itemField] = match;

                const getArrayData = () => {
                  if (!parsedSection) return undefined;
                  const pathParts = arrayPath.split(".");
                  let current: Record<string, unknown> =
                    parsedSection as Record<string, unknown>;

                  for (const part of pathParts) {
                    if (!current || typeof current !== "object")
                      return undefined;
                    current = current[part] as Record<string, unknown>;
                  }

                  return current as unknown as
                    | Record<string, unknown>[]
                    | undefined;
                };

                const arrayData = getArrayData();

                if (
                  arrayData === undefined &&
                  editorType !== "image-with-style-picker"
                )
                  return null;

                const safeArrayData = Array.isArray(arrayData) ? arrayData : [];

                const arrayFieldLabel = getFieldLabel(arrayPath);

                if (editorType === "icon-picker") {
                  return (
                    <div key={fieldPath} className="space-y-2">
                      <Label className="text-sm font-medium">
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

                if (editorType === "image-picker") {
                  // Check if this is a logo picker for items with logoHeight (works for hero marquee, awards_marquee, etc.)
                  // Detects if items have "logo" field and any item has "logoHeight" defined
                  const isLogoMarquee =
                    itemField === "logo" &&
                    safeArrayData.some(
                      (item) => "logoHeight" in item || "logo" in item,
                    );

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
                            const currentValue =
                              (item[itemField] as string) || "";
                            const altValue = (item.alt as string) || "";
                            const logoHeight =
                              (item.logoHeight as string) || "";
                            const displaySrc =
                              imageRegistry?.images?.[currentValue]?.src ||
                              currentValue;

                            return (
                              <Collapsible
                                key={index}
                                className="border rounded-md"
                              >
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
                                        <Label className="text-xs text-muted-foreground">
                                          Alt text
                                        </Label>
                                        <Input
                                          value={altValue}
                                          onChange={(e) =>
                                            updateArrayItemField(
                                              arrayPath,
                                              index,
                                              "alt",
                                              e.target.value,
                                            )
                                          }
                                          placeholder="Logo description"
                                          className="h-8 text-sm"
                                          data-testid={`props-logo-marquee-${index}-alt`}
                                        />
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          removeArrayItem(arrayPath, index)
                                        }
                                        className="text-muted-foreground hover:text-destructive"
                                        data-testid={`props-logo-marquee-${index}-delete`}
                                        title="Remove logo"
                                      >
                                        <IconTrash className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">
                                        Logo Height (CSS classes)
                                      </Label>
                                      <Input
                                        value={logoHeight}
                                        onChange={(e) =>
                                          updateArrayItemField(
                                            arrayPath,
                                            index,
                                            "logoHeight",
                                            e.target.value,
                                          )
                                        }
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
                        {getFieldLabel(itemField)}
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {safeArrayData.map((item, index) => {
                          const currentValue =
                            (item[itemField] as string) || "";
                          const altValue = (item.alt as string) || "";
                          // For ID fields, look up the actual src from registry
                          const displaySrc =
                            imageRegistry?.images?.[currentValue]?.src ||
                            currentValue;

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

                if (editorType === "image-with-style-picker") {
                  const MAX_IMAGES = 4;
                  const hasImages = safeArrayData.length > 0;

                  // Detect if this is a "tabs" array (bullet_tabs_showcase) which has limited styling options
                  // vs a regular "images" array which has full styling options
                  const isTabsArray =
                    arrayPath === "tabs" || arrayPath.endsWith(".tabs");

                  // Detect if array items have non-image fields (e.g. cards with title, description, video).
                  // In that case, delete should clear the image field instead of removing the whole item.
                  const imageRelatedKeys = new Set(["src", "alt", "object_fit", "object_position", "border_radius", "width", "height", "max_width", "max_height", "opacity", "filter", "image_id", "image_object_fit", "image_object_position", itemField]);
                  const isMixedItemArray = safeArrayData.length > 0 && Object.keys(safeArrayData[0]).some(k => !imageRelatedKeys.has(k));

                  // For tabs: use image_object_fit/image_object_position (schema naming)
                  // For images: use object_fit/object_position
                  const objectFitField = isTabsArray
                    ? "image_object_fit"
                    : "object_fit";
                  const objectPositionField = isTabsArray
                    ? "image_object_position"
                    : "object_position";

                  const initializeDefaultImages = () => {
                    const defaultImages = [
                      {
                        src: "",
                        alt: "Student 1",
                        object_fit: "cover",
                        object_position: "center top",
                        border_radius: "0.5rem",
                      },
                      {
                        src: "",
                        alt: "Student 2",
                        object_fit: "cover",
                        object_position: "center top",
                        border_radius: "0.5rem",
                      },
                      {
                        src: "",
                        alt: "Student 3",
                        object_fit: "cover",
                        object_position: "center top",
                        border_radius: "0.5rem",
                      },
                      {
                        src: "",
                        alt: "Student 4",
                        object_fit: "cover",
                        object_position: "center top",
                        border_radius: "0.5rem",
                      },
                    ];
                    updateArrayField(arrayPath, defaultImages);
                  };

                  return (
                    <div key={fieldPath} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          {isTabsArray
                            ? `Imágenes de Tabs (${safeArrayData.length})`
                            : `${getFieldLabel(itemField)} (${safeArrayData.length}/${MAX_IMAGES})`}
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
                          <p>
                            Haz clic en "Inicializar imágenes" para
                            personalizarlas.
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        {safeArrayData.map((item, index) => {
                          const currentSrc = (item[itemField] as string) || "";
                          const currentAlt = (item.alt as string) || "";
                          const displaySrc =
                            imageRegistry?.images?.[currentSrc]?.src ||
                            currentSrc;

                          return (
                            <Collapsible
                              key={index}
                              className="border rounded-md"
                            >
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
                                        alt={
                                          currentAlt || `Imagen ${index + 1}`
                                        }
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
                                          clearFieldOnly: isMixedItemArray,
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
                                      <Label className="text-xs text-muted-foreground">
                                        Alt text
                                      </Label>
                                      <Input
                                        value={currentAlt}
                                        onChange={(e) =>
                                          updateArrayItemField(
                                            arrayPath,
                                            index,
                                            "alt",
                                            e.target.value,
                                          )
                                        }
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
                                        onClick={() => {
                                          if (isMixedItemArray) {
                                            updateArrayItemField(arrayPath, index, itemField, "");
                                          } else {
                                            removeArrayItem(arrayPath, index);
                                          }
                                        }}
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
                                      <Label className="text-xs text-muted-foreground">
                                        Object Fit
                                      </Label>
                                      <Select
                                        value={
                                          (item[objectFitField] as string) ||
                                          "cover"
                                        }
                                        onValueChange={(value) =>
                                          updateArrayItemField(
                                            arrayPath,
                                            index,
                                            objectFitField,
                                            value,
                                          )
                                        }
                                      >
                                        <SelectTrigger
                                          className="h-8 text-sm"
                                          data-testid={`props-image-style-${index}-object-fit`}
                                        >
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="cover">
                                            Cover
                                          </SelectItem>
                                          <SelectItem value="contain">
                                            Contain
                                          </SelectItem>
                                          <SelectItem value="fill">
                                            Fill
                                          </SelectItem>
                                          <SelectItem value="none">
                                            None
                                          </SelectItem>
                                          <SelectItem value="scale-down">
                                            Scale Down
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">
                                        Object Position
                                      </Label>
                                      <Input
                                        value={
                                          (item[
                                            objectPositionField
                                          ] as string) ?? ""
                                        }
                                        onChange={(e) =>
                                          updateArrayItemField(
                                            arrayPath,
                                            index,
                                            objectPositionField,
                                            e.target.value,
                                          )
                                        }
                                        placeholder="center top"
                                        className="h-8 text-sm"
                                        data-testid={`props-image-style-${index}-object-position`}
                                      />
                                    </div>

                                    {!isTabsArray && (
                                      <>
                                        <div className="space-y-1">
                                          <Label className="text-xs text-muted-foreground">
                                            Border Radius
                                          </Label>
                                          <Input
                                            value={
                                              (item.border_radius as string) ??
                                              ""
                                            }
                                            onChange={(e) =>
                                              updateArrayItemField(
                                                arrayPath,
                                                index,
                                                "border_radius",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="0.5rem"
                                            className="h-8 text-sm"
                                            data-testid={`props-image-style-${index}-border-radius`}
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <Label className="text-xs text-muted-foreground">
                                            Opacidad
                                          </Label>
                                          <Input
                                            type="number"
                                            min={0}
                                            max={1}
                                            step={0.1}
                                            value={
                                              (item.opacity as number) ?? 1
                                            }
                                            onChange={(e) =>
                                              updateArrayItemField(
                                                arrayPath,
                                                index,
                                                "opacity",
                                                parseFloat(e.target.value) || 1,
                                              )
                                            }
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
                                        <Label className="text-xs text-muted-foreground">
                                          CSS Filter
                                        </Label>
                                        <Input
                                          value={(item.filter as string) || ""}
                                          onChange={(e) =>
                                            updateArrayItemField(
                                              arrayPath,
                                              index,
                                              "filter",
                                              e.target.value,
                                            )
                                          }
                                          placeholder="grayscale(50%)"
                                          className="h-8 text-sm"
                                          data-testid={`props-image-style-${index}-filter`}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">
                                          Altura
                                        </Label>
                                        <Input
                                          value={(item.height as string) || ""}
                                          onChange={(e) =>
                                            updateArrayItemField(
                                              arrayPath,
                                              index,
                                              "height",
                                              e.target.value,
                                            )
                                          }
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

                        {!isTabsArray &&
                          safeArrayData.length > 0 &&
                          safeArrayData.length < MAX_IMAGES && (
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
                              Añadir imagen ({safeArrayData.length}/{MAX_IMAGES}
                              )
                            </button>
                          )}
                      </div>
                    </div>
                  );
                }

                if (editorType === "video-picker") {
                  const resolveNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
                    const parts = path.split(".");
                    let cur: unknown = obj;
                    for (const p of parts) {
                      if (!cur || typeof cur !== "object") return undefined;
                      cur = (cur as Record<string, unknown>)[p];
                    }
                    return cur;
                  };

                  const itemFieldParts = itemField.split(".");
                  const parentPrefix = itemFieldParts.length > 1
                    ? itemFieldParts.slice(0, -1).join(".") + "."
                    : "";

                  return (
                    <div key={fieldPath} className="space-y-3">
                      <Label className="text-sm font-medium capitalize">
                        {getFieldLabel(itemField)} Videos
                      </Label>
                      <div className="space-y-2">
                        {safeArrayData.map((item, index) => {
                          const currentUrl = (resolveNestedValue(item, itemField) as string) || "";
                          const currentRatio = (resolveNestedValue(item, parentPrefix + "ratio") as string) || "";
                          const currentMuted = resolveNestedValue(item, parentPrefix + "muted");
                          const currentAutoplay = resolveNestedValue(item, parentPrefix + "autoplay");
                          const currentLoop = resolveNestedValue(item, parentPrefix + "loop");
                          const currentPreviewImage = (resolveNestedValue(item, parentPrefix + "preview_image_url") as string) || "";
                          const itemLabel =
                            (item.title as string) ||
                            (item.name as string) ||
                            (item.label as string) ||
                            `Item ${index + 1}`;

                          return (
                            <Collapsible key={index} className="border rounded-md">
                              <CollapsibleTrigger asChild>
                                <button
                                  type="button"
                                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                                  data-testid={`props-video-${arrayFieldLabel}-${index}-trigger`}
                                >
                                  <div className="w-10 h-10 rounded-md overflow-hidden bg-muted border flex-shrink-0 flex items-center justify-center">
                                    <IconVideo className={`h-5 w-5 ${currentUrl ? "text-primary" : "text-muted-foreground"}`} />
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <span className="text-sm font-medium block">
                                      {itemLabel}
                                    </span>
                                    {currentUrl && (
                                      <span className="text-xs text-muted-foreground truncate block">
                                        {currentUrl.split("/").pop() || currentUrl}
                                      </span>
                                    )}
                                  </div>
                                  <IconChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="p-3 pt-0 space-y-3 border-t">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setVideoPickerTarget({
                                          arrayPath,
                                          index,
                                          field: itemField,
                                          currentUrl,
                                          label: `${itemLabel} Video`,
                                        });
                                        setVideoPickerOpen(true);
                                      }}
                                      className="relative w-16 h-16 rounded-md border border-input bg-muted/50 hover:bg-muted transition-colors overflow-hidden group"
                                      data-testid={`props-video-${arrayFieldLabel}-${index}-picker`}
                                      title="Change video"
                                    >
                                      {currentUrl ? (
                                        <>
                                          <div className="w-full h-full flex items-center justify-center bg-muted">
                                            <IconVideo className="h-6 w-6 text-primary" />
                                          </div>
                                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <IconVideo className="h-5 w-5 text-white" />
                                          </div>
                                        </>
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <IconVideo className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                      )}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      {currentUrl ? (
                                        <span className="text-xs text-muted-foreground break-all line-clamp-3">
                                          {currentUrl}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-muted-foreground italic">
                                          No video selected
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setImagePickerTarget({
                                            arrayPath,
                                            index,
                                            srcField: parentPrefix + "preview_image_url",
                                            currentSrc: currentPreviewImage,
                                            currentAlt: "",
                                          });
                                          setImagePickerOpen(true);
                                        }}
                                        className="relative w-16 h-16 rounded-md border border-input bg-muted/50 hover:bg-muted transition-colors overflow-hidden group flex-shrink-0"
                                        data-testid={`props-video-${arrayFieldLabel}-${index}-preview-image`}
                                        title="Change preview image"
                                      >
                                        {currentPreviewImage ? (
                                          <>
                                            <img
                                              src={currentPreviewImage}
                                              alt="Preview"
                                              className="w-full h-full object-cover"
                                            />
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
                                      <div className="flex-1 min-w-0">
                                        {currentPreviewImage ? (
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs text-muted-foreground truncate flex-1">
                                              {currentPreviewImage.split("/").pop() || currentPreviewImage}
                                            </span>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6 flex-shrink-0"
                                              onClick={() => updateArrayItemField(arrayPath, index, parentPrefix + "preview_image_url", "")}
                                              data-testid={`props-video-${arrayFieldLabel}-${index}-preview-image-clear`}
                                            >
                                              <IconX className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-muted-foreground italic">
                                            No preview image selected
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">
                                      Aspect Ratio
                                    </Label>
                                    <Select
                                      value={currentRatio || "16:9"}
                                      onValueChange={(value) =>
                                        updateArrayItemField(arrayPath, index, parentPrefix + "ratio", value)
                                      }
                                    >
                                      <SelectTrigger
                                        className="h-8 text-sm"
                                        data-testid={`props-video-${arrayFieldLabel}-${index}-ratio`}
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                                        <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                                        <SelectItem value="4:3">4:3 (Classic)</SelectItem>
                                        <SelectItem value="1:1">1:1 (Square)</SelectItem>
                                        <SelectItem value="21:9">21:9 (Ultra-wide)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                      Playback Options
                                    </Label>
                                    <div className="grid grid-cols-1 gap-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <Label className="text-sm">Muted</Label>
                                        <Switch
                                          checked={currentMuted !== false}
                                          onCheckedChange={(checked) =>
                                            updateArrayItemField(arrayPath, index, parentPrefix + "muted", checked)
                                          }
                                          data-testid={`props-video-${arrayFieldLabel}-${index}-muted`}
                                        />
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                        <Label className="text-sm">Autoplay</Label>
                                        <Switch
                                          checked={currentAutoplay === true}
                                          onCheckedChange={(checked) =>
                                            updateArrayItemField(arrayPath, index, parentPrefix + "autoplay", checked)
                                          }
                                          data-testid={`props-video-${arrayFieldLabel}-${index}-autoplay`}
                                        />
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                        <Label className="text-sm">Loop</Label>
                                        <Switch
                                          checked={currentLoop !== false}
                                          onCheckedChange={(checked) =>
                                            updateArrayItemField(arrayPath, index, parentPrefix + "loop", checked)
                                          }
                                          data-testid={`props-video-${arrayFieldLabel}-${index}-loop`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                {
                  const getItemLabel = (item: Record<string, unknown>, idx: number) =>
                    (item.tab_label as string) ||
                    (item.title as string) ||
                    (item.label as string) ||
                    (item.name as string) ||
                    (item.text as string) ||
                    `Item ${idx + 1}`;

                  const renderItemEditor = (
                    item: Record<string, unknown>,
                    index: number,
                  ) => {
                    const currentValue = (item[itemField] as string) || "";
                    const itemLabel = getItemLabel(item, index);
                    const handleChange = (val: string | number | boolean) =>
                      updateArrayItemField(arrayPath, index, itemField, val);

                    switch (editorType) {
                      case "color-picker": {
                        const colorType = (variant as ColorPickerVariant) || "accent";
                        return (
                          <div key={index} className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground min-w-[80px] truncate">
                              {itemLabel}
                            </span>
                            <ColorPicker
                              value={currentValue}
                              onChange={(v) => handleChange(v)}
                              type={colorType}
                              label=" "
                              allowNone={true}
                              allowCustom={true}
                              testIdPrefix={`props-color-${arrayFieldLabel}-${index}`}
                            />
                          </div>
                        );
                      }
                      case "link-picker":
                        return (
                          <div key={index} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{itemLabel}</Label>
                            <LinkPicker
                              value={currentValue}
                              onChange={(url) => handleChange(url)}
                              locale={locale}
                              allSections={allSections}
                              testId={`props-link-${arrayFieldLabel}-${index}`}
                            />
                          </div>
                        );
                      case "rich-text-editor":
                        return (
                          <div key={index} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{itemLabel}</Label>
                            <RichTextArea
                              key={`${sectionIndex}-${arrayPath}-${index}-${itemField}`}
                              value={currentValue}
                              onChange={(html) => handleChange(html)}
                              placeholder={`Edit ${itemLabel}…`}
                              minHeight="80px"
                              locale={locale}
                              data-testid={`props-richtext-${arrayFieldLabel}-${index}`}
                            />
                          </div>
                        );
                      case "markdown":
                        return (
                          <div key={index} className="space-y-1">
                            <MarkdownEditorField
                              key={`${sectionIndex}-${arrayPath}-${index}-${itemField}`}
                              value={currentValue}
                              onChange={(md) => handleChange(md)}
                              label={itemLabel}
                              data-testid={`props-markdown-${arrayFieldLabel}-${index}`}
                            />
                          </div>
                        );
                      case "boolean-toggle": {
                        const boolValue = item[itemField] === true || item[itemField] === "true";
                        return (
                          <div key={index} className="flex items-center gap-3">
                            <Label className="text-sm text-muted-foreground">{itemLabel}</Label>
                            <Switch
                              checked={boolValue}
                              onCheckedChange={(checked) => handleChange(checked)}
                              data-testid={`props-toggle-${arrayFieldLabel}-${index}`}
                            />
                          </div>
                        );
                      }
                      default:
                        return (
                          <div key={index} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{itemLabel}</Label>
                            <Input
                              value={currentValue}
                              onChange={(e) => handleChange(e.target.value)}
                              className="h-8 text-sm"
                              data-testid={`props-${editorType}-${arrayFieldLabel}-${index}`}
                            />
                          </div>
                        );
                    }
                  };

                  return (
                    <div key={fieldPath} className="space-y-3">
                      <Label className="text-sm font-medium capitalize">
                        {getFieldLabel(itemField)}
                      </Label>
                      <div className="space-y-2">
                        {safeArrayData.map((item, index) => renderItemEditor(item, index))}
                      </div>
                    </div>
                  );
                }
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

      {/* Video Picker Modal */}
      <Dialog
        open={videoPickerOpen}
        onOpenChange={(open) => {
          setVideoPickerOpen(open);
          if (!open) {
            setVideoGallerySearch("");
            setVideoPickerMode("url");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Video</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
            <div className="flex rounded-md border overflow-visible">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={`flex-1 rounded-none toggle-elevate ${videoPickerMode === "url" ? "toggle-elevated bg-muted" : ""}`}
                onClick={() => setVideoPickerMode("url")}
                data-testid="button-video-picker-url"
              >
                <IconVideo className="h-4 w-4 mr-1.5" />
                URL
              </Button>
              <div className="w-px bg-border" />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={`flex-1 rounded-none toggle-elevate ${videoPickerMode === "browse" ? "toggle-elevated bg-muted" : ""}`}
                onClick={() => setVideoPickerMode("browse")}
                data-testid="button-video-picker-browse"
              >
                <IconSearch className="h-4 w-4 mr-1.5" />
                Browse
              </Button>
              <div className="w-px bg-border" />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={`flex-1 rounded-none toggle-elevate ${videoPickerMode === "upload" ? "toggle-elevated bg-muted" : ""}`}
                onClick={() => setVideoPickerMode("upload")}
                data-testid="button-video-picker-upload"
              >
                <IconUpload className="h-4 w-4 mr-1.5" />
                Upload
              </Button>
            </div>

            {videoPickerMode === "url" && (
              <div className="space-y-3">
                <Input
                  value={videoPickerTarget?.currentUrl || ""}
                  onChange={(e) => {
                    if (videoPickerTarget) {
                      setVideoPickerTarget({
                        ...videoPickerTarget,
                        currentUrl: e.target.value,
                      });
                    }
                  }}
                  placeholder="Paste a YouTube, Vimeo, or direct video URL..."
                  className="text-sm"
                  data-testid="input-video-url"
                />
                <p className="text-xs text-muted-foreground">
                  Supports YouTube, Vimeo, and direct video file URLs (.mp4, .webm, .mov)
                </p>
              </div>
            )}

            {videoPickerMode === "browse" && (
              <>
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search videos..."
                    value={videoGallerySearch}
                    onChange={(e) => setVideoGallerySearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-video-gallery-search"
                  />
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredGalleryVideos
                      .slice(0, visibleVideoCount)
                      .map(([id, vid]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            if (videoPickerTarget) {
                              setVideoPickerTarget({
                                ...videoPickerTarget,
                                currentUrl: vid.src,
                              });
                            }
                          }}
                          className={`rounded-md bg-muted border-2 transition-colors p-3 text-left ${
                            videoPickerTarget?.currentUrl === vid.src
                              ? "border-primary"
                              : "border-transparent hover:border-muted-foreground/50"
                          }`}
                          title={vid.alt}
                          data-testid={`gallery-video-${id}`}
                        >
                          <div className="flex items-center gap-2">
                            <IconVideo className="h-5 w-5 text-primary flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{id}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {vid.src.split("/").pop()}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                  {visibleVideoCount < filteredGalleryVideos.length && (
                    <div className="py-3 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setVisibleVideoCount((prev) =>
                            Math.min(prev + 24, filteredGalleryVideos.length),
                          )
                        }
                        data-testid="button-load-more-videos"
                      >
                        Load more ({filteredGalleryVideos.length - visibleVideoCount} remaining)
                      </Button>
                    </div>
                  )}
                  {filteredGalleryVideos.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No videos found in the media gallery
                    </div>
                  )}
                </div>
              </>
            )}

            {videoPickerMode === "upload" && (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
                {hasCloudProvider || mediaStatus?.defaultProvider === "local" ? (
                  <>
                    <input
                      ref={videoFileInputRef}
                      type="file"
                      accept=".mp4,.webm,.mov,.ogg,.m4v"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length)
                          handleVideoUpload(e.target.files);
                        e.target.value = "";
                      }}
                      data-testid="input-video-file-upload"
                    />
                    <div
                      className={`w-full rounded-md border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                        videoDragOver
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/30 hover:border-muted-foreground/50"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setVideoDragOver(true);
                      }}
                      onDragLeave={() => setVideoDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setVideoDragOver(false);
                        if (e.dataTransfer.files.length)
                          handleVideoUpload(e.dataTransfer.files);
                      }}
                      onClick={() => videoFileInputRef.current?.click()}
                      data-testid="dropzone-video-upload"
                    >
                      {videoUploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Uploading video...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <IconCloudUpload className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium">Drop a video here or click to browse</p>
                          <p className="text-xs text-muted-foreground">
                            MP4, WebM, MOV, OGG, M4V (max 100 MB)
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
                      Configure a cloud provider in the Media Gallery settings, or place video files directly in the{" "}
                      <code className="bg-muted px-1 rounded text-xs">marketing-content/images/</code> folder.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-md overflow-hidden bg-muted border flex-shrink-0 flex items-center justify-center">
                  {videoPickerTarget?.currentUrl ? (
                    <IconVideo className="h-6 w-6 text-primary" />
                  ) : (
                    <div className="text-muted-foreground text-xs">None</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {videoPickerTarget?.currentUrl
                      ? videoPickerTarget.currentUrl.split("/").pop() || videoPickerTarget.currentUrl
                      : "No video selected"}
                  </p>
                  {videoPickerTarget?.currentUrl && (
                    <p className="text-xs text-muted-foreground truncate">
                      {videoPickerTarget.currentUrl}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (videoPickerTarget?.arrayPath != null && videoPickerTarget.index != null && videoPickerTarget.field) {
                  updateArrayItemField(videoPickerTarget.arrayPath, videoPickerTarget.index, videoPickerTarget.field, "");
                } else if (videoPickerTarget?.fieldPath) {
                  updateProperty(videoPickerTarget.fieldPath, "");
                }
                setVideoPickerOpen(false);
                setVideoPickerTarget(null);
              }}
              data-testid="button-video-remove"
            >
              <IconX className="h-4 w-4 mr-2" />
              Remove
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setVideoPickerOpen(false);
                  setVideoPickerTarget(null);
                }}
                data-testid="button-video-cancel"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (videoPickerTarget?.arrayPath != null && videoPickerTarget.index != null && videoPickerTarget.field) {
                    updateArrayItemField(videoPickerTarget.arrayPath, videoPickerTarget.index, videoPickerTarget.field, videoPickerTarget.currentUrl);
                  } else if (videoPickerTarget?.fieldPath) {
                    updateProperty(videoPickerTarget.fieldPath, videoPickerTarget.currentUrl);
                  }
                  setVideoPickerOpen(false);
                  setVideoPickerTarget(null);
                }}
                data-testid="button-video-save"
              >
                <IconCheck className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Picker Modal */}
      <Dialog
        open={imagePickerOpen}
        onOpenChange={(open) => {
          setImagePickerOpen(open);
          if (!open) {
            setImageGallerySearch("");
            setImagePickerMode("browse");
            setCropPanelOpen(false);
          }
        }}
      >
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
                    {filteredGalleryImages
                      .slice(0, visibleImageCount)
                      .map(([id, img]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            if (imagePickerTarget) {
                              const fieldName =
                                imagePickerTarget.srcField ||
                                imagePickerTarget.fieldPath ||
                                "";
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
                            imagePickerTarget?.currentSrc === img.src ||
                            imagePickerTarget?.currentSrc === id
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
                        onClick={() =>
                          setVisibleImageCount((prev) =>
                            Math.min(prev + 24, filteredGalleryImages.length),
                          )
                        }
                        data-testid="button-load-more-images"
                      >
                        Load more (
                        {filteredGalleryImages.length - visibleImageCount}{" "}
                        remaining)
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
                {hasCloudProvider ||
                mediaStatus?.defaultProvider === "local" ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.svg,.avif,.gif"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length)
                          handleImageUpload(e.target.files);
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
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        if (e.dataTransfer.files.length)
                          handleImageUpload(e.dataTransfer.files);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="dropzone-upload"
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Uploading...
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <IconCloudUpload className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium">
                            Drop an image here or click to browse
                          </p>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG, WebP, SVG, AVIF, GIF (max 10 MB)
                          </p>
                          {hasCloudProvider && mediaStatus?.gcs && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Uploading to {mediaStatus.gcs.bucket}/
                              {mediaStatus.gcs.basePath}
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
                    <p className="text-sm font-medium">
                      No storage provider configured
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Drop images directly into the{" "}
                      <code className="bg-muted px-1 rounded text-xs">
                        marketing-content/images/
                      </code>{" "}
                      folder, then scan the registry to include them. Or
                      configure a cloud provider in the Media Gallery settings.
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
                        imageRegistry?.images?.[imagePickerTarget.currentSrc]
                          ?.src || imagePickerTarget.currentSrc
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
                  <div className="flex gap-2">
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
                      className="text-sm flex-1"
                      data-testid="input-image-url"
                    />
                    {imagePickerTarget?.currentRegistryId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCropState({ unit: "%", x: 0, y: 0, width: 100, height: 100 });
                          // Smart crop defaults: use registry dimensions if available
                          if (imagePickerTarget?.currentRegistryId && imageRegistry?.images?.[imagePickerTarget.currentRegistryId]) {
                            const entry = imageRegistry.images[imagePickerTarget.currentRegistryId];
                            if (entry.width && entry.height) {
                              setCropTargetWidth(entry.width);
                              setCropTargetHeight(entry.height);
                            } else {
                              setCropTargetWidth(800);
                              setCropTargetHeight(600);
                            }
                          } else {
                            setCropTargetWidth(800);
                            setCropTargetHeight(600);
                          }
                          setCropPanelOpen(true);
                        }}
                        data-testid="button-crop-resize"
                      >
                        <IconPhoto className="h-4 w-4 mr-1.5" />
                        Crop & Resize
                      </Button>
                    )}
                  </div>
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
                  } else if (
                    imagePickerTarget.arrayPath &&
                    imagePickerTarget.index !== undefined
                  ) {
                    if (imagePickerTarget.clearFieldOnly && imagePickerTarget.srcField) {
                      updateArrayItemField(
                        imagePickerTarget.arrayPath,
                        imagePickerTarget.index,
                        imagePickerTarget.srcField,
                        "",
                      );
                    } else {
                      const pathParts = imagePickerTarget.arrayPath.split(".");
                      let current: Record<string, unknown> | null = parsedSection;
                      for (let i = 0; i < pathParts.length - 1 && current; i++) {
                        current = current[pathParts[i]] as Record<
                          string,
                          unknown
                        > | null;
                      }
                      const arrayField = pathParts[pathParts.length - 1];
                      const array =
                        (current?.[arrayField] as Record<string, unknown>[]) ||
                        [];
                      const newArray = [...array];
                      newArray.splice(imagePickerTarget.index, 1);
                      updateArrayField(imagePickerTarget.arrayPath, newArray);
                    }
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
                      updateProperty(
                        imagePickerTarget.fieldPath,
                        imagePickerTarget.currentSrc,
                      );
                    } else if (
                      imagePickerTarget.arrayPath !== undefined &&
                      imagePickerTarget.index !== undefined &&
                      imagePickerTarget.srcField
                    ) {
                      const updates: Record<string, string> = {
                        [imagePickerTarget.srcField]:
                          imagePickerTarget.currentSrc,
                        alt: imagePickerTarget.currentAlt,
                      };
                      if (imagePickerTarget.currentRegistryId) {
                        updates.id =
                          imagePickerTarget.currentRegistryId.replace(
                            /_/g,
                            "-",
                          );
                      }
                      updateArrayItemFields(
                        imagePickerTarget.arrayPath,
                        imagePickerTarget.index,
                        updates,
                      );
                    } else if (imagePickerTarget._fromImageClick && (imagePickerTarget._oldRegistryId || imagePickerTarget._oldSrc)) {
                      // YAML-level string replace fallback: no fieldPath or arrayPath provided.
                      // Type-preserving substitution:
                      //   - old registry ID occurrences -> new registry ID
                      //   - old src URL occurrences -> new src URL
                      const newRegistryId = imagePickerTarget.currentRegistryId;
                      const newSrc = newRegistryId
                        ? (imageRegistry?.images?.[newRegistryId]?.src || imagePickerTarget.currentSrc)
                        : imagePickerTarget.currentSrc;

                      // Build pairs: [oldValue, newValue] for each type
                      const replacementPairs: Array<[string, string]> = [];
                      if (imagePickerTarget._oldRegistryId && newRegistryId && imagePickerTarget._oldRegistryId !== newRegistryId) {
                        replacementPairs.push([imagePickerTarget._oldRegistryId, newRegistryId]);
                      }
                      if (imagePickerTarget._oldSrc && newSrc && imagePickerTarget._oldSrc !== newSrc) {
                        // Only replace src if it differs from the registry ID replacement (avoid double-replacement)
                        const alreadyHandled = replacementPairs.some(([old]) => old === imagePickerTarget._oldSrc);
                        if (!alreadyHandled) {
                          replacementPairs.push([imagePickerTarget._oldSrc, newSrc]);
                        }
                      }

                      if (replacementPairs.length > 0) {
                        let newYaml = yamlContent;
                        for (const [oldVal, newVal] of replacementPairs) {
                          const escaped = oldVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                          newYaml = newYaml.replace(new RegExp(escaped, 'g'), newVal);
                        }
                        if (newYaml !== yamlContent) {
                          pushUndoState(yamlContent);
                          setYamlContent(newYaml);
                          setHasChanges(true);
                          try {
                            const parsed = safeYamlLoad(newYaml) as Section;
                            if (parsed && onPreviewChange) onPreviewChange(parsed);
                          } catch (_err) { /* ignore parse errors */ }
                        }
                      }
                    }

                    if (imagePickerTarget.currentRegistryId) {
                      const classifyId = imagePickerTarget.currentRegistryId;
                      const classifyContext = imagePickerTarget.tagFilter
                        ? { tagFilter: imagePickerTarget.tagFilter }
                        : undefined;
                      fetch(`/api/media/classify/${encodeURIComponent(classifyId)}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ context: classifyContext }),
                      })
                        .then((r) => {
                          if (!r.ok) {
                            console.warn(`[ImageClassify] ${classifyId}: HTTP ${r.status}`);
                            return null;
                          }
                          return r.json();
                        })
                        .then((data) => {
                          if (data?.added && data.added.length > 0) {
                            toast({
                              title: "Tags added",
                              description: `Added ${data.added.length} tag(s): ${data.added.join(", ")}`,
                            });
                          }
                        })
                        .catch((err) => {
                          console.warn(`[ImageClassify] ${classifyId}:`, err);
                        });
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

      {/* Crop & Resize Modal */}
      <Dialog
        open={cropPanelOpen}
        onOpenChange={(open) => {
          setCropPanelOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Crop & Resize</DialogTitle>
            <DialogDescription>Select a crop area and set target dimensions to create a new optimized image.</DialogDescription>
          </DialogHeader>
          {imagePickerTarget?.currentRegistryId && (() => {
            const regId = imagePickerTarget.currentRegistryId;
            const imgEntry = imageRegistry?.images?.[regId];
            const imgSrc = imgEntry?.src || imagePickerTarget.currentSrc;
            return (
              <div className="flex-1 overflow-y-auto space-y-4 py-2">
                <div className="flex justify-center">
                  <ReactCrop
                    crop={cropState}
                    onChange={(_, percentCrop) => {
                      setCropState(percentCrop);
                    }}
                    aspect={cropAspectLock && cropTargetWidth > 0 && cropTargetHeight > 0 ? cropTargetWidth / cropTargetHeight : undefined}
                  >
                    <img
                      src={imgSrc}
                      alt="Crop source"
                      className="max-w-full max-h-80"
                      data-testid="crop-source-image"
                    />
                  </ReactCrop>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Target Width (px)</label>
                    <Input
                      type="number"
                      min={1}
                      value={cropTargetWidth}
                      onChange={(e) => {
                        const w = parseInt(e.target.value, 10) || 1;
                        setCropTargetWidth(w);
                      }}
                      className="text-sm"
                      data-testid="input-crop-width"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Target Height (px)</label>
                    <Input
                      type="number"
                      min={1}
                      value={cropTargetHeight}
                      onChange={(e) => {
                        const h = parseInt(e.target.value, 10) || 1;
                        setCropTargetHeight(h);
                      }}
                      className="text-sm"
                      data-testid="input-crop-height"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={cropAspectLock}
                    onCheckedChange={setCropAspectLock}
                    id="crop-aspect-lock"
                    data-testid="toggle-crop-aspect-lock"
                  />
                  <label htmlFor="crop-aspect-lock" className="text-sm cursor-pointer">
                    Lock aspect ratio
                  </label>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Quality</label>
                    <span className="text-xs text-muted-foreground" data-testid="text-crop-quality">{cropQuality}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    value={cropQuality}
                    onChange={(e) => setCropQuality(parseInt(e.target.value, 10))}
                    className="w-full accent-primary"
                    data-testid="slider-crop-quality"
                  />
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCropPanelOpen(false)}
              data-testid="button-crop-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={cropProcessing}
              onClick={async () => {
                if (!imagePickerTarget?.currentRegistryId) return;
                const cX = (cropState.x ?? 0) / 100;
                const cY = (cropState.y ?? 0) / 100;
                const cW = (cropState.width ?? 100) / 100;
                const cH = (cropState.height ?? 100) / 100;
                setCropProcessing(true);
                try {
                  const resp = await fetch("/api/media/crop-resize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      imageId: imagePickerTarget.currentRegistryId,
                      crop: { x: cX, y: cY, width: cW, height: cH },
                      targetWidth: cropTargetWidth,
                      targetHeight: cropTargetHeight,
                      quality: cropQuality,
                    }),
                  });
                  const contentType = resp.headers.get("content-type") || "";
                  if (!contentType.includes("application/json")) {
                    throw new Error(`Server returned an unexpected response (${resp.status}). Please try again or check the server logs.`);
                  }
                  if (!resp.ok) {
                    const data = await resp.json();
                    throw new Error(data.error || "Processing failed");
                  }
                  const result = await resp.json() as { id: string; src: string; width: number; height: number };
                  const fieldName = imagePickerTarget.srcField || imagePickerTarget.fieldPath || "";
                  const isIdField = fieldName.endsWith("_id");
                  setImagePickerTarget({
                    ...imagePickerTarget,
                    currentSrc: isIdField ? result.id : result.src,
                    currentRegistryId: result.id,
                  });
                  setCropPanelOpen(false);
                  refetchRegistry();
                  toast({ title: "Image processed", description: `Saved as ${result.width}×${result.height} WebP` });
                } catch (err: any) {
                  toast({ title: "Processing failed", description: err.message || "Unknown error", variant: "destructive" });
                } finally {
                  setCropProcessing(false);
                }
              }}
              data-testid="button-crop-process"
            >
              {cropProcessing ? (
                <>
                  <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <IconCheck className="h-4 w-4 mr-2" />
                  Process & Use
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section Binding Dialog */}
      {contentType && slug && locale && (
        <SectionBindingDialog
          open={bindingDialogOpen}
          onOpenChange={setBindingDialogOpen}
          contentType={contentType}
          slug={slug}
          sectionIndex={sectionIndex}
          component={sectionComponentType}
          locale={locale}
          existingGroup={bindingGroup}
          onBindingChanged={() => refetchBinding()}
        />
      )}

      <Dialog open={bindingConfirmOpen} onOpenChange={setBindingConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-amber-500" />
              Synced Section
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              This section is synced with {boundSiblings.length} other page{boundSiblings.length !== 1 ? "s" : ""}. Your changes will also be applied to:
            </p>
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {boundSiblings.map((sibling, i) => (
                <li key={i} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md bg-muted">
                  <IconLink className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="font-medium">{sibling.slug}</span>
                  <span className="text-muted-foreground">({sibling.contentType}, section {sibling.sectionIndex + 1})</span>
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBindingConfirmOpen(false)}
              data-testid="button-binding-confirm-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setBindingConfirmOpen(false);
                await executeSave();
              }}
              data-testid="button-binding-confirm-save"
            >
              <IconDeviceFloppy className="h-4 w-4 mr-2" />
              Save to all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
