
import type { FeaturesGridStatsChartsSection } from "@shared/schema";
import { BarChart } from "@/components/BarChart";
import { CircleGauge } from "@/components/CircleGauge";
import { TrendLineChart } from "@/components/TrendLineChart";

interface Props {
  data: FeaturesGridStatsChartsSection;
}

const CARD1_DEFAULT_COLOR = "bg-gradient-to-br from-blue-950/80 to-slate-900 border border-blue-800/30";
const CARD2_DEFAULT_COLOR = "bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-700/25";
const CARD3_DEFAULT_COLOR = "bg-gradient-to-br from-emerald-950/50 to-slate-900 border border-emerald-700/25";

export default function FeaturesGridStatsCharts({ data }: Props) {
  const { card1, card2, card3 } = data;

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
                <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-2"
                   data-testid="text-stats-charts-subtitle">
                  {data.subtitle}
                </p>
              )}
              {data.title && (
                <h2 className="text-h2 text-foreground leading-tight"
                    data-testid="text-stats-charts-title">
                  {data.title}
                </h2>
              )}
            </div>
            {data.description && (
              <p className="text-base text-muted-foreground leading-relaxed self-end"
                 data-testid="text-stats-charts-description">
                {data.description}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div
            className={`rounded-2xl p-6 flex flex-col gap-4 shadow-xl ${card1?.card_color || CARD1_DEFAULT_COLOR}`}
            data-testid="card-stats-charts-1"
          >
            {card1?.badge && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20 tracking-wide uppercase self-start">
                {card1.badge}
              </span>
            )}
            {card1?.stat_value && (
              <div>
                <div className="text-4xl font-black text-white tracking-tight leading-none"
                     data-testid="text-stats-charts-card1-value">
                  {card1.stat_value}
                </div>
                {card1.stat_label && (
                  <p className="text-sm text-slate-400 mt-1.5 leading-snug"
                     data-testid="text-stats-charts-card1-label">
                    {card1.stat_label}
                  </p>
                )}
              </div>
            )}
            <BarChart
              years={card1?.years}
              displacedLabel={card1?.displaced_label}
              createdLabel={card1?.created_label}
            />
          </div>

          <div
            className={`rounded-2xl p-6 flex flex-col gap-4 shadow-xl ${card2?.card_color || CARD2_DEFAULT_COLOR}`}
            data-testid="card-stats-charts-2"
          >
            {card2?.badge && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20 tracking-wide uppercase self-start">
                {card2.badge}
              </span>
            )}
            <CircleGauge
              percentage={card2?.gauge_percentage}
              gaugeLabel={card2?.gauge_label}
              bar1Label={card2?.bar1_label}
              bar2Label={card2?.bar2_label}
            />
          </div>

          <div
            className={`rounded-2xl p-6 flex flex-col gap-4 shadow-xl ${card3?.card_color || CARD3_DEFAULT_COLOR}`}
            data-testid="card-stats-charts-3"
          >
            {card3?.badge && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 tracking-wide uppercase self-start">
                {card3.badge}
              </span>
            )}
            {card3?.stat_value && (
              <div>
                <div className="text-4xl font-black text-white tracking-tight leading-none"
                     data-testid="text-stats-charts-card3-value">
                  {card3.stat_value}
                </div>
                {card3.stat_label && (
                  <p className="text-sm text-slate-400 mt-1.5 leading-snug"
                     data-testid="text-stats-charts-card3-label">
                    {card3.stat_label}
                  </p>
                )}
              </div>
            )}
            <TrendLineChart endLabel={card3?.end_label} />
          </div>

        </div>
      </div>
    </section>
  );
}
