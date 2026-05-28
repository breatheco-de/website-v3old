import { useState, useEffect } from "react";
import {
  IconDeviceFloppy,
  IconLoader2,
  IconPlus,
  IconX,
  IconCheck,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export type EditorOption = string | { value: string; label: string };

export interface EditorConfig {
  type?: string;
  options?: EditorOption[];
  populate_options?: boolean;
  allow_custom_values?: boolean;
  cache_images?: boolean;
  description?: string;
}

interface DBConfig {
  field_mapping?: Record<string, string>;
  editor?: Record<string, EditorConfig>;
}

interface DatabaseDetail {
  name: string;
  config: DBConfig;
}

export function normalizeOption(opt: EditorOption): { value: string; label: string } {
  return typeof opt === "string" ? { value: opt, label: opt } : opt;
}

function buildItemFromForm(
  fields: string[],
  formData: Record<string, unknown>,
  editor: Record<string, EditorConfig> | undefined,
  omitEmpty: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of fields) {
    const value = formData[key];
    const editorType = editor?.[key]?.type;
    if (editorType === "boolean") {
      out[key] = Boolean(value);
    } else if (editorType === "tags") {
      const arr = Array.isArray(value) ? value : [];
      if (arr.length > 0) {
        out[key] = arr;
      } else if (!omitEmpty) {
        out[key] = [];
      }
    } else if (editorType === "number") {
      if (value !== "" && value !== null && value !== undefined) {
        const n = Number(value);
        out[key] = isNaN(n) ? value : n;
      } else if (!omitEmpty) {
        out[key] = null;
      }
    } else {
      if (value !== "" && value !== null && value !== undefined) {
        out[key] = value;
      } else if (!omitEmpty) {
        out[key] = "";
      }
    }
  }
  return out;
}

