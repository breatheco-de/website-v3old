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
import { resolveVariable, type VariableDefinition, type VariableCondition } from "@/lib/variable-resolver";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import {
  IconCheck,
  IconX,
  IconEdit,
  IconPlus,
  IconTrash,
  IconSelector,
  IconChevronUp,
  IconChevronDown,
  IconFilter,
} from "@tabler/icons-react";
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

const SUPPORTED_LOCALES = [
  { value: "en", label: "English (en)" },
  { value: "es", label: "Spanish (es)" },
];

const CRITERIA_KEYS = [
  { key: "location", label: "Location" },
  { key: "region", label: "Region" },
  { key: "locale", label: "Locale" },
] as const;

function getOptionsForCriteriaKey(key: string): { value: string; label: string }[] {
  if (key === "location") {
    return locations
      .filter((loc) => loc.visibility === "listed")
      .map((loc) => ({ value: loc.slug, label: `${loc.name} (${loc.slug})` }));
  }
  if (key === "region") {
    const regionSet = new Set(locations.map((loc) => loc.region));
    return Array.from(regionSet)
      .sort()
      .map((r) => ({ value: r, label: r }));
  }
  if (key === "locale") {
    return SUPPORTED_LOCALES;
  }
  return [];
}

function querySummary(query: Record<string, string>): string {
  return Object.entries(query)
    .map(([k, v]) => `${k} = ${v}`)
    .join(", ");
}

