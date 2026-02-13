import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  IconFlask,
  IconDeviceFloppy,
  IconRefresh,
  IconEye,
  IconPencil,
  IconUsers,
  IconPercentage,
  IconTarget,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconLanguage,
  IconWorld,
  IconX,
  IconMapPin,
} from "@tabler/icons-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getDebugToken } from "@/hooks/useDebugAuth";
import type { ExperimentConfig, ExperimentVariant, ExperimentTargeting } from "@shared/schema";

interface ExperimentWithStats extends ExperimentConfig {
  stats?: Record<string, number>;
  unique_visitors?: number;
  auto_stopped?: boolean;
}

interface ExperimentResponse {
  experiment: ExperimentWithStats;
  contentType: string;
  contentSlug: string;
  filePath: string;
}

const statusColors: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  winner: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  archived: "bg-muted text-muted-foreground opacity-60",
};

const statusOptions = ["planned", "active", "paused", "winner", "archived"] as const;

function deslugify(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface Suggestion {
  value: string;
  label: string;
}

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  transform?: (value: string) => string;
  suggestions?: Suggestion[];
  "data-testid"?: string;
}

function TagInput({ values, onChange, placeholder, transform, suggestions, "data-testid": testId }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = useMemo(() => {
    if (!suggestions || !inputValue.trim()) return [];
    const query = inputValue.toLowerCase();
    return suggestions
      .filter(s => 
        !values.includes(s.value) && 
        (s.value.toLowerCase().includes(query) || s.label.toLowerCase().includes(query))
      )
      .slice(0, 8);
  }, [suggestions, inputValue, values]);

  const addTag = (value: string) => {
    const trimmed = transform ? transform(value.trim()) : value.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInputValue("");
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const removeTag = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex(i => Math.min(i + 1, filteredSuggestions.length - 1));
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex(i => Math.max(i - 1, 0));
        return;
      } else if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        addTag(filteredSuggestions[highlightedIndex].value);
        return;
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        return;
      }
    }

    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && values.length > 0) {
      removeTag(values.length - 1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.includes(",")) {
      const parts = value.split(",");
      parts.forEach((part, i) => {
        if (i < parts.length - 1 && part.trim()) {
          addTag(part);
        }
      });
      setInputValue(parts[parts.length - 1]);
    } else {
      setInputValue(value);
      setShowSuggestions(!!value.trim() && !!suggestions?.length);
      setHighlightedIndex(-1);
    }
  };

  const getDisplayLabel = (value: string) => {
    if (suggestions) {
      const suggestion = suggestions.find(s => s.value === value);
      return suggestion?.label || value;
    }
    return value;
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 p-2 min-h-10 border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        {values.map((tag, index) => (
          <Badge
            key={`${tag}-${index}`}
            variant="secondary"
            className="gap-1 pr-1"
            data-testid={`${testId}-tag-${index}`}
          >
            {getDisplayLabel(tag)}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
              data-testid={`${testId}-remove-${index}`}
            >
              <IconX className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.trim() && suggestions?.length) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              setShowSuggestions(false);
              if (inputValue.trim() && !suggestions) {
                addTag(inputValue);
              }
            }, 150);
          }}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-20 bg-transparent outline-none text-sm"
          data-testid={testId}
        />
      </div>
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion.value}
              type="button"
              className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${
                index === highlightedIndex ? "bg-accent" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(suggestion.value);
              }}
              data-testid={`${testId}-suggestion-${suggestion.value}`}
            >
              <span className="font-medium">{suggestion.label}</span>
              <span className="text-muted-foreground ml-2 text-xs">({suggestion.value})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExperimentEditor() {
  const { contentType, contentSlug, experimentSlug } = useParams<{
    contentType: string;
    contentSlug: string;
    experimentSlug: string;
  }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [editingVariantSlug, setEditingVariantSlug] = useState<string | null>(null);
  const [tempAllocations, setTempAllocations] = useState<Record<string, number>>({});
  const [targetingDialogOpen, setTargetingDialogOpen] = useState(false);

  const [formData, setFormData] = useState<{
    description: string;
    status: string;
    max_visitors: number | undefined;
    variants: ExperimentVariant[];
    targeting: ExperimentTargeting;
  } | null>(null);

  const { data, isLoading, error } = useQuery<ExperimentResponse>({
    queryKey: ["/api/experiments", contentType, contentSlug, experimentSlug],
    enabled: !!contentType && !!contentSlug && !!experimentSlug,
  });

  const { data: locationsData } = useQuery<{ slug: string; name: string; city: string; country: string }[]>({
    queryKey: ["/api/locations"],
  });

  useMemo(() => {
    if (data?.experiment && !formData) {
      setFormData({
        description: data.experiment.description || "",
        status: data.experiment.status,
        max_visitors: data.experiment.max_visitors,
        variants: [...data.experiment.variants],
        targeting: { ...(data.experiment.targeting || {}) },
      });
      if (data.experiment.variants.length > 0 && !selectedVariant) {
        setSelectedVariant(data.experiment.variants[0].slug);
      }
    }
    return null;
  }, [data, formData, selectedVariant]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<ExperimentConfig>) => {
      return apiRequest(
        "PATCH",
        `/api/experiments/${contentType}/${contentSlug}/${experimentSlug}`,
        updates
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/experiments", contentType, contentSlug, experimentSlug],
      });
      setHasChanges(false);
      toast({
        title: "Experiment updated",
        description: "Changes have been saved successfully.",
      });
    },
    onError: (err) => {
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!formData) return;
    updateMutation.mutate({
      description: formData.description,
      status: formData.status as ExperimentConfig["status"],
      max_visitors: formData.max_visitors,
      variants: formData.variants,
      targeting: formData.targeting,
    });
  };

  const updateFormData = <K extends keyof NonNullable<typeof formData>>(
    key: K,
    value: NonNullable<typeof formData>[K]
  ) => {
    if (!formData) return;
    setFormData({ ...formData, [key]: value });
    setHasChanges(true);
  };

  const updateVariantAllocation = (variantSlug: string, newAllocation: number) => {
    if (!formData) return;
    const variants = formData.variants.map((v) =>
      v.slug === variantSlug ? { ...v, allocation: newAllocation } : v
    );
    updateFormData("variants", variants);
  };

  const updateVariantVersion = (variantSlug: string, newVersion: number) => {
    if (!formData) return;
    const variants = formData.variants.map((v) =>
      v.slug === variantSlug ? { ...v, version: newVersion } : v
    );
    updateFormData("variants", variants);
  };

  const updateTargeting = <K extends keyof ExperimentTargeting>(
    key: K,
    value: ExperimentTargeting[K]
  ) => {
    if (!formData) return;
    updateFormData("targeting", { ...formData.targeting, [key]: value });
  };

  const totalAllocation = formData?.variants.reduce((sum, v) => sum + v.allocation, 0) || 0;
  const totalExposures = Object.values(data?.experiment?.stats || {}).reduce((a, b) => a + b, 0);

  const backUrl = useMemo(() => {
    if (contentType === "programs") {
      return `/en/career-programs/${contentSlug}`;
    } else if (contentType === "locations") {
      return `/en/location/${contentSlug}`;
    } else if (contentType === "landings") {
      return `/landing/${contentSlug}`;
    } else {
      return `/en/${contentSlug}`;
    }
  }, [contentType, contentSlug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <IconRefresh className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.experiment) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <IconFlask className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Experiment not found</h1>
        <p className="text-muted-foreground">
          Could not find experiment "{experimentSlug}" for {contentType}/{contentSlug}
        </p>
        <Button onClick={() => navigate(backUrl)} variant="outline">
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const experiment = data.experiment;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(backUrl)}
              data-testid="button-back"
            >
              <IconArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <IconFlask className="h-5 w-5 text-primary" />
              <div>
                <div className="flex items-center gap-1">
                  <h1 className="font-semibold text-sm" data-testid="text-experiment-title">
                    {deslugify(experiment.slug)}
                  </h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setEditDescription(formData?.description || "");
                      setEditDialogOpen(true);
                    }}
                    data-testid="button-edit-title"
                  >
                    <IconPencil className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {deslugify(contentType || "")} / {deslugify(contentSlug || "")}
                </p>
              </div>
            </div>
            <Badge className={statusColors[formData?.status || experiment.status]}>
              {formData?.status || experiment.status}
            </Badge>
            
            {experiment.auto_stopped && (
              <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
                Auto-stopped
              </Badge>
            )}
            
            <div 
              className="flex items-center gap-2 text-sm text-muted-foreground border rounded-md px-2 py-1"
              data-testid="stat-visitors"
            >
              <IconUsers className="h-4 w-4" />
              <span className="font-medium text-foreground">
                {experiment.unique_visitors || 0}
              </span>
              {formData?.max_visitors && (
                <span>/ {formData.max_visitors}</span>
              )}
              <span className="text-xs">visitors</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border rounded-lg p-1">
              {formData?.variants.map((variant) => (
                <Button
                  key={variant.slug}
                  variant={selectedVariant === variant.slug ? "default" : "ghost"}
                  size="sm"
                  className="gap-2"
                  onClick={() => setSelectedVariant(variant.slug)}
                  data-testid={`button-variant-${variant.slug}`}
                >
                  {deslugify(variant.slug)}
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs cursor-pointer ${
                      selectedVariant === variant.slug
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const allocations: Record<string, number> = {};
                      formData?.variants.forEach((v) => {
                        allocations[v.slug] = v.allocation;
                      });
                      setTempAllocations(allocations);
                      setEditingVariantSlug(variant.slug);
                      setAllocationDialogOpen(true);
                    }}
                    data-testid={`badge-allocation-${variant.slug}`}
                  >
                    {variant.allocation}%
                    <IconPencil className="h-2.5 w-2.5" />
                  </span>
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTargetingDialogOpen(true)}
              data-testid="button-targeting"
            >
              <IconTarget className="h-4 w-4 mr-1" />
              Targeting
            </Button>
            
          </div>
        </div>
      </header>

      {/* Preview iframes - all variants rendered but only selected one visible */}
      <div className="flex-1 overflow-hidden relative">
        {formData?.variants.map((variant) => {
          const token = getDebugToken();
          // Build base URL based on content type
          let basePath = "";
          if (contentType === "programs") {
            basePath = `/en/career-programs/${contentSlug}`;
          } else if (contentType === "landings") {
            basePath = `/landing/${contentSlug}`;
          } else if (contentType === "locations") {
            basePath = `/en/location/${contentSlug}`;
          } else if (contentType === "pages") {
            basePath = `/en/${contentSlug}`;
          }
          const baseUrl = `${basePath}?force_variant=${variant.slug}&force_version=${variant.version || 1}&navbar=false&debug=true&edit_mode=true`;
          const iframeSrc = token ? `${baseUrl}&token=${encodeURIComponent(token)}` : baseUrl;
          return (
            <iframe
              key={`${variant.slug}-${variant.version || 1}`}
              src={iframeSrc}
              className={`absolute inset-0 w-full h-full border-0 transition-opacity duration-150 ${
                selectedVariant === variant.slug ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
              title={`Preview: ${deslugify(variant.slug)}`}
              data-testid={`iframe-preview-${variant.slug}`}
            />
          );
        })}
        {!selectedVariant && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a variant to preview
          </div>
        )}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Experiment</DialogTitle>
            <DialogDescription>
              Update the description for this experiment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={deslugify(experiment.slug)}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                The experiment slug cannot be changed.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe what this experiment tests..."
                rows={4}
                data-testid="input-edit-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                updateFormData("description", editDescription);
                setEditDialogOpen(false);
              }}
              data-testid="button-save-edit"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={allocationDialogOpen} onOpenChange={setAllocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Traffic Allocation</DialogTitle>
            <DialogDescription>
              Adjust how traffic is distributed between variants. Total must equal 100%.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formData?.variants.map((variant) => (
              <div key={variant.slug} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{deslugify(variant.slug)}</Label>
                  <span className="text-sm font-medium">
                    {tempAllocations[variant.slug] ?? variant.allocation}%
                  </span>
                </div>
                <Slider
                  value={[tempAllocations[variant.slug] ?? variant.allocation]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([value]) => {
                    setTempAllocations((prev) => ({
                      ...prev,
                      [variant.slug]: value,
                    }));
                  }}
                  data-testid={`slider-temp-allocation-${variant.slug}`}
                />
              </div>
            ))}
            {(() => {
              const total = Object.values(tempAllocations).reduce((sum, v) => sum + v, 0);
              if (total !== 100) {
                return (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Total allocation is {total}%, should be 100%
                  </p>
                );
              }
              return null;
            })()}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAllocationDialogOpen(false)}
              data-testid="button-cancel-allocation"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const total = Object.values(tempAllocations).reduce((sum, v) => sum + v, 0);
                if (total !== 100) {
                  toast({
                    title: "Invalid allocation",
                    description: "Total allocation must equal 100%",
                    variant: "destructive",
                  });
                  return;
                }
                const updatedVariants = formData?.variants.map((v) => ({
                  ...v,
                  allocation: tempAllocations[v.slug] ?? v.allocation,
                })) || [];
                setFormData((prev) => prev ? { ...prev, variants: updatedVariants } : null);
                setHasChanges(true);
                setAllocationDialogOpen(false);
              }}
              data-testid="button-save-allocation"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={targetingDialogOpen} onOpenChange={setTargetingDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconTarget className="h-4 w-4" />
              Targeting Rules
            </DialogTitle>
            <DialogDescription>
              Define which visitors are eligible for this experiment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <IconWorld className="h-4 w-4" />
                  Regions
                </Label>
                <div className="flex flex-wrap gap-2">
                  {["usa-canada", "latam", "europe"].map((region) => (
                    <Button
                      key={region}
                      variant={
                        formData?.targeting?.regions?.includes(region)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => {
                        const current = formData?.targeting?.regions || [];
                        const updated = current.includes(region)
                          ? current.filter((r) => r !== region)
                          : [...current, region];
                        updateTargeting("regions", updated.length ? updated : undefined);
                      }}
                      data-testid={`button-region-${region}`}
                    >
                      {deslugify(region)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <IconDeviceMobile className="h-4 w-4" />
                  Devices
                </Label>
                <div className="flex gap-2">
                  {(["mobile", "tablet", "desktop"] as const).map((device) => (
                    <Button
                      key={device}
                      variant={
                        formData?.targeting?.devices?.includes(device)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => {
                        const current = formData?.targeting?.devices || [];
                        const updated = current.includes(device)
                          ? current.filter((d) => d !== device)
                          : [...current, device];
                        updateTargeting(
                          "devices",
                          updated.length ? (updated as ("mobile" | "tablet" | "desktop")[]) : undefined
                        );
                      }}
                      data-testid={`button-device-${device}`}
                    >
                      {device === "mobile" && <IconDeviceMobile className="h-3 w-3 mr-1" />}
                      {device === "desktop" && <IconDeviceDesktop className="h-3 w-3 mr-1" />}
                      {device.charAt(0).toUpperCase() + device.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconMapPin className="h-4 w-4" />
                Campus Locations
              </Label>
              <TagInput
                values={formData?.targeting?.locations || []}
                onChange={(values) => updateTargeting("locations", values.length ? values : undefined)}
                placeholder="Type city or slug..."
                suggestions={locationsData?.map(loc => ({
                  value: loc.slug,
                  label: `${loc.city}, ${loc.country}`
                })) || []}
                data-testid="input-locations"
              />
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>UTM Sources</Label>
                <TagInput
                  values={formData?.targeting?.utm_sources || []}
                  onChange={(values) => updateTargeting("utm_sources", values.length ? values : undefined)}
                  placeholder="Type and press Enter or comma..."
                  data-testid="input-utm-sources"
                />
              </div>
              <div className="space-y-2">
                <Label>UTM Campaigns</Label>
                <TagInput
                  values={formData?.targeting?.utm_campaigns || []}
                  onChange={(values) => updateTargeting("utm_campaigns", values.length ? values : undefined)}
                  placeholder="Type and press Enter or comma..."
                  data-testid="input-utm-campaigns"
                />
              </div>
              <div className="space-y-2">
                <Label>UTM Mediums</Label>
                <TagInput
                  values={formData?.targeting?.utm_mediums || []}
                  onChange={(values) => updateTargeting("utm_mediums", values.length ? values : undefined)}
                  placeholder="Type and press Enter or comma..."
                  data-testid="input-utm-mediums"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Countries (ISO codes)</Label>
              <TagInput
                values={formData?.targeting?.countries || []}
                onChange={(values) => updateTargeting("countries", values.length ? values : undefined)}
                placeholder="Type country codes (US, CA, MX)..."
                transform={(v) => v.toUpperCase()}
                data-testid="input-countries"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTargetingDialogOpen(false)}
              data-testid="button-cancel-targeting"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleSave();
                setTargetingDialogOpen(false);
              }}
              disabled={updateMutation.isPending}
              data-testid="button-save-targeting"
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
