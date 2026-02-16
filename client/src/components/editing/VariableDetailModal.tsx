import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { locations } from "@/lib/locations";
import { useToast } from "@/hooks/use-toast";
import { useVariableDefinitions, useVariableContext } from "@/hooks/useVariables";
import { resolveVariable, type VariableDefinition } from "@/lib/variable-resolver";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { IconCheck, IconX, IconArrowRight, IconEdit, IconPlus, IconTrash, IconSelector, IconSearch } from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface VariableDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variableName: string;
  inlineDefault: string;
  mode?: "inspect" | "create";
  onCreated?: (variableName: string, templateSyntax: string) => void;
}

type ResolutionLevel = "by_location" | "by_region" | "by_locale" | "default";

const LEVEL_LABELS: Record<ResolutionLevel, string> = {
  by_location: "Location",
  by_region: "Region",
  by_locale: "Locale",
  default: "Default",
};

const LEVEL_ORDER: ResolutionLevel[] = ["by_location", "by_region", "by_locale", "default"];

function ResolutionChainItem({
  level,
  label,
  contextKey,
  allEntries,
  defaultValue,
  isActive,
  isChecked,
}: {
  level: ResolutionLevel;
  label: string;
  contextKey: string | undefined;
  allEntries: Record<string, string> | undefined;
  defaultValue?: string;
  isActive: boolean;
  isChecked: boolean;
}) {
  const isDefault = level === "default";
  const hasEntries = isDefault ? defaultValue !== undefined : (allEntries && Object.keys(allEntries).length > 0);

  return (
    <div
      className={`rounded-md overflow-visible ${
        isActive
          ? "bg-primary/10 border border-primary/30"
          : isChecked
          ? "bg-muted/50"
          : "opacity-50"
      }`}
      data-testid={`resolution-level-${level}`}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {isActive ? (
            <IconCheck className="w-4 h-4 text-primary" />
          ) : isChecked ? (
            <IconX className="w-4 h-4 text-muted-foreground" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{label}</span>
            {contextKey && (
              <Badge variant="secondary" className="text-xs">
                {contextKey}
              </Badge>
            )}
            {!hasEntries && (
              <span className="text-xs text-muted-foreground/60 italic">No values configured</span>
            )}
          </div>
        </div>
        {isActive && (
          <Badge variant="default" className="text-xs flex-shrink-0">
            Active
          </Badge>
        )}
      </div>

      {hasEntries && (
        <div className="px-3 pb-2 pl-11 space-y-0.5">
          {isDefault ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-mono truncate max-w-[120px]">default</span>
              <span className="text-muted-foreground/40">=</span>
              <span className={`truncate ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>"{defaultValue}"</span>
            </div>
          ) : (
            Object.entries(allEntries!).map(([key, val]) => {
              const isMatch = key === contextKey;
              return (
                <div key={key} className={`flex items-center gap-2 text-xs ${isMatch && isActive ? "font-medium" : ""}`}>
                  <span className={`font-mono truncate max-w-[120px] ${isMatch ? "text-primary" : "text-muted-foreground"}`}>{key}</span>
                  <span className="text-muted-foreground/40">=</span>
                  <span className={`truncate ${isMatch && isActive ? "text-foreground" : "text-muted-foreground"}`}>"{val}"</span>
                  {isMatch && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 flex-shrink-0">
                      match
                    </Badge>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

interface EditRowProps {
  scopeKey: string;
  value: string;
  onSave: (key: string, value: string) => void;
  onDelete: (key: string) => void;
}

function EditRow({ scopeKey, value, onSave, onDelete }: EditRowProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  if (!editing) {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="text-sm text-muted-foreground w-40 truncate flex-shrink-0">{scopeKey}</span>
        <span className="text-sm flex-1 truncate">"{value}"</span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setEditing(true)}
          data-testid={`button-edit-${scopeKey}`}
        >
          <IconEdit className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(scopeKey)}
          data-testid={`button-delete-${scopeKey}`}
        >
          <IconTrash className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-sm text-muted-foreground w-40 truncate flex-shrink-0">{scopeKey}</span>
      <Input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        className="flex-1"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(scopeKey, editValue);
            setEditing(false);
          }
          if (e.key === "Escape") {
            setEditValue(value);
            setEditing(false);
          }
        }}
        data-testid={`input-edit-${scopeKey}`}
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={() => {
          onSave(scopeKey, editValue);
          setEditing(false);
        }}
        data-testid={`button-save-${scopeKey}`}
      >
        <IconCheck className="w-3.5 h-3.5 text-primary" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => {
          setEditValue(value);
          setEditing(false);
        }}
        data-testid={`button-cancel-${scopeKey}`}
      >
        <IconX className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

interface EditableSectionProps {
  level: ResolutionLevel;
  label: string;
  entries: Record<string, string> | undefined;
  defaultValue?: string;
  onSave: (level: ResolutionLevel, key: string, value: string) => Promise<void>;
  onDelete: (level: ResolutionLevel, key: string) => Promise<void>;
  onAdd: (level: ResolutionLevel, key: string, value: string) => Promise<void>;
}

const SUPPORTED_LOCALES = [
  { value: "en", label: "English (en)" },
  { value: "es", label: "Spanish (es)" },
];

function getKeyOptionsForLevel(level: ResolutionLevel, existingKeys: string[]): { value: string; label: string }[] {
  const existing = new Set(existingKeys);

  if (level === "by_location") {
    return locations
      .filter((loc) => loc.visibility === "listed" && !existing.has(loc.slug))
      .map((loc) => ({ value: loc.slug, label: `${loc.name} (${loc.slug})` }));
  }

  if (level === "by_region") {
    const regionSet = new Set(locations.map((loc) => loc.region));
    return Array.from(regionSet)
      .filter((r) => !existing.has(r))
      .sort()
      .map((r) => ({ value: r, label: r }));
  }

  if (level === "by_locale") {
    return SUPPORTED_LOCALES.filter((l) => !existing.has(l.value));
  }

  return [];
}

function EditableSection({ level, label, entries, defaultValue, onSave, onDelete, onAdd }: EditableSectionProps) {
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const isDefault = level === "default";

  const handleAdd = useCallback(() => {
    if (isDefault) {
      onAdd(level, "", newValue);
    } else if (newKey && newValue) {
      onAdd(level, newKey, newValue);
    }
    setNewKey("");
    setNewValue("");
    setAdding(false);
  }, [level, newKey, newValue, isDefault, onAdd]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-foreground">{label}</h4>
        {!isDefault && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAdding(true)}
            className="text-xs"
            data-testid={`button-add-${level}`}
          >
            <IconPlus className="w-3 h-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {isDefault ? (
        <EditRow
          scopeKey="default"
          value={defaultValue || ""}
          onSave={(_, val) => onSave(level, "", val)}
          onDelete={() => onDelete(level, "")}
        />
      ) : (
        <>
          {entries && Object.entries(entries).map(([key, val]) => (
            <EditRow
              key={key}
              scopeKey={key}
              value={val}
              onSave={(k, v) => onSave(level, k, v)}
              onDelete={(k) => onDelete(level, k)}
            />
          ))}
          {(!entries || Object.keys(entries).length === 0) && !adding && (
            <p className="text-xs text-muted-foreground/60 italic py-1">No values defined</p>
          )}
        </>
      )}

      {adding && !isDefault && (() => {
        const existingKeys = entries ? Object.keys(entries) : [];
        const options = getKeyOptionsForLevel(level, existingKeys);
        return (
          <div className="flex items-center gap-2 py-1">
            <Select value={newKey} onValueChange={setNewKey}>
              <SelectTrigger className="w-48 flex-shrink-0" data-testid={`select-trigger-new-key-${level}`}>
                <SelectValue placeholder={
                  level === "by_location" ? "Select location" :
                  level === "by_region" ? "Select region" :
                  "Select locale"
                } />
              </SelectTrigger>
              <SelectContent>
                {options.length === 0 ? (
                  <SelectItem value="__empty__" disabled>All options already added</SelectItem>
                ) : (
                  options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} data-testid={`select-option-${opt.value}`}>
                      {opt.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Input
              placeholder="Value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setAdding(false);
              }}
              data-testid={`input-new-value-${level}`}
            />
            <Button size="icon" variant="ghost" onClick={handleAdd} data-testid={`button-confirm-add-${level}`}>
              <IconCheck className="w-3.5 h-3.5 text-primary" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setAdding(false)} data-testid={`button-cancel-add-${level}`}>
              <IconX className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })()}
    </div>
  );
}

export function VariableDetailModal({
  open,
  onOpenChange,
  variableName,
  inlineDefault,
  mode = "inspect",
  onCreated,
}: VariableDetailModalProps) {
  const { toast } = useToast();
  const { data: definitions, refetch } = useVariableDefinitions();
  const varContext = useVariableContext();
  const [activeTab, setActiveTab] = useState<"explain" | "edit">("explain");
  const [createName, setCreateName] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [currentMode, setCurrentMode] = useState(mode);
  const [createSubMode, setCreateSubMode] = useState<"new" | "existing">("existing");
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const nameCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [existingVarName, setExistingVarName] = useState("");
  const [varComboboxOpen, setVarComboboxOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentMode(mode);
    if (mode === "create") {
      setCreateName("");
      setCreateSaving(false);
      setCreateSubMode("existing");
      setExistingVarName("");
      setNameAvailable(null);
      if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);
    }
  }, [mode, open]);

  const effectiveVarName = currentMode === "create"
    ? (createSubMode === "existing" ? existingVarName : createName)
    : variableName;

  const definition = definitions?.[effectiveVarName];
  const resolution = definition && definitions
    ? resolveVariable(effectiveVarName, definitions, varContext)
    : null;

  const resolvedValue = resolution?.value || inlineDefault || effectiveVarName || "—";
  const resolvedSource = resolution?.source || (inlineDefault ? "inline" : "unresolved");

  const handleCreate = useCallback(async () => {
    const name = createName.trim().replace(/\s+/g, "_").toLowerCase();
    if (!name) {
      toast({ title: "Name required", description: "Please enter a name for the variable.", variant: "destructive" });
      return;
    }
    if (definitions?.[name]) {
      toast({ title: "Already exists", description: `Variable "${name}" already exists. Choose a different name.`, variant: "destructive" });
      return;
    }
    setCreateSaving(true);
    try {
      await apiRequest("PUT", `/api/variables/${name}`, {
        level: "default",
        value: inlineDefault,
      });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
      const templateSyntax = `{{ ${name} | ${inlineDefault} }}`;
      toast({ title: "Variable created", description: `"${name}" is ready to use.` });
      onCreated?.(name, templateSyntax);
      setCurrentMode("inspect");
    } catch (err) {
      toast({
        title: "Failed to create",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreateSaving(false);
    }
  }, [createName, inlineDefault, definitions, refetch, toast, onCreated]);

  const handleUseExisting = useCallback(() => {
    if (!existingVarName) {
      toast({ title: "Select a variable", description: "Please choose an existing variable.", variant: "destructive" });
      return;
    }
    const templateSyntax = `{{ ${existingVarName} | ${inlineDefault} }}`;
    toast({ title: "Variable linked", description: `Text will use "{{ ${existingVarName} }}".` });
    onCreated?.(existingVarName, templateSyntax);
    setCurrentMode("inspect");
  }, [existingVarName, inlineDefault, toast, onCreated]);

  const existingVarNames = definitions ? Object.keys(definitions).sort() : [];

  const handleNameChange = useCallback((rawValue: string) => {
    const sanitized = rawValue.replace(/[^a-zA-Z0-9_]/g, "_");
    setCreateName(sanitized);
    setNameAvailable(null);
    if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);
    const normalized = sanitized.trim().replace(/\s+/g, "_").toLowerCase();
    if (!normalized) {
      setNameAvailable(null);
      return;
    }
    nameCheckTimerRef.current = setTimeout(() => {
      setNameAvailable(!definitions?.[normalized]);
    }, 500);
  }, [definitions]);

  const resolvedCreateValue = (() => {
    const varName = createSubMode === "existing" ? existingVarName : createName.trim().replace(/\s+/g, "_").toLowerCase();
    if (!varName || !definitions?.[varName]) return inlineDefault;
    const res = resolveVariable(varName, definitions, varContext);
    return res?.value || inlineDefault || varName;
  })();

  const getEntriesForLevel = (level: ResolutionLevel): Record<string, string> | undefined => {
    if (!definition) return undefined;
    if (level === "default") return undefined;
    return definition[level] as Record<string, string> | undefined;
  };

  const getContextKeyForLevel = (level: ResolutionLevel): string | undefined => {
    if (level === "default") return undefined;
    const map: Record<string, string | undefined> = {
      by_location: varContext.location,
      by_region: varContext.region,
      by_locale: varContext.locale,
    };
    return map[level];
  };

  const sourceToLevel: Record<string, ResolutionLevel> = {
    location: "by_location",
    region: "by_region",
    locale: "by_locale",
    default: "default",
  };

  const activeLevel = sourceToLevel[resolvedSource] || null;

  const handleSave = useCallback(
    async (level: ResolutionLevel, key: string, value: string) => {
      try {
        await apiRequest("PUT", `/api/variables/${effectiveVarName}`, {
          level,
          key: key || undefined,
          value,
        });
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
        toast({ title: "Variable updated", description: `${effectiveVarName} saved successfully.` });
      } catch (err) {
        toast({
          title: "Failed to save",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [effectiveVarName, refetch, toast],
  );

  const handleDelete = useCallback(
    async (level: ResolutionLevel, key: string) => {
      try {
        await apiRequest("DELETE", `/api/variables/${effectiveVarName}`, {
          level,
          key: key || undefined,
        });
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
        toast({ title: "Value removed", description: `Removed from ${effectiveVarName}.` });
      } catch (err) {
        toast({
          title: "Failed to delete",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [effectiveVarName, refetch, toast],
  );

  const handleAdd = useCallback(
    async (level: ResolutionLevel, key: string, value: string) => {
      await handleSave(level, key, value);
    },
    [handleSave],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={dialogRef} className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="variable-detail-modal">
        {currentMode === "create" ? (
          <>
            <DialogHeader>
              <DialogTitle>Convert to Variable</DialogTitle>
              <DialogDescription>
                Replace the selected text with a variable template.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {createSubMode === "new" ? "New variable name" : "Select variable"}
                </label>
                <div className="flex gap-2 items-start">
                  {createSubMode === "existing" ? (
                    <div className="flex-1">
                      <Popover open={varComboboxOpen} onOpenChange={setVarComboboxOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={varComboboxOpen}
                            className="w-full justify-between font-normal"
                            data-testid="select-existing-variable"
                          >
                            {existingVarName ? (
                              <span className="font-mono text-sm">{existingVarName}</span>
                            ) : (
                              <span className="text-muted-foreground">Choose a variable...</span>
                            )}
                            <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[9999]" align="start">
                          <Command>
                            <CommandInput placeholder="Search variables..." data-testid="input-search-variable" />
                            <CommandList>
                              <CommandEmpty>No variables found.</CommandEmpty>
                              <CommandGroup>
                                {existingVarNames.map((name) => (
                                  <CommandItem
                                    key={name}
                                    value={name}
                                    onSelect={(val) => {
                                      setExistingVarName(val);
                                      setVarComboboxOpen(false);
                                    }}
                                    data-testid={`variable-option-${name}`}
                                  >
                                    <IconCheck
                                      className={`mr-2 h-4 w-4 ${existingVarName === name ? "opacity-100" : "opacity-0"}`}
                                    />
                                    <span className="font-mono text-sm">{name}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : (
                    <div className="flex-1 space-y-1">
                      <div className="relative">
                        <Input
                          id="var-name-input"
                          placeholder="e.g., hero_title, cta_text"
                          value={createName}
                          onChange={(e) => handleNameChange(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && nameAvailable) handleCreate();
                          }}
                          className={`pr-8 font-mono ${nameAvailable === false ? "border-destructive" : nameAvailable === true ? "border-chart-3" : ""}`}
                          data-testid="input-variable-name"
                        />
                        {createName.trim() && nameAvailable !== null && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2">
                            {nameAvailable ? (
                              <IconCheck className="h-4 w-4 text-chart-3" />
                            ) : (
                              <IconX className="h-4 w-4 text-destructive" />
                            )}
                          </span>
                        )}
                      </div>
                      {createName.trim() && nameAvailable === false && (
                        <p className="text-xs text-destructive">This variable name is already taken</p>
                      )}
                      {createName.trim() && nameAvailable === true && (
                        <p className="text-xs text-chart-3">Name available</p>
                      )}
                      {!createName.trim() && (
                        <p className="text-xs text-muted-foreground">Use snake_case (letters, numbers, underscores only)</p>
                      )}
                    </div>
                  )}
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      if (createSubMode === "existing") {
                        setCreateSubMode("new");
                        setCreateName("");
                        setNameAvailable(null);
                      } else {
                        setCreateSubMode("existing");
                      }
                    }}
                    data-testid="button-toggle-create-mode"
                  >
                    {createSubMode === "existing" ? (
                      <IconPlus className="h-4 w-4" />
                    ) : (
                      <IconX className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Based on your current session in <span className="font-medium text-foreground">{varContext.locale || "en"}</span>,{" "}
                  <span className="font-medium text-foreground">{varContext.region || "unknown"}</span> and location{" "}
                  <span className="font-medium text-foreground">{varContext.location || "unknown"}</span>, the value of this variable will be:
                </p>
                <div className="px-3 py-2 rounded-md bg-muted text-sm font-medium">
                  "{resolvedCreateValue}"
                </div>
              </div>

              {((createSubMode === "new" && createName.trim()) || (createSubMode === "existing" && existingVarName)) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Preview</label>
                  <div className="px-3 py-2 rounded-md bg-muted font-mono text-sm">
                    {"{{ "}{createSubMode === "new" ? createName.trim().replace(/\s+/g, "_").toLowerCase() : existingVarName}{" | "}{inlineDefault}{" }}"}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-create">
                  Cancel
                </Button>
                {createSubMode === "new" ? (
                  <Button onClick={handleCreate} disabled={createSaving || !createName.trim() || nameAvailable === false} data-testid="button-confirm-create">
                    {createSaving ? "Creating..." : "Create Variable"}
                  </Button>
                ) : (
                  <Button onClick={handleUseExisting} disabled={!existingVarName} data-testid="button-confirm-use-existing">
                    Use Variable
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-sm px-2 py-1 rounded-md bg-muted">
              {"{{ "}
              {effectiveVarName}
              {" }}"}
            </span>
          </DialogTitle>
          <DialogDescription>
            Currently resolves to: <span className="font-semibold text-foreground">"{resolvedValue}"</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b pb-0 mb-4">
          <button
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "explain"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("explain")}
            data-testid="tab-explain"
          >
            Why this value?
          </button>
          <button
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "edit"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("edit")}
            data-testid="tab-edit"
          >
            Edit values
          </button>
        </div>

        {activeTab === "explain" && (
          <div className="space-y-2" data-testid="explain-tab-content">
            <p className="text-sm text-muted-foreground mb-3">
              The system checks each level in order. The first match wins:
            </p>

            <div className="space-y-2">
              {LEVEL_ORDER.map((level, i) => {
                const contextKey = getContextKeyForLevel(level);
                const allEntries = getEntriesForLevel(level);
                const isActive = activeLevel === level;
                const isChecked = i <= LEVEL_ORDER.indexOf(activeLevel || "default");

                return (
                  <div key={level}>
                    {i > 0 && (
                      <div className="flex items-center justify-center py-1">
                        <IconArrowRight className="w-3 h-3 text-muted-foreground/40 rotate-90" />
                      </div>
                    )}
                    <ResolutionChainItem
                      level={level}
                      label={LEVEL_LABELS[level]}
                      contextKey={contextKey}
                      allEntries={allEntries}
                      defaultValue={level === "default" ? definition?.default : undefined}
                      isActive={isActive}
                      isChecked={isChecked}
                    />
                  </div>
                );
              })}

              {inlineDefault && (
                <>
                  <div className="flex items-center justify-center py-1">
                    <IconArrowRight className="w-3 h-3 text-muted-foreground/40 rotate-90" />
                  </div>
                  <ResolutionChainItem
                    level={"default" as ResolutionLevel}
                    label="Inline Default"
                    contextKey={undefined}
                    allEntries={undefined}
                    defaultValue={inlineDefault}
                    isActive={resolvedSource === "inline"}
                    isChecked={true}
                  />
                </>
              )}
            </div>

            <div className="mt-4 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
              <p>
                <span className="font-medium">Your context:</span>{" "}
                Location={varContext.location || "none"}, Region={varContext.region || "none"}, Locale={varContext.locale || "none"}
              </p>
            </div>

            {definition && (() => {
              const hasOverrides = definition.by_location || definition.by_region || definition.by_locale;
              if (!hasOverrides) return null;

              const contextSamples: { label: string; context: { location?: string; region?: string; locale?: string } }[] = [];

              if (definition.by_location) {
                for (const locSlug of Object.keys(definition.by_location)) {
                  const loc = locations.find((l) => l.slug === locSlug);
                  contextSamples.push({
                    label: loc ? `${loc.name} (${loc.default_language})` : locSlug,
                    context: {
                      location: locSlug,
                      region: loc?.region,
                      locale: loc?.default_language,
                    },
                  });
                }
              }

              if (definition.by_region) {
                for (const regionKey of Object.keys(definition.by_region)) {
                  const alreadyCovered = contextSamples.some((s) => s.context.region === regionKey);
                  if (!alreadyCovered) {
                    const sampleLoc = locations.find((l) => l.region === regionKey);
                    contextSamples.push({
                      label: `${regionKey} region`,
                      context: {
                        location: undefined,
                        region: regionKey,
                        locale: sampleLoc?.default_language,
                      },
                    });
                  }
                }
              }

              if (definition.by_locale) {
                for (const localeKey of Object.keys(definition.by_locale)) {
                  const alreadyCovered = contextSamples.some((s) => s.context.locale === localeKey);
                  if (!alreadyCovered) {
                    contextSamples.push({
                      label: localeKey === "en" ? "English (general)" : localeKey === "es" ? "Spanish (general)" : localeKey,
                      context: {
                        location: undefined,
                        region: undefined,
                        locale: localeKey,
                      },
                    });
                  }
                }
              }

              if (contextSamples.length === 0) return null;

              return (
                <div className="mt-3 space-y-1.5" data-testid="cross-context-summary">
                  <p className="text-xs font-medium text-muted-foreground">How it resolves across contexts:</p>
                  <div className="rounded-md border divide-y">
                    {contextSamples.map((sample) => {
                      const res = definitions && effectiveVarName ? resolveVariable(effectiveVarName, definitions, sample.context) : null;
                      const value = res?.value || definition.default || inlineDefault || "—";
                      const source = res?.source || "default";
                      return (
                        <div key={sample.label} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs" data-testid={`context-sample-${sample.label}`}>
                          <span className="text-muted-foreground truncate">{sample.label}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="font-medium text-foreground">"{value}"</span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {source}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === "edit" && (
          <div className="space-y-4" data-testid="edit-tab-content">
            <EditableSection
              level="default"
              label="Default Value"
              entries={undefined}
              defaultValue={definition?.default}
              onSave={handleSave}
              onDelete={handleDelete}
              onAdd={handleAdd}
            />
            <EditableSection
              level="by_locale"
              label="By Locale"
              entries={definition?.by_locale}
              onSave={handleSave}
              onDelete={handleDelete}
              onAdd={handleAdd}
            />
            <EditableSection
              level="by_region"
              label="By Region"
              entries={definition?.by_region}
              onSave={handleSave}
              onDelete={handleDelete}
              onAdd={handleAdd}
            />
            <EditableSection
              level="by_location"
              label="By Location"
              entries={definition?.by_location}
              onSave={handleSave}
              onDelete={handleDelete}
              onAdd={handleAdd}
            />
          </div>
        )}
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
