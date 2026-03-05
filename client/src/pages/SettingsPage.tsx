import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  IconArrowLeft,
  IconLanguage,
  IconPlus,
  IconTrash,
  IconStar,
  IconStarFilled,
  IconDeviceFloppy,
  IconLoader2,
  IconScript,
  IconPlayerPlay,
  IconInfoCircle,
  IconCircleCheck,
  IconCircleX,
} from "@tabler/icons-react";

interface LocaleEntry {
  code: string;
  label: string;
}

interface LocaleSettings {
  default_locale: string;
  supported_locales: LocaleEntry[];
}

interface Migration {
  filename: string;
  name: string;
  description: string;
}

interface MigrationRowState {
  running: boolean;
  result: { success: boolean; output: string } | null;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<LocaleSettings>({
    queryKey: ["/api/settings/locales"],
  });

  const { data: migrations, isLoading: migrationsLoading } = useQuery<Migration[]>({
    queryKey: ["/api/migrations"],
  });

  const [locales, setLocales] = useState<LocaleEntry[]>([]);
  const [defaultLocale, setDefaultLocale] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [migrationStates, setMigrationStates] = useState<Record<string, MigrationRowState>>({});

  useEffect(() => {
    if (data) {
      setLocales(data.supported_locales.map((l) => ({ ...l })));
      setDefaultLocale(data.default_locale);
      setDirty(false);
    }
  }, [data]);

  function addLocale() {
    const code = newCode.trim().toLowerCase();
    const label = newLabel.trim();
    if (!code || !label) return;
    if (!/^[a-z]{2,3}$/.test(code)) {
      toast({ title: "Invalid code", description: "Locale code must be 2-3 lowercase letters", variant: "destructive" });
      return;
    }
    if (locales.some((l) => l.code === code)) {
      toast({ title: "Duplicate", description: `Locale "${code}" already exists`, variant: "destructive" });
      return;
    }
    setLocales((prev) => [...prev, { code, label }]);
    setNewCode("");
    setNewLabel("");
    setDirty(true);
  }

  function removeLocale(code: string) {
    if (locales.length <= 1) return;
    if (code === defaultLocale) {
      toast({ title: "Cannot remove", description: "Set a different default locale first", variant: "destructive" });
      return;
    }
    setLocales((prev) => prev.filter((l) => l.code !== code));
    setDirty(true);
  }

  function setAsDefault(code: string) {
    setDefaultLocale(code);
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/settings/locales", {
        default_locale: defaultLocale,
        supported_locales: locales,
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/locales"] });
      setDirty(false);
      toast({ title: "Settings saved", description: `${locales.length} locale(s) configured` });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message || String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function runMigration(filename: string) {
    setMigrationStates((prev) => ({
      ...prev,
      [filename]: { running: true, result: null },
    }));
    try {
      const res = await apiRequest("POST", "/api/migrations/run", { filename });
      const result = await res.json();
      setMigrationStates((prev) => ({
        ...prev,
        [filename]: { running: false, result },
      }));
    } catch (err: any) {
      setMigrationStates((prev) => ({
        ...prev,
        [filename]: { running: false, result: { success: false, output: err.message || String(err) } },
      }));
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/private/diagnostics">
            <Button variant="ghost" size="icon" data-testid="button-back-settings">
              <IconArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-settings-title">Settings</h1>
            <p className="text-sm text-muted-foreground">Site-wide configuration</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <div className="flex items-center gap-2">
              <IconLanguage className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Internationalization</CardTitle>
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || saving}
              data-testid="button-save-locales"
            >
              {saving ? (
                <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <IconDeviceFloppy className="h-4 w-4 mr-1.5" />
              )}
              Save
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Supported Locales</p>
                  <p className="text-xs text-muted-foreground">
                    Locales available for content and URL patterns. The default locale is used as fallback.
                  </p>
                </div>

                <div className="space-y-2">
                  {locales.map((locale) => (
                    <div
                      key={locale.code}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md border"
                      data-testid={`row-locale-${locale.code}`}
                    >
                      <code className="text-sm font-mono font-medium w-8">{locale.code}</code>
                      <span className="text-sm flex-1">{locale.label}</span>
                      {locale.code === defaultLocale ? (
                        <Badge variant="secondary" className="gap-1" data-testid={`badge-default-${locale.code}`}>
                          <IconStarFilled className="h-3 w-3" />
                          Default
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setAsDefault(locale.code)}
                          title="Set as default"
                          data-testid={`button-set-default-${locale.code}`}
                        >
                          <IconStar className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLocale(locale.code)}
                        disabled={locales.length <= 1 || locale.code === defaultLocale}
                        title="Remove locale"
                        data-testid={`button-remove-locale-${locale.code}`}
                      >
                        <IconTrash className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex items-end gap-2 pt-2 border-t">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Code</label>
                    <Input
                      placeholder="pt"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 3))}
                      className="w-20"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLocale(); } }}
                      data-testid="input-new-locale-code"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Label</label>
                    <Input
                      placeholder="Portuguese"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLocale(); } }}
                      data-testid="input-new-locale-label"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={addLocale}
                    disabled={!newCode.trim() || !newLabel.trim()}
                    data-testid="button-add-locale"
                  >
                    <IconPlus className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            <IconScript className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Migrations</CardTitle>
          </CardHeader>
          <CardContent>
            {migrationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !migrations || migrations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No migration scripts found.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  One-time data scripts. Each migration is idempotent — safe to re-run.
                </p>
                <div className="space-y-2">
                  {migrations.map((migration) => {
                    const state = migrationStates[migration.filename];
                    const running = state?.running ?? false;
                    const result = state?.result ?? null;
                    return (
                      <div key={migration.filename} className="space-y-2" data-testid={`row-migration-${migration.filename}`}>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border">
                          <code className="text-xs font-mono text-muted-foreground flex-1 truncate" data-testid={`text-migration-name-${migration.filename}`}>
                            {migration.filename}
                          </code>
                          {result && (
                            result.success
                              ? <IconCircleCheck className="h-4 w-4 text-green-500 shrink-0" />
                              : <IconCircleX className="h-4 w-4 text-destructive shrink-0" />
                          )}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="About this migration"
                                data-testid={`button-info-migration-${migration.filename}`}
                              >
                                <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 text-sm" side="left" align="start">
                              <p className="font-medium mb-1">{migration.name}</p>
                              <p className="text-muted-foreground text-xs leading-relaxed">{migration.description}</p>
                            </PopoverContent>
                          </Popover>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => runMigration(migration.filename)}
                            disabled={running}
                            title="Run migration"
                            data-testid={`button-run-migration-${migration.filename}`}
                          >
                            {running
                              ? <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              : <IconPlayerPlay className="h-4 w-4 text-muted-foreground" />
                            }
                          </Button>
                        </div>
                        {result && (
                          <pre
                            className={`text-xs font-mono rounded-md border px-3 py-2 overflow-auto max-h-48 whitespace-pre-wrap ${
                              result.success
                                ? "border-green-500/30 bg-green-500/5 text-foreground"
                                : "border-destructive/30 bg-destructive/5 text-destructive"
                            }`}
                            data-testid={`text-migration-output-${migration.filename}`}
                          >
                            {result.output || (result.success ? "Done." : "Failed with no output.")}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
