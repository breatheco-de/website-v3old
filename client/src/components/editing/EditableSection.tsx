import { useState, useCallback, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import { IconPencil, IconArrowsExchange, IconTrash, IconArrowUp, IconArrowDown, IconChevronLeft, IconChevronRight, IconCheck, IconLoader2, IconX, IconSparkles, IconDeviceDesktop, IconDeviceMobile, IconCopy, IconCode, IconEye, IconLink, IconLinkOff } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { Section, SectionLayout, ShowOn } from "@shared/schema";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import { getLocationBySlug } from "@/lib/locations";
import { usePageHistoryOptional } from "@/contexts/PageHistoryContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CodeMirror from "@uiw/react-codemirror";
import { yaml as yamlLang } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";
import { getDebugToken } from "@/hooks/useDebugAuth";
import { useToast } from "@/hooks/use-toast";
import { emitContentUpdated } from "@/lib/contentEvents";
import { renderSection } from "@/components/SectionRenderer";
import yaml from "js-yaml";
import { escapeTemplateVars, unescapeObjectVars } from "@shared/templateVars";
import * as CountryFlags from "country-flag-icons/react/3x2";

function deslugify(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function CountryFlag({ code, className = "h-3 w-4 rounded-[1px]" }: { code: string; className?: string }) {
  const FlagComponent = (CountryFlags as Record<string, React.ComponentType<{ className?: string }>>)[code.toUpperCase()];
  if (!FlagComponent) return null;
  return <FlagComponent className={className} />;
}

function getUniqueCountryCodes(locationSlugs: string[]): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const slug of locationSlugs) {
    const loc = getLocationBySlug(slug);
    if (loc && !seen.has(loc.country_code)) {
      seen.add(loc.country_code);
      codes.push(loc.country_code);
    }
  }
  return codes;
}

const SectionEditorPanel = lazy(() => 
  import("./SectionEditorPanel").then(mod => ({ default: mod.SectionEditorPanel }))
);

interface EditableSectionProps {
  children: React.ReactNode;
  section: Section;
  index: number;
  sectionType: string;
  contentType?: "program" | "landing" | "location" | "page";
  slug?: string;
  locale?: string;
  variant?: string;
  version?: number;
  totalSections?: number;
  allSections?: Section[];
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  onDelete?: (index: number) => void;
  onDuplicate?: (index: number) => void;
}

