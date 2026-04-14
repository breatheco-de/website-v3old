
interface CircleGaugeProps {
  percentage?: number;
  gaugeLabel?: string;
  bar1Label?: string;
  bar2Label?: string;
}

export function CircleGauge({
  percentage = 3,
  gaugeLabel  = "qualified",
  bar1Label   = "Traditional workforce",
  bar2Label   = "AI-ready professionals",
}: CircleGaugeProps) {
  const pct    = Math.min(100, Math.max(0, percentage));
  const filled = `${pct}%`;
  const empty  = `${100 - pct}%`;
  const inverse = 100 - pct;

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
                #f59e0b ${filled},
                #1e293b ${filled} ${empty},
                #1e293b
              )`,
            }}
          />
          <div
            className="absolute inset-0 rounded-full flex flex-col items-center justify-center bg-slate-900"
            style={{ margin: 9 }}
          >
            <span className="text-base font-black text-amber-400 leading-none">{pct}%</span>
            <span className="text-[9px] text-slate-500 mt-0.5 leading-none">{gaugeLabel}</span>
          </div>
        </div>

        <div>
          <div className="text-4xl font-black text-white tracking-tight leading-none">
            {inverse}%
          </div>
          <p className="text-sm text-slate-400 mt-1.5 leading-snug">
            of the workforce is not ready for AI roles today
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
            <div className="h-full rounded-full bg-slate-500" style={{ width: `${inverse}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">{bar2Label}</span>
            <span className="text-amber-400">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
