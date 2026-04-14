
interface CircleGaugeProps {
  percentage?: number;
  gaugeLabel?: string;
  bar1Label?: string;
  bar2Label?: string;
  accentColor?: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(100,100,100,${alpha})`;
  return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
}

export function CircleGauge({
  percentage  = 3,
  gaugeLabel  = "qualified",
  bar1Label   = "Traditional workforce",
  bar2Label   = "AI-ready professionals",
  accentColor = "#f59e0b",
}: CircleGaugeProps) {
  const pct     = Math.min(100, Math.max(0, percentage));
  const filled  = `${pct}%`;
  const empty   = `${100 - pct}%`;
  const inverse = 100 - pct;
  const track   = "#1e293b";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
          <div
            className="rounded-full"
            style={{
              width: 88,
              height: 88,
              background: `conic-gradient(
                ${accentColor} ${filled},
                ${track} ${filled} ${empty},
                ${track}
              )`,
            }}
          />
          <div
            className="absolute inset-0 rounded-full flex flex-col items-center justify-center bg-slate-900"
            style={{ margin: 9 }}
          >
            <span
              className="text-base font-black leading-none"
              style={{ color: accentColor }}
            >
              {pct}%
            </span>
            <span className="text-[9px] text-slate-500 mt-0.5 leading-none">{gaugeLabel}</span>
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
              style={{ width: `${inverse}%`, background: hexToRgba(accentColor, 0.3) }}
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
