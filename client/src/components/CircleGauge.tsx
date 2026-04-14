
interface CircleGaugeProps {
  percentage?: number;
  gaugeLabel?: string;
  bar1Label?: string;
  bar2Label?: string;
  accentColor?: string;
}

const GAUGE_SIZE = 88;
const STROKE_WIDTH = 3.6;

export function CircleGauge({
  percentage  = 3,
  gaugeLabel  = "qualified",
  bar1Label   = "Traditional workforce",
  bar2Label   = "AI-ready professionals",
  accentColor = "#f59e0b",
}: CircleGaugeProps) {
  const pct      = Math.min(100, Math.max(0, percentage));
  const inverse  = 100 - pct;
  const trackColor = `color-mix(in srgb, ${accentColor} 30%, #64748b)`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {/* SVG donut ring — center is transparent */}
        <div className="relative shrink-0" style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}>
          <svg
            viewBox="0 0 36 36"
            width={GAUGE_SIZE}
            height={GAUGE_SIZE}
            style={{ transform: "rotate(-90deg)" }}
          >
            {/* Track — visible ring in accent-tinted slate */}
            <circle
              cx="18" cy="18" r="15.9"
              fill="none"
              style={{ stroke: trackColor, strokeWidth: STROKE_WIDTH }}
            />
            {/* Filled arc */}
            <circle
              cx="18" cy="18" r="15.9"
              fill="none"
              style={{ stroke: accentColor, strokeWidth: STROKE_WIDTH }}
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeLinecap="round"
            />
          </svg>
          {/* Center label — rotated back upright */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-black leading-none" style={{ color: accentColor }}>
              {pct}%
            </span>
            <span className="text-[9px] text-slate-500 mt-0.5 leading-none text-center px-1">
              {gaugeLabel}
            </span>
          </div>
        </div>

        <div>
          <div className="text-4xl font-black text-white tracking-tight leading-none">
            {inverse}%
          </div>
          <p className="text-sm text-slate-400 mt-1.5 leading-snug">
            not ready for AI roles today
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">{bar1Label}</span>
            <span className="text-slate-500">{inverse}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${inverse}%`,
                background: `color-mix(in srgb, ${accentColor} 30%, transparent)`,
              }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">{bar2Label}</span>
            <span style={{ color: accentColor }}>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, background: accentColor }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
