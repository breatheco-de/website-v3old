import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  IconArrowLeft,
  IconDatabase,
  IconRefresh,
  IconSearch,
  IconTable,
  IconApi,
  IconClock,
  IconArrowsSort,
  IconChevronUp,
  IconChevronDown,
  IconLoader2,
} from "@tabler/icons-react";

interface DatabaseSummary {
  name: string;
  label: string;
  description: string | null;
  source_type: string;
  field_count: number;
}

interface DatabaseDetail {
  name: string;
  config: {
    name: string;
    description?: string;
    source: {
      type: string;
      api?: {
        endpoint: string;
        params?: Record<string, unknown>;
        results_path?: string;
        auth?: { token_env_var?: string; prefix?: string };
      };
    };
    cache?: { ttl_hours?: number };
    field_mapping?: Record<string, string>;
  };
}

interface DatabaseItems {
  items: Record<string, unknown>[];
  raw_count: number;
  fetched_at: string;
  from_cache: boolean;
}

function DatabaseList() {
  const { data: databases, isLoading } = useQuery<DatabaseSummary[]>({
    queryKey: ["/api/databases"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!databases || databases.length === 0) {
    return (
      <div className="text-center py-20">
        <IconDatabase className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground">No databases configured yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Create a folder under marketing-content/db/ with a config.yml file.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {databases.map((db) => (
        <Link key={db.name} href={`/private/databases/${db.name}`}>
          <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-database-${db.name}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <IconDatabase className="h-4 w-4 text-primary flex-shrink-0" />
                <CardTitle className="text-base truncate">{db.label}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {db.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{db.description}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  <IconApi className="h-3 w-3 mr-1" />
                  {db.source_type}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {db.field_count} fields
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function DatabaseDetailView({ dbName }: { dbName: string }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: detail } = useQuery<DatabaseDetail>({
    queryKey: ["/api/databases", dbName],
  });

  const {
    data: itemsData,
    isLoading: itemsLoading,
    refetch: refetchItems,
  } = useQuery<DatabaseItems>({
    queryKey: [`/api/databases/${dbName}/items`],
  });

  const config = detail?.config;
  const fieldMapping = config?.field_mapping;
  const columns = useMemo(() => {
    if (fieldMapping && Object.keys(fieldMapping).length > 0) {
      return Object.keys(fieldMapping);
    }
    if (itemsData?.items?.[0]) {
      return Object.keys(itemsData.items[0]);
    }
    return [];
  }, [fieldMapping, itemsData?.items]);

  const filteredItems = useMemo(() => {
    if (!itemsData?.items) return [];
    let items = itemsData.items;

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((item) =>
        Object.values(item).some(
          (v) => v != null && String(v).toLowerCase().includes(q)
        )
      );
    }

    if (sortKey) {
      items = [...items].sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return items;
  }, [itemsData?.items, search, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch(`/api/databases/${dbName}/refresh`, { method: "POST" });
      await refetchItems();
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/private/databases">
          <Button variant="ghost" size="sm" data-testid="button-back-databases">
            <IconArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate" data-testid="text-database-name">
            {config?.name || dbName}
          </h2>
          {config?.description && (
            <p className="text-xs text-muted-foreground truncate">{config.description}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <IconApi className="h-3.5 w-3.5" />
              <span>Source</span>
            </div>
            <p className="text-sm font-medium">{config?.source.type || "—"}</p>
            {config?.source.api?.endpoint && (
              <p className="text-xs text-muted-foreground truncate" title={config.source.api.endpoint}>
                {config.source.api.endpoint}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <IconTable className="h-3.5 w-3.5" />
              <span>Items</span>
            </div>
            <p className="text-sm font-medium" data-testid="text-item-count">
              {itemsData ? itemsData.raw_count : itemsLoading ? "..." : "—"}
            </p>
            {itemsData?.from_cache && (
              <p className="text-xs text-muted-foreground">from cache</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <IconClock className="h-3.5 w-3.5" />
              <span>Last Fetched</span>
            </div>
            <p className="text-sm font-medium" data-testid="text-fetched-at">
              {itemsData?.fetched_at
                ? new Date(itemsData.fetched_at).toLocaleString()
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              TTL: {config?.cache?.ttl_hours ?? 24}h
            </p>
          </CardContent>
        </Card>
      </div>

      {fieldMapping && (
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm">Field Mapping</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(fieldMapping).map(([key, path]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-medium">{key}</code>
                  <span className="text-muted-foreground">←</span>
                  <code className="text-muted-foreground truncate">{path || "null"}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm">
              Data{" "}
              {filteredItems.length !== (itemsData?.items?.length ?? 0) && (
                <span className="text-muted-foreground font-normal">
                  ({filteredItems.length} of {itemsData?.items?.length ?? 0})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 h-8 w-48 text-xs"
                  data-testid="input-search-items"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                data-testid="button-refresh-items"
              >
                <IconRefresh className={`h-3.5 w-3.5 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {itemsLoading ? (
            <div className="flex items-center justify-center py-12">
              <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                {search ? "No items match your search." : "No items fetched yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="table-database-items">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap"
                        onClick={() => handleSort(col)}
                        data-testid={`th-sort-${col}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col}
                          {sortKey === col ? (
                            sortDir === "asc" ? (
                              <IconChevronUp className="h-3 w-3" />
                            ) : (
                              <IconChevronDown className="h-3 w-3" />
                            )
                          ) : (
                            <IconArrowsSort className="h-3 w-3 opacity-30" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, i) => (
                    <tr
                      key={i}
                      className="border-b last:border-b-0 hover:bg-muted/30"
                      data-testid={`row-item-${i}`}
                    >
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="px-3 py-2 max-w-[200px] truncate whitespace-nowrap"
                          title={formatCellValue(item[col])}
                        >
                          {formatCellValue(item[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PrivateDatabases() {
  const [, params] = useRoute("/private/databases/:name");
  const dbName = params?.name;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <IconDatabase className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Databases</h1>
      </div>

      {dbName ? <DatabaseDetailView dbName={dbName} /> : <DatabaseList />}
    </div>
  );
}
