
import { resolveColorVar, hslColor, hslColorRaw } from "@/components/course_selector/shared";

interface CircleGaugeProps {
  percentage?: number;
  gaugeLabel?: string;
  gaugeSubLabel?: string;
  bar1Label?: string;
  bar2Label?: string;
  accentColor?: string;
  variant?: "full" | "circle-only" | "bars-only";
}

const GAUGE_SIZE   = 88;
const STROKE_WIDTH = 3.6;

export function CircleGauge({
  percentage    = 3,
  gaugeLabel    = "qualified",
  gaugeSubLabel = "not ready for AI roles today",
  bar1Label     = "Traditional workforce",
  bar2Label     = "AI-ready professionals",
  accentColor   = "hsl(var(--color-orange))",
  variant       = "full",
}: CircleGaugeProps) {
  const pct     = Math.min(100, Math.max(0, percentage));
  const inverse = 100 - pct;

  const resolved    = resolveColorVar(accentColor);
  const accentCss   = hslColorRaw(resolved);
  const trackColor  = hslColor(resolved, 0.3);
  const barFaint    = hslColor(resolved, 0.3);
  const bar1Track   = hslColor(resolved, 0.1);
  const bar2Track   = hslColor(resolved, 0.2);

  const circleEl = (
    <div className="relative shrink-0" style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}>
      <svg
        viewBox="0 0 36 36"
        width={GAUGE_SIZE}
        height={GAUGE_SIZE}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx="18" cy="18" r="15.9"
          fill="none"
          style={{ stroke: trackColor, strokeWidth: STROKE_WIDTH }}
        />
        <circle
          cx="18" cy="18" r="15.9"
          fill="none"
          style={{ stroke: accentCss, strokeWidth: STROKE_WIDTH }}
          strokeDasharray={`${pct} ${100 - pct}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black leading-none" style={{ color: accentCss }}>
          {pct}%
        </span>
        <span className="text-[9px] text-slate-500 mt-0.5 leading-none text-center px-1">
          {gaugeLabel}
        </span>
      </div>
    </div>
  );

  const barsEl = (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">{bar1Label}</span>
          <span className="text-slate-500">{inverse}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: bar1Track }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${inverse}%`, background: barFaint }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">{bar2Label}</span>
          <span style={{ color: accentCss }}>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: bar2Track }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: accentCss }}
          />
        </div>
      </div>
    </div>
  );

  if (variant === "circle-only") return circleEl;
  if (variant === "bars-only")   return barsEl;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {circleEl}
        <div>
          <div className="text-4xl font-black tracking-tight leading-none" style={{ color: accentCss }}>
            {inverse}%
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 leading-snug">
            {gaugeSubLabel}
          </p>
        </div>
      </div>
      {barsEl}
    </div>
  );
}
