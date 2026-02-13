import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  IconStethoscope,
  IconCheck,
  IconAlertTriangle,
  IconX,
  IconSearch,
  IconRefresh,
  IconArrowLeft,
  IconWorld,
  IconPhoto,
  IconCode,
  IconFileText,
  IconLayoutGrid,
  IconPlayerPlay,
  IconLink,
  IconArrowRight,
} from "@tabler/icons-react";
import { apiRequest } from "@/lib/queryClient";

interface ValidatorIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  file?: string;
  suggestion?: string;
}

interface ValidatorResult {
  name: string;
  description: string;
  status: "passed" | "failed" | "warning";
  errors: ValidatorIssue[];
  warnings: ValidatorIssue[];
  duration: number;
  artifacts?: Record<string, unknown>;
}

interface RunResult {
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    duration: number;
  };
  validators: ValidatorResult[];
}

interface PageSummary {
  url: string;
  title: string;
  locale: string;
  contentType: string;
  slug: string;
  filePath: string;
  hasMeta: boolean;
  hasSchema: boolean;
}

interface PageDiagnostics {
  url: string;
  contentType: string;
  slug: string;
  locale: string;
  filePath: string;
  title: string;
  meta: {
    page_title: string;
    titleLength: number;
    description: string;
    descriptionLength: number;
    og_image: string;
    canonical_url: string;
    robots: string;
  };
  schema: {
    configured: boolean;
    includes: string[];
    renderedJsonLd: object[];
    htmlPreview: string;
  };
  sections: { count: number; types: string[]; hasFaq: boolean };
  images: {
    referencedIds: string[];
    missingFromRegistry: string[];
    missingFromDisk: string[];
  };
  translations: {
    hasEnglish: boolean;
    hasSpanish: boolean;
    counterpartUrl: string | null;
  };
  redirects: { incomingRedirects: string[] };
  emptyFields: string[];
  score: { total: number; seo: number; schema: number; content: number };
}

type SeverityFilter = "all" | "errors" | "warnings";
type CategoryFilter = "all" | "seo" | "integrity" | "content" | "components";

function getScoreColorClass(score: number): string {
  if (score >= 80) return "text-chart-3";
  if (score >= 50) return "text-chart-2";
  return "text-destructive";
}

function getScoreCssVar(score: number): string {
  if (score >= 80) return "var(--chart-3)";
  if (score >= 50) return "var(--chart-2)";
  return "var(--destructive)";
}

