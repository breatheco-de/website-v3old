const COLOR_MAP: Record<string, string> = {
  primary: "var(--primary)",
  "muted-foreground": "var(--muted-foreground)",
  muted: "var(--muted-foreground)",
  accent: "var(--accent)",
  destructive: "var(--destructive)",
  secondary: "var(--secondary)",
  "secondary-foreground": "var(--secondary-foreground)",
};

export function resolveColor(color?: string): string {
  if (!color) return "var(--primary)";
  if (COLOR_MAP[color]) return COLOR_MAP[color];
  if (color.startsWith("var(") || color.startsWith("hsl(")) return color;
  return "var(--primary)";
}

export function hsl(cssVar: string, opacity?: number): string {
  if (opacity !== undefined) return `hsl(${cssVar} / ${opacity})`;
  return `hsl(${cssVar})`;
}
