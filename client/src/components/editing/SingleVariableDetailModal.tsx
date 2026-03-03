import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { IconLoader2, IconExternalLink, IconInfoCircle } from "@tabler/icons-react";

interface SingleVariableDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variableName: string;
  inlineDefault: string;
  contentType: string;
  currentSlug?: string;
}

interface FieldValueEntry {
  slug: string;
  value: unknown;
  url: string | null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "(not set)";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function SingleVariableDetailModal({
  open,
  onOpenChange,
  variableName,
  inlineDefault,
  contentType,
  currentSlug,
}: SingleVariableDetailModalProps) {
  const fieldName = variableName.startsWith("single.")
    ? variableName.slice(7)
    : variableName;

  const { data, isLoading } = useQuery<{
    field: string;
    source: string;
    entries: FieldValueEntry[];
  }>({
    queryKey: ["/api/content-types", contentType, "single-field-values", fieldName],
    queryFn: async () => {
      const res = await fetch(
        `/api/content-types/${contentType}/single-field-values?field=${encodeURIComponent(fieldName)}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: open && !!contentType && !!fieldName,
  });

  const currentEntry = data?.entries.find((e) => e.slug === currentSlug);
  const otherEntries = data?.entries.filter((e) => e.slug !== currentSlug) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[85vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        data-testid="single-variable-detail-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-sm px-2 py-1 rounded-md bg-muted">
              {"{{ "}
              {variableName}
              {inlineDefault ? ` | ${inlineDefault}` : ""}
              {" }}"}
            </span>
          </DialogTitle>
          <DialogDescription>
            {currentEntry ? (
              <>
                Currently resolves to:{" "}
                <span className="font-semibold text-foreground">
                  "{formatValue(currentEntry.value)}"
                </span>
              </>
            ) : inlineDefault ? (
              <>
                Inline default:{" "}
                <span className="font-semibold text-foreground">
                  "{inlineDefault}"
                </span>
              </>
            ) : (
              "Entry-specific variable"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
            <IconInfoCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p>
                <span className="font-medium text-foreground">Single variables</span> pull
                their value from each entry's own data. Unlike global variables
                which are the same everywhere, single variables change based on
                which {contentType} page you're viewing.
              </p>
              {data?.source && (
                <p className="mt-1.5">
                  This variable reads from the{" "}
                  <span className="font-mono text-xs px-1 py-0.5 rounded bg-muted text-foreground">
                    {data.source}
                  </span>{" "}
                  property in each entry's YAML data.
                </p>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <IconLoader2 className="w-4 h-4 animate-spin mr-2" />
              Loading values...
            </div>
          ) : data?.entries && data.entries.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">
                Values across {data.entries.length} {contentType} {data.entries.length === 1 ? "entry" : "entries"}
              </h4>
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                {data.entries.map((entry) => {
                  const isCurrent = entry.slug === currentSlug;
                  return (
                    <div
                      key={entry.slug}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                        isCurrent
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-muted/50"
                      }`}
                      data-testid={`single-value-entry-${entry.slug}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">
                            {entry.slug}
                          </span>
                          {isCurrent && (
                            <Badge variant="secondary" className="text-[10px]">
                              current page
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 truncate font-medium">
                          {entry.value !== null && entry.value !== undefined
                            ? `"${formatValue(entry.value)}"`
                            : <span className="text-muted-foreground/60 italic">not set</span>
                          }
                        </div>
                      </div>
                      {entry.url && (
                        <a
                          href={entry.url}
                          className="flex-shrink-0 text-muted-foreground/60"
                          title={`Go to ${entry.url}`}
                          data-testid={`link-entry-${entry.slug}`}
                        >
                          <IconExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              No entries found for this content type.
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-single-detail"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
