import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MoleculeRenderer, type MoleculeDefinition } from "@/components/MoleculeRenderer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  IconSun,
  IconMoon,
  IconDeviceFloppy,
  IconArrowBackUp,
  IconPalette,
  IconComponents,
  IconLink,
} from "@tabler/icons-react";

interface ThemeData {
  colors?: {
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
}

interface MoleculesData {
  molecules: MoleculeDefinition[];
}

interface RegistryComponent {
  type: string;
  name: string;
  versions: string[];
}

interface RegistryData {
  components: RegistryComponent[];
}

const TOKEN_GROUPS: { label: string; tokens: { id: string; label: string }[] }[] = [
  {
    label: "Brand",
    tokens: [
      { id: "--primary", label: "Primary" },
      { id: "--accent", label: "Accent" },
      { id: "--destructive", label: "Destructive" },
    ],
  },
  {
    label: "Surfaces",
    tokens: [
      { id: "--background", label: "Background" },
      { id: "--card", label: "Card" },
      { id: "--muted", label: "Muted" },
      { id: "--secondary", label: "Secondary" },
    ],
  },
  {
    label: "Foregrounds",
    tokens: [
      { id: "--foreground", label: "Foreground" },
      { id: "--muted-foreground", label: "Muted text" },
      { id: "--primary-foreground", label: "On Primary" },
      { id: "--secondary-foreground", label: "On Secondary" },
      { id: "--accent-foreground", label: "On Accent" },
      { id: "--destructive-foreground", label: "On Destructive" },
    ],
  },
  {
    label: "Borders & Ring",
    tokens: [
      { id: "--border", label: "Border" },
      { id: "--input", label: "Input border" },
      { id: "--ring", label: "Focus ring" },
    ],
  },
];

function parseHsl(value: string): [number, number, number] {
  const parts = (value || "").trim().split(/\s+/);
  const h = parseFloat(parts[0]) || 0;
  const s = parseFloat(parts[1]) || 0;
  const l = parseFloat(parts[2]) || 0;
  return [Math.round(h), Math.round(s), Math.round(l)];
}

function formatHsl(h: number, s: number, l: number): string {
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

interface ColorRowProps {
  tokenId: string;
  label: string;
  value: string;
  onChange: (token: string, value: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

function ColorRow({ tokenId, label, value, onChange, isOpen, onToggle }: ColorRowProps) {
  const [h, s, l] = parseHsl(value);
  const hex = hslToHex(h, s, l);
  const [hexInput, setHexInput] = useState(hex);

  useEffect(() => {
    setHexInput(hslToHex(...parseHsl(value)));
  }, [value]);

  const handleHexChange = (v: string) => {
    setHexInput(v);
    const parsed = hexToHsl(v);
    if (parsed) onChange(tokenId, formatHsl(...parsed));
  };

  return (
    <div className="py-3" data-testid={`color-row-${tokenId.replace(/^--/, "")}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{label}</span>
        <button
          type="button"
          className="w-6 h-6 rounded-full border border-border shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ backgroundColor: `hsl(${h} ${s}% ${l}%)` }}
          onClick={onToggle}
          aria-expanded={isOpen}
          data-testid={`swatch-${tokenId.replace(/^--/, "")}`}
        />
      </div>
      {isOpen && (
        <div className="space-y-2 mt-2">
          <input
            type="text"
            value={hexInput}
            onChange={(e) => handleHexChange(e.target.value)}
            className="w-full text-xs px-2 py-1 rounded-md border border-input bg-background font-mono"
            data-testid={`input-hex-${tokenId.replace(/^--/, "")}`}
          />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-3">H</span>
              <div
                className="flex-1 h-2 rounded-full relative"
                style={{
                  background: `linear-gradient(to right, hsl(0 ${s}% ${l}%), hsl(60 ${s}% ${l}%), hsl(120 ${s}% ${l}%), hsl(180 ${s}% ${l}%), hsl(240 ${s}% ${l}%), hsl(300 ${s}% ${l}%), hsl(360 ${s}% ${l}%))`,
                }}
              >
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={h}
                  onChange={(e) => onChange(tokenId, formatHsl(Number(e.target.value), s, l))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                  data-testid={`slider-h-${tokenId.replace(/^--/, "")}`}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                  style={{ left: `${(h / 360) * 100}%`, transform: "translateX(-50%) translateY(-50%)", backgroundColor: `hsl(${h} ${s}% ${l}%)` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-7 text-right">{h}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-3">S</span>
              <div
                className="flex-1 h-2 rounded-full relative"
                style={{ background: `linear-gradient(to right, hsl(${h} 0% ${l}%), hsl(${h} 100% ${l}%))` }}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={s}
                  onChange={(e) => onChange(tokenId, formatHsl(h, Number(e.target.value), l))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                  data-testid={`slider-s-${tokenId.replace(/^--/, "")}`}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                  style={{ left: `${s}%`, transform: "translateX(-50%) translateY(-50%)", backgroundColor: `hsl(${h} ${s}% ${l}%)` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-7 text-right">{s}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-3">L</span>
              <div
                className="flex-1 h-2 rounded-full relative"
                style={{ background: `linear-gradient(to right, hsl(${h} ${s}% 0%), hsl(${h} ${s}% 50%), hsl(${h} ${s}% 100%))` }}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={l}
                  onChange={(e) => onChange(tokenId, formatHsl(h, s, Number(e.target.value)))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                  data-testid={`slider-l-${tokenId.replace(/^--/, "")}`}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                  style={{ left: `${l}%`, transform: "translateX(-50%) translateY(-50%)", backgroundColor: `hsl(${h} ${s}% ${l}%)` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-7 text-right">{l}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ATOM_TAG_ORDER = ["button", "badge", "form", "card", "stats", "banner", "atoms"] as const;
const ATOM_TAG_LABELS: Record<string, string> = {
  button: "Buttons",
  badge: "Badges",
  form: "Form Elements",
  card: "Cards",
  stats: "Stats",
  banner: "Banners",
  atoms: "Other Atoms",
};

function getGroupTag(molecule: MoleculeDefinition): string {
  for (const tag of ATOM_TAG_ORDER) {
    if (molecule.tags.includes(tag)) return tag;
  }
  return "atoms";
}

function AtomGroups({ molecules }: { molecules: MoleculeDefinition[] }) {
  const grouped = useMemo(() => {
    const map: Record<string, MoleculeDefinition[]> = {};
    for (const m of molecules) {
      const tag = getGroupTag(m);
      if (!map[tag]) map[tag] = [];
      map[tag].push(m);
    }
    return map;
  }, [molecules]);

  return (
    <div className="space-y-8">
      {ATOM_TAG_ORDER.map((tag) => {
        const group = grouped[tag];
        if (!group || group.length === 0) return null;
        return (
          <div key={tag}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {ATOM_TAG_LABELS[tag] || tag}
            </p>
            <div className="flex flex-wrap gap-4 items-start">
              {group.map((molecule) => (
                <div
                  key={molecule.id}
                  className="flex flex-col gap-1.5"
                  data-testid={`molecule-${molecule.id}`}
                >
                  <div className="flex items-center justify-center p-4 rounded-md bg-background border border-border min-w-[120px]">
                    <MoleculeRenderer molecule={molecule} />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{molecule.variant}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ThemeEditor() {
  const { toast } = useToast();
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("light");
  const [lightColors, setLightColors] = useState<Record<string, string>>({});
  const [darkColors, setDarkColors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<"atoms" | "combinations">("atoms");
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [radiusOpen, setRadiusOpen] = useState(false);

  const { data: themeData, isLoading: themeLoading } = useQuery<ThemeData>({
    queryKey: ["/api/theme"],
  });

  const { data: moleculesData, isLoading: moleculesLoading } = useQuery<MoleculesData>({
    queryKey: ["/api/molecules"],
  });

  const { data: registryData } = useQuery<RegistryData>({
    queryKey: ["/api/component-registry"],
  });

  useEffect(() => {
    if (themeData?.colors) {
      setLightColors(themeData.colors.light || {});
      setDarkColors(themeData.colors.dark || {});
    }
  }, [themeData]);

  const activeColors = previewMode === "light" ? lightColors : darkColors;

  const handleColorChange = (token: string, value: string) => {
    if (previewMode === "light") {
      setLightColors((prev) => ({ ...prev, [token]: value }));
    } else {
      setDarkColors((prev) => ({ ...prev, [token]: value }));
    }
  };

  const previewStyle = useMemo(() => {
    const vars: Record<string, string> = {};
    const colors = previewMode === "light" ? lightColors : darkColors;
    for (const [k, v] of Object.entries(colors)) {
      if (k !== "--radius") vars[k] = v;
    }
    return vars as React.CSSProperties;
  }, [lightColors, darkColors, previewMode]);

  const radiusValue = parseFloat(activeColors["--radius"] || "0.75") || 0.75;

  const handleRadiusChange = (v: number) => {
    const val = `${v}rem`;
    if (previewMode === "light") {
      setLightColors((prev) => ({ ...prev, "--radius": val }));
    } else {
      setDarkColors((prev) => ({ ...prev, "--radius": val }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiRequest("PUT", "/api/theme/colors", { light: lightColors, dark: darkColors });
      toast({ title: "Theme saved", description: "Color changes are now live on the site." });
      queryClient.invalidateQueries({ queryKey: ["/api/theme"] });
    } catch {
      toast({ title: "Save failed", description: "Could not save theme colors.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (themeData?.colors) {
      setLightColors(themeData.colors.light || {});
      setDarkColors(themeData.colors.dark || {});
    }
  };

  const atomMolecules = useMemo(() => {
    return (moleculesData?.molecules || []).filter((m) => m.tags.includes("theme-preview"));
  }, [moleculesData]);

  const combinationComponents = useMemo(() => {
    const all = registryData?.components || [];
    const preferred = ["hero", "features_grid", "cta_banner", "trust_cards", "stats_section", "two_column"];
    const picks: RegistryComponent[] = [];
    for (const pref of preferred) {
      const found = all.find((c) => c.type === pref);
      if (found) picks.push(found);
      if (picks.length >= 3) break;
    }
    if (picks.length < 3) {
      for (const c of all) {
        if (!picks.find((p) => p.type === c.type)) picks.push(c);
        if (picks.length >= 3) break;
      }
    }
    return picks.slice(0, 3);
  }, [registryData]);

  return (
    <div className="flex h-screen bg-background overflow-hidden" data-testid="page-theme-editor">
      <div className="w-72 shrink-0 flex flex-col border-r border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <IconPalette className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-semibold">Theme Editor</h1>
          </div>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setPreviewMode("light")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${previewMode === "light" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover-elevate"}`}
              data-testid="button-mode-light"
            >
              <IconSun className="h-3.5 w-3.5" />
              Light
            </button>
            <button
              onClick={() => setPreviewMode("dark")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${previewMode === "dark" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover-elevate"}`}
              data-testid="button-mode-dark"
            >
              <IconMoon className="h-3.5 w-3.5" />
              Dark
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4">
          {themeLoading ? (
            <div className="space-y-4 py-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="py-2">
              {TOKEN_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-4 pb-1">
                    {group.label}
                  </p>
                  {group.tokens.map((token, i) => (
                    <div key={token.id}>
                      <ColorRow
                        tokenId={token.id}
                        label={token.label}
                        value={activeColors[token.id] || "0 0% 0%"}
                        onChange={handleColorChange}
                        isOpen={expandedToken === token.id}
                        onToggle={() => setExpandedToken(expandedToken === token.id ? null : token.id)}
                      />
                      {i < group.tokens.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              ))}

              <div className="py-3">
                <button
                  type="button"
                  className="flex items-center justify-between w-full pt-4 pb-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setRadiusOpen((prev) => !prev)}
                  aria-expanded={radiusOpen}
                  data-testid="button-radius-toggle"
                >
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Radius
                  </p>
                  <span className="text-xs text-muted-foreground">{radiusValue.toFixed(2)}rem</span>
                </button>
                {radiusOpen && (
                  <>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 relative h-2 rounded-full bg-muted">
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.05}
                          value={radiusValue}
                          onChange={(e) => handleRadiusChange(Number(e.target.value))}
                          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                          data-testid="slider-radius"
                        />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white bg-primary shadow-sm"
                          style={{ left: `${(radiusValue / 2) * 100}%`, transform: "translateX(-50%) translateY(-50%)" }}
                        />
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(radiusValue / 2) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right shrink-0">{radiusValue.toFixed(2)}rem</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {[0, 0.25, 0.5, 0.75, 1, 1.5, 2].map((v) => (
                        <button
                          key={v}
                          onClick={() => handleRadiusChange(v)}
                          className={`flex-1 h-6 border text-xs transition-colors hover-elevate ${Math.abs(radiusValue - v) < 0.01 ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                          style={{ borderRadius: `${v * 8}px` }}
                          data-testid={`button-radius-${v}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </ScrollArea>

        <div className="px-4 py-3 border-t border-border flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="flex-1"
            data-testid="button-reset-theme"
          >
            <IconArrowBackUp className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1"
            data-testid="button-save-theme"
          >
            <IconDeviceFloppy className="h-3.5 w-3.5" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card shrink-0">
          <button
            onClick={() => setActiveSection("atoms")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeSection === "atoms" ? "bg-muted text-foreground" : "text-muted-foreground hover-elevate"}`}
            data-testid="tab-atoms"
          >
            <IconComponents className="h-4 w-4" />
            Atoms & Molecules
          </button>
          <button
            onClick={() => setActiveSection("combinations")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeSection === "combinations" ? "bg-muted text-foreground" : "text-muted-foreground hover-elevate"}`}
            data-testid="tab-combinations"
          >
            <IconLink className="h-4 w-4" />
            Combinations
          </button>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${previewMode === "dark" ? "bg-slate-500" : "bg-amber-400"}`} />
            Previewing {previewMode} mode
          </div>
        </div>

        <ScrollArea className="flex-1">
          {activeSection === "atoms" && (
            <div
              className={`p-6 min-h-full ${previewMode === "dark" ? "dark bg-[hsl(0_0%_8%)]" : "bg-[hsl(0_0%_97%)]"}`}
              style={previewStyle}
              data-testid="preview-atoms"
            >
              {moleculesLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : atomMolecules.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No theme-preview molecules found
                </div>
              ) : (
                <AtomGroups molecules={atomMolecules} />
              )}
            </div>
          )}

          {activeSection === "combinations" && (
            <div className="p-6 space-y-8" data-testid="preview-combinations">
              {combinationComponents.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No component registry available
                </div>
              ) : (
                combinationComponents.map((comp) => {
                  const version = comp.versions?.[comp.versions.length - 1] || "v1.0";
                  const iframeSrc = `/private/component-showcase/${comp.type}/preview?debug=false&version=${version}`;
                  return (
                    <div key={comp.type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{comp.name}</p>
                        <a
                          href={`/private/component-showcase/${comp.type}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                          data-testid={`link-showcase-${comp.type}`}
                        >
                          Open in showcase
                        </a>
                      </div>
                      <div className="rounded-md border border-border overflow-hidden">
                        <iframe
                          src={iframeSrc}
                          className="w-full"
                          style={{ height: 420, border: "none" }}
                          title={`${comp.name} combination preview`}
                          data-testid={`iframe-combination-${comp.type}`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