export function EditableSection({ children, section, index, sectionType, contentType, slug, locale, variant, version, totalSections = 0, allSections, onMoveUp, onMoveDown, onDelete, onDuplicate }: EditableSectionProps) {
  const editMode = useEditModeOptional();
  const pageHistory = usePageHistoryOptional();
  const { toast } = useToast();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<Section>(section);
  const [wasLocallyUpdated, setWasLocallyUpdated] = useState(false);
  
  // Sync currentSection when the prop changes (e.g., after refetch)
  useEffect(() => {
    setCurrentSection(section);
    setWasLocallyUpdated(false);
  }, [section]);
  
  const canMoveUp = index > 0;
  const canMoveDown = totalSections > 0 && index < totalSections - 1;
  
  // Swap popover state
  const [swapPopoverOpen, setSwapPopoverOpen] = useState(false);
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [variants, setVariants] = useState<string[]>([]); // Unique variant slugs from examples
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedExampleIndex, setSelectedExampleIndex] = useState(0); // Index within current variant's examples
  const [examplesWithVariants, setExamplesWithVariants] = useState<{filename: string, variant: string, name: string, yaml: string}[]>([]);
  const [previewSection, setPreviewSection] = useState<Section | null>(null);
  const [isLoadingSwap, setIsLoadingSwap] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  
  // AI adaptation state
  const [isAdapting, setIsAdapting] = useState(false);
  const [adaptedSection, setAdaptedSection] = useState<Section | null>(null);
  const [hasAdapted, setHasAdapted] = useState(false);
  
  // YAML source modal state
  const [showYamlModal, setShowYamlModal] = useState(false);
  
  // Review code modal state (for reviewing AI-adapted content before applying)
  const [showReviewCodeModal, setShowReviewCodeModal] = useState(false);
  const [reviewCodeYaml, setReviewCodeYaml] = useState("");
  const [reviewCodeError, setReviewCodeError] = useState<string | null>(null);

  const { data: bindingData } = useQuery<{ group: { id: string; members: unknown[] } | null }>({
    queryKey: ["/api/bindings/section", contentType, slug, index],
    queryFn: () => fetch(`/api/bindings/section?contentType=${contentType}&slug=${slug}&sectionIndex=${index}`).then(r => r.json()),
    enabled: !!editMode?.isEditMode && !!contentType && !!slug,
    staleTime: 30_000,
  });
  const isBound = !!bindingData?.group;
  const boundSiblingCount = isBound ? (bindingData.group!.members.length - 1) : 0;

  const selectedVariant = variants[selectedVariantIndex] || "";
  
  // Get examples for the currently selected variant
  const examplesForCurrentVariant = useMemo(() => {
    return examplesWithVariants.filter(e => e.variant === selectedVariant);
  }, [examplesWithVariants, selectedVariant]);
  
  const currentExample = examplesForCurrentVariant[selectedExampleIndex] || null;

  // Get current section's version from the section object
  const currentSectionVersion = (section as { version?: string }).version || "";
  
  // Ref to track active version for race condition prevention
  const activeVersionRef = useRef<string>("");

  // Fetch versions when popover opens
  useEffect(() => {
    if (!swapPopoverOpen || !sectionType) return;
    setIsLoadingSwap(true);
    const token = getDebugToken();
    fetch(`/api/component-registry/${sectionType}/versions`, {
      headers: token ? { 'X-Debug-Token': token } : {}
    })
      .then(res => res.json())
      .then(data => {
        const vers: string[] = data.versions || [];
        setVersions(vers);
        // Use current section's version if available, otherwise use latest
        if (currentSectionVersion && vers.includes(currentSectionVersion)) {
          setSelectedVersion(currentSectionVersion);
        } else if (vers.length > 0) {
          setSelectedVersion(vers[vers.length - 1]);
        }
      })
      .catch(() => setVersions([]))
      .finally(() => setIsLoadingSwap(false));
  }, [swapPopoverOpen, sectionType, currentSectionVersion]);

  // Fetch examples and extract variants when version changes
  useEffect(() => {
    if (!swapPopoverOpen || !sectionType || !selectedVersion) return;
    
    // Reset state immediately when version changes to prevent stale data
    setExamplesWithVariants([]);
    setVariants([]);
    setPreviewSection(null);
    setIsLoadingSwap(true);
    
    // Track this as the active version request
    const requestedVersion = selectedVersion;
    activeVersionRef.current = requestedVersion;
    
    const token = getDebugToken();
    
    fetch(`/api/component-registry/${sectionType}/${selectedVersion}/examples`, {
      headers: token ? { 'X-Debug-Token': token } : {}
    })
      .then(res => res.json())
      .then((data) => {
        // Bail if a newer version request has started
        if (activeVersionRef.current !== requestedVersion) return;
        
        // API returns examples with variant and yaml properties
        const exs: {name: string, filename?: string, variant?: string, yaml?: string}[] = data.examples || [];
        
        // Map examples to our format - include yaml for parsing
        const examplesData = exs.map(ex => ({
          filename: ex.filename || ex.name?.toLowerCase().replace(/\s+/g, '-') + '.yml',
          variant: ex.variant || "default",
          name: ex.name || "",
          yaml: ex.yaml || ""
        }));
        
        setExamplesWithVariants(examplesData);
        
        // Extract unique variants
        const uniqueVariants = Array.from(new Set(examplesData.map(e => e.variant)));
        setVariants(uniqueVariants);
        
        // Try to select current section's variant, or first available
        const currentVariant = (section as { variant?: string }).variant || "default";
        const currentIdx = uniqueVariants.indexOf(currentVariant);
        setSelectedVariantIndex(currentIdx >= 0 ? currentIdx : 0);
      })
      .catch(() => {
        if (activeVersionRef.current === requestedVersion) {
          setExamplesWithVariants([]);
          setVariants([]);
        }
      })
      .finally(() => {
        if (activeVersionRef.current === requestedVersion) {
          setIsLoadingSwap(false);
        }
      });
  }, [swapPopoverOpen, sectionType, selectedVersion, section]);

  // Reset example index and adaptation state when variant changes
  useEffect(() => {
    setSelectedExampleIndex(0);
    setAdaptedSection(null);
    setHasAdapted(false);
  }, [selectedVariantIndex]);
  
  // Reset adaptation state when example changes
  useEffect(() => {
    setAdaptedSection(null);
    setHasAdapted(false);
  }, [selectedExampleIndex]);

  // Update preview when variant or example changes - parse YAML content locally
  useEffect(() => {
    if (!swapPopoverOpen || !sectionType || !currentExample || !currentExample.yaml) {
      setPreviewSection(null);
      return;
    }
    
    // Parse YAML content locally (escape template vars like {{ }} before parsing)
    try {
      const { escaped, map } = escapeTemplateVars(currentExample.yaml);
      const parsed = unescapeObjectVars(yaml.load(escaped), map);
      // Handle both array format (sections list) and object format (single section)
      let sectionData: Record<string, unknown>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        sectionData = parsed[0] as Record<string, unknown>;
      } else if (parsed && typeof parsed === 'object') {
        sectionData = parsed as Record<string, unknown>;
      } else {
        setPreviewSection(null);
        return;
      }
      setPreviewSection({ type: sectionType, ...sectionData } as Section);
    } catch (err) {
      console.error("Failed to parse example YAML:", err);
      setPreviewSection(null);
    }
  }, [swapPopoverOpen, sectionType, currentExample]);

  // Cycle through variants
  const cycleVariant = useCallback((direction: number) => {
    if (variants.length === 0) return;
    setSelectedVariantIndex(prev => {
      let next = prev + direction;
      if (next < 0) next = variants.length - 1;
      if (next >= variants.length) next = 0;
      return next;
    });
  }, [variants.length]);

  // Cycle through examples within current variant
  const cycleExample = useCallback((direction: number) => {
    if (examplesForCurrentVariant.length <= 1) return;
    setSelectedExampleIndex(prev => {
      let next = prev + direction;
      if (next < 0) next = examplesForCurrentVariant.length - 1;
      if (next >= examplesForCurrentVariant.length) next = 0;
      return next;
    });
  }, [examplesForCurrentVariant.length]);

  // Handle AI adaptation of the selected variant
  const handleAdaptWithAI = useCallback(async () => {
    if (!currentExample?.yaml || !contentType || !slug || !sectionType) return;
    
    setIsAdapting(true);
    try {
      const token = getDebugToken();
      
      // Map contentType prop format to API format
      const contentTypeMap: Record<string, string> = {
        'program': 'programs',
        'landing': 'landings',
        'location': 'locations',
        'page': 'pages'
      };
      
      const res = await fetch('/api/content/adapt-with-ai', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'X-Debug-Token': token } : {})
        },
        body: JSON.stringify({
          contentType: contentTypeMap[contentType] || contentType,
          contentSlug: slug,
          targetComponent: sectionType,
          targetVersion: selectedVersion || 'v1.0',
          targetVariant: selectedVariant || currentExample.variant || 'default',
          sourceYaml: currentExample.yaml,
          targetExampleYaml: currentExample.yaml // Pass example as reference template for AI
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to adapt content with AI');
      }
      
      const data = await res.json();
      
      // Parse the adapted YAML (escape template vars like {{ }} before parsing)
      const adaptedYaml = data.adaptedYaml || data.yaml;
      if (!adaptedYaml) {
        throw new Error('No adapted content returned');
      }
      
      const { escaped: escapedAdapted, map: adaptedMap } = escapeTemplateVars(adaptedYaml);
      const parsed = unescapeObjectVars(yaml.load(escapedAdapted), adaptedMap);
      let sectionData: Record<string, unknown>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        sectionData = parsed[0] as Record<string, unknown>;
      } else if (parsed && typeof parsed === 'object') {
        sectionData = parsed as Record<string, unknown>;
      } else {
        throw new Error('Invalid adapted content format');
      }
      
      const adapted = { type: sectionType, ...sectionData } as Section;
      setAdaptedSection(adapted);
      setHasAdapted(true);
      toast({ title: "Content adapted", description: "AI has adapted the content. Click 'Review Code' to view, edit, and apply." });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to adapt content';
      toast({ title: "AI Adaptation Error", description: message, variant: "destructive" });
    } finally {
      setIsAdapting(false);
    }
  }, [currentExample, contentType, slug, sectionType, selectedVersion, toast]);

  const handleConfirmSwap = useCallback(async () => {
    // Use adapted section if available, otherwise use preview section
    const sectionToSave = hasAdapted && adaptedSection ? adaptedSection : previewSection;
    if (!sectionToSave || !contentType || !slug) return;
    
    setIsConfirming(true);
    try {
      const token = getDebugToken();
      const res = await fetch('/api/content/edit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'X-Debug-Token': token } : {})
        },
        body: JSON.stringify({
          operation: 'update_section',
          contentType,
          slug,
          locale: locale || 'en',
          variant: variant || 'default',
          version: version || 1,
          sectionIndex: index,
          sectionData: sectionToSave
        })
      });
      if (!res.ok) throw new Error('Failed to swap section');
      setCurrentSection(sectionToSave);
      setSwapPopoverOpen(false);
      setAdaptedSection(null);
      setHasAdapted(false);
      // Emit event to trigger page refresh
      emitContentUpdated({ contentType: contentType!, slug: slug!, locale: locale || 'en' });
      toast({ title: "Section swapped", description: "The section variant has been updated." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to swap section variant.", variant: "destructive" });
    } finally {
      setIsConfirming(false);
    }
  }, [previewSection, adaptedSection, hasAdapted, contentType, slug, locale, variant, version, index, toast]);
  
  // Open review code modal with adapted section YAML
  const handleOpenReviewCode = useCallback(() => {
    if (!adaptedSection) return;
    // Convert adapted section to YAML for editing
    const { type, ...sectionData } = adaptedSection as Record<string, unknown>;
    const yamlStr = yaml.dump(sectionData, { lineWidth: -1, quotingType: '"', forceQuotes: false });
    setReviewCodeYaml(yamlStr);
    setReviewCodeError(null); // Clear any previous errors
    setShowReviewCodeModal(true);
  }, [adaptedSection]);
  
  // Apply changes from the review code modal (parse edited YAML and save)
  const handleApplyReviewedCode = useCallback(async () => {
    if (!contentType || !slug) return;
    
    setIsConfirming(true);
    setReviewCodeError(null);
    
    // Save page snapshot for undo before making changes
    if (pageHistory) {
      pageHistory.saveCurrentSnapshot(`Antes de aplicar adaptación en sección ${index + 1}`);
    }
    
    try {
      // Parse the edited YAML (escape template vars like {{ }} before parsing)
      const { escaped: escapedReview, map: reviewMap } = escapeTemplateVars(reviewCodeYaml);
      const parsed = unescapeObjectVars(yaml.load(escapedReview), reviewMap);
      let sectionData: Record<string, unknown>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        sectionData = parsed[0] as Record<string, unknown>;
      } else if (parsed && typeof parsed === 'object') {
        sectionData = parsed as Record<string, unknown>;
      } else {
        throw new Error('Invalid YAML format');
      }
      
      const sectionToSave = { type: sectionType, ...sectionData } as Section;
      
      const token = getDebugToken();
      const res = await fetch('/api/content/edit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'X-Debug-Token': token } : {})
        },
        body: JSON.stringify({
          operation: 'update_section',
          contentType,
          slug,
          locale: locale || 'en',
          variant: variant || 'default',
          version: version || 1,
          sectionIndex: index,
          sectionData: sectionToSave
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to apply section';
        setReviewCodeError(errorMessage);
        return;
      }
      
      setCurrentSection(sectionToSave);
      setWasLocallyUpdated(true);
      setShowReviewCodeModal(false);
      setSwapPopoverOpen(false);
      setAdaptedSection(null);
      setHasAdapted(false);
      emitContentUpdated({ contentType: contentType!, slug: slug!, locale: locale || 'en' });
      toast({ title: "Section applied", description: "The reviewed section has been saved." });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply section';
      setReviewCodeError(message);
    } finally {
      setIsConfirming(false);
    }
  }, [reviewCodeYaml, sectionType, contentType, slug, locale, variant, version, index, toast, pageHistory]);
  
  const handleOpenEditor = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditorOpen(true);
  }, []);
  
  const handleCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
  }, []);
  
  const handleUpdate = useCallback((updatedSection: Section) => {
    setCurrentSection(updatedSection);
    setWasLocallyUpdated(true);
  }, []);
  
  const renderedContent = wasLocallyUpdated ? renderSection(currentSection, index) : children;

  // If not in edit mode context or edit mode is not active, render children directly
  if (!editMode || !editMode.isEditMode) {
    return <>{renderedContent}</>;
  }
  
  return (
    <div 
      className="relative group"
      data-edit-section-index={index}
      data-edit-section-type={sectionType}
    >
      {/* Edit overlay - only visible on hover when in edit mode */}
      <div 
        className={`
          absolute inset-0 z-40 pointer-events-none transition-all duration-150
          ${isEditorOpen 
            ? "ring-2 ring-primary ring-offset-2" 
            : swapPopoverOpen
              ? "border-l-2 border-r-2 border-b-2 border-primary"
              : "group-hover:ring-2 group-hover:ring-primary/50 group-hover:ring-offset-1"
          }
        `}
      />
      
      {/* Edit controls - visible on hover */}
      <div 
        className={`
          absolute top-2 right-2 z-30 flex items-center gap-1 
          transition-opacity duration-150
          ${isEditorOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
        `}
      >
        <button
          onClick={handleOpenEditor}
          className="p-2 bg-primary text-primary-foreground rounded-md shadow-lg hover-elevate flex items-center gap-1.5"
          data-testid={`button-edit-section-${index}`}
        >
          <IconPencil className="h-4 w-4" />
          <div className="flex flex-col items-start">
            <span className="text-xs font-medium">{sectionType}</span>
            {(currentSection as { variant?: string }).variant && (
              <small className="text-[10px] opacity-75">{deslugify((currentSection as { variant?: string }).variant!)}</small>
            )}
          </div>
        </button>
        <button
          onClick={handleOpenEditor}
          className={`p-2 rounded-md shadow-lg hover-elevate flex items-center gap-1 ${
            isBound
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground"
          }`}
          data-testid={`button-binding-indicator-${index}`}
          title={isBound ? `Bound to ${boundSiblingCount} other page${boundSiblingCount !== 1 ? 's' : ''}` : "Not bound – click to manage bindings"}
        >
          {isBound ? (
            <>
              <IconLink className="h-4 w-4" />
              <span className="text-xs font-medium">{boundSiblingCount}</span>
            </>
          ) : (
            <IconLinkOff className="h-4 w-4" />
          )}
        </button>
        {onMoveUp && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(index); }}
            disabled={!canMoveUp}
            className={`p-2 bg-muted text-muted-foreground rounded-md shadow-lg hover-elevate ${!canMoveUp ? 'opacity-40 cursor-not-allowed' : ''}`}
            data-testid={`button-move-up-section-${index}`}
            title="Move section up"
          >
            <IconArrowUp className="h-4 w-4" />
          </button>
        )}
        {onMoveDown && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(index); }}
            disabled={!canMoveDown}
            className={`p-2 bg-muted text-muted-foreground rounded-md shadow-lg hover-elevate ${!canMoveDown ? 'opacity-40 cursor-not-allowed' : ''}`}
            data-testid={`button-move-down-section-${index}`}
            title="Move section down"
          >
            <IconArrowDown className="h-4 w-4" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(index); }}
            className="p-2 bg-destructive text-destructive-foreground rounded-md shadow-lg hover-elevate"
            data-testid={`button-delete-section-${index}`}
            title="Delete section"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        )}
        {onDuplicate && (
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(index); }}
            className="p-2 bg-muted text-muted-foreground rounded-md shadow-lg hover-elevate"
            data-testid={`button-duplicate-section-${index}`}
            title="Duplicate section"
          >
            <IconCopy className="h-4 w-4" />
          </button>
        )}
        <Popover open={swapPopoverOpen} onOpenChange={setSwapPopoverOpen}>
          <PopoverTrigger asChild>
            <button 
              className="p-2 bg-muted text-muted-foreground rounded-md shadow-lg hover-elevate" 
              title="Swap variant"
              data-testid={`button-swap-section-${index}`}
            >
              <IconArrowsExchange className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto min-w-[500px] max-w-[700px] p-2" onClick={(e) => e.stopPropagation()}>
            {isLoadingSwap ? (
              <div className="flex items-center justify-center py-2 px-4" data-testid={`loader-swap-section-${index}`}>
                <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                <span className="text-xs text-muted-foreground">Loading variants...</span>
              </div>
            ) : versions.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2" data-testid={`text-no-variants-${index}`}>No versions available</p>
            ) : (
              <div className="flex items-center gap-3">
                {/* Left: Component + Version badges */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span 
                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-muted"
                    data-testid={`badge-component-${index}`}
                  >
                    {sectionType}
                  </span>
                  <span 
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-muted ${versions.length > 1 ? 'cursor-pointer hover-elevate' : ''}`}
                    onClick={() => versions.length > 1 && setShowVersionPicker(!showVersionPicker)}
                    data-testid={`badge-version-${index}`}
                  >
                    {selectedVersion || versions[0] || ""}
                    {versions.length > 1 && <IconPencil className="h-3 w-3" />}
                  </span>
                </div>
                
                {/* Divider */}
                <div className="w-px h-6 bg-border shrink-0" />
                
                {/* Center: Variant navigation */}
                {variants.length > 0 ? (
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => cycleVariant(-1)} disabled={variants.length <= 1} data-testid={`button-variant-prev-${index}`}>
                      <IconChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-medium truncate min-w-[80px] text-center" data-testid={`text-variant-${index}`}>
                      {deslugify(selectedVariant || "default")}
                      {examplesForCurrentVariant.length > 1 && (
                        <span className="text-muted-foreground ml-1">({selectedExampleIndex + 1}/{examplesForCurrentVariant.length})</span>
                      )}
                    </span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => cycleVariant(1)} disabled={variants.length <= 1} data-testid={`button-variant-next-${index}`}>
                      <IconChevronRight className="h-4 w-4" />
                    </Button>
                    {/* Example navigation (only if multiple examples in variant) */}
                    {examplesForCurrentVariant.length > 1 && (
                      <>
                        <div className="w-px h-4 bg-border/50 shrink-0" />
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Examples</span>
                          <div className="flex items-center">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => cycleExample(-1)} data-testid={`button-example-prev-${index}`}>
                              <IconChevronLeft className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => cycleExample(1)} data-testid={`button-example-next-${index}`}>
                              <IconChevronRight className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                    {/* View YAML source - always visible */}
                    <div className="w-px h-4 bg-border/50 shrink-0" />
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setShowYamlModal(true)} title="View YAML source" data-testid={`button-view-yaml-${index}`}>
                      <IconCode className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">No variants</span>
                )}
                
                {/* Divider */}
                <div className="w-px h-6 bg-border shrink-0" />
                
                {/* Right: Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSwapPopoverOpen(false); setAdaptedSection(null); setHasAdapted(false); }} data-testid={`button-cancel-swap-${index}`} title="Cancel">
                    <IconX className="h-4 w-4" />
                  </Button>
                  {hasAdapted ? (
                    <Button size="sm" className="h-7 px-3" onClick={handleOpenReviewCode} disabled={!adaptedSection} data-testid={`button-review-code-${index}`}>
                      <IconCode className="h-3 w-3 mr-1" />
                      Review Code
                    </Button>
                  ) : (
                    <Button size="sm" className="h-7 px-3" onClick={handleAdaptWithAI} disabled={!previewSection || isAdapting} data-testid={`button-adapt-ai-${index}`}>
                      {isAdapting ? (
                        <IconLoader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <IconSparkles className="h-3 w-3 mr-1" />
                      )}
                      {isAdapting ? 'Adapting...' : 'Adapt'}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {/* Version picker dropdown (shown conditionally) */}
            {showVersionPicker && versions.length > 1 && (
              <div className="mt-2 pt-2 border-t">
                <Select value={selectedVersion} onValueChange={(val) => { setSelectedVersion(val); setShowVersionPicker(false); }}>
                  <SelectTrigger className="w-full h-8 text-xs" data-testid={`select-version-${index}`}>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map(ver => (
                      <SelectItem key={ver} value={ver} data-testid={`option-version-${ver}-${index}`}>{ver}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
      
      {(() => {
        const showOn = (section as SectionLayout).showOn || 'all';
        const showOnLocations = (section as SectionLayout).showOnLocations || [];
        const showOnRegions = (section as SectionLayout).showOnRegions || [];
        
        const hasDeviceFilter = showOn !== 'all';
        const hasLocationFilter = showOnLocations.length > 0 || showOnRegions.length > 0;
        
        if (!hasDeviceFilter && !hasLocationFilter) return null;
        
        const countryCodes = hasLocationFilter ? getUniqueCountryCodes(showOnLocations) : [];
        
        return (
          <div 
            className="absolute top-12 right-2 z-30 flex items-center gap-1.5 px-2 py-1 bg-amber-500/90 text-amber-950 text-xs font-medium rounded"
            title="Special Visibility Conditions"
            data-testid={`badge-visibility-${index}`}
          >
            <IconEye className="h-3.5 w-3.5" />
            <span>Special Visibility Conditions</span>
            {hasDeviceFilter && (
              showOn === 'desktop' 
                ? <IconDeviceDesktop className="h-3.5 w-3.5" /> 
                : <IconDeviceMobile className="h-3.5 w-3.5" />
            )}
            {countryCodes.map((code) => (
              <CountryFlag key={code} code={code} />
            ))}
          </div>
        );
      })()}

      
      {/* Section label - top left */}
      <div 
        className={`
          absolute top-2 left-2 z-30 
          px-2 py-1 bg-muted/90 backdrop-blur-sm rounded text-xs text-muted-foreground
          transition-opacity duration-150
          ${isEditorOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
        `}
      >
        {sectionType}-{index}
      </div>
      
      {/* Content with pointer events enabled - show preview section when cycling variants */}
      <div className="relative">
        {swapPopoverOpen ? (
          <>
            {/* Preview indicator banner */}
            <div className={`absolute top-0 left-0 right-0 z-30 text-xs px-3 py-1.5 ${hasAdapted ? 'bg-green-600' : 'bg-primary/90'} text-primary-foreground`}>
              <span className="font-medium flex items-center gap-2">
                {isLoadingSwap ? (
                  <>
                    <IconLoader2 className="h-3 w-3 animate-spin" />
                    Loading preview...
                  </>
                ) : isAdapting ? (
                  <>
                    <IconLoader2 className="h-3 w-3 animate-spin" />
                    Adapting content with AI...
                  </>
                ) : hasAdapted ? (
                  <>
                    <IconSparkles className="h-3 w-3" />
                    AI Adapted: {selectedVariant || "default"}{examplesForCurrentVariant.length > 1 && currentExample?.name ? ` - ${currentExample.name}` : ""}
                  </>
                ) : (
                  <>Preview: {selectedVariant || "default"}{examplesForCurrentVariant.length > 1 && currentExample?.name ? ` - ${currentExample.name}` : ""}</>
                )}
              </span>
            </div>
            {/* Render the preview section or original with loading overlay */}
            <div className="pt-8 relative">
              {hasAdapted && adaptedSection ? (
                renderSection(adaptedSection, index)
              ) : previewSection ? (
                renderSection(previewSection, index)
              ) : (
                <>
                  {renderedContent}
                  {(isLoadingSwap || isAdapting) && (
                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                        {isAdapting && <span className="text-sm text-muted-foreground">Adapting with AI...</span>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          renderedContent
        )}
      </div>
      
      {/* Editor Panel - slides in when open */}
      {isEditorOpen && (
        <Suspense fallback={null}>
          <SectionEditorPanel
            section={currentSection}
            sectionIndex={index}
            contentType={contentType}
            slug={slug}
            locale={locale}
            variant={variant}
            version={version}
            onUpdate={handleUpdate}
            onClose={handleCloseEditor}
            allSections={allSections}
          />
        </Suspense>
      )}
      
      {/* YAML Source Modal */}
      <Dialog open={showYamlModal} onOpenChange={setShowYamlModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconCode className="h-5 w-5" />
              {currentExample?.name || selectedVariant || "Variant"} - YAML Source
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded border">
            <CodeMirror
              value={currentExample?.yaml || ""}
              extensions={[yamlLang()]}
              theme={oneDark}
              readOnly
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: false,
              }}
              className="text-sm"
            />
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Review Code Modal - editable YAML for AI-adapted content */}
      <Dialog open={showReviewCodeModal} onOpenChange={setShowReviewCodeModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconSparkles className="h-5 w-5" />
              Review AI-Generated Code
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Review and edit the YAML below. Fix any issues before applying.
          </p>
          <div className="flex-1 overflow-auto rounded border min-h-[300px]">
            <CodeMirror
              value={reviewCodeYaml}
              onChange={(value) => setReviewCodeYaml(value)}
              extensions={[yamlLang()]}
              theme={oneDark}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
              }}
              className="text-sm"
            />
          </div>
          {reviewCodeError && (
            <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive max-h-[150px] overflow-auto" data-testid={`error-review-code-${index}`}>
              <p className="font-medium mb-1">Validation Error:</p>
              <pre className="whitespace-pre-wrap text-xs">{reviewCodeError}</pre>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowReviewCodeModal(false)} data-testid={`button-cancel-review-${index}`}>
              Cancel
            </Button>
            <Button onClick={handleApplyReviewedCode} disabled={isConfirming} data-testid={`button-apply-review-${index}`}>
              {isConfirming ? (
                <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <IconCheck className="h-4 w-4 mr-2" />
              )}
              Apply Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
