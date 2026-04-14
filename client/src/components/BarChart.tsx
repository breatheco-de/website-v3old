
interface BarChartProps {
  years?: string[];
  displaced?: number[];
  created?: number[];
  displacedLabel?: string;
  createdLabel?: string;
  accentColor?: string;
}

const DEFAULT_YEARS     = ["2021", "2022", "2023", "2024", "2025"];
const DEFAULT_DISPLACED = [12, 15, 19, 23, 27];
const DEFAULT_CREATED   = [14, 24, 38, 54, 72];

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(100,100,100,${alpha})`;
  return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
}

export function BarChart({
  years          = DEFAULT_YEARS,
  displaced      = DEFAULT_DISPLACED,
  created        = DEFAULT_CREATED,
  displacedLabel = "Displaced",
  createdLabel   = "Created by AI",
  accentColor    = "#3b82f6",
}: BarChartProps) {
  const maxVal       = Math.max(...displaced, ...created);
  const accentFaint  = hexToRgba(accentColor, 0.35);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-1.5 h-28">
        {years.map((year, i) => (
          <div key={year} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full flex items-end gap-0.5 h-24">
              <div
                className="flex-1 rounded-t-sm transition-all"
                style={{
                  height: `${((displaced[i] ?? 0) / maxVal) * 100}%`,
                  background: accentFaint,
                }}
              />
              <div
                className="flex-1 rounded-t-sm transition-all"
                style={{
                  height: `${((created[i] ?? 0) / maxVal) * 100}%`,
                  background: accentColor,
                }}
              />
            </div>
            <span className="text-[10px] text-slate-500">{year}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ background: accentFaint }}
          />
          <span className="text-xs text-slate-400">{displacedLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ background: accentColor }}
          />
          <span className="text-xs text-slate-400">{createdLabel}</span>
        </div>
      </div>
    </div>
  );
}
