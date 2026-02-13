import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconArrowLeft, IconArrowRight, IconSearch, IconRoute, IconExternalLink, IconChevronRight, IconShieldCheck, IconTestPipe, IconAlertTriangle, IconCircleCheck, IconPlus, IconX, IconTrash } from "@tabler/icons-react";
import { Link } from "wouter";
import { isDebugModeActive } from "@/hooks/useDebugAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SitemapSearch } from "@/components/menus/SitemapSearch";
import { useToast } from "@/hooks/use-toast";
import { LocaleFlag } from "@/components/DebugBubble/components/LocaleFlag";

interface Redirect {
  from: string;
  to: string | Record<string, string>;
  type: string;
  status: number;
  source: string;
}

function formatRedirectTo(to: string | Record<string, string>): string {
  if (typeof to === "string") return to;
  return Object.values(to).join(", ");
}

function isLocaleMap(to: string | Record<string, string>): to is Record<string, string> {
  return typeof to === "object";
}

interface ValidationIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  file?: string;
  suggestion?: string;
}

interface ValidationResult {
  name: string;
  description: string;
  status: "passed" | "failed" | "warning";
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  duration: number;
}

function stripContentPath(text: string): string {
  return text.replace(/(?:\/home\/runner\/workspace\/)?marketing-content\//g, "");
}

export default function PrivateRedirects() {
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");
  const [originalTo, setOriginalTo] = useState("");
  const [allLanguages, setAllLanguages] = useState(true);
  const [isCustomDestination, setIsCustomDestination] = useState(false);
  const [redirectStatus, setRedirectStatus] = useState<number>(301);
  const [localeUrls, setLocaleUrls] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingRedirect, setDeletingRedirect] = useState<Redirect | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  useEffect(() => {
    setIsAuthorized(isDebugModeActive());
  }, []);

  const runValidation = useCallback(async () => {
    setIsValidating(true);
    try {
      const res = await apiRequest("POST", "/api/validation/run/redirects");
      const data = await res.json();
      setValidationResult(data);
      if (data.status === "failed" || data.status === "warning") {
        setShowValidation(true);
      }
    } catch {
      setValidationResult(null);
    } finally {
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      runValidation();
    }
  }, [isAuthorized, runValidation]);

  const { data: redirectsData, isLoading } = useQuery<{ redirects: Redirect[] }>({
    queryKey: ['/api/debug/redirects'],
    enabled: isAuthorized,
  });

  const redirects = redirectsData?.redirects || [];

  const filteredRedirects = redirects.filter((r) => {
    const q = search.toLowerCase();
    const toStr = formatRedirectTo(r.to).toLowerCase();
    return r.from.toLowerCase().includes(q) ||
      toStr.includes(q) ||
      r.type.toLowerCase().includes(q) ||
      String(r.status).includes(q);
  });

  const groupedByType = filteredRedirects.reduce((acc, redirect) => {
    const normalizedType = redirect.type.replace(/-common$/, "");
    if (!acc[normalizedType]) {
      acc[normalizedType] = [];
    }
    acc[normalizedType].push(redirect);
    return acc;
  }, {} as Record<string, Redirect[]>);

  const totalIssues = validationResult
    ? validationResult.errors.length + validationResult.warnings.length
    : 0;

  const isLandingDestination = newTo.startsWith("/landing");

  const stripLocalePrefix = (url: string) => url.replace(/^\/(en|es)(\/|$)/, "/");

  const fetchLocaleUrls = useCallback(async (url: string) => {
    try {
      const res = await fetch(`/api/debug/redirects/locale-urls?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        setLocaleUrls(data.urls || {});
      }
    } catch {
      setLocaleUrls({});
    }
  }, []);

  const handleOpenAddDialog = () => {
    setNewFrom("");
    setNewTo("");
    setOriginalTo("");
    setAllLanguages(true);
    setIsCustomDestination(false);
    setRedirectStatus(301);
    setLocaleUrls({});
    setShowAddDialog(true);
  };

  const handleDestinationChange = (url: string, isCustom: boolean) => {
    setOriginalTo(url);
    setIsCustomDestination(isCustom);
    if (isCustom) {
      setAllLanguages(false);
      setNewTo(url);
      setLocaleUrls({});
    } else {
      if (allLanguages && !url.startsWith("/landing")) {
        setNewTo(stripLocalePrefix(url));
      } else {
        setNewTo(url);
      }
      if (!url.startsWith("/landing")) {
        fetchLocaleUrls(url);
      }
    }
  };

  const handleSubmitRedirect = async () => {
    if (!newFrom.trim() || !newTo.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/debug/redirects", {
        from: newFrom.trim(),
        to: newTo.trim(),
        allLanguages,
        status: redirectStatus,
        isCustomDestination,
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Failed to add redirect",
          description: data.error || "An error occurred",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Redirect added",
        description: `${newFrom.trim()} → ${newTo.trim()}`,
      });

      setShowAddDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/debug/redirects'] });
      runValidation();
    } catch {
      toast({
        title: "Failed to add redirect",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRedirect = async () => {
    if (!deletingRedirect) return;

    setIsDeleting(true);
    try {
      const res = await apiRequest("DELETE", "/api/debug/redirects", {
        from: deletingRedirect.from,
        source: deletingRedirect.source,
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Failed to delete redirect",
          description: data.error || "An error occurred",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Redirect deleted",
        description: `${deletingRedirect.from} has been removed`,
      });

      setDeletingRedirect(null);
      queryClient.invalidateQueries({ queryKey: ['/api/debug/redirects'] });
      runValidation();
    } catch {
      toast({
        title: "Failed to delete redirect",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              This page requires debug mode. Add <code className="bg-muted px-1 rounded">?debug=true</code> to the URL.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button variant="outline" data-testid="link-back-home">
                <IconArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="link-back-home">
                  <IconArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <IconRoute className="w-5 h-5" />
                  URL Redirects
                </h1>
                <p className="text-sm text-muted-foreground">
                  {redirects.length} redirect{redirects.length !== 1 ? 's' : ''} configured
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {validationResult && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowValidation(!showValidation)}
                  data-testid="button-toggle-validation"
                >
                  {validationResult.status === "passed" ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Badge variant="secondary" className="gap-1 cursor-pointer bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <IconCircleCheck className="h-3.5 w-3.5" />
                          Passed
                        </Badge>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 text-sm" side="bottom" align="start">
                        <div className="space-y-2">
                          <p className="font-medium">All tests passed</p>
                          <p className="text-muted-foreground text-xs">No redirect conflicts, loops, or self-redirects were found. All redirects are properly configured and pointing to valid destinations.</p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : validationResult.status === "warning" ? (
                    <Badge variant="outline" className="gap-1">
                      <IconAlertTriangle className="h-3.5 w-3.5" />
                      {totalIssues} warning{totalIssues !== 1 ? 's' : ''}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <IconAlertTriangle className="h-3.5 w-3.5" />
                      {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={runValidation}
                disabled={isValidating}
                title="Run validation"
                data-testid="button-run-validation"
              >
                {isValidating ? (
                  <div className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                ) : (
                  <IconTestPipe className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSearch(prev => { if (prev) setSearch(""); return !prev; })}
                data-testid="button-toggle-search"
              >
                <IconSearch className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleOpenAddDialog}
                data-testid="button-add-redirect"
              >
                <IconPlus className="h-3.5 w-3.5 mr-1" />
                Add redirect
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showSearch && (
        <div className="border-b" style={{ background: "hsl(var(--muted-foreground) / 0.03)" }}>
          <div className="container mx-auto px-4 py-2">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search redirects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                autoFocus
                data-testid="input-search-redirects"
              />
            </div>
          </div>
        </div>
      )}

      {showValidation && validationResult && (
        <div className="border-b" style={{ background: "hsl(var(--muted-foreground) / 0.05)" }}>
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <IconShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Validation Results</span>
              <span className="text-xs text-muted-foreground">({validationResult.duration}ms)</span>
            </div>
            {totalIssues === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border text-sm">
                <IconCircleCheck className="h-4 w-4 flex-shrink-0" />
                All redirect checks passed. No conflicts, loops, or self-redirects found.
              </div>
            ) : (
            <div className="space-y-2">
              {validationResult.errors.map((issue, i) => (
                <div key={`err-${i}`} className="flex items-start gap-3 px-3 py-2 rounded-md border bg-destructive/5 border-destructive/20" data-testid={`validation-error-${i}`}>
                  <IconAlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="destructive" className="text-xs">{issue.code}</Badge>
                      {issue.file && <span className="text-xs text-muted-foreground truncate">{stripContentPath(issue.file)}</span>}
                    </div>
                    <p className="text-sm mt-1">{stripContentPath(issue.message)}</p>
                    {issue.suggestion && (
                      <p className="text-xs text-muted-foreground mt-1">{stripContentPath(issue.suggestion)}</p>
                    )}
                  </div>
                </div>
              ))}
              {validationResult.warnings.map((issue, i) => (
                <div key={`warn-${i}`} className="flex items-start gap-3 px-3 py-2 rounded-md border" style={{ background: "hsl(var(--muted-foreground) / 0.03)" }} data-testid={`validation-warning-${i}`}>
                  <IconAlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{issue.code}</Badge>
                      {issue.file && <span className="text-xs text-muted-foreground truncate">{stripContentPath(issue.file)}</span>}
                    </div>
                    <p className="text-sm mt-1">{stripContentPath(issue.message)}</p>
                    {issue.suggestion && (
                      <p className="text-xs text-muted-foreground mt-1">{stripContentPath(issue.suggestion)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          </div>
        ) : filteredRedirects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {search ? "No redirects match your search" : "No redirects configured"}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {Object.entries(groupedByType).map(([type, typeRedirects]) => {
              const isExpanded = expandedType === type;
              return (
                <div key={type}>
                  <button
                    onClick={() => setExpandedType(isExpanded ? null : type)}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-md text-sm hover-elevate"
                    data-testid={`button-toggle-${type}`}
                  >
                    <IconChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    <Badge variant="secondary">{type}</Badge>
                    <span className="text-muted-foreground font-normal text-sm">
                      {typeRedirects.length} redirect{typeRedirects.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-1 border rounded-lg divide-y overflow-hidden">
                      {typeRedirects.map((redirect, index) => (
                        <div
                          key={`${redirect.from}-${index}`}
                          className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                          data-testid={`redirect-row-${type}-${index}`}
                        >
                          <div className="flex-1 min-w-0">
                            <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                              {redirect.from}
                            </code>
                          </div>
                          <Badge variant={redirect.status === 301 || redirect.status === 308 ? "secondary" : "outline"} className="text-xs flex-shrink-0 font-mono">
                            {redirect.status}
                          </Badge>
                          <IconArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            {isLocaleMap(redirect.to) ? (
                              <div className="flex-1 min-w-0 space-y-1">
                                {Object.entries(redirect.to).map(([locale, url]) => (
                                  <div key={locale} className="flex items-center gap-1.5">
                                    <LocaleFlag locale={locale} />
                                    <code className="text-xs bg-muted px-2 py-0.5 rounded truncate flex-1">{url}</code>
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="p-0.5 rounded hover:bg-muted flex-shrink-0" data-testid={`link-redirect-target-${type}-${index}-${locale}`}>
                                      <IconExternalLink className="h-3 w-3 text-muted-foreground" />
                                    </a>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <>
                                <code className="text-xs bg-muted px-2 py-1 rounded block truncate flex-1">
                                  {redirect.to}
                                </code>
                                <a
                                  href={redirect.to}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded hover:bg-muted flex-shrink-0"
                                  title="Open target URL"
                                  data-testid={`link-redirect-target-${type}-${index}`}
                                >
                                  <IconExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                </a>
                              </>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingRedirect(redirect)}
                            title="Delete redirect"
                            data-testid={`button-delete-redirect-${type}-${index}`}
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent ref={dialogRef} className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Add Redirect</DialogTitle>
            <DialogDescription>
              Create a new URL redirect. The origin URL will be redirected to the destination page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Status Code</Label>
              <div className="flex border rounded-md overflow-hidden">
                {[
                  { code: 301, label: "301 — Permanent", desc: "The page has moved forever. Search engines transfer ranking to the new URL." },
                  { code: 302, label: "302 — Temporary", desc: "The page is temporarily at a different URL. Search engines keep the original URL indexed." },
                ].map((option, i) => (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => setRedirectStatus(option.code)}
                    className={`flex-1 text-left p-3 transition-colors ${
                      i > 0 ? "border-l" : ""
                    } ${
                      redirectStatus === option.code
                        ? "bg-primary/5"
                        : "hover-elevate"
                    }`}
                    data-testid={`button-status-${option.code}`}
                  >
                    <span className="text-sm font-medium">{option.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="redirect-from">Origin URL</Label>
              <Input
                id="redirect-from"
                placeholder="/old-page-url"
                value={newFrom}
                onChange={(e) => setNewFrom(e.target.value.replace(/\s+/g, "-"))}
                data-testid="input-redirect-from"
              />
              {newFrom && (
                <p className="text-xs text-muted-foreground">
                  Visitors to <code className="bg-muted px-1 rounded">{newFrom.startsWith("/") ? newFrom : `/${newFrom}`}</code> will be redirected
                </p>
              )}
            </div>

            {newFrom.trim() && (
              <div className="space-y-2">
                <Label>Destination</Label>
                {!newTo ? (
                  <div className="flex items-center">
                    <SitemapSearch
                      value={newTo}
                      onChange={handleDestinationChange}
                      placeholder="Search for a page..."
                      testId="input-redirect-to"
                      portalContainer={dialogRef.current}
                    />
                  </div>
                ) : (
                  <div className="rounded-md border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {isLandingDestination ? (
                          <>
                            <code className="text-xs bg-muted px-2 py-1 rounded block truncate">{newTo}</code>
                            <p className="text-xs text-muted-foreground">
                              Visitors to <code className="bg-muted px-1 rounded">{newFrom.startsWith("/") ? newFrom : `/${newFrom}`}</code> will land on this exact landing page.
                            </p>
                          </>
                        ) : isCustomDestination ? (
                          <>
                            <code className="text-xs bg-muted px-2 py-1 rounded block truncate">{newTo}</code>
                            <p className="text-xs text-muted-foreground">
                              Visitors to <code className="bg-muted px-1 rounded">{newFrom.startsWith("/") ? newFrom : `/${newFrom}`}</code> will be redirected to this exact URL.
                            </p>
                          </>
                        ) : allLanguages ? (
                          <>
                            <div className="space-y-1">
                              {Object.entries(localeUrls).map(([locale, url]) => (
                                <div key={locale} className="flex items-center gap-2 min-w-0">
                                  <LocaleFlag locale={locale} />
                                  <code className="text-xs bg-muted px-2 py-1 rounded truncate min-w-0">{url}</code>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Visitors to <code className="bg-muted px-1 rounded">{newFrom.startsWith("/") ? newFrom : `/${newFrom}`}</code> will be redirected to the matching language version of this content.
                            </p>
                          </>
                        ) : (
                          <>
                            <code className="text-xs bg-muted px-2 py-1 rounded block truncate">{originalTo || newTo}</code>
                            <p className="text-xs text-muted-foreground">
                              Visitors to <code className="bg-muted px-1 rounded">{newFrom.startsWith("/") ? newFrom : `/${newFrom}`}</code> will be sent to the <strong>{(originalTo || newTo).match(/^\/(en|es)/)?.[1] || "en"}</strong> version of this page only.
                            </p>
                          </>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setNewTo(""); setOriginalTo(""); setLocaleUrls({}); setIsCustomDestination(false); setAllLanguages(true); }}
                        data-testid="button-clear-destination"
                      >
                        <IconX className="h-4 w-4" />
                      </Button>
                    </div>

                    {!isLandingDestination && !isCustomDestination && (
                      <div className="flex items-center justify-between gap-4 border-t pt-3">
                        <Label htmlFor="all-languages" className="text-sm font-medium">All languages</Label>
                        <Switch
                          id="all-languages"
                          checked={allLanguages}
                          onCheckedChange={(checked) => {
                            setAllLanguages(checked);
                            if (originalTo && !originalTo.startsWith("/landing")) {
                              setNewTo(checked ? stripLocalePrefix(originalTo) : originalTo);
                            }
                          }}
                          data-testid="switch-all-languages"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              data-testid="button-cancel-redirect"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRedirect}
              disabled={!newFrom.trim() || !newTo.trim() || isSubmitting}
              data-testid="button-save-redirect"
            >
              {isSubmitting ? "Adding..." : "Add Redirect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingRedirect} onOpenChange={(open) => { if (!open) setDeletingRedirect(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Redirect</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this redirect? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingRedirect && (
            <div className="space-y-2 py-2">
              <div className="rounded-md border p-3 space-y-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">From</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block truncate">{deletingRedirect.from}</code>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">To</p>
                  {isLocaleMap(deletingRedirect.to) ? (
                    <div className="space-y-1">
                      {Object.entries(deletingRedirect.to).map(([locale, url]) => (
                        <div key={locale} className="flex items-center gap-1.5">
                          <LocaleFlag locale={locale} />
                          <code className="text-xs bg-muted px-2 py-0.5 rounded truncate">{url}</code>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <code className="text-xs bg-muted px-2 py-1 rounded block truncate">{deletingRedirect.to}</code>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingRedirect(null)}
              disabled={isDeleting}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRedirect}
              disabled={isDeleting}
              data-testid="button-confirm-delete"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
