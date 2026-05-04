import { useCallback, useState, useEffect, useMemo } from "react";
import { Loader2, Palette } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ThemeColor {
  id: string;
  label: string;
  cssVar?: string;
  value?: string;
}

interface ThemeConfig {
  backgrounds: ThemeColor[];
  accents?: ThemeColor[];
  text?: ThemeColor[];
  courses?: ThemeColor[]
}

export type ColorPickerType = "background" | "accent" | "text" | "courses";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  type?: ColorPickerType;
  label?: string;
  allowCustom?: boolean;
  allowNone?: boolean;
  testIdPrefix?: string;
}

export function ColorPicker({
  value,
  onChange,
  type = "background",
  label,
  allowCustom = true,
  allowNone = true,
  testIdPrefix = "color-picker",
}: ColorPickerProps) {
  const { data: theme, isLoading } = useQuery<ThemeConfig>({
    queryKey: ["/api/theme"],
  });

  const colors = useMemo(() => {
    if (!theme) return [];
    
    let themeColors: ThemeColor[] = [];
    switch (type) {
      case "background":
        themeColors = theme.backgrounds || [];
        break;
      case "accent":
        themeColors = theme.accents || [];
        break;
      case "text":
        themeColors = theme.text || [];
        break;
      case "courses":
        themeColors = theme.courses || [];
        break;
    }
    
    return themeColors.map((color) => {
      const cssValue = color.cssVar ? `hsl(var(${color.cssVar}))` : color.value || "";
      return {
        id: color.id,
        label: color.label,
        cssValue,
        previewStyle: cssValue,
      };
    });
  }, [theme, type]);

  const isSelected = useCallback(
    (color: { id: string; cssValue: string }) => {
      return value === color.cssValue || value === color.id;
    },
    [value],
  );

  const isCustom =
    value &&
    colors.length > 0 &&
    !colors.some((color) => isSelected(color));
  const [customValue, setCustomValue] = useState(isCustom ? value : "");
  const [showCustomInput, setShowCustomInput] = useState(false);

  useEffect(() => {
    const isNowCustom =
      value &&
      colors.length > 0 &&
      !colors.some((color) => isSelected(color));
    if (isNowCustom) {
      setCustomValue(value);
      setShowCustomInput(true);
    } else {
      setCustomValue("");
    }
  }, [value, colors, isSelected]);

  const defaultLabel = useMemo(() => {
    switch (type) {
      case "background":
        return "Background Color";
      case "accent":
        return "Accent Color";
      case "text":
        return "Text Color";
      default:
        return "Color";
    }
  }, [type]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">{label || defaultLabel}</Label>
        <div className="flex items-center justify-center h-24 bg-muted/30 rounded-md">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label || defaultLabel}</Label>
      <div className="flex flex-wrap gap-1.5">
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange("")}
            className={`w-7 h-7 rounded border-2 transition-all ${
              value === ""
                ? "border-primary ring-2 ring-primary/20"
                : "border-border hover:border-primary/50"
            }`}
            data-testid={`${testIdPrefix}-none`}
            title="None"
            style={{
              background:
                "repeating-conic-gradient(hsl(var(--muted)) 0% 25%, transparent 0% 50%) 50% / 8px 8px",
            }}
          />
        )}
        {colors.map((color) => (
          <button
            key={color.id}
            type="button"
            onClick={() => {
              onChange(color.cssValue);
              setShowCustomInput(false);
            }}
            className={`w-7 h-7 rounded border-2 transition-all ${
              isSelected(color)
                ? "border-primary ring-2 ring-primary/20"
                : "border-border hover:border-primary/50"
            }`}
            data-testid={`${testIdPrefix}-${color.id}`}
            title={color.label}
            style={{ background: color.previewStyle }}
          />
        ))}
        {allowCustom && (
          <button
            type="button"
            onClick={() => setShowCustomInput(!showCustomInput)}
            className={`w-7 h-7 rounded border-2 transition-all flex items-center justify-center ${
              isCustom || showCustomInput
                ? "border-primary ring-2 ring-primary/20 bg-primary/10"
                : "border-border hover:border-primary/50 bg-muted"
            }`}
            data-testid={`${testIdPrefix}-custom-toggle`}
            title="Custom CSS value"
          >
            <Palette className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
      {showCustomInput && allowCustom && (
        <Input
          type="text"
          placeholder="e.g., #ff5500, linear-gradient(...)"
          value={customValue}
          onChange={(e) => {
            setCustomValue(e.target.value);
            if (e.target.value) {
              onChange(e.target.value);
            }
          }}
          className="text-sm"
          data-testid={`${testIdPrefix}-custom`}
          autoFocus
        />
      )}
    </div>
  );
}
