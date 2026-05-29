import { useState, useMemo } from "react";
import { IconCheck, IconChevronDown, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DbFieldValuesPickerProps {
  database: string;
  field: string;
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
}

/**
 * General-purpose field editor that fetches a specific database and shows a
 * searchable picker populated from the unique values of a given field.
 *
 * Used to configure dynamic_entries.permanent_filters entries from a live dataset
 * instead of a hardcoded list.
 *
 * editorType syntax: "db-field-values-picker:database_name:field_name"
 * Example: "db-field-values-picker:frequently_asked_questions:locations"
 */
export function DbFieldValuesPicker({
  database,
  field,
  value,
  onChange,
  label,
}: DbFieldValuesPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ items: Record<string, unknown>[] }>({
    queryKey: [`/api/databases/${database}/items`],
    staleTime: 5 * 60 * 1000,
    enabled: !!database && !!field,
  });

  const uniqueValues = useMemo<string[]>(() => {
    const items = data?.items ?? [];
    const seen = new Set<string>();
    for (const item of items) {
      const fieldVal = item[field];
      if (Array.isArray(fieldVal)) {
        for (const v of fieldVal) {
          if (v && typeof v === "string") seen.add(v);
        }
      } else if (fieldVal && typeof fieldVal === "string") {
        seen.add(fieldVal);
      }
    }
    return Array.from(seen).sort();
  }, [data, field]);

  const filteredValues = useMemo(
    () =>
      uniqueValues.filter(
        (v) => !search || v.toLowerCase().includes(search.toLowerCase()),
      ),
    [uniqueValues, search],
  );

  const toggle = (v: string) => {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  };

  const displayLabel = label ?? field;

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium capitalize">{displayLabel}</Label>

      <div className="flex flex-wrap gap-1.5 min-h-[2rem] items-start">
        {value.length === 0 && (
          <span className="text-xs text-muted-foreground italic self-center">
            No filter — shows all
          </span>
        )}
        {value.map((v) => (
          <Badge
            key={v}
            variant="secondary"
            className="text-xs font-mono gap-1 no-default-active-elevate cursor-pointer"
            onClick={() => toggle(v)}
          >
            {v}
            <IconX className="h-3 w-3" />
          </Badge>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between text-xs"
            data-testid={`button-db-field-picker-${field}`}
          >
            <span className="text-muted-foreground">
              {isLoading ? "Loading values…" : `Pick ${field} values`}
            </span>
            <IconChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0 z-[10000]" align="start" side="bottom">
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder={`Search ${field}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1 text-sm rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid={`input-db-field-picker-search-${field}`}
            />
          </div>

          <div className="max-h-52 overflow-y-auto p-1">
            {isLoading && (
              <p className="text-xs text-muted-foreground text-center py-3">Loading…</p>
            )}
            {!isLoading && filteredValues.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No values found</p>
            )}
            {!isLoading &&
              filteredValues.map((v) => {
                const selected = value.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggle(v)}
                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover-elevate ${
                      selected ? "text-foreground" : "text-muted-foreground"
                    }`}
                    data-testid={`button-db-field-value-${field}-${v}`}
                  >
                    <span className="flex-1 text-xs font-mono">{v}</span>
                    {selected && (
                      <IconCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })}
          </div>

          {value.length > 0 && (
            <div className="border-t p-1.5">
              <button
                type="button"
                onClick={() => {
                  onChange([]);
                  setOpen(false);
                }}
                className="w-full text-xs text-muted-foreground px-2 py-1 rounded hover-elevate text-left"
                data-testid={`button-db-field-picker-clear-${field}`}
              >
                Clear filter
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {uniqueValues.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {uniqueValues.length} unique value{uniqueValues.length !== 1 ? "s" : ""} in{" "}
          <span className="font-mono">{database}.{field}</span>
        </p>
      )}
    </div>
  );
}
