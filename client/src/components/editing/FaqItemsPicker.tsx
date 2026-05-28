import { useState, useMemo } from "react";
import {
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconEyeOff,
  IconLoader2,
  IconMapPin,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconArrowBackUp,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { locations as allLocations } from "@/lib/locations";
import { faqItemKey, type FaqItem } from "@/lib/faqConstants";
import type { Location } from "@shared/session";
import { FaqScopeDialog } from "@/components/editing/FaqScopeDialog";
import { ItemEditModal } from "@/components/databases/ItemEditModal";

const FAQ_DB_NAME = "frequently_asked_questions";
const FAQ_LOCAL_FIELDS: string[] = ["question", "answer"];

type DisplayItem = {
  question: string;
  answer: string;
  _source: "hardcoded" | "db";
};

type ScopeState = {
  mode: "add" | "edit" | "delete";
  item?: DisplayItem;
} | null;

type EditState = {
  item: Record<string, unknown> | null;
  onSave: (item: Record<string, unknown>) => Promise<void>;
  title?: string;
  onlyFields?: string[];
} | null;

interface FaqItemsPickerProps {
  relatedFeatures: string[];
  locale: string;
  hardcodedItems: Array<{ question: string; answer: string }>;
  ignoredEntries: string[];
  itemOverrides: Record<string, { hideOnLocations?: string[] }>;
  onChange: (overrides: Record<string, { hideOnLocations?: string[] }>) => void;
  onHardcodedEntriesChange?: (entries: Array<{ question: string; answer: string }>) => void;
  onIgnoredEntriesChange?: (keys: string[]) => void;
  /** Atomic callback: adds a hardcoded entry AND an ignored key in one YAML write. */
  onLocalizeDbEntry?: (
    entry: { question: string; answer: string },
    ignoredKey: string,
  ) => void;
  /** Mirrors dynamic_entries.sort — same format as server: field name, prefix "-" for desc. */
  sortField?: string;
  /** Mirrors dynamic_entries.limit — caps DB items after hardcoded slots are counted. */
  limit?: number;
}

function ItemLocationPicker({
  itemKey,
  question,
  hideOnLocations,
  source,
  onLocationsChange,
  onEdit,
  onDelete,
}: {
  itemKey: string;
  question: string;
  hideOnLocations: string[];
  source: "hardcoded" | "db";
  onLocationsChange: (itemKey: string, locations: string[]) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const hasOverrides = hideOnLocations.length > 0;

  const grouped = useMemo(() => {
    const groups: Record<string, Location[]> = {};
    const searchLower = search.toLowerCase();
    for (const loc of allLocations) {
      if (loc.visibility !== "listed") continue;
      if (
        searchLower &&
        !loc.name.toLowerCase().includes(searchLower) &&
        !loc.country.toLowerCase().includes(searchLower) &&
        !loc.slug.toLowerCase().includes(searchLower)
      )
        continue;
      const region = loc.region;
      if (!groups[region]) groups[region] = [];
      groups[region].push(loc);
    }
    return groups;
  }, [search]);

  const regionLabels: Record<string, string> = {
    "usa-canada": "USA & Canada",
    latam: "Latin America",
    europe: "Europe",
    online: "Online",
  };

  const toggleLocation = (slug: string) => {
    if (hideOnLocations.includes(slug)) {
      onLocationsChange(itemKey, hideOnLocations.filter((s) => s !== slug));
    } else {
      onLocationsChange(itemKey, [...hideOnLocations, slug]);
    }
  };

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${source === "hardcoded" ? "bg-secondary" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 flex-1 min-w-0">
          <p className="text-xs text-foreground leading-tight line-clamp-2 flex-1">
            {question}
            {source === "hardcoded" && (
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 ml-1.5 text-muted-foreground align-middle no-default-hover-elevate no-default-active-elevate"
              >
                only in this section
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={hasOverrides ? "border-amber-400 dark:border-amber-600" : ""}
                data-testid={`button-faq-item-locations-${itemKey}`}
              >
                <IconMapPin className="h-3.5 w-3.5 mr-1" />
                {hasOverrides ? (
                  <span className="text-xs">{hideOnLocations.length} hidden</span>
                ) : (
                  <span className="text-xs">All visible</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 z-[10000]" align="end">
              <div className="p-2 border-b">
                <div className="relative">
                  <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search locations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    data-testid={`input-search-faq-locations-${itemKey}`}
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {Object.entries(grouped).map(([region, locs]) => (
                  <div key={region} className="mb-1">
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {regionLabels[region] || region}
                    </div>
                    {locs.map((loc) => {
                      const isHidden = hideOnLocations.includes(loc.slug);
                      return (
                        <button
                          key={loc.slug}
                          onClick={() => toggleLocation(loc.slug)}
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-left text-sm rounded-md hover-elevate"
                          data-testid={`button-toggle-faq-loc-${itemKey}-${loc.slug}`}
                        >
                          <div
                            className={`w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                              isHidden
                                ? "bg-destructive/20 border-destructive text-destructive"
                                : "border-muted-foreground/30"
                            }`}
                          >
                            {isHidden && <IconEyeOff className="h-3 w-3" />}
                          </div>
                          <span
                            className={isHidden ? "text-muted-foreground line-through" : ""}
                          >
                            {loc.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {loc.country}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              {hasOverrides && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      onLocationsChange(itemKey, []);
                      setOpen(false);
                    }}
                    data-testid={`button-clear-faq-locations-${itemKey}`}
                  >
                    <IconCheck className="h-3.5 w-3.5 mr-1" />
                    Show on all locations
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              data-testid={`button-faq-item-edit-${itemKey}`}
              title="Edit"
            >
              <IconPencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              data-testid={`button-faq-item-delete-${itemKey}`}
              title="Delete"
            >
              <IconTrash className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      {hasOverrides && (
        <div className="flex flex-wrap gap-1">
          {hideOnLocations.map((slug) => {
            const loc = allLocations.find((l) => l.slug === slug);
            return (
              <Badge
                key={slug}
                variant="outline"
                className="text-[10px] cursor-pointer border-destructive/50 text-destructive"
                onClick={() => toggleLocation(slug)}
                data-testid={`badge-hidden-loc-${itemKey}-${slug}`}
              >
                <IconEyeOff className="h-2.5 w-2.5 mr-0.5" />
                {loc?.name || slug}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FaqItemsPicker({
  relatedFeatures,
  locale,
  hardcodedItems,
  ignoredEntries,
  itemOverrides,
  onChange,
  onHardcodedEntriesChange,
  onIgnoredEntriesChange,
  onLocalizeDbEntry,
  sortField,
  limit,
}: FaqItemsPickerProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const [scopeState, setScopeState] = useState<ScopeState>(null);
  const [editState, setEditState] = useState<EditState>(null);
  const [hardcodedDeleteConfirm, setHardcodedDeleteConfirm] =
    useState<DisplayItem | null>(null);
  const [globalDeleteConfirm, setGlobalDeleteConfirm] = useState<DisplayItem | null>(null);
  const [globalDeleting, setGlobalDeleting] = useState(false);

  const hasCentralized = relatedFeatures.length > 0;
  const isEditable = !!(onHardcodedEntriesChange || onIgnoredEntriesChange || onLocalizeDbEntry);

  const { data: faqsData, isLoading } = useQuery<{ items: FaqItem[] }>({
    queryKey: ["/api/databases/frequently_asked_questions/items"],
    enabled: hasCentralized,
    staleTime: 5 * 60 * 1000,
  });

  const displayedItems = useMemo<DisplayItem[]>(() => {
    const allDbItems = faqsData?.items ?? [];
    const localeItems = allDbItems.filter((f) => f.locale === locale);

    // Match server order: filter by related_features (same logic, no relevance re-scoring),
    // then preserve YAML order. No limit applied here so preview shows all candidates.
    let dbItems: FaqItem[] = localeItems;
    if (hasCentralized && relatedFeatures.length > 0) {
      dbItems = localeItems.filter((faq) => {
        const faqFeatures = faq.related_features || [];
        return relatedFeatures.some((f) => faqFeatures.includes(f));
      });
    } else if (!hasCentralized) {
      dbItems = [];
    }

    const hardcodedKeys = new Set(hardcodedItems.map((i) => faqItemKey(i.question)));
    const ignoredSet = new Set(ignoredEntries);

    let uniqueDbItems = dbItems
      .filter((i) => !hardcodedKeys.has(faqItemKey(i.question)))
      .filter((i) => !ignoredSet.has(faqItemKey(i.question)));

    // Match-count sort (mirrors server dynamic-entries logic):
    // When multiple relatedFeatures are configured, items matching more features
    // float to the top. The explicit sortField (if set) is the tiebreaker within
    // each match-count group; otherwise priority is the default tiebreaker.
    // Falls back to explicit sortField alone when relatedFeatures has ≤1 value.
    if (relatedFeatures.length > 1) {
      const explicitSortDesc = sortField?.startsWith("-") ?? false;
      const explicitSortField = sortField
        ? (explicitSortDesc ? sortField.slice(1) : sortField)
        : null;

      uniqueDbItems = [...uniqueDbItems].sort((a, b) => {
        const aFeatures = ((a as Record<string, unknown>).related_features as string[]) || [];
        const bFeatures = ((b as Record<string, unknown>).related_features as string[]) || [];
        const aCount = relatedFeatures.filter((f) => aFeatures.includes(f)).length;
        const bCount = relatedFeatures.filter((f) => bFeatures.includes(f)).length;
        if (bCount !== aCount) return bCount - aCount;

        // Tiebreaker: explicit sort field, or priority as default
        const tieField = explicitSortField ?? "priority";
        const aT = (a as Record<string, unknown>)[tieField];
        const bT = (b as Record<string, unknown>)[tieField];
        if (aT == null && bT == null) return 0;
        if (aT == null) return 1;
        if (bT == null) return -1;
        let cmp = 0;
        if (typeof aT === "number" && typeof bT === "number") {
          cmp = aT - bT;
        } else {
          cmp = String(aT).localeCompare(String(bT));
        }
        return explicitSortField && explicitSortDesc ? -cmp : cmp;
      });
    } else if (sortField) {
      const desc = sortField.startsWith("-");
      const field = desc ? sortField.slice(1) : sortField;
      uniqueDbItems = [...uniqueDbItems].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[field];
        const bVal = (b as Record<string, unknown>)[field];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        let cmp = 0;
        if (typeof aVal === "number" && typeof bVal === "number") {
          cmp = aVal - bVal;
        } else {
          cmp = String(aVal).localeCompare(String(bVal));
        }
        return desc ? -cmp : cmp;
      });
    }

    // Mirror server limit logic: limit caps total (hardcoded + DB), so DB gets remaining slots
    if (limit && limit > 0) {
      const remainingSlots = Math.max(0, limit - hardcodedItems.length);
      uniqueDbItems = uniqueDbItems.slice(0, remainingSlots);
    }

    return [
      ...hardcodedItems.map((i) => ({ ...i, _source: "hardcoded" as const })),
      ...uniqueDbItems.map((i) => ({ ...i, _source: "db" as const })),
    ];
  }, [faqsData, relatedFeatures, hasCentralized, hardcodedItems, ignoredEntries, locale, sortField, limit]);

  // Resolve original question text for ignored entries from DB data
  const ignoredItemsResolved = useMemo(() => {
    if (!ignoredEntries.length) return [];
    const allDbItems = faqsData?.items ?? [];
    return ignoredEntries.map((key) => {
      const found = allDbItems.find(
        (i) => faqItemKey(i.question) === key && i.locale === locale,
      );
      return { key, question: found?.question ?? key };
    });
  }, [ignoredEntries, faqsData, locale]);

  const handleItemLocationsChange = (itemKey: string, locations: string[]) => {
    const newOverrides = { ...itemOverrides };
    if (locations.length === 0) {
      delete newOverrides[itemKey];
    } else {
      newOverrides[itemKey] = { hideOnLocations: locations };
    }
    onChange(newOverrides);
  };

  const overrideCount = Object.keys(itemOverrides).filter(
    (k) => (itemOverrides[k]?.hideOnLocations?.length ?? 0) > 0,
  ).length;

  // --- Edit state factories ---
  const openLocalAdd = () => {
    setEditState({
      item: null,
      title: "Add FAQ (this section only)",
      onlyFields: FAQ_LOCAL_FIELDS,
      onSave: async (builtItem) => {
        const entry = {
          question: String(builtItem.question || ""),
          answer: String(builtItem.answer || ""),
        };
        if (!entry.question.trim()) throw new Error("Question is required");
        onHardcodedEntriesChange?.([...hardcodedItems, entry]);
        toast({ title: "FAQ added to this section" });
      },
    });
  };

  const openGlobalAdd = () => {
    setEditState({
      item: null,
      title: "Add FAQ (all pages)",
      onSave: async (builtItem) => {
        const res = await fetch(`/api/databases/${FAQ_DB_NAME}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item: { ...builtItem, locale } }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error || "Failed to create FAQ",
          );
        }
        await queryClient.invalidateQueries({
          queryKey: ["/api/databases/frequently_asked_questions/items"],
        });
        toast({ title: "FAQ added to database" });
      },
    });
  };

  const openLocalEditHardcoded = (faqItem: DisplayItem) => {
    const key = faqItemKey(faqItem.question);
    setEditState({
      item: { question: faqItem.question, answer: faqItem.answer },
      title: "Edit FAQ (this section)",
      onlyFields: FAQ_LOCAL_FIELDS,
      onSave: async (builtItem) => {
        const entry = {
          question: String(builtItem.question || ""),
          answer: String(builtItem.answer || ""),
        };
        if (!entry.question.trim()) throw new Error("Question is required");
        onHardcodedEntriesChange?.(
          hardcodedItems.map((h) => (faqItemKey(h.question) === key ? entry : h)),
        );
        toast({ title: "FAQ updated" });
      },
    });
  };

  const openLocalEditDb = (faqItem: DisplayItem) => {
    const key = faqItemKey(faqItem.question);
    setEditState({
      item: { question: faqItem.question, answer: faqItem.answer },
      title: "Edit FAQ (this section only)",
      onlyFields: FAQ_LOCAL_FIELDS,
      onSave: async (builtItem) => {
        const entry = {
          question: String(builtItem.question || ""),
          answer: String(builtItem.answer || ""),
        };
        if (!entry.question.trim()) throw new Error("Question is required");
        // Use atomic callback if available (avoids stale-closure double-write bug)
        if (onLocalizeDbEntry) {
          onLocalizeDbEntry(entry, key);
        } else {
          onHardcodedEntriesChange?.([...hardcodedItems, entry]);
          onIgnoredEntriesChange?.([...ignoredEntries, key]);
        }
        toast({ title: "FAQ saved as section-only copy" });
      },
    });
  };

  const openGlobalEdit = (faqItem: DisplayItem) => {
    const allDbItems = faqsData?.items ?? [];
    const dbIndex = allDbItems.findIndex(
      (i) =>
        faqItemKey(i.question) === faqItemKey(faqItem.question) &&
        i.locale === locale,
    );
    const fullItem =
      dbIndex !== -1
        ? (allDbItems[dbIndex] as unknown as Record<string, unknown>)
        : null;
    setEditState({
      item: fullItem,
      title: "Edit FAQ (all pages)",
      onSave: async (builtItem) => {
        if (dbIndex === -1) throw new Error("Item not found in database");
        const res = await fetch(`/api/databases/${FAQ_DB_NAME}/items/${dbIndex}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(builtItem),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error || "Failed to update FAQ",
          );
        }
        await queryClient.invalidateQueries({
          queryKey: ["/api/databases/frequently_asked_questions/items"],
        });
        toast({ title: "FAQ updated in database" });
      },
    });
  };

  // --- Action handlers ---
  const handleAdd = () => {
    if (hasCentralized && isEditable) {
      setScopeState({ mode: "add" });
    } else if (isEditable) {
      openLocalAdd();
    }
  };

  const handleEdit = (faqItem: DisplayItem) => {
    if (faqItem._source === "hardcoded") {
      openLocalEditHardcoded(faqItem);
    } else if (isEditable) {
      setScopeState({ mode: "edit", item: faqItem });
    } else {
      openGlobalEdit(faqItem);
    }
  };

  const handleDelete = (faqItem: DisplayItem) => {
    if (faqItem._source === "hardcoded") {
      setHardcodedDeleteConfirm(faqItem);
    } else if (isEditable) {
      setScopeState({ mode: "delete", item: faqItem });
    } else {
      setGlobalDeleteConfirm(faqItem);
    }
  };

  const handleScopeSelect = (scope: "local" | "global") => {
    if (!scopeState) return;
    const { mode, item } = scopeState;
    setScopeState(null);

    if (mode === "add") {
      if (scope === "local") openLocalAdd();
      else openGlobalAdd();
    } else if (mode === "edit" && item) {
      if (scope === "local") {
        if (item._source === "hardcoded") openLocalEditHardcoded(item);
        else openLocalEditDb(item);
      } else {
        openGlobalEdit(item);
      }
    } else if (mode === "delete" && item) {
      const key = faqItemKey(item.question);
      if (scope === "local") {
        if (item._source === "hardcoded") {
          onHardcodedEntriesChange?.(
            hardcodedItems.filter((h) => faqItemKey(h.question) !== key),
          );
          toast({ title: "FAQ removed from this section" });
        } else {
          onIgnoredEntriesChange?.([...ignoredEntries, key]);
          toast({ title: "FAQ hidden from this section" });
        }
      } else {
        setGlobalDeleteConfirm(item);
      }
    }
  };

  const handleHardcodedDeleteConfirm = () => {
    if (!hardcodedDeleteConfirm) return;
    const key = faqItemKey(hardcodedDeleteConfirm.question);
    onHardcodedEntriesChange?.(
      hardcodedItems.filter((h) => faqItemKey(h.question) !== key),
    );
    toast({ title: "FAQ removed from this section" });
    setHardcodedDeleteConfirm(null);
  };

  const handleGlobalDelete = async () => {
    if (!globalDeleteConfirm) return;
    setGlobalDeleting(true);
    try {
      const allDbItems = faqsData?.items ?? [];
      const dbIndex = allDbItems.findIndex(
        (i) =>
          faqItemKey(i.question) === faqItemKey(globalDeleteConfirm.question) &&
          i.locale === locale,
      );
      if (dbIndex === -1) throw new Error("Item not found in database");
      const res = await fetch(`/api/databases/${FAQ_DB_NAME}/items/${dbIndex}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "Failed to delete FAQ",
        );
      }
      await queryClient.invalidateQueries({
        queryKey: ["/api/databases/frequently_asked_questions/items"],
      });
      toast({ title: "FAQ deleted from database" });
      setGlobalDeleteConfirm(null);
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setGlobalDeleting(false);
    }
  };

  const hasItems = hardcodedItems.length > 0 || hasCentralized;
  if (!hasItems && !isEditable) return null;

  return (
    <div className="space-y-2">
      {/* Scope dialog */}
      {scopeState && (
        <FaqScopeDialog
          mode={scopeState.mode}
          onSelectScope={handleScopeSelect}
          onClose={() => setScopeState(null)}
        />
      )}

      {/* Edit modal */}
      {editState && (
        <ItemEditModal
          dbName={FAQ_DB_NAME}
          item={editState.item}
          onSave={editState.onSave}
          onClose={() => setEditState(null)}
          title={editState.title}
          onlyFields={editState.onlyFields}
        />
      )}

      {/* Hardcoded delete confirm */}
      {hardcodedDeleteConfirm && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) setHardcodedDeleteConfirm(null);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Remove local FAQ?</DialogTitle>
              <DialogDescription>
                This will remove the FAQ from this section's content. The database is
                not affected.
              </DialogDescription>
            </DialogHeader>
            <p className="text-xs text-muted-foreground border rounded-md p-2 line-clamp-3">
              {hardcodedDeleteConfirm.question}
            </p>
            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHardcodedDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleHardcodedDeleteConfirm}
                data-testid="button-confirm-delete-hardcoded"
              >
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Global delete confirm */}
      {globalDeleteConfirm && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) setGlobalDeleteConfirm(null);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete from database?</DialogTitle>
              <DialogDescription>
                This permanently removes the FAQ from the database. All pages showing it
                will be affected.
              </DialogDescription>
            </DialogHeader>
            <p className="text-xs text-muted-foreground border rounded-md p-2 line-clamp-3">
              {globalDeleteConfirm.question}
            </p>
            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGlobalDeleteConfirm(null)}
                disabled={globalDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleGlobalDelete}
                disabled={globalDeleting}
                data-testid="button-confirm-delete-global"
              >
                {globalDeleting && (
                  <IconLoader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                )}
                Delete permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Header row */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 flex-1 group min-w-0"
          data-testid="button-toggle-faq-items-visibility"
        >
          <Label className="text-sm font-medium flex items-center gap-1.5 cursor-pointer flex-wrap">
            <IconEyeOff className="h-3.5 w-3.5 flex-shrink-0" />
            FAQ preview
            {overrideCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {overrideCount} with overrides
              </Badge>
            )}
          </Label>
          {expanded ? (
            <IconChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-auto" />
          ) : (
            <IconChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-auto" />
          )}
        </button>
        {/* "hidden" count badge — outside the collapse button so it has no hover effect */}
        {ignoredEntries.length > 0 && (
          <Badge
            variant="outline"
            className="text-[10px] text-muted-foreground no-default-hover-elevate no-default-active-elevate pointer-events-none"
          >
            {ignoredEntries.length} hidden
          </Badge>
        )}
        {isEditable && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            data-testid="button-faq-add-item"
          >
            <IconPlus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        )}
      </div>

      {expanded && (
        <div className="space-y-2 mt-2">
          {isLoading && (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          )}
          {!isLoading && displayedItems.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No FAQ items found for the selected topics.
            </p>
          )}
          {!isLoading &&
            displayedItems.map((faqItem) => {
              const key = faqItemKey(faqItem.question);
              const override = itemOverrides[key];
              return (
                <ItemLocationPicker
                  key={key}
                  itemKey={key}
                  question={faqItem.question}
                  hideOnLocations={override?.hideOnLocations || []}
                  source={faqItem._source}
                  onLocationsChange={handleItemLocationsChange}
                  onEdit={isEditable ? () => handleEdit(faqItem) : undefined}
                  onDelete={isEditable ? () => handleDelete(faqItem) : undefined}
                />
              );
            })}

          {/* Hidden DB items section */}
          {ignoredItemsResolved.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
                Hidden DB items ({ignoredItemsResolved.length})
              </p>
              {ignoredItemsResolved.map(({ key, question }) => (
                <div
                  key={key}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed bg-muted/20"
                >
                  <p className="text-xs text-muted-foreground line-clamp-1 flex-1 italic">
                    {question}
                  </p>
                  {onIgnoredEntriesChange && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2 flex-shrink-0"
                      onClick={() =>
                        onIgnoredEntriesChange(ignoredEntries.filter((k) => k !== key))
                      }
                      data-testid={`button-restore-ignored-${key}`}
                      title="Restore this FAQ"
                    >
                      <IconArrowBackUp className="h-3 w-3 mr-1" />
                      Restore
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