export interface ItemEditModalProps {
  dbName: string;
  item: Record<string, unknown> | null;
  onSave: (item: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  title?: string;
  modalDescription?: string;
  hiddenFields?: string[];
  onlyFields?: string[];
  allItems?: Record<string, unknown>[];
}

export function ItemEditModal({
  dbName,
  item,
  onSave,
  onClose,
  title,
  modalDescription,
  hiddenFields = [],
  onlyFields,
  allItems: externalAllItems,
}: ItemEditModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState<Record<string, string>>({});
  const [expandedTagFields, setExpandedTagFields] = useState<Record<string, boolean>>({});

  const isNew = item === null;

  const { data: detail, isLoading: configLoading } = useQuery<DatabaseDetail>({
    queryKey: ["/api/databases", dbName],
    staleTime: 5 * 60 * 1000,
  });

  const { data: allItemsData } = useQuery<{ items: Record<string, unknown>[] }>({
    queryKey: [`/api/databases/${dbName}/items`],
    enabled: !externalAllItems && !!detail,
    staleTime: 5 * 60 * 1000,
  });

  const config = detail?.config;
  const allItems = externalAllItems ?? allItemsData?.items ?? [];

  const [formData, setFormData] = useState<Record<string, unknown>>(
    item ? { ...item } : {},
  );
  const [initialized, setInitialized] = useState(!isNew);

  useEffect(() => {
    if (!isNew || initialized || !config?.field_mapping) return;
    const defaults: Record<string, unknown> = {};
    for (const key of Object.keys(config.field_mapping)) {
      if (hiddenFields.includes(key)) continue;
      const editorType = config.editor?.[key]?.type;
      defaults[key] = editorType === "tags" ? [] : editorType === "boolean" ? false : "";
    }
    setFormData(defaults);
    setInitialized(true);
  }, [isNew, initialized, config, hiddenFields]);

  const fields = config?.field_mapping
    ? Object.keys(config.field_mapping).filter((f) => {
        if (hiddenFields.includes(f)) return false;
        if (onlyFields && onlyFields.length > 0 && !onlyFields.includes(f)) return false;
        return true;
      })
    : [];

  const setValue = (key: string, v: unknown) =>
    setFormData((prev) => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = buildItemFromForm(fields, formData, config?.editor, isNew);
      await onSave(payload);
      onClose();
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (key: string) => {
    const editorConfig = config?.editor?.[key];
    const type = editorConfig?.type || "text";
    const rawManualOptions: EditorOption[] = editorConfig?.options || [];
    const manualOptions = rawManualOptions.map(normalizeOption);
    const canAddCustom =
      editorConfig?.allow_custom_values ?? editorConfig?.populate_options ?? false;

    const dataOptions: { value: string; label: string }[] = (
      editorConfig?.populate_options || editorConfig?.allow_custom_values
    )
      ? Array.from(
          new Set(
            allItems
              .map((it) => it[key])
              .flat()
              .filter((v): v is string => typeof v === "string" && v.trim() !== ""),
          ),
        )
          .sort()
          .map((v) => ({ value: v, label: v }))
      : [];

    const manualValues = new Set(manualOptions.map((o) => o.value));
    const mergedOptions = [
      ...manualOptions,
      ...dataOptions.filter((o) => !manualValues.has(o.value)),
    ];

    const value = formData[key];

    switch (type) {
      case "textarea":
        return (
          <Textarea
            value={String(value ?? "")}
            onChange={(e) => setValue(key, e.target.value)}
            className="text-sm min-h-[6rem] resize-y"
            data-testid={`input-edit-${key}`}
          />
        );
      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={Boolean(value)}
              onCheckedChange={(v) => setValue(key, v)}
              data-testid={`switch-edit-${key}`}
            />
            <span className="text-sm text-muted-foreground">
              {Boolean(value) ? "Yes" : "No"}
            </span>
          </div>
        );
      case "number":
        return (
          <Input
            type="number"
            value={String(value ?? "")}
            onChange={(e) => setValue(key, e.target.value)}
            className="text-sm"
            data-testid={`input-edit-${key}`}
          />
        );
      case "select":
        return (
          <Select value={String(value ?? "")} onValueChange={(v) => setValue(key, v)}>
            <SelectTrigger className="text-sm" data-testid={`select-edit-${key}`}>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {mergedOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "tags": {
        const tags = Array.isArray(value) ? (value as string[]) : [];
        const inputVal = tagInput[key] || "";
        const addTag = () => {
          const trimmed = inputVal.trim();
          if (!trimmed) return;
          if (!tags.includes(trimmed)) setValue(key, [...tags, trimmed]);
          setTagInput((prev) => ({ ...prev, [key]: "" }));
        };
        if (mergedOptions.length > 0) {
          const COLLAPSE_THRESHOLD = 8;
          const isExpanded = !!expandedTagFields[key];
          const visibleOptions = isExpanded
            ? mergedOptions
            : mergedOptions.slice(0, COLLAPSE_THRESHOLD);
          const optionValues = new Set(mergedOptions.map((o) => o.value));
          const customTags = tags.filter((t) => !optionValues.has(t));
          const toggle = (opt: { value: string; label: string }) => {
            if (tags.includes(opt.value)) {
              setValue(key, tags.filter((t) => t !== opt.value));
            } else {
              setValue(key, [...tags, opt.value]);
            }
          };
          return (
            <div className="space-y-2" data-testid={`tags-${key}`}>
              <div className="flex flex-wrap gap-1.5">
                {visibleOptions.map((opt) => {
                  const selected = tags.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggle(opt)}
                      data-testid={`button-tag-${key}-${opt.value}`}
                      className="inline-flex"
                    >
                      <Badge
                        variant={selected ? "default" : "outline"}
                        className={selected ? "" : "text-muted-foreground"}
                      >
                        {selected && <IconCheck className="h-3 w-3 mr-1" />}
                        {opt.label}
                      </Badge>
                    </button>
                  );
                })}
                {mergedOptions.length > COLLAPSE_THRESHOLD && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTagFields((prev) => ({ ...prev, [key]: !prev[key] }))
                    }
                    data-testid={`button-tag-expand-${key}`}
                    className="inline-flex"
                  >
                    <Badge variant="outline" className="text-muted-foreground">
                      {isExpanded ? "Show less" : `Show all (${mergedOptions.length})`}
                    </Badge>
                  </button>
                )}
              </div>
              {customTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customTags.map((tag, ti) => (
                    <Badge key={ti} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => setValue(key, tags.filter((t) => t !== tag))}
                        data-testid={`button-remove-custom-tag-${key}-${ti}`}
                      >
                        <IconX className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {canAddCustom && (
                <div className="flex gap-2">
                  <Input
                    value={inputVal}
                    onChange={(e) =>
                      setTagInput((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder="Add new value..."
                    className="h-8 text-sm flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    data-testid={`input-tag-${key}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!inputVal.trim()}
                    onClick={addTag}
                    data-testid={`button-add-tag-${key}`}
                  >
                    <IconPlus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          );
        }
        return (
          <div className="space-y-2">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, ti) => (
                  <Badge key={ti} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setValue(key, tags.filter((_, i) => i !== ti))}
                      data-testid={`button-remove-tag-${key}-${ti}`}
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={inputVal}
                onChange={(e) =>
                  setTagInput((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder="Add tag..."
                className="h-8 text-sm flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                data-testid={`input-tag-${key}`}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!inputVal.trim()}
                onClick={addTag}
                data-testid={`button-add-tag-${key}`}
              >
                <IconPlus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      }
      default:
        return (
          <Input
            value={String(value ?? "")}
            onChange={(e) => setValue(key, e.target.value)}
            className="text-sm"
            data-testid={`input-edit-${key}`}
          />
        );
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title ?? (isNew ? "Add Item" : "Edit Item")}</DialogTitle>
          <DialogDescription>
            {modalDescription ??
              (isNew ? "Fill in the fields to create a new entry." : "Edit the fields below.")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1 min-h-0">
          {configLoading && (
            <div className="flex items-center justify-center py-8">
              <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!configLoading && fields.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <p className="text-sm font-medium">No fields configured</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Go to database settings → Field Mappings to add fields before editing items.
              </p>
            </div>
          )}
          {!configLoading &&
            fields.map((key) => {
              const editorConfig = config?.editor?.[key];
              return (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs font-medium capitalize">
                    {key.replace(/_/g, " ")}
                  </Label>
                  {editorConfig?.description && (
                    <p className="text-xs text-muted-foreground">{editorConfig.description}</p>
                  )}
                  {renderField(key)}
                </div>
              );
            })}
        </div>
        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={saving}
            data-testid="button-cancel-edit-item"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || configLoading || fields.length === 0}
            data-testid="button-save-edit-item"
          >
            {saving ? (
              <IconLoader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <IconDeviceFloppy className="h-3.5 w-3.5 mr-1" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
