import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconTool, IconCheck, IconX } from "@tabler/icons-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface RedirectConflictInfo {
  redirectUrl: string;
  files: string[];
  code: string;
}

export interface ValidatorIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  file?: string;
  suggestion?: string;
}

function normalizeFilePath(p: string): string {
  const idx = p.indexOf("marketing-content/");
  return idx >= 0 ? p.substring(idx) : p;
}

export function parseRedirectConflict(issue: ValidatorIssue): RedirectConflictInfo | null {
  const codes = ["REDIRECT_CONFLICT", "REDIRECT_OVERLAP", "SELF_REDIRECT", "REDIRECT_OVERWRITES_CONTENT"];
  if (!codes.includes(issue.code)) return null;

  let redirectUrl = "";
  const files: string[] = [];

  if (issue.code === "REDIRECT_CONFLICT" || issue.code === "REDIRECT_OVERLAP") {
    const urlMatch = issue.message.match(/"([^"]+)"/);
    if (urlMatch) redirectUrl = urlMatch[1];
    const fileMatches = issue.message.match(/"([^"]*marketing-content\/[^"]+\.yml)"/g);
    if (fileMatches) {
      for (const m of fileMatches) {
        files.push(normalizeFilePath(m.replace(/"/g, "")));
      }
    }
    if (issue.file && !files.includes(normalizeFilePath(issue.file))) {
      files.push(normalizeFilePath(issue.file));
    }
    if (issue.code === "REDIRECT_OVERLAP" && !files.some(f => f.includes("_common.yml"))) {
      const localeFile = files.find(f => !f.includes("_common.yml"));
      if (localeFile) {
        const dir = localeFile.substring(0, localeFile.lastIndexOf("/"));
        files.unshift(`${dir}/_common.yml`);
      }
    }
  } else if (issue.code === "SELF_REDIRECT") {
    const urlMatch = issue.message.match(/"([^"]+)"/);
    if (urlMatch) redirectUrl = urlMatch[1];
    if (issue.file) files.push(normalizeFilePath(issue.file));
  } else if (issue.code === "REDIRECT_OVERWRITES_CONTENT") {
    const urlMatch = issue.message.match(/"([^"]+)"/);
    if (urlMatch) redirectUrl = urlMatch[1];
    if (issue.file) files.push(normalizeFilePath(issue.file));
  }

  if (!redirectUrl) return null;
  return { redirectUrl, files, code: issue.code };
}

function getConflictTitle(code: string): string {
  switch (code) {
    case "REDIRECT_CONFLICT": return "Redirect Conflict";
    case "REDIRECT_OVERLAP": return "Duplicate Redirect";
    case "SELF_REDIRECT": return "Self-Redirect";
    case "REDIRECT_OVERWRITES_CONTENT": return "Redirect Overwrites Content";
    default: return "Redirect Issue";
  }
}

function getConflictDescription(info: RedirectConflictInfo): string {
  switch (info.code) {
    case "REDIRECT_CONFLICT":
      return `The redirect "${info.redirectUrl}" is claimed by multiple pages. Choose which page should own this redirect — the other will have it removed.`;
    case "REDIRECT_OVERLAP":
      return `The redirect "${info.redirectUrl}" is defined in both a shared file (_common.yml) and a language-specific file. Keep it in only one place.`;
    case "SELF_REDIRECT":
      return `The redirect "${info.redirectUrl}" points to itself. This redirect should be removed.`;
    case "REDIRECT_OVERWRITES_CONTENT":
      return `The redirect "${info.redirectUrl}" conflicts with an existing page URL. This redirect should be removed to avoid hiding the page.`;
    default:
      return `There's an issue with the redirect "${info.redirectUrl}".`;
  }
}

function getConfirmationWarning(conflict: RedirectConflictInfo, selectedFile: string): string {
  const formatFile = (f: string) => f.replace("marketing-content/", "").split("/").join(" / ");

  switch (conflict.code) {
    case "REDIRECT_CONFLICT": {
      const removedFile = conflict.files.find(f => f !== selectedFile);
      return `The redirect "${conflict.redirectUrl}" will be removed from "${formatFile(removedFile || "")}" and kept only in "${formatFile(selectedFile)}". Users visiting ${conflict.redirectUrl} will be redirected based on the definition in "${formatFile(selectedFile)}".`;
    }
    case "REDIRECT_OVERLAP": {
      const removedFile = selectedFile.includes("_common.yml")
        ? conflict.files.find(f => !f.includes("_common.yml"))
        : conflict.files.find(f => f.includes("_common.yml"));
      return `The redirect "${conflict.redirectUrl}" will be removed from "${formatFile(removedFile || "")}" to eliminate the duplicate definition.`;
    }
    case "SELF_REDIRECT":
      return `The self-redirect "${conflict.redirectUrl}" will be removed from "${formatFile(selectedFile)}". This redirect was pointing to itself and causing a loop.`;
    case "REDIRECT_OVERWRITES_CONTENT":
      return `The redirect "${conflict.redirectUrl}" will be removed from "${formatFile(selectedFile)}". The page at this URL will become accessible again instead of being redirected.`;
    default:
      return `The redirect "${conflict.redirectUrl}" will be removed from "${formatFile(selectedFile)}".`;
  }
}

