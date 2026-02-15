import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { IconExternalLink, IconPhoto, IconCheck, IconX, IconArrowUp, IconArrowDown, IconChevronDown } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/contexts/SessionContext";
import type { DynamicTableConfig } from "./TableBuilderWizard";

interface RegionFilter {
  key: string;
  mapping: Record<string, string[]>;
}

interface DynamicTableSection {
  type: "dynamic_table";
  endpoint: string;
  data_path?: string;
  columns: Array<{
    key: string;
    label: string;
    type: "text" | "number" | "date" | "image" | "link" | "boolean";
    function?: string;
  }>;
  title?: string;
  subtitle?: string;
  action?: {
    label: string;
    href: string;
  };
  background?: string;
  region_filter?: RegionFilter;
  max_rows?: number;
}

interface DynamicTableProps {
  data: DynamicTableSection;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(str)) {
    try {
      return new Date(str).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch { /* fall through */ }
  }
  return str;
}

function executeColumnFunction(fnBase64: string, row: Record<string, unknown>): unknown {
  try {
    const fnString = atob(fnBase64);
    const fn = new Function("row", `return (${fnString})(row);`);
    return fn(row);
  } catch {
    return null;
  }
}

function resolveTemplate(template: string, row: Record<string, unknown>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const val = getNestedValue(row, key.trim());
    return formatValue(val);
  });
}

function getCellValue(row: Record<string, unknown>, col: { key: string; function?: string }): unknown {
  if (col.function) {
    return executeColumnFunction(col.function, row);
  }
  return getNestedValue(row, col.key);
}

function CellValue({ value, type }: { value: unknown; type: string }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  switch (type) {
    case "image":
      return (
        <div className="flex items-center justify-center">
          {typeof value === "string" && value ? (
            <img src={value} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" />
          ) : (
            <IconPhoto className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      );
    case "link":
      return typeof value === "string" && value ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline inline-flex items-center gap-1 text-sm"
        >
          Link
          <IconExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    case "boolean":
      return value ? (
        <IconCheck className="w-4 h-4 text-green-600" />
      ) : (
        <IconX className="w-4 h-4 text-muted-foreground" />
      );
    case "number":
      return <span className="tabular-nums">{String(value)}</span>;
    case "date": {
      const raw = String(value).trim();
      if (!raw) return <span className="text-muted-foreground">-</span>;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return <span className="text-muted-foreground">-</span>;
      return <span>{d.toLocaleDateString()}</span>;
    }
    default:
      return <span className="line-clamp-2">{String(value)}</span>;
  }
}

export function DynamicTable({ data }: DynamicTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();

  const sessionRegion = location?.region || null;

  const { data: fetchedData, isLoading, error } = useQuery<unknown>({
    queryKey: ["dynamic-table", data.endpoint],
    queryFn: async () => {
      const res = await fetch(data.endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const allRows = useMemo<Record<string, unknown>[]>(() => {
    if (!fetchedData) return [];
    let arr: unknown;
    if (data.data_path) {
      arr = (fetchedData as Record<string, unknown>)[data.data_path];
    } else if (Array.isArray(fetchedData)) {
      arr = fetchedData;
    } else {
      const obj = fetchedData as Record<string, unknown>;
      const arrayKey = Object.keys(obj).find((k) => Array.isArray(obj[k]));
      arr = arrayKey ? obj[arrayKey] : [];
    }
    if (!Array.isArray(arr)) return [];

    let filtered = arr as Record<string, unknown>[];

    if (data.region_filter && data.region_filter.key && sessionRegion) {
      const { key, mapping } = data.region_filter;
      const allowedValues = mapping[sessionRegion];
      if (allowedValues && allowedValues.length > 0) {
        const lowerAllowed = allowedValues.map(v => v.toLowerCase());
        filtered = filtered.filter(row => {
          const val = getNestedValue(row, key);
          if (val === null || val === undefined) return false;
          return lowerAllowed.includes(String(val).toLowerCase());
        });
      }
    }

    if (sortKey) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = getNestedValue(a, sortKey);
        const bVal = getNestedValue(b, sortKey);
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        }
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return filtered;
  }, [fetchedData, data.data_path, data.region_filter, sessionRegion, sortKey, sortDir]);

  const maxRows = data.max_rows && data.max_rows > 0 ? data.max_rows : null;
  const hasMore = maxRows !== null && allRows.length > maxRows;
  const rows = (maxRows && !expanded) ? allRows.slice(0, maxRows) : allRows;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const bgStyle: React.CSSProperties = {};
  if (data.background) {
    if (data.background.startsWith("linear-gradient") || data.background.startsWith("radial-gradient")) {
      bgStyle.backgroundImage = data.background;
    } else {
      bgStyle.backgroundColor = data.background;
    }
  }

  if (isLoading) {
    return (
      <section className="py-12" style={bgStyle} data-testid="section-dynamic-table">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="animate-pulse">
            {data.title && <div className="h-8 w-64 bg-muted rounded mb-6" />}
            <div className="h-10 w-full bg-muted rounded mb-2" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full bg-muted/50 rounded mb-1" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-12" style={bgStyle} data-testid="section-dynamic-table">
        <div className="max-w-7xl mx-auto px-4 md:px-6 text-center">
          <p className="text-sm text-destructive">Failed to load data from endpoint.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12" style={bgStyle} data-testid="section-dynamic-table">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {(data.title || data.subtitle) && (
          <div className="mb-6">
            {data.title && (
              <h2 className="text-h2 text-foreground" data-testid="text-dynamic-table-title">
                {data.title}
              </h2>
            )}
            {data.subtitle && (
              <p className="text-body text-muted-foreground mt-1" data-testid="text-dynamic-table-subtitle">
                {data.subtitle}
              </p>
            )}
          </div>
        )}

        <div className="overflow-x-auto rounded-[0.8rem] border">
          <table className="w-full text-sm" data-testid="dynamic-table">
            <thead>
              <tr className="bg-muted/50 border-b">
                {data.columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left font-medium text-foreground cursor-pointer select-none"
                    onClick={() => handleSort(col.key)}
                    data-testid={`th-${col.key}`}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        sortDir === "asc" ? (
                          <IconArrowUp className="w-3 h-3" />
                        ) : (
                          <IconArrowDown className="w-3 h-3" />
                        )
                      )}
                    </div>
                  </th>
                ))}
                {data.action && (
                  <th className="px-4 py-3 text-left font-medium text-foreground" data-testid="th-action">
                    {data.action.label}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={data.columns.length + (data.action ? 1 : 0)} className="px-4 py-8 text-center text-muted-foreground">
                    No data available
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b last:border-0 hover-elevate"
                    data-testid={`row-${idx}`}
                  >
                    {data.columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-foreground" data-testid={`cell-${col.key}-${idx}`}>
                        <CellValue value={getCellValue(row, col)} type={col.type} />
                      </td>
                    ))}
                    {data.action && (
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          data-testid={`button-action-${idx}`}
                        >
                          <a
                            href={resolveTemplate(data.action.href, row)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {data.action.label}
                            <IconExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted-foreground" data-testid="text-row-count">
            {maxRows && !expanded
              ? `${rows.length} of ${allRows.length} rows`
              : `${allRows.length} ${allRows.length === 1 ? "row" : "rows"}`}
          </p>
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              data-testid="button-toggle-rows"
            >
              {expanded ? "Show less" : `Show all ${allRows.length}`}
              <IconChevronDown className={`w-4 h-4 ml-1 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

export default DynamicTable;
