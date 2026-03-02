import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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

function CreateContentTypeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [patternMode, setPatternMode] = useState<"shorthand" | "per-locale">("shorthand");
  const [shorthandPattern, setShorthandPattern] = useState("");
  const [enPattern, setEnPattern] = useState("");
  const [esPattern, setEsPattern] = useState("");
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
    return {
      ymlEntry: `marketing-content/content-types.yml`,
      directory: `marketing-content/${dir}/`,
    };
  }, [name, effectiveDir]);

  function resetForm() {
    setName("");
    setShorthandPattern("");
    setEnPattern("");
    setEsPattern("");
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || nameError) return;

    const url_pattern = patternMode === "shorthand"
      ? shorthandPattern
      : { en: enPattern, es: esPattern };

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
            <div className="flex items-center justify-between">
              <Label>URL Pattern</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover-elevate rounded px-1.5 py-0.5"
                onClick={() => setPatternMode(patternMode === "shorthand" ? "per-locale" : "shorthand")}
                data-testid="button-toggle-pattern-mode"
              >
                {patternMode === "shorthand" ? "Per-locale" : "Shorthand"}
              </button>
            </div>
            {patternMode === "shorthand" ? (
              <Input
                placeholder="/:locale/my-type/:slug"
                value={shorthandPattern}
                onChange={(e) => setShorthandPattern(e.target.value)}
                data-testid="input-url-pattern-shorthand"
              />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6 flex-shrink-0">EN</span>
                  <Input
                    placeholder="/en/my-type/:slug"
                    value={enPattern}
                    onChange={(e) => setEnPattern(e.target.value)}
                    data-testid="input-url-pattern-en"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6 flex-shrink-0">ES</span>
                  <Input
                    placeholder="/es/mi-tipo/:slug"
                    value={esPattern}
                    onChange={(e) => setEsPattern(e.target.value)}
                    data-testid="input-url-pattern-es"
                  />
                </div>
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
                <Label htmlFor="ct-directory">Directory</Label>
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
              {showFiles && (
                <div className="space-y-0.5 font-mono text-xs text-muted-foreground pl-4 pt-1">
                  <div>{filePreview.directory}</div>
                  <div className="pl-4">(empty directory for YAML entries)</div>
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
              disabled={!name || !!nameError || mutation.isPending || (patternMode === "shorthand" ? !shorthandPattern : (!enPattern || !esPattern))}
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