function ScoreCircle({ label, score }: { label: string; score: number }) {
  const cssVar = getScoreCssVar(score);
  const deg = (score / 100) * 360;

  return (
    <div className="flex flex-col items-center gap-2" data-testid={`score-${label.toLowerCase()}`}>
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: 72,
          height: 72,
          background: `conic-gradient(hsl(${cssVar}) ${deg}deg, hsl(${cssVar} / 0.2) ${deg}deg 360deg)`,
        }}
      >
        <div className="absolute inset-[6px] rounded-full bg-background flex items-center justify-center">
          <span className={`text-lg font-bold ${getScoreColorClass(score)}`}>{score}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: "passed" | "failed" | "warning" }) {
  if (status === "passed") {
    return (
      <Badge variant="secondary" className="gap-1" data-testid={`badge-status-${status}`}>
        <IconCheck className="h-3 w-3" />
        Passed
      </Badge>
    );
  }
  if (status === "warning") {
    return (
      <Badge variant="outline" className="gap-1" data-testid={`badge-status-${status}`}>
        <IconAlertTriangle className="h-3 w-3" />
        Warning
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1" data-testid={`badge-status-${status}`}>
      <IconX className="h-3 w-3" />
      Failed
    </Badge>
  );
}

function IssueRow({ issue }: { issue: ValidatorIssue }) {
  return (
    <div className="flex flex-wrap items-start gap-2 py-2 border-b last:border-b-0" data-testid={`issue-${issue.code}`}>
      <div className="flex-shrink-0 mt-0.5">
        {issue.type === "error" ? (
          <IconX className="h-4 w-4 text-destructive" />
        ) : (
          <IconAlertTriangle className="h-4 w-4 text-chart-2" />
        )}
      </div>
      <Badge variant="outline" className="text-xs font-mono">{issue.code}</Badge>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{issue.message}</p>
        {issue.file && (
          <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{issue.file}</p>
        )}
        {issue.suggestion && (
          <p className="text-xs text-muted-foreground mt-1 italic">{issue.suggestion}</p>
        )}
      </div>
    </div>
  );
}

function LengthBar({ value, max, optimal }: { value: number; max: number; optimal: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const isGood = value <= optimal && value > 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isGood ? "bg-chart-3" : value === 0 ? "bg-muted" : "bg-chart-2"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{value}/{max}</span>
    </div>
  );
}

function GlobalHealthTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [results, setResults] = useState<RunResult | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const { data: validators } = useQuery<{ name: string; description: string; category?: string }[]>({
    queryKey: ["/api/validation/validators"],
  });

  const runAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/validation/run", {
        includeArtifacts: true,
      });
      return (await res.json()) as RunResult;
    },
    onSuccess: (data) => {
      setResults(data);
      setLastRun(new Date());
    },
  });

  const runSingleMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/validation/run", {
        validators: [name],
        includeArtifacts: true,
      });
      return (await res.json()) as RunResult;
    },
    onSuccess: (data) => {
      if (!results) {
        setResults(data);
        setLastRun(new Date());
        return;
      }
      const updated = { ...results };
      for (const v of data.validators) {
        const idx = updated.validators.findIndex((x) => x.name === v.name);
        if (idx >= 0) {
          updated.validators[idx] = v;
        } else {
          updated.validators.push(v);
        }
      }
      const passed = updated.validators.filter((v) => v.status === "passed").length;
      const failed = updated.validators.filter((v) => v.status === "failed").length;
      const warnings = updated.validators.filter((v) => v.status === "warning").length;
      updated.summary = {
        ...updated.summary,
        total: updated.validators.length,
        passed,
        failed,
        warnings,
      };
      setResults(updated);
      setLastRun(new Date());
    },
  });

  const filteredValidators = useMemo(() => {
    if (!results) return [];
    return results.validators.filter((v) => {
      if (search && !v.name.toLowerCase().includes(search.toLowerCase()) && !v.description.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (severityFilter === "errors" && v.status !== "failed") return false;
      if (severityFilter === "warnings" && v.status !== "warning") return false;
      if (categoryFilter !== "all") {
        const cat = v.name.toLowerCase();
        if (!cat.includes(categoryFilter)) return false;
      }
      return true;
    });
  }, [results, search, severityFilter, categoryFilter]);

  const categories: { key: CategoryFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "seo", label: "SEO" },
    { key: "integrity", label: "Integrity" },
    { key: "content", label: "Content" },
    { key: "components", label: "Components" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground" data-testid="text-global-health-title">
            Content Diagnostics
          </h2>
          {lastRun && (
            <p className="text-xs text-muted-foreground mt-1" data-testid="text-last-run">
              Last run: {lastRun.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button
          onClick={() => runAllMutation.mutate()}
          disabled={runAllMutation.isPending}
          data-testid="button-run-all"
        >
          <IconRefresh className={`h-4 w-4 ${runAllMutation.isPending ? "animate-spin" : ""}`} />
          {runAllMutation.isPending ? "Running..." : "Run All"}
        </Button>
      </div>

      {results && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="summary-bar">
          <Card style={{ borderRadius: "0.8rem" }}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{results.summary.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card style={{ borderRadius: "0.8rem" }}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-chart-3">{results.summary.passed}</p>
              <p className="text-xs text-muted-foreground">Passed</p>
            </CardContent>
          </Card>
          <Card style={{ borderRadius: "0.8rem" }}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-chart-2">{results.summary.warnings}</p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </CardContent>
          </Card>
          <Card style={{ borderRadius: "0.8rem" }}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-destructive">{results.summary.failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search validators..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-validators"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", "errors", "warnings"] as SeverityFilter[]).map((s) => (
              <Button
                key={s}
                variant={severityFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => setSeverityFilter(s)}
                className="toggle-elevate"
                data-testid={`button-severity-${s}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {categories.map((c) => (
            <Button
              key={c.key}
              variant={categoryFilter === c.key ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(c.key)}
              className="toggle-elevate"
              data-testid={`button-category-${c.key}`}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      {runAllMutation.isPending && !results && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
            <p className="mt-4 text-muted-foreground">Running validators...</p>
          </div>
        </div>
      )}

      {!results && !runAllMutation.isPending && (
        <Card style={{ borderRadius: "0.8rem" }}>
          <CardContent className="p-8 text-center">
            <IconStethoscope className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Click "Run All" to start the diagnostics check
            </p>
            <Button
              onClick={() => runAllMutation.mutate()}
              data-testid="button-run-all-empty"
            >
              <IconRefresh className="h-4 w-4" />
              Run All Validators
            </Button>
          </CardContent>
        </Card>
      )}

      {results && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredValidators.map((v) => (
            <Card key={v.name} style={{ borderRadius: "0.8rem" }} data-testid={`card-validator-${v.name}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm font-semibold truncate">{v.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.description}</p>
                </div>
                <StatusBadge status={v.status} />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {v.errors.length > 0 && (
                    <span className="flex items-center gap-1">
                      <IconX className="h-3 w-3 text-destructive" />
                      {v.errors.length} error{v.errors.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {v.warnings.length > 0 && (
                    <span className="flex items-center gap-1">
                      <IconAlertTriangle className="h-3 w-3 text-chart-2" />
                      {v.warnings.length} warning{v.warnings.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  <span>{v.duration}ms</span>
                </div>

                {(v.errors.length > 0 || v.warnings.length > 0) && (
                  <Accordion type="single" collapsible>
                    <AccordionItem value="issues" className="border-0">
                      <AccordionTrigger className="py-2 text-xs" data-testid={`trigger-issues-${v.name}`}>
                        View Issues ({v.errors.length + v.warnings.length})
                      </AccordionTrigger>
                      <AccordionContent className="text-sm">
                        <ScrollArea className="max-h-64">
                          <div className="space-y-0">
                            {v.errors.map((e, i) => (
                              <IssueRow key={`e-${i}`} issue={e} />
                            ))}
                            {v.warnings.map((w, i) => (
                              <IssueRow key={`w-${i}`} issue={w} />
                            ))}
                          </div>
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}

                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runSingleMutation.mutate(v.name)}
                    disabled={runSingleMutation.isPending}
                    data-testid={`button-run-${v.name}`}
                  >
                    <IconPlayerPlay className="h-3.5 w-3.5" />
                    Run
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {results && filteredValidators.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground" data-testid="text-no-validators">No validators match your filters</p>
        </div>
      )}
    </div>
  );
}

function PageAnalysisTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: pagesData, isLoading: pagesLoading } = useQuery<{ pages: PageSummary[]; total: number }>({
    queryKey: ["/api/diagnostics/pages"],
  });

  const { data: pageDiag, isLoading: diagLoading } = useQuery<PageDiagnostics>({
    queryKey: [`/api/diagnostics/page?url=${encodeURIComponent(selectedUrl || "")}`],
    enabled: !!selectedUrl,
  });

  const groupedPages = useMemo(() => {
    if (!pagesData?.pages) return {};
    const filtered = pagesData.pages.filter(
      (p) =>
        p.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const groups: Record<string, PageSummary[]> = {};
    for (const p of filtered) {
      const key = p.contentType || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return groups;
  }, [pagesData, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Select a page to analyze</label>
        <div className="relative max-w-lg" ref={dropdownRef}>
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search pages..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              className="pl-10"
              data-testid="input-search-pages"
            />
          </div>
          {dropdownOpen && pagesData && (
            <Card
              className="absolute z-50 top-full mt-1 w-full shadow-lg"
              style={{ borderRadius: "0.8rem" }}
            >
              <ScrollArea className="max-h-72">
                <div className="p-2">
                  {Object.entries(groupedPages).map(([type, pages]) => (
                    <div key={type}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1.5">{type}</p>
                      {pages.map((page) => (
                        <button
                          key={page.url}
                          className="w-full text-left px-2 py-1.5 rounded-md text-sm hover-elevate flex items-center justify-between gap-2"
                          onClick={() => {
                            setSelectedUrl(page.url);
                            setSearchTerm(page.title || page.url);
                            setDropdownOpen(false);
                          }}
                          data-testid={`option-page-${page.url}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-foreground">{page.title || page.url}</p>
                            <p className="text-xs text-muted-foreground truncate">{page.url}</p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {page.hasMeta && <Badge variant="secondary" className="text-xs">Meta</Badge>}
                            {page.hasSchema && <Badge variant="secondary" className="text-xs">Schema</Badge>}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                  {Object.keys(groupedPages).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No pages found</p>
                  )}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>
      </div>

      {pagesLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
        </div>
      )}

      {diagLoading && selectedUrl && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
            <p className="mt-4 text-muted-foreground">Loading page diagnostics...</p>
          </div>
        </div>
      )}

      {pageDiag && !diagLoading && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground" data-testid="text-page-title">{pageDiag.title}</h3>
            <p className="text-sm text-muted-foreground font-mono">{pageDiag.url}</p>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-6" data-testid="score-dashboard">
            <ScoreCircle label="Total" score={pageDiag.score.total} />
            <ScoreCircle label="SEO" score={pageDiag.score.seo} />
            <ScoreCircle label="Schema" score={pageDiag.score.schema} />
            <ScoreCircle label="Content" score={pageDiag.score.content} />
          </div>

          {pageDiag.emptyFields.length > 0 && (
            <Card style={{ borderRadius: "0.8rem" }}>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <IconAlertTriangle className="h-4 w-4 text-chart-2" />
                <CardTitle className="text-sm">Empty Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {pageDiag.emptyFields.map((f) => (
                    <Badge key={f} variant="outline" className="text-xs font-mono">{f}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card style={{ borderRadius: "0.8rem" }} data-testid="card-meta">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <IconFileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Meta Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Page Title</span>
                  </div>
                  <p className="text-sm text-foreground mb-1 break-all">{pageDiag.meta.page_title || "Not set"}</p>
                  <LengthBar value={pageDiag.meta.titleLength} max={70} optimal={60} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Description</span>
                  </div>
                  <p className="text-sm text-foreground mb-1 break-all">{pageDiag.meta.description || "Not set"}</p>
                  <LengthBar value={pageDiag.meta.descriptionLength} max={160} optimal={155} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">OG Image</span>
                    <p className="text-sm text-foreground break-all mt-0.5">{pageDiag.meta.og_image || "Not set"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Canonical URL</span>
                    <p className="text-sm text-foreground break-all mt-0.5">{pageDiag.meta.canonical_url || "Not set"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Robots</span>
                    <p className="text-sm text-foreground mt-0.5">{pageDiag.meta.robots || "Not set"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card style={{ borderRadius: "0.8rem" }} data-testid="card-schema">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <IconCode className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Schema / JSON-LD</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Configured:</span>
                {pageDiag.schema.configured ? (
                  <Badge variant="secondary" className="gap-1">
                    <IconCheck className="h-3 w-3" /> Yes
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <IconX className="h-3 w-3" /> No
                  </Badge>
                )}
              </div>
              {pageDiag.schema.includes.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">Includes:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pageDiag.schema.includes.map((inc) => (
                      <Badge key={inc} variant="outline" className="text-xs">{inc}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {pageDiag.schema.renderedJsonLd.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">JSON-LD Preview:</span>
                  <div className="mt-1 rounded-md bg-muted p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-foreground whitespace-pre">
                      {JSON.stringify(pageDiag.schema.renderedJsonLd, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card style={{ borderRadius: "0.8rem" }} data-testid="card-sections">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <IconLayoutGrid className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-muted-foreground">Count: <strong className="text-foreground">{pageDiag.sections.count}</strong></span>
                <span className="text-muted-foreground">
                  FAQ: {pageDiag.sections.hasFaq ? (
                    <Badge variant="secondary" className="ml-1 text-xs"><IconCheck className="h-3 w-3" /></Badge>
                  ) : (
                    <Badge variant="outline" className="ml-1 text-xs"><IconX className="h-3 w-3" /></Badge>
                  )}
                </span>
              </div>
              {pageDiag.sections.types.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {pageDiag.sections.types.map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card style={{ borderRadius: "0.8rem" }} data-testid="card-images">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <IconPhoto className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pageDiag.images.referencedIds.length === 0 && (
                <p className="text-sm text-muted-foreground">No images referenced</p>
              )}
              {pageDiag.images.referencedIds.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {pageDiag.images.referencedIds.map((id) => {
                    const missingReg = pageDiag.images.missingFromRegistry.includes(id);
                    const missingDisk = pageDiag.images.missingFromDisk.includes(id);
                    const isMissing = missingReg || missingDisk;
                    return (
                      <Badge
                        key={id}
                        variant={isMissing ? "destructive" : "secondary"}
                        className="text-xs font-mono gap-1"
                        data-testid={`badge-image-${id}`}
                      >
                        {isMissing ? <IconX className="h-3 w-3" /> : <IconCheck className="h-3 w-3" />}
                        {id}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card style={{ borderRadius: "0.8rem" }} data-testid="card-translations">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <IconWorld className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">Translations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={pageDiag.translations.hasEnglish ? "secondary" : "outline"} className="gap-1">
                    {pageDiag.translations.hasEnglish ? <IconCheck className="h-3 w-3" /> : <IconX className="h-3 w-3" />}
                    EN
                  </Badge>
                  <Badge variant={pageDiag.translations.hasSpanish ? "secondary" : "outline"} className="gap-1">
                    {pageDiag.translations.hasSpanish ? <IconCheck className="h-3 w-3" /> : <IconX className="h-3 w-3" />}
                    ES
                  </Badge>
                </div>
                {pageDiag.translations.counterpartUrl && (
                  <Link href={`/private/diagnostics?url=${encodeURIComponent(pageDiag.translations.counterpartUrl)}`}>
                    <span className="text-sm text-primary flex items-center gap-1 cursor-pointer">
                      <IconArrowRight className="h-3.5 w-3.5" />
                      {pageDiag.translations.counterpartUrl}
                    </span>
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card style={{ borderRadius: "0.8rem" }} data-testid="card-redirects">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <IconLink className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">Incoming Redirects</CardTitle>
              </CardHeader>
              <CardContent>
                {pageDiag.redirects.incomingRedirects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No incoming redirects</p>
                ) : (
                  <div className="space-y-1">
                    {pageDiag.redirects.incomingRedirects.map((r) => (
                      <p key={r} className="text-sm font-mono text-foreground">{r}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!selectedUrl && !pagesLoading && (
        <Card style={{ borderRadius: "0.8rem" }}>
          <CardContent className="p-8 text-center">
            <IconSearch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a page above to view its diagnostics</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DiagnosticsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <IconArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <IconStethoscope className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground" data-testid="text-diagnostics-title">
              Diagnostics
            </h1>
          </div>
        </div>

        <Tabs defaultValue="global-health">
          <TabsList data-testid="tabs-diagnostics">
            <TabsTrigger value="global-health" data-testid="tab-global-health">Global Health</TabsTrigger>
            <TabsTrigger value="page-analysis" data-testid="tab-page-analysis">Page Analysis</TabsTrigger>
          </TabsList>
          <TabsContent value="global-health">
            <GlobalHealthTab />
          </TabsContent>
          <TabsContent value="page-analysis">
            <PageAnalysisTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
