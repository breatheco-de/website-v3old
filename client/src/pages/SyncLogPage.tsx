import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  IconArrowLeft,
  IconRefresh,
  IconSearch,
  IconFilter,
  IconServer,
  IconWebhook,
  IconCheck,
  IconX,
  IconBrandGithub,
  IconTrash,
} from "@tabler/icons-react";
import { apiRequest } from "@/lib/queryClient";

const CATEGORIES = [
  "RESTART",
  "RECONCILE",
  "WEBHOOK",
  "AUTO-PULL",
  "COMMIT",
  "CONFLICT",
  "ERROR",
] as const;

type Category = (typeof CATEGORIES)[number];

interface SyncInfo {
  instanceId: string;
  commitHash: string;
  repoUrl: string | null;
  env: string;
  pid: number;
  webhook: {
    active: boolean;
    id?: number;
    url?: string;
    createdAt?: string;
  };
  recentLog: string[];
}

interface ParsedEntry {
  raw: string;
  timestamp: string;
  timeOnly: string;
  dateOnly: string;
  category: string;
  message: string;
}

function parseLogEntry(line: string): ParsedEntry | null {
  const match = line.match(/^(\S+)\s+\[(\S+)\]\s+(.+)$/);
  if (!match) return null;
  const [, timestamp, category, message] = match;
  const timeOnly = timestamp.includes("T")
    ? timestamp.split("T")[1]?.replace("Z", "").slice(0, 8) || timestamp
    : timestamp;
  const dateOnly = timestamp.includes("T")
    ? timestamp.split("T")[0] || ""
    : "";
  return { raw: line, timestamp, timeOnly, dateOnly, category, message };
}

function getCategoryColor(cat: string): string {
  switch (cat) {
    case "RESTART":
      return "text-blue-600 dark:text-blue-400";
    case "RECONCILE":
      return "text-purple-600 dark:text-purple-400";
    case "WEBHOOK":
      return "text-cyan-600 dark:text-cyan-400";
    case "AUTO-PULL":
      return "text-green-600 dark:text-green-400";
    case "COMMIT":
      return "text-emerald-600 dark:text-emerald-400";
    case "CONFLICT":
      return "text-amber-600 dark:text-amber-400";
    case "ERROR":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-muted-foreground";
  }
}

function getCategoryBadgeVariant(cat: string): "default" | "secondary" | "destructive" | "outline" {
  switch (cat) {
    case "ERROR":
    case "CONFLICT":
      return "destructive";
    default:
      return "secondary";
  }
}

