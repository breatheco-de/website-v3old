import { useState, useMemo, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconCheck, IconSearch, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

interface FieldValidationResult {
  valid: boolean;
  total: number;
  found: number;
  missing: { slug: string; files: string[] }[];
}

interface SingleVariablePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: string;
  inlineDefault: string;
  onCreated: (variableName: string, templateSyntax: string) => void;
}

export function SingleVariablePickerModal({
  open,
  onOpenChange,
  contentType,
  inlineDefault,
  onCreated,
}: SingleVariablePickerModalProps) {
  const [search, setSearch] = useState("");
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [validation, setValidation] = useState<FieldValidationResult | "loading" | null>(null);
  const requestCounter = useRef(0);

  const { data: typeConfig } = useQuery<{
    name: string;
    label: string;
    field_mapping?: Record<string, string>;
    database?: { slug?: string };
  }>({
    queryKey: [`/api/content-types/${contentType}/config`],
    enabled: open && !!contentType,
  });

  const isDbBacked = !!typeConfig?.database?.slug;
  const fieldMapping = typeConfig?.field_mapping || {};
  const fields = useMemo(() => {
    return Object.entries(fieldMapping)
      .filter(([key]) => !key.startsWith("_"))
      .map(([key, source]) => ({ key, source: source as string }));
  }, [fieldMapping]);

  const filteredFields = useMemo(() => {
    if (!search.trim()) return fields;
    const q = search.toLowerCase();
    return fields.filter(
      (f) =>
        f.key.toLowerCase().includes(q) ||
        f.source.toLowerCase().includes(q),
    );
  }, [fields, search]);

  const validateField = useCallback((source: string) => {
    if (isDbBacked || !source) {
      setValidation(null);
      return;
    }
    const reqId = ++requestCounter.current;
    setValidation("loading");
    fetch(`/api/content-types/${contentType}/validate-field?source=${encodeURIComponent(source)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((result: FieldValidationResult | null) => {
        if (requestCounter.current !== reqId) return;
        setValidation(result);
      })
      .catch(() => {
        if (requestCounter.current !== reqId) return;
        setValidation(null);
      });
  }, [contentType, isDbBacked]);

  const handleSelectField = (key: string) => {
    setSelectedField(key);
    const field = fields.find((f) => f.key === key);
    if (field) {
      const source = field.source.startsWith("function:") ? null : field.source;
      if (source) {
        validateField(source);
      } else {
        setValidation(null);
      }
    }
  };

  const handleUseField = () => {
    if (!selectedField) return;
    const templateSyntax = `{{ single.${selectedField} | ${inlineDefault} }}`;
    onCreated(`single.${selectedField}`, templateSyntax);
    setSelectedField(null);
    setSearch("");
    setValidation(null);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setSelectedField(null);
      setSearch("");
      setValidation(null);
    }
    onOpenChange(o);
  };

  const label = typeConfig?.label || contentType;

  const validationWarning = !isDbBacked && validation && validation !== "loading" && !validation.valid ? validation : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md max-h-[85vh] overflow-y-auto"
        data-testid="single-variable-picker-modal"
      >
        <DialogHeader>
          <DialogTitle>Select {label} field</DialogTitle>
          <DialogDescription>
            Choose a field from the {label.toLowerCase()} entry to insert into
            the template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="relative">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search fields..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="input-search-single-fields"
            />
          </div>

          <div className="border rounded-md max-h-[280px] overflow-y-auto" data-testid="single-fields-list">
            {filteredFields.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-no-fields">
                No fields found
              </div>
            ) : (
              filteredFields.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 border-b last:border-b-0 transition-colors ${
                    selectedField === field.key
                      ? "bg-primary/5"
                      : "hover-elevate"
                  }`}
                  onClick={() => handleSelectField(field.key)}
                  data-testid={`single-field-option-${field.key}`}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {selectedField === field.key && (
                      <IconCheck className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-mono font-medium text-foreground">
                      {field.key}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {field.source}
                    </span>
                  </div>
                  {selectedField === field.key && !isDbBacked && (
                    <div className="flex-shrink-0">
                      {validation === "loading" && (
                        <IconLoader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      )}
                      {validation && validation !== "loading" && validation.valid && (
                        <IconCheck className="w-3.5 h-3.5 text-green-600" />
                      )}
                      {validation && validation !== "loading" && !validation.valid && (
                        <IconAlertTriangle className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          {validationWarning && selectedField && (
            <div className="text-[11px] text-destructive space-y-1" data-testid="text-single-validation-warning">
              <p>
                Source property "<span className="font-mono font-medium">{fieldMapping[selectedField]}</span>" was not found in {validationWarning.found === 0 ? "any" : "some"} content {validationWarning.total === 1 ? "entry" : "entries"}.
                {" "}{validationWarning.found === 0 ? "None" : `Only ${validationWarning.found}`} of {validationWarning.total} {validationWarning.total === 1 ? "entry has" : "entries have"} this property.
              </p>
              {validationWarning.missing.length > 0 && (
                <>
                  <p className="text-muted-foreground">Missing in:</p>
                  <ul className="list-none space-y-0.5">
                    {validationWarning.missing.slice(0, 3).map((entry) => (
                      <li key={entry.slug}>
                        <span className="font-medium">{entry.slug}/</span>
                        {" "}
                        <span className="font-mono text-muted-foreground">
                          {entry.files.map((f) => f.replace(/^marketing-content\//, "")).join(" or ")}
                        </span>
                      </li>
                    ))}
                    {validationWarning.missing.length > 3 && (
                      <li className="text-muted-foreground">+{validationWarning.missing.length - 3} more {validationWarning.missing.length - 3 === 1 ? "entry" : "entries"}</li>
                    )}
                  </ul>
                </>
              )}
            </div>
          )}

          {selectedField && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                Preview
              </label>
              <div className="px-3 py-2 rounded-md bg-muted font-mono text-sm" data-testid="text-single-preview">
                {"{{ "}single.{selectedField}{" | "}{inlineDefault}{" }}"}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              data-testid="button-single-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUseField}
              disabled={!selectedField}
              data-testid="button-single-use-field"
            >
              Use Field
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