export function RedirectConflictResolverModal({
  open,
  onOpenChange,
  conflict,
  onResolved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflict: RedirectConflictInfo | null;
  onResolved: () => void;
}) {
  const { toast } = useToast();
  const [resolving, setResolving] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ fileToRemove: string; keepFile: string } | null>(null);

  const handleResolve = useCallback(async (fileToRemoveFrom: string) => {
    if (!conflict) return;
    setResolving(true);
    try {
      const res = await apiRequest("DELETE", "/api/debug/redirects", {
        from: conflict.redirectUrl,
        source: fileToRemoveFrom,
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Resolved", description: result.message });
        setPendingAction(null);
        onOpenChange(false);
        onResolved();
      } else {
        toast({ title: "Error", description: result.error || "Failed to resolve", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to resolve conflict", variant: "destructive" });
    } finally {
      setResolving(false);
    }
  }, [conflict, onOpenChange, onResolved, toast]);

  const handleClose = useCallback((isOpen: boolean) => {
    if (!isOpen) setPendingAction(null);
    onOpenChange(isOpen);
  }, [onOpenChange]);

  if (!conflict) return null;

  const isSimpleRemoval = conflict.code === "SELF_REDIRECT" || conflict.code === "REDIRECT_OVERWRITES_CONTENT";
  const isConflict = conflict.code === "REDIRECT_CONFLICT";
  const isOverlap = conflict.code === "REDIRECT_OVERLAP";

  const formatFileName = (f: string) => {
    const parts = f.replace("marketing-content/", "").split("/");
    return parts.join(" / ");
  };

  const commonFile = conflict.files.find(f => f.includes("_common.yml"));
  const localeFiles = conflict.files.filter(f => !f.includes("_common.yml"));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" style={{ borderRadius: "0.8rem" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconTool className="h-5 w-5" />
            {getConflictTitle(conflict.code)}
          </DialogTitle>
          <DialogDescription>
            {getConflictDescription(conflict)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground mb-1">Redirect URL</p>
            <p className="text-sm font-mono text-foreground break-all">{conflict.redirectUrl}</p>
          </div>

          {!pendingAction && (
            <>
              {isSimpleRemoval && conflict.files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {conflict.code === "SELF_REDIRECT"
                      ? "Remove this self-redirect:"
                      : "Remove this redirect so the page remains accessible:"}
                  </p>
                  <Button
                    className="w-full justify-start gap-2"
                    variant="outline"
                    onClick={() => setPendingAction({ fileToRemove: conflict.files[0], keepFile: "" })}
                    disabled={resolving}
                    data-testid="button-resolve-remove"
                  >
                    <IconX className="h-4 w-4 text-destructive flex-shrink-0" />
                    <span className="truncate text-left">Remove from {formatFileName(conflict.files[0])}</span>
                  </Button>
                </div>
              )}

              {isConflict && conflict.files.length >= 2 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Choose which file should keep this redirect:</p>
                  {conflict.files.map((file) => {
                    const otherFile = conflict.files.find(f => f !== file);
                    return (
                      <Button
                        key={file}
                        className="w-full justify-start gap-2"
                        variant="outline"
                        onClick={() => {
                          if (otherFile) setPendingAction({ fileToRemove: otherFile, keepFile: file });
                        }}
                        disabled={resolving}
                        data-testid={`button-keep-${file}`}
                      >
                        <IconCheck className="h-4 w-4 text-chart-3 flex-shrink-0" />
                        <span className="truncate text-left">Keep in {formatFileName(file)}</span>
                      </Button>
                    );
                  })}
                </div>
              )}

              {isOverlap && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Where should this redirect live?</p>
                  {commonFile && (
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => {
                        if (localeFiles.length > 0) setPendingAction({ fileToRemove: localeFiles[0], keepFile: commonFile });
                      }}
                      disabled={resolving || localeFiles.length === 0}
                      data-testid="button-keep-common"
                    >
                      <IconCheck className="h-4 w-4 text-chart-3 flex-shrink-0" />
                      <span className="truncate text-left">Keep in _common.yml (all languages)</span>
                    </Button>
                  )}
                  {localeFiles.map((file) => (
                    <Button
                      key={file}
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => {
                        if (commonFile) setPendingAction({ fileToRemove: commonFile, keepFile: file });
                      }}
                      disabled={resolving || !commonFile}
                      data-testid={`button-keep-locale-${file}`}
                    >
                      <IconCheck className="h-4 w-4 text-chart-3 flex-shrink-0" />
                      <span className="truncate text-left">Keep in {formatFileName(file)} only</span>
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}

          {pendingAction && (
            <div className="space-y-3">
              <div className="rounded-md border border-chart-5/30 bg-chart-5/10 p-3">
                <p className="text-sm text-foreground">
                  {getConfirmationWarning(conflict, pendingAction.keepFile || pendingAction.fileToRemove)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setPendingAction(null)}
                  disabled={resolving}
                  data-testid="button-back-options"
                >
                  Back
                </Button>
                <Button
                  variant="default"
                  onClick={() => handleResolve(pendingAction.fileToRemove)}
                  disabled={resolving}
                  data-testid="button-apply-resolve"
                  className="flex-1"
                >
                  {resolving ? "Applying..." : "Apply"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {!pendingAction && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => handleClose(false)} disabled={resolving} data-testid="button-cancel-resolve">
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function useRedirectConflictResolver() {
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [activeConflict, setActiveConflict] = useState<RedirectConflictInfo | null>(null);

  const openResolver = useCallback((issue: ValidatorIssue) => {
    const conflict = parseRedirectConflict(issue);
    if (conflict) {
      setActiveConflict(conflict);
      setResolveModalOpen(true);
    }
  }, []);

  return {
    resolveModalOpen,
    setResolveModalOpen,
    activeConflict,
    openResolver,
  };
}
