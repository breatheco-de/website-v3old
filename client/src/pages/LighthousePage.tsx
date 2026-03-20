import { useState, useEffect, Fragment } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IconArrowLeft,
  IconGauge,
  IconInfoCircle,
  IconChevronDown,
  IconChevronUp,
  IconPlayerPlay,
  IconLoader2,
  IconAlertTriangle,
  IconChevronRight,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LighthouseConfig {
  hasSiteBaseUrl: boolean;
  hasApiKey: boolean;
  gcsAvailable: boolean;
}

interface AuditablePage {
  slug: string;
  url: string;
  title: string;
  priority: number;
  type: string;
}

interface RunSummary {
  date: string;
  pageCount: number;
  avgPerformanceScore: number;
  worstPage: { slug: string; score: number } | null;
}

interface ReportsResponse {
  runs: RunSummary[];
  latestRun: string | null;
}

interface PageReport {
  url: string;
  slug: string;
  strategy: string;
  timestamp: string;
  performanceScore: number;
  seoScore: number;
  bestPracticesScore: number;
  metrics?: { lcp: number; fcp: number; cls: number; ttfb: number };
  opportunities: { id: string; title: string; description?: string; displayValue?: string; savings_ms?: number }[];
  diagnostics: { id: string; title: string; description: string }[];
}

const DOCS_STORAGE_KEY = "lighthouse-docs-expanded";
const SELECTED_URLS_KEY = "lighthouse-selected-urls";

function scoreBadgeVariant(score: number): "destructive" | "secondary" | "default" {
  if (score < 50) return "destructive";
  if (score < 90) return "secondary";
  return "default";
}

function lcpColor(ms: number): string {
  if (ms > 4000) return "text-destructive";
  if (ms > 2500) return "text-orange-500 dark:text-orange-400";
  return "text-green-600 dark:text-green-400";
}