export default function SyncLogPage() {
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    new Set(CATEGORIES)
  );
  const qc = useQueryClient();

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/github/sync-log"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/github/sync-log"] });
      qc.invalidateQueries({ queryKey: ["/api/github/sync-info"] });
    },
  });

  const {
    data: logText,
    isLoading: logLoading,
    refetch: refetchLog,
  } = useQuery<string>({
    queryKey: ["/api/github/sync-log"],
    queryFn: async () => {
      const res = await fetch("/api/github/sync-log");
      return res.text();
    },
    refetchInterval: 15000,
  });

  const { data: syncInfo } = useQuery<SyncInfo>({
    queryKey: ["/api/github/sync-info"],
    refetchInterval: 30000,
  });

  const entries = useMemo(() => {
    if (!logText) return [];
    return logText
      .split("\n")
      .filter(Boolean)
      .map(parseLogEntry)
      .filter((e): e is ParsedEntry => e !== null);
  }, [logText]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (!activeCategories.has(e.category as Category)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          e.message.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.timestamp.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [entries, activeCategories, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      counts[e.category] = (counts[e.category] || 0) + 1;
    }
    return counts;
  }, [entries]);

  const toggleCategory = (cat: Category) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const selectOnly = (cat: Category) => {
    setActiveCategories(new Set([cat]));
  };

  const selectAll = () => {
    setActiveCategories(new Set(CATEGORIES));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/private/diagnostics">
            <Button variant="ghost" size="icon" data-testid="button-back-from-sync-log">
              <IconArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <IconBrandGithub className="h-5 w-5" />
            <h1 className="text-xl font-semibold" data-testid="text-sync-log-title">
              GitHub Sync Log
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {syncInfo && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground mr-2">
                <span className="flex items-center gap-1.5">
                  <IconServer className="h-3.5 w-3.5" />
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded" data-testid="text-instance-id">
                    {syncInfo.instanceId} @{" "}
                    {syncInfo.repoUrl && syncInfo.commitHash !== "?" ? (
                      <a
                        href={`${syncInfo.repoUrl}/commit/${syncInfo.commitHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                        data-testid="link-commit-hash"
                      >
                        {syncInfo.commitHash}
                      </a>
                    ) : (
                      syncInfo.commitHash
                    )}
                  </code>
                </span>
                <span className="flex items-center gap-1.5">
                  <IconWebhook className="h-3.5 w-3.5" />
                  {syncInfo.webhook.active ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400" data-testid="text-webhook-status">
                      <IconCheck className="h-3 w-3" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400" data-testid="text-webhook-status">
                      <IconX className="h-3 w-3" />
                      Inactive
                    </span>
                  )}
                </span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchLog()}
              disabled={logLoading}
              data-testid="button-refresh-sync-log"
            >
              <IconRefresh className={`h-3.5 w-3.5 mr-1.5 ${logLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              data-testid="button-clear-sync-log"
            >
              <IconTrash className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <IconFilter className="h-3.5 w-3.5" />
                <span>Filter:</span>
              </div>
              {CATEGORIES.map((cat) => (
                <Badge
                  key={cat}
                  variant={activeCategories.has(cat) ? getCategoryBadgeVariant(cat) : "outline"}
                  className={`cursor-pointer select-none ${!activeCategories.has(cat) ? "opacity-50" : ""}`}
                  onClick={() => toggleCategory(cat)}
                  onDoubleClick={() => selectOnly(cat)}
                  data-testid={`badge-filter-${cat.toLowerCase()}`}
                >
                  {cat}
                  {categoryCounts[cat] ? (
                    <span className="ml-1 opacity-70">({categoryCounts[cat]})</span>
                  ) : null}
                </Badge>
              ))}
              {activeCategories.size < CATEGORIES.length && (
                <button
                  onClick={selectAll}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                  data-testid="button-show-all-categories"
                >
                  Show all
                </button>
              )}
            </div>

            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search log entries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-sync-log"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <span className="text-sm text-muted-foreground" data-testid="text-entry-count">
                {filtered.length} of {entries.length} entries
              </span>
              <span className="text-xs text-muted-foreground">
                Auto-refreshes every 15s
              </span>
            </div>

            {logLoading && entries.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground" data-testid="text-no-entries">
                <span className="text-sm">
                  {entries.length === 0
                    ? "No sync log entries yet"
                    : "No entries match current filters"}
                </span>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="font-mono text-xs">
                  {filtered
                    .slice()
                    .reverse()
                    .map((entry, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 px-4 py-1.5 border-b border-border/50 ${
                          entry.category === "ERROR"
                            ? "bg-red-50/50 dark:bg-red-950/20"
                            : entry.category === "CONFLICT"
                              ? "bg-amber-50/50 dark:bg-amber-950/20"
                              : ""
                        }`}
                        data-testid={`log-entry-${i}`}
                      >
                        <span className="text-muted-foreground shrink-0 tabular-nums w-[68px]">
                          {entry.timeOnly}
                        </span>
                        <span className="text-muted-foreground shrink-0 tabular-nums w-[80px]">
                          {entry.dateOnly}
                        </span>
                        <span
                          className={`shrink-0 w-[90px] font-semibold ${getCategoryColor(entry.category)}`}
                        >
                          [{entry.category}]
                        </span>
                        <span className="text-foreground break-all">
                          {entry.message}
                        </span>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
