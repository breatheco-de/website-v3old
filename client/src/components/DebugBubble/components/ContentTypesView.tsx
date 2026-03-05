import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  IconArrowLeft,
  IconFileText,
  IconExternalLink,
  IconRefresh,
  IconDatabase,
  IconFolder,
  IconPlus,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MenuView } from "../types";

interface ContentTypeSummary {
  name: string;
  label: string;
  directory: string;
  has_database: boolean;
  database_slug: string | null;
  has_field_mapping: boolean;
  static_entry_count: number;
}

interface ContentTypesViewProps {
  setMenuView: (v: MenuView) => void;
}

interface LocaleEntry {
  code: string;
  label: string;
}

interface LocaleSettings {
  default_locale: string;
  supported_locales: LocaleEntry[];
}

function CreateContentTypeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const { data: localeSettings } = useQuery<LocaleSettings>({
    queryKey: ["/api/settings/locales"],
    staleTime: Infinity,
  });
  const defaultLocales = localeSettings?.supported_locales ?? [{ code: "en", label: "English" }, { code: "es", label: "Spanish" }];

  const [name, setName] = useState("");
  const [patternMode, setPatternMode] = useState<"non-localized" | "shorthand" | "per-locale">("shorthand");
  const [nonLocalizedPattern, setNonLocalizedPattern] = useState("");
  const [shorthandPattern, setShorthandPattern] = useState("");
  const [localePatterns, setLocalePatterns] = useState<{ locale: string; path: string }[]>(
    defaultLocales.map(l => ({ locale: l.code, path: "" }))
  );
  const [directory, setDirectory] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [nameError, setNameError] = useState("");

  const mutation = useMutation({
    mutationFn: async (body: { name: string; directory?: string; url_pattern: string | Record<string, string> }) => {
      const res = await apiRequest("POST", "/api/content-types", body);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-types"] });
      toast({ title: "Content type created", description: `"${data.name}" is ready to use.` });
      resetForm();
      onOpenChange(false);
    },
    onError: (err) => {
      toast({ title: "Failed to create content type", description: String(err), variant: "destructive" });
    },
  });

  const effectiveDir = directory || name;

  const filePreview = useMemo(() => {
    if (!name) return null;
    const dir = effectiveDir;
    const defaultLocale = localeSettings?.default_locale ?? "en";
    const localeFiles = patternMode === "non-localized"
      ? [defaultLocale]
      : defaultLocales.map(l => l.code);
    return {
      ymlEntry: `marketing-content/content-types.yml`,
      directory: `marketing-content/${dir}/`,
      sampleDir: `sample-${name}/`,
      sampleFiles: ["_common.yml", ...localeFiles.map(l => `${l}.yml`)],
    };
  }, [name, effectiveDir, defaultLocales, patternMode, localeSettings]);

  function resetForm() {
    setName("");
    setNonLocalizedPattern("");
    setShorthandPattern("");
    setLocalePatterns(defaultLocales.map(l => ({ locale: l.code, path: "" })));
    setDirectory("");
    setShowAdvanced(false);
    setShowFiles(false);
    setPatternMode("shorthand");
    setNameError("");
  }

  function validateName(v: string) {
    if (!v) {
      setNameError("");
      return;
    }
    if (!/^[a-z][a-z0-9_-]*$/.test(v)) {
      setNameError("Lowercase letters, numbers, hyphens, underscores only. Must start with a letter.");
    } else {
      setNameError("");
    }
  }

  function normalizePathInput(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed && !trimmed.startsWith("/")) return "/" + trimmed;
    return trimmed;
  }

  function updateLocalePattern(index: number, rawPath: string) {
    setLocalePatterns(prev => prev.map((lp, i) => i === index ? { ...lp, path: rawPath } : lp));
  }

  function validatePattern(p: string): string {
    if (!p) return "";
    const normalized = normalizePathInput(p);
    if (!normalized.includes(":slug")) return "Must include :slug";
    return "";
  }

  const nonLocalizedError = nonLocalizedPattern ? validatePattern(nonLocalizedPattern) : "";
  const shorthandError = shorthandPattern ? validatePattern(shorthandPattern) : "";
  const localeErrors = localePatterns.map(lp => lp.path ? validatePattern(lp.path) : "");
  const hasLocaleErrors = localeErrors.some(e => e !== "");

  const allLocalesFilled = localePatterns.length > 0 && localePatterns.every(lp => lp.path.trim() !== "");

  const canSubmit = !!name && !nameError &&
    (patternMode === "non-localized"
      ? nonLocalizedPattern.trim() !== "" && !nonLocalizedError
      : patternMode === "shorthand"
        ? shorthandPattern.trim() !== "" && !shorthandError
        : allLocalesFilled && !hasLocaleErrors);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    let url_pattern: string | Record<string, string>;
    if (patternMode === "non-localized") {
      const normalized = normalizePathInput(nonLocalizedPattern);
      url_pattern = { default: normalized };
    } else if (patternMode === "shorthand") {
      const normalized = normalizePathInput(shorthandPattern);
      url_pattern = `/:locale${normalized}`;
    } else {
      const map: Record<string, string> = {};
      for (const lp of localePatterns) {
        const normalized = normalizePathInput(lp.path);
        map[lp.locale] = `/${lp.locale}${normalized}`;
      }
      url_pattern = map;
    }

    mutation.mutate({
      name,
      directory: directory || undefined,
      url_pattern,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Create Content Type</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ct-name">Name</Label>
            <Input
              id="ct-name"
              placeholder="e.g. testimonial"
              value={name}
              onChange={(e) => { setName(e.target.value); validateName(e.target.value); }}
              data-testid="input-content-type-name"
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          <div className="space-y-2">
            <Label>URL Pattern</Label>
            <div className="flex rounded-md border overflow-visible" data-testid="segmented-url-pattern-mode">
              {([
                { value: "non-localized" as const, label: "No locale prefix" },
                { value: "shorthand" as const, label: "Use locale prefix" },
                { value: "per-locale" as const, label: "Customized" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`flex-1 text-xs py-1.5 px-1 transition-colors ${
                    patternMode === opt.value
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover-elevate"
                  } ${opt.value === "non-localized" ? "rounded-l-md" : ""} ${opt.value === "per-locale" ? "rounded-r-md" : ""}`}
                  onClick={() => setPatternMode(opt.value)}
                  data-testid={`button-pattern-mode-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {patternMode === "non-localized" && (
              <div className="space-y-1">
                <Input
                  placeholder={`/${name || "my-type"}/:slug`}
                  value={nonLocalizedPattern}
                  onChange={(e) => setNonLocalizedPattern(e.target.value)}
                  data-testid="input-url-pattern-non-localized"
                />
                {nonLocalizedError && <p className="text-xs text-destructive" data-testid="text-non-localized-error">{nonLocalizedError}</p>}
                <p className="text-xs text-muted-foreground">
                  A single URL for all locales, no language prefix.
                </p>
              </div>
            )}

            {patternMode === "shorthand" && (
              <>
                <div className="flex items-center gap-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-2 py-2 text-xs text-muted-foreground flex-shrink-0 cursor-help"
                        data-testid="tooltip-trigger-locale"
                      >
                        /:locale
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-64 text-xs" data-testid="tooltip-content-locale">
                      <p className="font-medium mb-1">:locale represents the language code</p>
                      <p>Each URL will start with the locale prefix. For example: <span className="font-mono">/en{shorthandPattern || `/${name || "type"}/:slug`}</span> for English, <span className="font-mono">/es{shorthandPattern || `/${name || "type"}/:slug`}</span> for Spanish.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    placeholder="/my-type/:slug"
                    value={shorthandPattern}
                    onChange={(e) => setShorthandPattern(e.target.value)}
                    className="rounded-l-none"
                    data-testid="input-url-pattern-shorthand"
                  />
                </div>
                {shorthandError && <p className="text-xs text-destructive" data-testid="text-shorthand-error">{shorthandError}</p>}
              </>
            )}

            {patternMode === "per-locale" && (
              <div className="space-y-2">
                {localePatterns.map((lp, i) => (
                  <div key={lp.locale} className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-2 py-2 text-xs text-muted-foreground flex-shrink-0">/{lp.locale}</span>
                      <Input
                        placeholder="/my-type/:slug"
                        value={lp.path}
                        onChange={(e) => updateLocalePattern(i, e.target.value)}
                        className="rounded-l-none"
                        data-testid={`input-url-pattern-${lp.locale}`}
                      />
                    </div>
                    {localeErrors[i] && <p className="text-xs text-destructive" data-testid={`text-pattern-error-${lp.locale}`}>{localeErrors[i]}</p>}
                  </div>
                ))}
                <Link
                  href="/private/settings"
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  data-testid="link-manage-locales"
                >
                  Manage locales
                  <IconExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover-elevate rounded px-1.5 py-1"
              onClick={() => setShowAdvanced(!showAdvanced)}
              data-testid="button-toggle-advanced"
            >
              {showAdvanced ? <IconChevronDown className="h-3 w-3" /> : <IconChevronRight className="h-3 w-3" />}
              Advanced
            </button>
            {showAdvanced && (
              <div className="mt-2 space-y-2 pl-4">
                <Label htmlFor="ct-directory">Choose a specific directory name</Label>
                <Input
                  id="ct-directory"
                  placeholder={name || "defaults to name"}
                  value={directory}
                  onChange={(e) => setDirectory(e.target.value)}
                  data-testid="input-content-type-directory"
                />
                <p className="text-xs text-muted-foreground">
                  Folder inside marketing-content/ for YAML files.
                </p>
              </div>
            )}
          </div>

          {filePreview && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setShowFiles(v => !v)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover-elevate rounded"
                data-testid="button-toggle-files-preview"
              >
                <IconChevronDown className={`h-3 w-3 transition-transform ${showFiles ? '' : '-rotate-90'}`} />
                Files that will be created
              </button>
              {showFiles && filePreview && (
                <div className="space-y-0.5 font-mono text-xs text-muted-foreground pl-4 pt-1">
                  <div>{filePreview.directory}</div>
                  <div className="pl-4">{filePreview.sampleDir}</div>
                  {filePreview.sampleFiles.map((f, i) => {
                    const isLast = i === filePreview.sampleFiles.length - 1;
                    return (
                      <div key={f} className="pl-8">{isLast ? "└── " : "├── "}{f}</div>
                    );
                  })}
                  <div className="mt-1 text-muted-foreground/70">Modified:</div>
                  <div>{filePreview.ymlEntry}</div>
                  <div className="pl-4">└── new "{name}" entry added</div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { resetForm(); onOpenChange(false); }}
              data-testid="button-cancel-create-content-type"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || mutation.isPending}
              data-testid="button-submit-create-content-type"
            >
              {mutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ContentTypesView({ setMenuView }: ContentTypesViewProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading } = useQuery<ContentTypeSummary[]>({
    queryKey: ["/api/content-types"],
  });

  return (
    <>
      <div className="px-3 py-2 border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuView("main")}
              className="p-1 rounded-md hover-elevate"
              data-testid="button-back-to-main-content-types"
            >
              <IconArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h3 className="font-semibold text-sm">Content Types</h3>
              <p className="text-xs text-muted-foreground">
                {data ? `${data.length} type${data.length !== 1 ? "s" : ""}` : "Loading..."}
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="p-1 rounded-md hover-elevate"
            data-testid="button-create-content-type"
          >
            <IconPlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto overflow-x-hidden max-h-[280px]">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No content types found
            </div>
          ) : (
            data.map((ct) => (
              <div
                key={ct.name}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm"
                data-testid={`row-content-type-${ct.name}`}
              >
                <a
                  href={`/private/type/${ct.name}`}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover-elevate rounded-md -ml-1 pl-1 py-0.5"
                  data-testid={`link-content-type-${ct.name}`}
                >
                  <IconFileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{ct.label}</div>
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                      <span className="inline-flex items-center gap-0.5">
                        <IconFolder className="h-3 w-3" />
                        {ct.directory}/ · {ct.static_entry_count} static
                      </span>
                      {ct.has_database && (
                        <span className="inline-flex items-center gap-0.5">
                          <IconDatabase className="h-3 w-3" />
                          {ct.database_slug}
                        </span>
                      )}
                    </div>
                  </div>
                  <IconExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                </a>
              </div>
            ))
          )}
        </div>
      </div>

      <CreateContentTypeDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