function ConditionRow({
  condition,
  index,
  isFirst,
  isLast,
  isMatched,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  condition: VariableCondition;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isMatched: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 rounded-md ${
        isMatched ? "bg-primary/10 border border-primary/30" : "bg-muted/50"
      }`}
      data-testid={`condition-row-${index}`}
    >
      <div className="flex flex-col flex-shrink-0">
        <Button
          size="icon"
          variant="ghost"
          onClick={onMoveUp}
          disabled={isFirst}
          data-testid={`button-move-up-${index}`}
        >
          <IconChevronUp className="w-3 h-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onMoveDown}
          disabled={isLast}
          data-testid={`button-move-down-${index}`}
        >
          <IconChevronDown className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">{index + 1}.</span>
          {Object.entries(condition.query).map(([key, val]) => (
            <Badge key={key} variant="secondary" className="text-xs">
              {key} = {val}
            </Badge>
          ))}
          {isMatched && (
            <Badge variant="default" className="text-xs ml-1">
              Matched
            </Badge>
          )}
        </div>
        <p className="text-sm mt-1 truncate">"{condition.value}"</p>
      </div>

      <div className="flex gap-0.5 flex-shrink-0">
        <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`button-edit-condition-${index}`}>
          <IconEdit className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete} data-testid={`button-delete-condition-${index}`}>
          <IconTrash className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function ConditionEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: VariableCondition;
  onSave: (condition: VariableCondition) => void;
  onCancel: () => void;
}) {
  const [criteria, setCriteria] = useState<Record<string, string>>(
    initial?.query ? { ...initial.query } : {},
  );
  const [value, setValue] = useState(initial?.value || "");
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const usedKeys = Object.keys(criteria);
  const availableKeys = CRITERIA_KEYS.filter((ck) => !usedKeys.includes(ck.key));

  const handleAddCriteria = (key: string, val: string) => {
    setCriteria((prev) => ({ ...prev, [key]: val }));
    setAddingKey(null);
  };

  const handleRemoveCriteria = (key: string) => {
    setCriteria((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = () => {
    if (Object.keys(criteria).length === 0 || !value.trim()) return;
    onSave({ query: criteria, value: value.trim() });
  };

  return (
    <div className="space-y-3 p-3 rounded-md border border-dashed border-primary/30 bg-muted/30" data-testid="condition-editor">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          When these criteria match:
        </label>
        {usedKeys.map((key) => {
          const opts = getOptionsForCriteriaKey(key);
          return (
            <div key={key} className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {key}
              </Badge>
              <Select
                value={criteria[key]}
                onValueChange={(val) =>
                  setCriteria((prev) => ({ ...prev, [key]: val }))
                }
              >
                <SelectTrigger className="flex-1" data-testid={`select-criteria-${key}`}>
                  <SelectValue placeholder={`Select ${key}...`} />
                </SelectTrigger>
                <SelectContent>
                  {opts.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleRemoveCriteria(key)}
                data-testid={`button-remove-criteria-${key}`}
              >
                <IconX className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })}

        {addingKey ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {addingKey}
            </Badge>
            <Select
              onValueChange={(val) => handleAddCriteria(addingKey, val)}
            >
              <SelectTrigger className="flex-1" data-testid={`select-new-criteria-${addingKey}`}>
                <SelectValue placeholder={`Select ${addingKey}...`} />
              </SelectTrigger>
              <SelectContent>
                {getOptionsForCriteriaKey(addingKey).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setAddingKey(null)}
              data-testid="button-cancel-add-criteria"
            >
              <IconX className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : availableKeys.length > 0 ? (
          <div className="flex gap-1">
            {availableKeys.map((ck) => (
              <Button
                key={ck.key}
                size="sm"
                variant="outline"
                onClick={() => setAddingKey(ck.key)}
                data-testid={`button-add-criteria-${ck.key}`}
              >
                <IconPlus className="w-3 h-3 mr-1" />
                {ck.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Then use this value:
        </label>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter value..."
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onCancel();
          }}
          data-testid="input-condition-value"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} data-testid="button-cancel-condition">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={Object.keys(criteria).length === 0 || !value.trim()}
          data-testid="button-save-condition"
        >
          {initial ? "Update" : "Add Condition"}
        </Button>
      </div>
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
  const [editingConditionIndex, setEditingConditionIndex] = useState<number | null>(null);
  const [addingCondition, setAddingCondition] = useState(false);
  const [editingDefault, setEditingDefault] = useState(false);
  const [editDefaultValue, setEditDefaultValue] = useState("");

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

  useEffect(() => {
    setEditingConditionIndex(null);
    setAddingCondition(false);
    setEditingDefault(false);
  }, [open, activeTab]);

  const effectiveVarName = currentMode === "create"
    ? (createSubMode === "existing" ? existingVarName : createName)
    : variableName;

  const definition = definitions?.[effectiveVarName];
  const resolution = definition
    ? resolveVariable(effectiveVarName, definitions!, varContext)
    : null;

  const resolvedValue = resolution?.value || inlineDefault || effectiveVarName;
  const resolvedSource = resolution?.source || (inlineDefault ? "inline" : "unresolved");

  const matchedConditionIndex = (() => {
    if (!definition?.conditions || resolvedSource !== "condition") return -1;
    for (let i = 0; i < definition.conditions.length; i++) {
      const cond = definition.conditions[i];
      const matches = Object.entries(cond.query).every(([key, val]) => {
        const contextVal = (varContext as Record<string, string | undefined>)[key];
        return contextVal === val;
      });
      if (matches) return i;
    }
    return -1;
  })();

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
        action: "set_default",
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

  const handleSaveDefault = useCallback(
    async (value: string) => {
      try {
        await apiRequest("PUT", `/api/variables/${effectiveVarName}`, {
          action: "set_default",
          value,
        });
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
        toast({ title: "Default updated", description: `${effectiveVarName} default saved.` });
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

  const handleAddCondition = useCallback(
    async (condition: VariableCondition) => {
      try {
        await apiRequest("PUT", `/api/variables/${effectiveVarName}`, {
          action: "add_condition",
          condition,
        });
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
        setAddingCondition(false);
        toast({ title: "Condition added", description: `New condition added to ${effectiveVarName}.` });
      } catch (err) {
        toast({
          title: "Failed to add condition",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [effectiveVarName, refetch, toast],
  );

  const handleUpdateCondition = useCallback(
    async (index: number, condition: VariableCondition) => {
      try {
        await apiRequest("PUT", `/api/variables/${effectiveVarName}`, {
          action: "update_condition",
          index,
          condition,
        });
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
        setEditingConditionIndex(null);
        toast({ title: "Condition updated", description: `Condition ${index + 1} updated.` });
      } catch (err) {
        toast({
          title: "Failed to update",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [effectiveVarName, refetch, toast],
  );

  const handleDeleteCondition = useCallback(
    async (index: number) => {
      try {
        await apiRequest("PUT", `/api/variables/${effectiveVarName}`, {
          action: "delete_condition",
          index,
        });
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
        toast({ title: "Condition removed", description: `Condition ${index + 1} removed.` });
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

  const handleReorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      try {
        await apiRequest("PUT", `/api/variables/${effectiveVarName}`, {
          action: "reorder_conditions",
          fromIndex,
          toIndex,
        });
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
      } catch (err) {
        toast({
          title: "Failed to reorder",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [effectiveVarName, refetch, toast],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={dialogRef} className={`max-w-lg max-h-[85vh] ${varComboboxOpen ? "overflow-visible" : "overflow-y-auto"}`} data-testid="variable-detail-modal">
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
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" container={dialogRef.current} onCloseAutoFocus={(e) => e.preventDefault()}>
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
                                      setExistingVarName(val === existingVarName ? "" : val);
                                      requestAnimationFrame(() => setVarComboboxOpen(false));
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
          <div className="space-y-3" data-testid="explain-tab-content">
            <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
              <p>
                <span className="font-medium">Your context:</span>{" "}
                location = {varContext.location || "none"}, region = {varContext.region || "none"}, locale = {varContext.locale || "none"}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              Conditions are checked in order. The first match wins:
            </p>

            {definition?.conditions && definition.conditions.length > 0 ? (
              <div className="space-y-1.5">
                {definition.conditions.map((cond, i) => {
                  const isMatch = i === matchedConditionIndex;
                  const isPastMatch = matchedConditionIndex >= 0 && i > matchedConditionIndex;
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-3 px-3 py-2 rounded-md ${
                        isMatch
                          ? "bg-primary/10 border border-primary/30"
                          : isPastMatch
                          ? "opacity-40"
                          : "bg-muted/50"
                      }`}
                      data-testid={`explain-condition-${i}`}
                    >
                      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
                        {isMatch ? (
                          <IconCheck className="w-4 h-4 text-primary" />
                        ) : isPastMatch ? (
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                        ) : (
                          <IconX className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          {Object.entries(cond.query).map(([key, val]) => (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {key} = {val}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm mt-0.5 truncate">"{cond.value}"</p>
                      </div>
                      {isMatch && (
                        <Badge variant="default" className="text-xs flex-shrink-0 mt-0.5">
                          Active
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">No conditions defined</p>
            )}

            <div
              className={`flex items-start gap-3 px-3 py-2 rounded-md ${
                resolvedSource === "default"
                  ? "bg-primary/10 border border-primary/30"
                  : resolvedSource === "inline" && !definition?.default
                  ? "bg-primary/10 border border-primary/30"
                  : matchedConditionIndex >= 0
                  ? "opacity-40"
                  : "bg-muted/50"
              }`}
              data-testid="explain-default"
            >
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
                {resolvedSource === "default" || (resolvedSource === "inline" && !definition?.default) ? (
                  <IconCheck className="w-4 h-4 text-primary" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">Default</span>
                {definition?.default ? (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">"{definition.default}"</p>
                ) : (
                  <p className="text-xs text-muted-foreground/60 mt-0.5 italic">No default set</p>
                )}
              </div>
              {resolvedSource === "default" && (
                <Badge variant="default" className="text-xs flex-shrink-0 mt-0.5">
                  Active
                </Badge>
              )}
            </div>

            {inlineDefault && (
              <div
                className={`flex items-start gap-3 px-3 py-2 rounded-md ${
                  resolvedSource === "inline"
                    ? "bg-primary/10 border border-primary/30"
                    : "opacity-40"
                }`}
                data-testid="explain-inline"
              >
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
                  {resolvedSource === "inline" ? (
                    <IconCheck className="w-4 h-4 text-primary" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">Inline Default</span>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">"{inlineDefault}"</p>
                </div>
                {resolvedSource === "inline" && (
                  <Badge variant="default" className="text-xs flex-shrink-0 mt-0.5">
                    Active
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "edit" && (
          <div className="space-y-4" data-testid="edit-tab-content">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Default Value</h4>
              {editingDefault ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editDefaultValue}
                    onChange={(e) => setEditDefaultValue(e.target.value)}
                    className="flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveDefault(editDefaultValue);
                        setEditingDefault(false);
                      }
                      if (e.key === "Escape") setEditingDefault(false);
                    }}
                    data-testid="input-edit-default"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      handleSaveDefault(editDefaultValue);
                      setEditingDefault(false);
                    }}
                    data-testid="button-save-default"
                  >
                    <IconCheck className="w-3.5 h-3.5 text-primary" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingDefault(false)}
                    data-testid="button-cancel-default"
                  >
                    <IconX className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm flex-1 truncate">
                    {definition?.default ? `"${definition.default}"` : <span className="text-muted-foreground/60 italic">Not set</span>}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditDefaultValue(definition?.default || "");
                      setEditingDefault(true);
                    }}
                    data-testid="button-edit-default"
                  >
                    <IconEdit className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <IconFilter className="w-3.5 h-3.5 text-muted-foreground" />
                  Conditions
                </h4>
                {!addingCondition && editingConditionIndex === null && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddingCondition(true)}
                    data-testid="button-add-condition"
                  >
                    <IconPlus className="w-3 h-3 mr-1" />
                    Add Condition
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                First match wins. Drag to reorder priority.
              </p>

              {definition?.conditions && definition.conditions.length > 0 ? (
                <div className="space-y-1.5">
                  {definition.conditions.map((cond, i) => (
                    editingConditionIndex === i ? (
                      <ConditionEditor
                        key={i}
                        initial={cond}
                        onSave={(updated) => handleUpdateCondition(i, updated)}
                        onCancel={() => setEditingConditionIndex(null)}
                      />
                    ) : (
                      <ConditionRow
                        key={i}
                        condition={cond}
                        index={i}
                        isFirst={i === 0}
                        isLast={i === definition.conditions!.length - 1}
                        isMatched={i === matchedConditionIndex}
                        onEdit={() => setEditingConditionIndex(i)}
                        onDelete={() => handleDeleteCondition(i)}
                        onMoveUp={() => handleReorder(i, i - 1)}
                        onMoveDown={() => handleReorder(i, i + 1)}
                      />
                    )
                  ))}
                </div>
              ) : !addingCondition ? (
                <p className="text-xs text-muted-foreground/60 italic py-1">
                  No conditions yet. Add one to vary this value by location, region, or language.
                </p>
              ) : null}

              {addingCondition && (
                <ConditionEditor
                  onSave={handleAddCondition}
                  onCancel={() => setAddingCondition(false)}
                />
              )}
            </div>
          </div>
        )}
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
