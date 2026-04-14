
import type { CSSProperties } from "react";
import type { FeaturesGridStatsChartsSection } from "@shared/schema";
import { BarChart } from "@/components/BarChart";
import { CircleGauge } from "@/components/CircleGauge";
import { TrendLineChart } from "@/components/TrendLineChart";

interface Props {
  data: FeaturesGridStatsChartsSection;
}

const DEFAULT_BARS_ACCENT  = "#3b82f6";
const DEFAULT_GAUGE_ACCENT = "#f59e0b";
const DEFAULT_TREND_ACCENT = "#34d399";

function cardBg(accent: string) {
  return `color-mix(in srgb, ${accent} 10%, transparent)`;
}

function badgeStyles(accent: string): CSSProperties {
  return {
    color: accent,
    background: `color-mix(in srgb, ${accent} 15%, transparent)`,
    border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
  };
}

export default function FeaturesGridStatsCharts({ data }: Props) {
  const { card_bars, card_gauge, card_trend } = data;

  const barsAccent  = data.card_bars_accent  || DEFAULT_BARS_ACCENT;
  const gaugeAccent = data.card_gauge_accent || DEFAULT_GAUGE_ACCENT;
  const trendAccent = data.card_trend_accent || DEFAULT_TREND_ACCENT;

  return (
    <section
      className={`py-14 ${data.background || "bg-slate-950"}`}
      data-testid="section-features-grid-stats-charts"
    >
      <div className="max-w-6xl mx-auto px-4 lg:px-6 flex flex-col gap-10">

        {(data.title || data.subtitle || data.description) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
            <div>
              {data.subtitle && (
                <p
                  className="text-sm font-semibold uppercase tracking-wider mb-2"
                  style={{ color: barsAccent }}
                  data-testid="text-stats-charts-subtitle"
                >
                  {data.subtitle}
                </p>
              )}
              {data.title && (
                <h2
                  className="text-h2 text-foreground leading-tight"
                  data-testid="text-stats-charts-title"
                >
                  {data.title}
                </h2>
              )}
            </div>
            {data.description && (
              <p
                className="text-base text-muted-foreground leading-relaxed self-end"
                data-testid="text-stats-charts-description"
              >
                {data.description}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Card Bars */}
          <div
            className="rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: cardBg(barsAccent) }}
            data-testid="card-stats-charts-bars"
          >
            {card_bars?.badge && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full tracking-wide uppercase self-start"
                style={badgeStyles(barsAccent)}
              >
                {card_bars.badge}
              </span>
            )}
            {card_bars?.stat_value && (
              <div>
                <div
                  className="text-4xl font-black tracking-tight leading-none text-white"
                  data-testid="text-stats-charts-bars-value"
                >
                  {card_bars.stat_value}
                </div>
                {card_bars.stat_label && (
                  <p
                    className="text-sm text-slate-400 mt-1.5 leading-snug"
                    data-testid="text-stats-charts-bars-label"
                  >
                    {card_bars.stat_label}
                  </p>
                )}
              </div>
            )}
            <BarChart
              years={card_bars?.years}
              displacedLabel={card_bars?.displaced_label}
              createdLabel={card_bars?.created_label}
              accentColor={barsAccent}
            />
          </div>

          {/* Card Gauge */}
          <div
            className="rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: cardBg(gaugeAccent) }}
            data-testid="card-stats-charts-gauge"
          >
            {card_gauge?.badge && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full tracking-wide uppercase self-start"
                style={badgeStyles(gaugeAccent)}
              >
                {card_gauge.badge}
              </span>
            )}
            <CircleGauge
              percentage={card_gauge?.gauge_percentage}
              gaugeLabel={card_gauge?.gauge_label}
              bar1Label={card_gauge?.bar1_label}
              bar2Label={card_gauge?.bar2_label}
              accentColor={gaugeAccent}
            />
          </div>

          {/* Card Trend */}
          <div
            className="rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: cardBg(trendAccent) }}
            data-testid="card-stats-charts-trend"
          >
            {card_trend?.badge && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full tracking-wide uppercase self-start"
                style={badgeStyles(trendAccent)}
              >
                {card_trend.badge}
              </span>
            )}
            {card_trend?.stat_value && (
              <div>
                <div
                  className="text-4xl font-black text-white tracking-tight leading-none"
                  data-testid="text-stats-charts-trend-value"
                >
                  {card_trend.stat_value}
                </div>
                {card_trend.stat_label && (
                  <p
                    className="text-sm text-slate-400 mt-1.5 leading-snug"
                    data-testid="text-stats-charts-trend-label"
                  >
                    {card_trend.stat_label}
                  </p>
                )}
              </div>
            )}
            <TrendLineChart
              endLabel={card_trend?.end_label}
              accentColor={trendAccent}
            />
          </div>

        </div>
      </div>
    </section>
  );
}
