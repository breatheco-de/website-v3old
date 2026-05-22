import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiFetch } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, BarChart2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { ComponentInsightsData, ComponentPairing, ComponentSequence } from "@shared/schema";

type SortKey = "from" | "to" | "count" | "frequency" | "pmi" | "distance";
type SortDir = "asc" | "desc";

const PMI_TOOLTIP = "PMI (Pointwise Mutual Information) — measures how much more often two components appear adjacent than would happen by chance. Positive = meaningful co-occurrence; near 0 = coincidental; negative = actively avoided.";
const DISTANCE_TOOLTIP = "Distance — 1 / max(PMI, ε). Lower values mean a stronger, more predictable relationship between the two components.";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="inline ml-1 opacity-40" size={12} />;
  return sortDir === "asc"
    ? <ArrowUp className="inline ml-1" size={12} />
    : <ArrowDown className="inline ml-1" size={12} />;
}

function PairingsTable({ pairings }: { pairings: ComponentPairing[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const arr = [...pairings];
    arr.sort((a, b) => {
      const av = a[sortKey] as string | number;
      const bv = b[sortKey] as string | number;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return arr;
  }, [pairings, sortKey, sortDir]);

  function toggle(col: SortKey) {
    if (col === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      setSortDir("desc");
    }
  }

  const cols: { key: SortKey; label: string; tooltip?: string }[] = [
    { key: "from", label: "From" },
    { key: "to", label: "To" },
    { key: "count", label: "Count" },
    { key: "frequency", label: "Frequency" },
    { key: "pmi", label: "PMI", tooltip: PMI_TOOLTIP },
    { key: "distance", label: "Distance", tooltip: DISTANCE_TOOLTIP },
  ];

  if (pairings.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No pairings found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            {cols.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                onClick={() => toggle(col.key)}
                data-testid={`th-${col.key}`}
              >
                {col.tooltip ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="border-b border-dashed border-muted-foreground/50">
                        {col.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm text-xs">{col.tooltip}</TooltipContent>
                  </Tooltip>
                ) : (
                  col.label
                )}
                <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr key={`${p.from}-${p.to}-${i}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2 font-mono text-xs">{p.from}</td>
              <td className="px-3 py-2 font-mono text-xs">{p.to}</td>
              <td className="px-3 py-2 tabular-nums">{p.count}</td>
              <td className="px-3 py-2 tabular-nums">{(p.frequency * 100).toFixed(1)}%</td>
              <td className="px-3 py-2 tabular-nums">
                <span className={p.pmi > 0.5 ? "text-green-700 dark:text-green-400" : p.pmi < 0 ? "text-destructive" : ""}>
                  {p.pmi.toFixed(3)}
                </span>
              </td>
              <td className="px-3 py-2 tabular-nums">{p.distance.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SequencesList({ sequences }: { sequences: ComponentSequence[] }) {
  if (sequences.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No sequences found.</p>;
  }
  return (
    <ol className="space-y-2">
      {sequences.map((s, i) => (
        <li key={i} className="flex items-start gap-3 rounded-md border px-3 py-2 bg-muted/20">
          <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 pt-0.5">{i + 1}.</span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1">
              {s.sequence.map((comp, j) => (
                <span key={j} className="flex items-center gap-1">
                  <Badge variant="secondary" className="font-mono text-xs">{comp}</Badge>
                  {j < s.sequence.length - 1 && (
                    <span className="text-muted-foreground text-xs">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{s.count}×</span>
        </li>
      ))}
    </ol>
  );
}

function SuggestPanel({ data }: { data: ComponentInsightsData }) {
  const [afterType, setAfterType] = useState<string>("");
  const [intent, setIntent] = useState<string>("__global__");
  const [rankBy, setRankBy] = useState<"frequency" | "pmi">("frequency");

  const allComponentTypes = useMemo(() => {
    const types = new Set<string>();
    for (const p of data.global.pairings) {
      types.add(p.from);
      types.add(p.to);
    }
    return Array.from(types).sort();
  }, [data]);

  const suggestions = useQuery<ComponentPairing[]>({
    queryKey: ["/api/private/component-insights/suggest", afterType, intent, rankBy],
    enabled: !!afterType,
    queryFn: async () => {
      const params = new URLSearchParams({ after: afterType, rankBy });
      if (intent && intent !== "__global__") params.set("intent", intent);
      const res = await apiFetch(`/api/private/component-insights/suggest?${params}`);
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json() as Promise<ComponentPairing[]>;
    },
  });

  const intentOptions = [
    { value: "__global__", label: "Global (all intents)" },
    ...data.meta.intents.map((id) => ({ value: id, label: id })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Component after</label>
          <Select value={afterType} onValueChange={setAfterType}>
            <SelectTrigger className="w-48" data-testid="select-after-type">
              <SelectValue placeholder="Pick a component…" />
            </SelectTrigger>
            <SelectContent>
              {allComponentTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Intent filter</label>
          <Select value={intent} onValueChange={setIntent}>
            <SelectTrigger className="w-44" data-testid="select-intent-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {intentOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Rank by</label>
          <Select value={rankBy} onValueChange={(v) => setRankBy(v as "frequency" | "pmi")}>
            <SelectTrigger className="w-36" data-testid="select-rank-by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="frequency">Frequency</SelectItem>
              <SelectItem value="pmi">PMI</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {afterType && (
        <div>
          {suggestions.isLoading && (
            <p className="text-sm text-muted-foreground">Loading suggestions…</p>
          )}
          {suggestions.data && suggestions.data.length === 0 && (
            <p className="text-sm text-muted-foreground">No suggestions found for <span className="font-mono">{afterType}</span>.</p>
          )}
          {suggestions.data && suggestions.data.length > 0 && (
            <PairingsTable pairings={suggestions.data} />
          )}
        </div>
      )}

      {!afterType && (
        <p className="text-sm text-muted-foreground">Select a component type to see what typically comes next.</p>
      )}
    </div>
  );
}

export default function ComponentInsightsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<ComponentInsightsData>({
    queryKey: ["/api/private/component-insights"],
  });

  const rebuild = useMutation({
    mutationFn: () => apiRequest("POST", "/api/private/component-insights/rebuild"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/private/component-insights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/private/component-insights/suggest"] });
    },
  });

  const allIntents = data ? ["__global__", ...data.meta.intents] : ["__global__"];
  const [activeTab, setActiveTab] = useState("__global__");

  const getCluster = (tab: string) => {
    if (!data) return null;
    if (tab === "__global__") return data.global;
    return data.byIntent[tab] ?? null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6 text-center space-y-4">
        <BarChart2 size={48} className="mx-auto text-muted-foreground" />
        <h1 className="text-2xl font-bold">Component Insights</h1>
        <p className="text-muted-foreground">
          No insights data yet. Run the first scan to analyse component co-occurrence patterns across all page YAML files.
        </p>
        <Button
          onClick={() => rebuild.mutate()}
          disabled={rebuild.isPending}
          data-testid="button-run-first-scan"
        >
          {rebuild.isPending && <RefreshCw className="animate-spin mr-2" size={16} />}
          Run first scan
        </Button>
        {rebuild.isError && (
          <p className="text-sm text-destructive">Scan failed. Check server logs.</p>
        )}
      </div>
    );
  }

  const cluster = getCluster(activeTab);

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 size={24} />
            Component Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last generated: <span className="font-mono">{new Date(data.generatedAt).toLocaleString()}</span>
          </p>
        </div>
        <Button
          onClick={() => rebuild.mutate()}
          disabled={rebuild.isPending}
          variant="outline"
          data-testid="button-rebuild"
        >
          {rebuild.isPending
            ? <><RefreshCw className="animate-spin mr-2" size={16} />Rebuilding…</>
            : <><RefreshCw className="mr-2" size={16} />Rebuild</>
          }
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pages scanned</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{data.meta.totalPagesScanned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total weight</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{data.meta.totalWeight}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Weighted pages</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{data.meta.weightedPagesCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Intent clusters</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{data.meta.intents.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="__global__" data-testid="tab-global">Global</TabsTrigger>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">All pages combined, regardless of intent.</TooltipContent>
          </Tooltip>
          {data.meta.intents.map((intentId) => {
            const intentDef = data.meta.pageIntents?.find((pi) => pi.id === intentId);
            return (
              <Tooltip key={intentId}>
                <TooltipTrigger asChild>
                  <TabsTrigger value={intentId} data-testid={`tab-${intentId}`}>
                    {intentId}
                  </TabsTrigger>
                </TooltipTrigger>
                {intentDef && (
                  <TooltipContent className="max-w-xs text-xs">{intentDef.what_for}</TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </TabsList>

        {allIntents.map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-8 mt-6">
            {cluster && (
              <>
                <section>
                  <h2 className="text-lg font-semibold mb-3">Component Pairings</h2>
                  <PairingsTable pairings={cluster.pairings} />
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-3">Top Page Sequences</h2>
                  <SequencesList sequences={cluster.topSequences} />
                </section>
              </>
            )}
            {!cluster && (
              <p className="text-muted-foreground text-sm">No data for this intent cluster.</p>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What comes after X?</CardTitle>
        </CardHeader>
        <CardContent>
          <SuggestPanel data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
