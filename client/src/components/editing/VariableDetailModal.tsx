import { useState, useEffect, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useVariableDefinitions, useVariableContext } from "@/hooks/useVariables";
import { resolveVariable, type VariableDefinition } from "@/lib/variable-resolver";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { IconCheck, IconX, IconArrowRight, IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";

interface VariableDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variableName: string;
  inlineDefault: string;
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
  value,
  isActive,
  isChecked,
}: {
  level: ResolutionLevel;
  label: string;
  contextKey: string | undefined;
  value: string | undefined;
  isActive: boolean;
  isChecked: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-md ${
        isActive
          ? "bg-primary/10 border border-primary/30"
          : isChecked
          ? "bg-muted/50"
          : "opacity-50"
      }`}
      data-testid={`resolution-level-${level}`}
    >
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
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {contextKey && (
            <Badge variant="secondary" className="text-xs">
              {contextKey}
            </Badge>
          )}
        </div>
        {value ? (
          <p className="text-sm text-muted-foreground truncate mt-0.5">"{value}"</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 mt-0.5 italic">No value defined</p>
        )}
      </div>
      {isActive && (
        <Badge variant="default" className="text-xs flex-shrink-0">
          Active
        </Badge>
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

      {adding && !isDefault && (
        <div className="flex items-center gap-2 py-1">
          <Input
            placeholder="Key (e.g., miami)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="w-40 flex-shrink-0"
            autoFocus
            data-testid={`input-new-key-${level}`}
          />
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
      )}
    </div>
  );
}

export function VariableDetailModal({
  open,
  onOpenChange,
  variableName,
  inlineDefault,
}: VariableDetailModalProps) {
  const { toast } = useToast();
  const { data: definitions, refetch } = useVariableDefinitions();
  const varContext = useVariableContext();
  const [activeTab, setActiveTab] = useState<"explain" | "edit">("explain");

  const definition = definitions?.[variableName];
  const resolution = definition
    ? resolveVariable(variableName, definitions!, varContext)
    : null;

  const resolvedValue = resolution?.value || inlineDefault || variableName;
  const resolvedSource = resolution?.source || (inlineDefault ? "inline" : "unresolved");

  const getValueForLevel = (level: ResolutionLevel): string | undefined => {
    if (!definition) return undefined;
    if (level === "default") return definition.default;
    const contextKeyMap: Record<string, string | undefined> = {
      by_location: varContext.location,
      by_region: varContext.region,
      by_locale: varContext.locale,
    };
    const key = contextKeyMap[level];
    if (!key) return undefined;
    const bucket = definition[level] as Record<string, string> | undefined;
    return bucket?.[key];
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
        await apiRequest("PUT", `/api/variables/${variableName}`, {
          level,
          key: key || undefined,
          value,
        });
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
        toast({ title: "Variable updated", description: `${variableName} saved successfully.` });
      } catch (err) {
        toast({
          title: "Failed to save",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [variableName, refetch, toast],
  );

  const handleDelete = useCallback(
    async (level: ResolutionLevel, key: string) => {
      try {
        await apiRequest("DELETE", `/api/variables/${variableName}`, {
          level,
          key: key || undefined,
        });
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
        toast({ title: "Value removed", description: `Removed from ${variableName}.` });
      } catch (err) {
        toast({
          title: "Failed to delete",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [variableName, refetch, toast],
  );

  const handleAdd = useCallback(
    async (level: ResolutionLevel, key: string, value: string) => {
      await handleSave(level, key, value);
    },
    [handleSave],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="variable-detail-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-sm px-2 py-1 rounded-md bg-muted">
              {"{{ "}
              {variableName}
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
                const value = getValueForLevel(level);
                const contextKey = getContextKeyForLevel(level);
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
                      value={value}
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
                    value={inlineDefault}
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
      </DialogContent>
    </Dialog>
  );
}
