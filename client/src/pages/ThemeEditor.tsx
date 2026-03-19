import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
  IconLayoutGrid,
  IconTrash,
  IconPlus,
} from "@tabler/icons-react";

interface PreviewExample {
  component: string;
  version: string;
  example: string;
}

interface ThemeData {
  colors?: {
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
  preview_examples?: PreviewExample[];
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

interface ExampleItem {
  name: string;
  yaml: string;
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
  const [activeSection, setActiveSection] = useState<"atoms" | "examples">("atoms");
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [radiusOpen, setRadiusOpen] = useState(false);

  const [confirmedExamples, setConfirmedExamples] = useState<PreviewExample[]>([]);
  const [addRow, setAddRow] = useState<{ component: string; version: string; example: string } | null>(null);
  const iframeRefs = useRef<Map<number, HTMLIFrameElement>>(new Map());
  const colorsInitialized = useRef(false);

  const { data: themeData, isLoading: themeLoading } = useQuery<ThemeData>({
    queryKey: ["/api/theme"],
  });

  const { data: moleculesData, isLoading: moleculesLoading } = useQuery<MoleculesData>({
    queryKey: ["/api/molecules"],
  });

  const { data: registryData } = useQuery<RegistryData>({
    queryKey: ["/api/component-registry"],
  });

  const addRowComponentVersions = useMemo(() => {
    if (!addRow?.component || !registryData) return [];
    const comp = registryData.components.find((c) => c.type === addRow.component);
    return comp?.versions || [];
  }, [addRow?.component, registryData]);

  const { data: addRowExamplesData } = useQuery<{ examples: ExampleItem[] }>({
    queryKey: ["/api/component-registry", addRow?.component, addRow?.version, "examples"],
    enabled: !!(addRow?.component && addRow?.version),
    queryFn: async () => {
      const res = await fetch(`/api/component-registry/${addRow!.component}/${addRow!.version}/examples`);
      if (!res.ok) throw new Error("Failed to fetch examples");
      return res.json();
    },
  });

  useEffect(() => {
    if (themeData?.colors && !colorsInitialized.current) {
      setLightColors(themeData.colors.light || {});
      setDarkColors(themeData.colors.dark || {});
      colorsInitialized.current = true;
    }
    if (themeData?.preview_examples !== undefined) {
      setConfirmedExamples(themeData.preview_examples);
    }
  }, [themeData]);

  const savePreviewExamples = useCallback(async (examples: PreviewExample[]) => {
    try {
      await apiRequest("PUT", "/api/theme/preview-examples", examples);
      queryClient.invalidateQueries({ queryKey: ["/api/theme"] });
    } catch {
      toast({ title: "Save failed", description: "Could not save preview examples.", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    const activeColors = previewMode === "light" ? lightColors : darkColors;
    iframeRefs.current.forEach((iframe) => {
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(
          { type: "theme-vars-update", vars: activeColors, mode: previewMode },
          "*"
        );
      }
    });
  }, [lightColors, darkColors, previewMode]);

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
            onClick={() => setActiveSection("examples")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeSection === "examples" ? "bg-muted text-foreground" : "text-muted-foreground hover-elevate"}`}
            data-testid="tab-examples"
          >
            <IconLayoutGrid className="h-4 w-4" />
            Examples
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

          {activeSection === "examples" && (
            <div className="p-6 space-y-6" data-testid="preview-examples">
              {confirmedExamples.map((entry, idx) => {
                const iframeSrc = `/private/component-showcase/${entry.component}/preview?debug=false&version=${encodeURIComponent(entry.version)}&example=${encodeURIComponent(entry.example)}`;
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {entry.component} &mdash; {entry.version} &mdash; {entry.example}
                      </p>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          const updated = confirmedExamples.filter((_, i) => i !== idx);
                          setConfirmedExamples(updated);
                          iframeRefs.current.delete(idx);
                          await savePreviewExamples(updated);
                        }}
                        data-testid={`button-delete-example-${idx}`}
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="rounded-md border border-border overflow-hidden">
                      <iframe
                        ref={(el) => {
                          if (el) iframeRefs.current.set(idx, el);
                          else iframeRefs.current.delete(idx);
                        }}
                        src={iframeSrc}
                        className="w-full"
                        style={{ height: 420, border: "none" }}
                        title={`${entry.component} ${entry.example} preview`}
                        data-testid={`iframe-example-${idx}`}
                        onLoad={(e) => {
                          const win = (e.currentTarget as HTMLIFrameElement).contentWindow;
                          if (win) {
                            const colors = previewMode === "light" ? lightColors : darkColors;
                            win.postMessage({ type: "theme-vars-update", vars: colors, mode: previewMode }, "*");
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              {addRow !== null && (
                <div className="rounded-md border border-border p-4 space-y-3" data-testid="add-example-row">
                  <p className="text-sm font-medium text-muted-foreground">Add example</p>
                  <div className="flex flex-wrap gap-3">
                    <select
                      className="flex-1 min-w-[140px] text-sm rounded-md border border-input bg-background px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={addRow.component}
                      onChange={(e) => setAddRow({ component: e.target.value, version: "", example: "" })}
                      data-testid="select-add-component"
                    >
                      <option value="">Component...</option>
                      {(registryData?.components || []).map((c) => (
                        <option key={c.type} value={c.type}>{c.name}</option>
                      ))}
                    </select>

                    <select
                      className="flex-1 min-w-[120px] text-sm rounded-md border border-input bg-background px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      value={addRow.version}
                      onChange={(e) => setAddRow((prev) => prev ? { ...prev, version: e.target.value, example: "" } : prev)}
                      disabled={!addRow.component}
                      data-testid="select-add-version"
                    >
                      <option value="">Version...</option>
                      {addRowComponentVersions.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>

                    <select
                      className="flex-1 min-w-[140px] text-sm rounded-md border border-input bg-background px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      value={addRow.example}
                      onChange={(e) => setAddRow((prev) => prev ? { ...prev, example: e.target.value } : prev)}
                      disabled={!addRow.component || !addRow.version}
                      data-testid="select-add-example"
                    >
                      <option value="">Example...</option>
                      {(addRowExamplesData?.examples || []).map((ex) => (
                        <option key={ex.name} value={ex.name}>{ex.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddRow(null)}
                      data-testid="button-cancel-add-example"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!addRow.component || !addRow.version || !addRow.example}
                      onClick={async () => {
                        if (!addRow.component || !addRow.version || !addRow.example) return;
                        const updated = [...confirmedExamples, { component: addRow.component, version: addRow.version, example: addRow.example }];
                        setConfirmedExamples(updated);
                        setAddRow(null);
                        await savePreviewExamples(updated);
                      }}
                      data-testid="button-confirm-add-example"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddRow({ component: "", version: "", example: "" })}
                disabled={addRow !== null}
                data-testid="button-add-example"
                className="flex items-center gap-1.5"
              >
                <IconPlus className="h-4 w-4" />
                Add example
              </Button>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
