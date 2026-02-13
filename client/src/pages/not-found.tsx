import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { IconAlertCircle, IconBug, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { isDebugModeActive } from "@/hooks/useDebugAuth";

interface DiagnosticIssue {
  type: "error" | "warning" | "info";
  code: string;
  message: string;
  category?: string;
  details?: {
    path?: string;
    expected?: string;
    received?: string;
  };
}

interface DiagnosticsData {
  url: string;
  contentType: string;
  slug: string;
  locale: string;
  filePath: string;
  title: string;
  schemaValidation: {
    valid: boolean;
    errors: Array<{
      path: string;
      code: string;
      message: string;
      expected?: string;
      received?: string;
    }>;
  };
  issues: DiagnosticIssue[];
  score: {
    total: number;
    seo: number;
    schema: number;
    content: number;
  };
}

function DiagnosticsPanel() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const currentPath = window.location.pathname;
    fetch(`/api/diagnostics/page?url=${encodeURIComponent(currentPath)}`)
      .then((res) => {
        if (res.status === 404) {
          setError("No content entry found for this URL in the content index.");
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mt-6 p-4 rounded-md bg-muted/50 border border-border" data-testid="debug-diagnostics-loading">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconBug className="h-4 w-4 animate-pulse" />
          <span>Running diagnostics...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mt-6 p-4 rounded-md bg-muted/50 border border-border" data-testid="debug-diagnostics-no-content">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconBug className="h-4 w-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const errors = data.issues?.filter((i) => i.type === "error") || [];
  const warnings = data.issues?.filter((i) => i.type === "warning") || [];
  const infos = data.issues?.filter((i) => i.type === "info") || [];

  return (
    <div className="mt-6 w-full" data-testid="debug-diagnostics-panel">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover-elevate rounded-md px-2 py-1 w-full"
        data-testid="button-toggle-diagnostics"
      >
        <IconBug className="h-4 w-4" />
        <span>Debug Diagnostics</span>
        {expanded ? <IconChevronDown className="h-4 w-4 ml-auto" /> : <IconChevronRight className="h-4 w-4 ml-auto" />}
        {errors.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
            {errors.length} {errors.length === 1 ? "error" : "errors"}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">
            {warnings.length} {warnings.length === 1 ? "warning" : "warnings"}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="p-3 rounded-md bg-muted/50 border border-border text-sm">
            <div className="grid grid-cols-2 gap-1 text-muted-foreground">
              <span>Content Type:</span>
              <span className="font-mono text-foreground" data-testid="text-diag-content-type">{data.contentType}</span>
              <span>Slug:</span>
              <span className="font-mono text-foreground" data-testid="text-diag-slug">{data.slug}</span>
              <span>Locale:</span>
              <span className="font-mono text-foreground" data-testid="text-diag-locale">{data.locale}</span>
              <span>File:</span>
              <span className="font-mono text-foreground text-xs break-all" data-testid="text-diag-file">{data.filePath}</span>
              <span>Schema Valid:</span>
              <span className={`font-mono ${data.schemaValidation.valid ? "text-green-600 dark:text-green-400" : "text-destructive"}`} data-testid="text-diag-schema-valid">
                {data.schemaValidation.valid ? "Yes" : "No"}
              </span>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="space-y-2" data-testid="diag-errors-section">
              <h3 className="text-sm font-medium text-destructive">Errors (page cannot render)</h3>
              {errors.map((issue, i) => (
                <div key={i} className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm" data-testid={`diag-error-${i}`}>
                  <div className="font-mono font-medium text-destructive">{issue.code}</div>
                  <div className="mt-1 text-foreground">{issue.message}</div>
                  {issue.details?.expected && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Expected: <span className="font-mono">{issue.details.expected}</span>
                      {issue.details.received && (
                        <> | Received: <span className="font-mono">{issue.details.received}</span></>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="space-y-2" data-testid="diag-warnings-section">
              <h3 className="text-sm font-medium text-amber-600 dark:text-amber-400">Warnings</h3>
              {warnings.map((issue, i) => (
                <div key={i} className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-sm" data-testid={`diag-warning-${i}`}>
                  <div className="font-mono font-medium text-amber-700 dark:text-amber-300">{issue.code}</div>
                  <div className="mt-1 text-foreground">{issue.message}</div>
                </div>
              ))}
            </div>
          )}

          {infos.length > 0 && (
            <div className="space-y-2" data-testid="diag-info-section">
              <h3 className="text-sm font-medium text-muted-foreground">Info</h3>
              {infos.map((issue, i) => (
                <div key={i} className="p-3 rounded-md bg-muted/50 border border-border text-sm" data-testid={`diag-info-${i}`}>
                  <div className="font-mono font-medium text-muted-foreground">{issue.code}</div>
                  <div className="mt-1 text-foreground">{issue.message}</div>
                </div>
              ))}
            </div>
          )}

          {errors.length === 0 && warnings.length === 0 && infos.length === 0 && (
            <div className="p-3 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground" data-testid="diag-no-issues">
              No issues found. The content loads and validates correctly.
            </div>
          )}

          <div className="p-3 rounded-md bg-muted/50 border border-border text-sm">
            <div className="text-muted-foreground mb-1">Health Score</div>
            <div className="flex items-center gap-3 flex-wrap">
              <span data-testid="text-diag-score-total">Total: <strong>{data.score.total}%</strong></span>
              <span data-testid="text-diag-score-seo">SEO: {data.score.seo}%</span>
              <span data-testid="text-diag-score-schema">Schema: {data.score.schema}%</span>
              <span data-testid="text-diag-score-content">Content: {data.score.content}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotFound() {
  const [isDebug, setIsDebug] = useState(false);

  useEffect(() => {
    setIsDebug(isDebugModeActive());
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-lg mx-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2">
              <IconAlertCircle className="h-8 w-8 text-destructive" />
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-404-title">404 Page Not Found</h1>
            </div>

            <p className="mt-4 text-sm text-muted-foreground" data-testid="text-404-description">
              The page you're looking for doesn't exist or couldn't be loaded.
            </p>
          </CardContent>
        </Card>

        {isDebug && <DiagnosticsPanel />}
      </div>
    </div>
  );
}
