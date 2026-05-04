"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type RunLogStatus = "ok" | "skipped" | "failed";

export interface RunQueueLogEntry {
  at: number;
  imageId: string;
  status: RunLogStatus;
  message: string;
}

export interface RunQueueItem {
  runId: string;
  pipelineRoot: string;
  fixerName: string;
  running: boolean;
  total: number;
  processed: number;
  ok: number;
  skipped: number;
  failed: number;
  startedAt: number;
  completedAt?: number;
  message?: string;
  log: RunQueueLogEntry[];
}

interface RunQueueSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runs: RunQueueItem[];
  onClearRuns?: () => void;
}

function getElapsed(run: RunQueueItem): string {
  const end = run.completedAt ?? Date.now();
  const ms = Math.max(0, end - run.startedAt);
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

function formatRunTimestamp(ts?: number): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

export default function RunQueueSidebar({ open, onOpenChange, runs, onClearRuns }: RunQueueSidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<Record<string, "all" | "ok" | "skipped" | "failed">>({});
  const [searchOpen, setSearchOpen] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState<Record<string, string>>({});

  const orderedRuns = useMemo(
    () => [...runs].sort((a, b) => b.startedAt - a.startedAt),
    [runs],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl overflow-y-hidden">
        <SheetHeader>
          <div className="flex items-center justify-between gap-2">
            <SheetTitle>Run Queue</SheetTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={onClearRuns}
              disabled={!onClearRuns || orderedRuns.length === 0}
              data-testid="button-clear-runs"
            >
              Clear runs
            </Button>
          </div>
          <SheetDescription>
            Progress and logs for fixer runs in this session.
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-3 h-[calc(100vh-8rem)] overflow-y-auto">
          {orderedRuns.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No fixer runs yet.
            </p>
          )}

          {orderedRuns.map((run) => {
            const isOpen = expanded[run.runId] ?? true;
            const filter = filters[run.runId] ?? "all";
            const runSearchOpen = searchOpen[run.runId] ?? false;
            const runSearchText = searchText[run.runId] ?? "";
            const searchQuery = runSearchText.trim().toLowerCase();
            const progress = run.total > 0 ? (run.processed / run.total) * 100 : 0;
            const filteredLog = run.log.filter((entry) => {
              if (filter === "all") return true;
              return entry.status === filter;
            }).filter((entry) => {
              if (!searchQuery) return true;
              return (
                entry.imageId.toLowerCase().includes(searchQuery) ||
                entry.message.toLowerCase().includes(searchQuery)
              );
            });

            return (
              <Collapsible
                key={run.runId}
                open={isOpen}
                onOpenChange={(next) => setExpanded((prev) => ({ ...prev, [run.runId]: next }))}
                className="rounded-md border p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                      <span className="text-sm font-medium">{run.fixerName}</span>
                      {run.running ? (
                        <Badge variant="outline">Running</Badge>
                      ) : (
                        <Badge variant="secondary">Done</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground pl-8">
                      Triggered by {run.pipelineRoot} • elapsed {getElapsed(run)}
                    </div>
                    <div className="text-xs text-muted-foreground pl-8">
                      Started {formatRunTimestamp(run.startedAt)}
                      {!run.running && run.completedAt ? ` • Completed ${formatRunTimestamp(run.completedAt)}` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {run.processed}/{run.total || run.processed}
                  </div>
                </div>

                <Progress value={progress} className="h-1.5" />
                <CollapsibleContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Tabs
                      className="flex-1 min-w-0"
                      value={filter}
                      onValueChange={(value) =>
                        setFilters((prev) => ({ ...prev, [run.runId]: value as "all" | "ok" | "skipped" | "failed" }))
                      }
                    >
                      <TabsList className="h-8 w-full grid grid-cols-4">
                        <TabsTrigger
                          value="all"
                          className="text-xs data-[state=active]:bg-muted"
                        >
                          All
                        </TabsTrigger>
                        <TabsTrigger
                          value="ok"
                          className="text-xs text-green-800 dark:text-green-300 border border-green-200/80 dark:border-green-800/70 data-[state=inactive]:!bg-green-50/80 dark:data-[state=inactive]:!bg-green-950/20 data-[state=active]:!bg-green-200 dark:data-[state=active]:!bg-green-900/50"
                        >
                          Success ({run.ok})
                        </TabsTrigger>
                        <TabsTrigger
                          value="skipped"
                          className="text-xs text-amber-600 dark:text-amber-400 border border-amber-300/80 dark:border-amber-700/70 data-[state=inactive]:!bg-amber-50/80 dark:data-[state=inactive]:!bg-amber-950/20 data-[state=active]:!bg-amber-100 dark:data-[state=active]:!bg-amber-900/40"
                        >
                          Skipped ({run.skipped})
                        </TabsTrigger>
                        <TabsTrigger
                          value="failed"
                          className="text-xs text-red-800 dark:text-red-300 border border-red-200/80 dark:border-red-800/70 data-[state=inactive]:!bg-red-50/80 dark:data-[state=inactive]:!bg-red-950/20 data-[state=active]:!bg-red-200 dark:data-[state=active]:!bg-red-900/50"
                        >
                          Error ({run.failed})
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() =>
                        setSearchOpen((prev) => ({ ...prev, [run.runId]: !runSearchOpen }))
                      }
                      data-testid={`button-toggle-log-search-${run.runId}`}
                    >
                      <Search className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {runSearchOpen && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          value={runSearchText}
                          onChange={(e) =>
                            setSearchText((prev) => ({ ...prev, [run.runId]: e.target.value }))
                          }
                          placeholder="Search logs..."
                          className="h-8 w-full rounded-md border bg-background pl-7 pr-8 text-xs"
                          data-testid={`input-log-search-${run.runId}`}
                        />
                        {runSearchText.length > 0 && (
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              setSearchText((prev) => ({ ...prev, [run.runId]: "" }))
                            }
                            data-testid={`button-clear-log-search-${run.runId}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <ScrollArea className="h-48 rounded-md border p-2">
                    <div className="space-y-1">
                      {filteredLog.map((entry, index) => (
                        <div key={`${entry.at}-${entry.imageId}-${index}`} className="text-xs">
                          <span className="font-mono text-muted-foreground">{entry.imageId}</span>
                          <span className="text-muted-foreground"> - </span>
                          <span
                            className={
                              entry.status === "failed"
                                ? "text-destructive"
                                : entry.status === "skipped"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-green-600 dark:text-green-400"
                            }
                          >
                            {entry.message}
                          </span>
                          {index < filteredLog.length - 1 && <div className="mt-2 border-b border-border/60" />}
                        </div>
                      ))}
                      {filteredLog.length === 0 && (
                        <p className="text-xs text-muted-foreground">No entries for this filter.</p>
                      )}
                    </div>
                  </ScrollArea>

                  {!run.running && run.message && (
                    <p className="text-xs text-muted-foreground">{run.message}</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