function clsColor(val: number): string {
  if (val > 0.25) return "text-destructive";
  if (val > 0.1) return "text-orange-500 dark:text-orange-400";
  return "text-green-600 dark:text-green-400";
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function DocsBanner({ config, open }: { config: LighthouseConfig; open: boolean }) {
  const forceOpen = !config.hasSiteBaseUrl;
  const isOpen = forceOpen || open;

  return (
    <Collapsible open={isOpen}>
      <Card className={forceOpen ? "border-orange-400 dark:border-orange-600" : ""}>
        {forceOpen && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <IconAlertTriangle className="h-4 w-4" />
              SITE_BASE_URL is not configured — audits are disabled
            </CardTitle>
          </CardHeader>
        )}
        <CollapsibleContent>
          <CardContent className={`${forceOpen ? "" : "pt-3 "}text-sm text-muted-foreground space-y-3`}>
            <p>
              This tool runs Google PageSpeed Insights (Lighthouse) against your deployed site and saves
              reports to Google Cloud Storage under the <code className="text-xs bg-muted px-1 rounded">reports/lighthouse/</code> prefix.
            </p>
            <div>
              <p className="font-medium text-foreground mb-1">Required environment variable:</p>
              <div className="font-mono text-xs bg-muted rounded p-2 space-y-1">
                <p><span className="text-foreground">SITE_BASE_URL</span> &nbsp; Public URL of your site, e.g. https://4geeks.com</p>
              </div>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Optional environment variable:</p>
              <div className="font-mono text-xs bg-muted rounded p-2 space-y-1">
                <p><span className="text-foreground">GOOGLE_PSI_API_KEY</span> &nbsp; Free key from Google Cloud Console</p>
                <p className="text-muted-foreground pl-4">Without it: ~400 requests/day</p>
                <p className="text-muted-foreground pl-4">With it: &nbsp; 25,000 requests/day (free tier)</p>
                <p className="text-muted-foreground pl-4">Get one at console.cloud.google.com</p>
              </div>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Time estimate:</p>
              <p>Each page takes ~4 seconds to audit. 25 pages &asymp; 2 minutes. Reports are saved to GCS when done.</p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function PagePicker({
  pages,
  onRun,
  running,
}: {
  pages: AuditablePage[];
  onRun: (urls: string[]) => void;
  running: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(SELECTED_URLS_KEY);
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch { /* noop */ }
    return new Set(pages.filter((p) => p.priority >= 0.7).map((p) => p.url));
  });

  useEffect(() => {
    if (pages.length === 0) return;
    const validUrls = new Set(pages.map((p) => p.url));
    setSelected((prev) => {
      const filtered = new Set(Array.from(prev).filter((u) => validUrls.has(u)));
      if (filtered.size === 0) {
        return new Set(pages.filter((p) => p.priority >= 0.7).map((p) => p.url));
      }
      return filtered;
    });
  }, [pages]);

  function persistSelection(next: Set<string>) {
    setSelected(next);
    try {
      localStorage.setItem(SELECTED_URLS_KEY, JSON.stringify(Array.from(next)));
    } catch { /* noop */ }
  }

  function toggle(url: string) {
    const next = new Set(selected);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    persistSelection(next);
  }

  function selectAll() { persistSelection(new Set(pages.map((p) => p.url))); }
  function selectNone() { persistSelection(new Set()); }
  function selectTop(n: number) { persistSelection(new Set(pages.slice(0, n).map((p) => p.url))); }

  const count = selected.size;
  const estimatedSeconds = count * 4;
  const estimatedLabel = estimatedSeconds >= 60
    ? `~${Math.ceil(estimatedSeconds / 60)}m`
    : `~${estimatedSeconds}s`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          data-testid="button-select-pages"
        >
          {open ? <IconChevronUp className="h-3.5 w-3.5" /> : <IconChevronDown className="h-3.5 w-3.5" />}
          Select &amp; Run
        </Button>
        {open && (
          <div className="flex items-center gap-1 flex-wrap">
            <Button variant="ghost" size="sm" onClick={selectAll} data-testid="button-select-all">All</Button>
            <Button variant="ghost" size="sm" onClick={() => selectTop(10)} data-testid="button-select-top10">Top 10</Button>
            <Button variant="ghost" size="sm" onClick={() => selectTop(25)} data-testid="button-select-top25">Top 25</Button>
            <Button variant="ghost" size="sm" onClick={selectNone} data-testid="button-select-none">None</Button>
          </div>
        )}
      </div>

      {open && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Select pages to audit · {count} / {pages.length} selected ({estimatedLabel})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-72">
              <div className="p-3 space-y-1">
                {pages.map((page) => (
                  <label
                    key={page.url}
                    className="flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                    data-testid={`page-picker-row-${page.slug}`}
                  >
                    <Checkbox
                      checked={selected.has(page.url)}
                      onCheckedChange={() => toggle(page.url)}
                      data-testid={`checkbox-page-${page.slug}`}
                    />
                    <Badge variant="secondary" className="text-xs tabular-nums shrink-0">
                      {page.priority.toFixed(1)}
                    </Badge>
                    <span className="text-sm text-foreground flex-1 truncate">{page.title}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{page.url}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{page.type}</Badge>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
          <div className="p-3 border-t">
            <Button
              size="sm"
              disabled={count === 0 || running}
              onClick={() => onRun(Array.from(selected))}
              data-testid="button-run-audit"
            >
              {running ? (
                <>
                  <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                  Auditing {count} pages...
                </>
              ) : (
                <>
                  <IconPlayerPlay className="h-3.5 w-3.5" />
                  Run audit ({count} pages · {estimatedLabel})
                </>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function ResultsTable({ pages }: { pages: PageReport[] }) {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const sorted = [...pages].sort((a, b) => a.performanceScore - b.performanceScore);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="results-table">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="text-left py-2 pr-4 font-medium">Page</th>
            <th className="text-center py-2 px-2 font-medium">Perf</th>
            <th className="text-center py-2 px-2 font-medium">SEO</th>
            <th className="text-center py-2 px-2 font-medium">Best Practices</th>
            <th className="text-center py-2 px-2 font-medium">LCP</th>
            <th className="text-center py-2 px-2 font-medium">CLS</th>
            <th className="text-left py-2 pl-2 font-medium">Top Opportunity</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((page) => {
            const isExpanded = expandedSlug === page.slug;
            const topOpp = page.opportunities?.[0];
            const lcp = page.metrics?.lcp ?? 0;
            const cls = page.metrics?.cls ?? 0;

            return (
              <Fragment key={page.slug}>
                <tr
                  className="border-b border-border hover-elevate cursor-pointer"
                  onClick={() => setExpandedSlug(isExpanded ? null : page.slug)}
                  data-testid={`result-row-${page.slug}`}
                >
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <IconChevronRight
                        className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      />
                      <div>
                        <p className="font-medium text-foreground truncate max-w-[200px]">{page.slug}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{page.url}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Badge variant={scoreBadgeVariant(page.performanceScore)} data-testid={`perf-score-${page.slug}`}>
                      {page.performanceScore}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Badge variant={scoreBadgeVariant(page.seoScore)} data-testid={`seo-score-${page.slug}`}>
                      {page.seoScore}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Badge variant={scoreBadgeVariant(page.bestPracticesScore)} data-testid={`bp-score-${page.slug}`}>
                      {page.bestPracticesScore}
                    </Badge>
                  </td>
                  <td className={`py-2 px-2 text-center font-mono text-xs ${lcpColor(lcp)}`} data-testid={`lcp-${page.slug}`}>
                    {lcp ? formatMs(lcp) : "—"}
                  </td>
                  <td className={`py-2 px-2 text-center font-mono text-xs ${clsColor(cls)}`} data-testid={`cls-${page.slug}`}>
                    {cls ? cls.toFixed(3) : "—"}
                  </td>
                  <td className="py-2 pl-2">
                    {topOpp ? (
                      <div>
                        <span className="text-foreground">{topOpp.title}</span>
                        {topOpp.displayValue && (
                          <span className="text-xs text-muted-foreground ml-1">{topOpp.displayValue}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${page.slug}-expanded`}>
                    <td colSpan={7} className="pb-4 pt-1 px-8 bg-muted/30">
                      <div className="space-y-3">
                        {page.opportunities.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-foreground mb-1">Opportunities</p>
                            <div className="space-y-1">
                              {page.opportunities.map((opp) => (
                                <div key={opp.id} className="text-xs text-muted-foreground flex items-start gap-2">
                                  <span className="font-medium text-foreground shrink-0">{opp.title}</span>
                                  {opp.displayValue && <span>{opp.displayValue}</span>}
                                  {opp.savings_ms && <span className="text-orange-500 dark:text-orange-400 shrink-0">saves {formatMs(opp.savings_ms)}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {page.diagnostics.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-foreground mb-1">Diagnostics</p>
                            <div className="space-y-1">
                              {page.diagnostics.map((diag) => (
                                <div key={diag.id} className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{diag.title}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {page.opportunities.length === 0 && page.diagnostics.length === 0 && (
                          <p className="text-xs text-muted-foreground">No issues found.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function LighthousePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [docsOpen, setDocsOpen] = useState(() => {
    try {
      return localStorage.getItem(DOCS_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  function toggleDocs() {
    const next = !docsOpen;
    setDocsOpen(next);
    try {
      localStorage.setItem(DOCS_STORAGE_KEY, String(next));
    } catch { /* noop */ }
  }

  const { data: config } = useQuery<LighthouseConfig>({
    queryKey: ["/api/admin/lighthouse/config"],
  });

  const { data: pages = [], isLoading: pagesLoading } = useQuery<AuditablePage[]>({
    queryKey: ["/api/admin/lighthouse/pages"],
    enabled: config?.hasSiteBaseUrl === true,
  });

  const { data: reportsData, isLoading: reportsLoading } = useQuery<ReportsResponse>({
    queryKey: ["/api/admin/lighthouse/reports"],
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const activeDate = selectedDate ?? reportsData?.latestRun ?? null;

  const { data: reportPages, isLoading: reportPagesLoading } = useQuery<PageReport[]>({
    queryKey: ["/api/admin/lighthouse/reports", activeDate],
    enabled: !!activeDate,
  });

  const runMutation = useMutation({
    mutationFn: async (urls: string[]) => {
      const res = await apiRequest("POST", "/api/admin/lighthouse/run", { urls });
      return res.json() as Promise<{ date: string; pageCount: number; avgPerformanceScore: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lighthouse/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lighthouse/reports", data.date] });
      setSelectedDate(data.date);
      toast({ title: "Audit complete", description: "PageSpeed Insights audit finished successfully." });
    },
    onError: (err) => {
      toast({ title: "Audit failed", description: String(err), variant: "destructive" });
    },
  });

  const hasReports = (reportsData?.runs?.length ?? 0) > 0;
  const forceDocsOpen = config ? !config.hasSiteBaseUrl : false;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/private/diagnostics">
              <Button variant="ghost" size="icon" data-testid="button-back-diagnostics">
                <IconArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <IconGauge className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold text-foreground" data-testid="text-lighthouse-title">
                Page Speed
              </h1>
            </div>
            {config && !forceDocsOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDocs}
                data-testid="button-docs-toggle"
                className={docsOpen ? "toggle-elevate toggle-elevated" : "toggle-elevate"}
              >
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            )}
          </div>

          {hasReports && reportsData && (
            <div className="flex items-center gap-3 flex-wrap">
              <Select
                value={activeDate ?? ""}
                onValueChange={(v) => setSelectedDate(v)}
                data-testid="select-run-date"
              >
                <SelectTrigger className="w-40" data-testid="trigger-select-run-date">
                  <SelectValue placeholder="Select run date" />
                </SelectTrigger>
                <SelectContent>
                  {reportsData.runs.map((run) => (
                    <SelectItem key={run.date} value={run.date} data-testid={`option-run-${run.date}`}>
                      {run.date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {config && <DocsBanner config={config} open={docsOpen} />}

        {config?.hasSiteBaseUrl && (
          <>
            {pagesLoading ? (
              <Skeleton className="h-10 w-40" />
            ) : (
              <PagePicker
                pages={pages}
                onRun={(urls) => runMutation.mutate(urls)}
                running={runMutation.isPending}
              />
            )}

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm font-semibold">
                    {activeDate ? `Results — ${activeDate}` : "Results"}
                  </CardTitle>
                  {activeDate && reportsData && (() => {
                    const run = reportsData.runs.find((r) => r.date === activeDate);
                    if (!run) return null;
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" data-testid="badge-page-count">{run.pageCount} pages</Badge>
                        <Badge variant={scoreBadgeVariant(run.avgPerformanceScore)} data-testid="badge-avg-score">
                          avg {run.avgPerformanceScore}
                        </Badge>
                      </div>
                    );
                  })()}
                </div>
              </CardHeader>
              <CardContent>
                {reportsLoading || reportPagesLoading ? (
                  <div className="space-y-2" data-testid="results-skeleton">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : !hasReports && !reportPages ? (
                  <div className="text-center py-12" data-testid="empty-state">
                    <IconGauge className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">No audit reports yet.</p>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={runMutation.isPending || pagesLoading}
                      onClick={() => {
                        if (pages.length > 0) {
                          const defaultUrls = pages.filter((p) => p.priority >= 0.7).map((p) => p.url);
                          runMutation.mutate(defaultUrls.length > 0 ? defaultUrls : pages.map((p) => p.url));
                        }
                      }}
                      data-testid="button-run-first-audit"
                    >
                      {runMutation.isPending ? (
                        <IconLoader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <IconPlayerPlay className="h-4 w-4 mr-1" />
                      )}
                      Run first audit
                    </Button>
                  </div>
                ) : reportPages && reportPages.length > 0 ? (
                  <ResultsTable pages={reportPages} />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8" data-testid="no-pages-in-report">
                    No pages in this report.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
