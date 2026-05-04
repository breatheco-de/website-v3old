import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PageDiagnostics } from "../types";
import { AlertTriangle } from "lucide-react";

interface PageErrorsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageDiagnostics: PageDiagnostics | null;
}

export function PageErrorsModal(props: PageErrorsModalProps) {
  const {
    open,
    onOpenChange,
    pageDiagnostics,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Page Diagnostics
          </DialogTitle>
          <DialogDescription>
            {pageDiagnostics ? `Issues found on ${pageDiagnostics.url}` : 'Loading diagnostics...'}
          </DialogDescription>
        </DialogHeader>
        {pageDiagnostics && (
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-muted/50 border border-border text-sm">
              <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                <span>Content Type:</span>
                <span className="font-mono text-foreground" data-testid="text-modal-content-type">{pageDiagnostics.contentType}</span>
                <span>Slug:</span>
                <span className="font-mono text-foreground" data-testid="text-modal-slug">{pageDiagnostics.slug}</span>
                <span>Locale:</span>
                <span className="font-mono text-foreground" data-testid="text-modal-locale">{pageDiagnostics.locale}</span>
                <span>Schema Valid:</span>
                <span className={`font-mono ${pageDiagnostics.schemaValidation?.valid ? "text-green-600 dark:text-green-400" : "text-destructive"}`} data-testid="text-modal-schema-valid">
                  {pageDiagnostics.schemaValidation?.valid ? "Yes" : "No"}
                </span>
              </div>
            </div>

            {(() => {
              const errors = pageDiagnostics.issues?.filter(i => i.type === "error") || [];
              const warnings = pageDiagnostics.issues?.filter(i => i.type === "warning") || [];
              const infos = pageDiagnostics.issues?.filter(i => i.type === "info") || [];
              return (
                <>
                  {errors.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-destructive">Errors</h3>
                      {errors.map((issue, i) => (
                        <div key={i} className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm" data-testid={`modal-error-${i}`}>
                          <div className="font-mono font-medium text-destructive text-xs">{issue.code}</div>
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
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-amber-600 dark:text-amber-400">Warnings</h3>
                      {warnings.map((issue, i) => (
                        <div key={i} className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-sm" data-testid={`modal-warning-${i}`}>
                          <div className="font-mono font-medium text-amber-700 dark:text-amber-300 text-xs">{issue.code}</div>
                          <div className="mt-1 text-foreground">{issue.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {infos.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Info</h3>
                      {infos.map((issue, i) => (
                        <div key={i} className="p-3 rounded-md bg-muted/50 border border-border text-sm" data-testid={`modal-info-${i}`}>
                          <div className="font-mono font-medium text-muted-foreground text-xs">{issue.code}</div>
                          <div className="mt-1 text-foreground">{issue.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {errors.length === 0 && warnings.length === 0 && infos.length === 0 && (
                    <div className="p-3 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground" data-testid="modal-no-issues">
                      No issues found. The content loads and validates correctly.
                    </div>
                  )}
                </>
              );
            })()}

            <div className="p-3 rounded-md bg-muted/50 border border-border text-sm">
              <div className="text-muted-foreground mb-1">Health Score</div>
              <div className="flex items-center gap-3 flex-wrap">
                <span data-testid="text-modal-score-total">Total: <strong>{pageDiagnostics.score?.total}%</strong></span>
                <span data-testid="text-modal-score-seo">SEO: {pageDiagnostics.score?.seo}%</span>
                <span data-testid="text-modal-score-schema">Schema: {pageDiagnostics.score?.schema}%</span>
                <span data-testid="text-modal-score-content">Content: {pageDiagnostics.score?.content}%</span>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-page-errors">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
