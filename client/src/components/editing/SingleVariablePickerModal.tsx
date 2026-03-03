import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconCheck, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

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

  const { data: typeConfig } = useQuery<{
    name: string;
    label: string;
    field_mapping?: Record<string, string>;
  }>({
    queryKey: [`/api/content-types/${contentType}/config`],
    enabled: open && !!contentType,
  });

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

  const handleUseField = () => {
    if (!selectedField) return;
    const templateSyntax = `{{ single.${selectedField} | ${inlineDefault} }}`;
    onCreated(`single.${selectedField}`, templateSyntax);
    setSelectedField(null);
    setSearch("");
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setSelectedField(null);
      setSearch("");
    }
    onOpenChange(o);
  };

  const label = typeConfig?.label || contentType;

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
                  onClick={() => setSelectedField(field.key)}
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
                </button>
              ))
            )}
          </div>

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
