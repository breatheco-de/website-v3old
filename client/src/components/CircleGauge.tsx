
import { resolveColorVar, hslColor, hslColorRaw } from "@/components/course_selector/shared";

interface CircleGaugeProps {
  /** Value shown inside the circle and fills the arc. Optional — circle hidden when absent. */
  gaugePercentage?: number;
  /** Short label rendered below the % inside the circle. */
  gaugeLabel?: string;
  /** Descriptive text shown beside the circle in the full variant. */
  gaugeSubLabel?: string;
  /** The "other" value. Defaults to (100 - gaugePercentage) when gauge is set,
   *  or shown standalone out of 100 when gaugePercentage is absent. */
  outerPercentage?: number;
  /** When true, the outer/bar1 value gets the accent colour in the arc and bars.
   *  When false (default), the inner/bar2 (gaugePercentage) gets accent. */
  highlightBar?: boolean;
  bar1Label?: string;
  bar2Label?: string;
  accentColor?: string;
  variant?: "full" | "circle-only" | "bars-only";
}

const GAUGE_SIZE   = 88;
const STROKE_WIDTH = 3.6;

export function CircleGauge({
  gaugePercentage,
  outerPercentage,
  gaugeLabel    = "qualified",
  gaugeSubLabel = "not ready for AI roles today",
  bar1Label     = "Traditional workforce",
  bar2Label     = "AI-ready professionals",
  accentColor   = "hsl(var(--color-orange))",
  highlightBar  = false,
  variant       = "full",
}: CircleGaugeProps) {
  const hasGauge  = gaugePercentage !== undefined;
  const showCircle = hasGauge || outerPercentage !== undefined;

  const inner = hasGauge
    ? Math.min(100, Math.max(0, gaugePercentage!))
    : 0;

  const outer = outerPercentage !== undefined
    ? Math.min(100, Math.max(0, outerPercentage))
    : hasGauge
      ? 100 - inner
      : 100;

  // When gauge is absent, arc always fills based on outer directly (over 100)
  const arcPct = !hasGauge
    ? outer
    : highlightBar ? outer : inner;
  const accentBarValue = highlightBar ? outer : inner;
  const faintBarValue  = highlightBar ? inner : outer;

  // Scale bar visual widths proportionally
  const total        = accentBarValue + faintBarValue;
  const accentVisual = total > 0 ? (accentBarValue / total) * 100 : 0;
  const faintVisual  = total > 0 ? (faintBarValue  / total) * 100 : 0;

  const resolved   = resolveColorVar(accentColor);
  const accentCss  = hslColorRaw(resolved);
  const trackColor = hslColor(resolved, 0.3);
  const barFaint   = hslColor(resolved, 0.3);
  const bar1Track  = hslColor(resolved, 0.1);
  const bar2Track  = hslColor(resolved, 0.2);

  // ── Circle ──────────────────────────────────────────────────────────────────
  const circleEl = showCircle ? (
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
          strokeDasharray={`${arcPct} ${100 - arcPct}`}
          strokeLinecap="round"
        />
      </svg>
      {hasGauge && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-black leading-none" style={{ color: accentCss }}>
            {arcPct}%
          </span>
          {gaugeLabel && (
            <span className="text-[9px] text-slate-500 mt-0.5 leading-none text-center px-1">
              {gaugeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  ) : null;

  // ── Bars ─────────────────────────────────────────────────────────────────────
  // When gaugePercentage is absent: single bar for outer relative to 100
  const barsEl = !hasGauge ? (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">{bar1Label}</span>
          <span style={{ color: accentCss }}>{outer}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: bar1Track }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${outer}%`, background: accentCss }}
          />
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-2.5">
      {/* bar1 = outer */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">{bar1Label}</span>
          <span style={{ color: highlightBar ? accentCss : "#94a3b8" }}>
            {outer}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: bar1Track }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${highlightBar ? accentVisual : faintVisual}%`,
              background: highlightBar ? accentCss : barFaint,
            }}
          />
        </div>
      </div>
      {/* bar2 = inner */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">{bar2Label}</span>
          <span style={{ color: highlightBar ? "#94a3b8" : accentCss }}>
            {inner}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: bar2Track }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${highlightBar ? faintVisual : accentVisual}%`,
              background: highlightBar ? barFaint : accentCss,
            }}
          />
        </div>
      </div>
    </div>
  );

  if (variant === "circle-only") return circleEl ?? <></>;
  if (variant === "bars-only")   return barsEl;

  // ── Full ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {showCircle ? (
        <div className="flex items-center gap-4">
          {circleEl}
          <div>
            <div className="text-4xl font-black tracking-tight leading-none" style={{ color: accentCss }}>
              {outer}%
            </div>
            <p className="text-sm text-muted-foreground mt-1.5 leading-snug">
              {gaugeSubLabel}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="text-4xl font-black tracking-tight leading-none" style={{ color: accentCss }}>
            {outer}%
          </div>
          {gaugeSubLabel && (
            <p className="text-sm text-muted-foreground mt-1.5 leading-snug">
              {gaugeSubLabel}
            </p>
          )}
        </div>
      )}
      {barsEl}
    </div>
  );
}
