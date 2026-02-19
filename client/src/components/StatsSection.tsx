import { Card } from "@/components/ui/card";
import Briefcase from "@/components/custom-icons/Briefcase";
import Graduation from "@/components/custom-icons/Graduation";
import GrowthChart from "@/components/custom-icons/GrowthChart";

export interface StatItem {
  value: string;
  label: string;
  icon?: string;
}

export interface StatsSectionData {
  title?: string;
  description?: string;
  subtitle?: string;
  background?: string;
  items?: StatItem[];
}

interface StatsSectionProps {
  data: StatsSectionData;
}

const defaultStats: StatItem[] = [
  { value: "84%", label: "Job placement rate", icon: "briefcase" },
  { value: "3-6 months", label: "Average time to get hired", icon: "graduation" },
  { value: "55%", label: "Salary increase after graduation", icon: "growth" },
];

const iconMap: Record<string, JSX.Element> = {
  briefcase: <Briefcase width="64" height="58" color="#0097CD" />,
  graduation: <Graduation width="64" height="54" />,
  growth: <GrowthChart width="64" height="67" />,
};

export default function StatsSection({ data }: StatsSectionProps) {
  const stats = data.items && data.items.length > 0 ? data.items : defaultStats;
  const hasIcons = stats.some(stat => stat.icon);
  
  if (hasIcons) {
    return (
      <section 
        className=""
        data-testid="section-stats"
      >
        <div className="max-w-6xl mx-auto px-4">
          {(data.title || data.description || data.subtitle) && (
            <div className="text-center mb-8">
              {data.title && (
                <h2 
                  className="text-h2 mb-6 text-foreground"
                  data-testid="text-stats-title"
                >
                  {data.title}
                </h2>
              )}
              {(data.description || data.subtitle) && (
                <p className="text-body text-muted-foreground max-w-3xl mx-auto">
                  {data.description || data.subtitle}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, index) => (
              <Card key={index} data-testid={`stat-item-${index}`} className="p-3 md:p-5 flex items-center gap-3 md:gap-5">
                {stat.icon && iconMap[stat.icon] && (
                  <div className="flex-shrink-0 [&_svg]:w-10 [&_svg]:h-10 md:[&_svg]:w-16 md:[&_svg]:h-16">
                    {iconMap[stat.icon]}
                  </div>
                )}
                <div>
                  <div className="text-h2 text-foreground">
                    {stat.value}
                  </div>
                  <div className="text-sm md:text-base text-muted-foreground mt-0.5 md:mt-1">{stat.label}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const gridCols = stats.length <= 3 ? "md:grid-cols-3" : 
                   stats.length === 4 ? "md:grid-cols-4" : 
                   stats.length === 5 ? "md:grid-cols-5" : "md:grid-cols-3";

  return (
    <section 
      className={`${data.background === 'muted' ? 'bg-muted' : ''}`}
      data-testid="section-stats"
    >
      <div className="max-w-6xl mx-auto px-4">
        {(data.title || data.description || data.subtitle) && (
          <div className="text-center mb-12">
            {data.title && (
              <h2 
                className="text-h2 mb-4 text-foreground"
                data-testid="text-stats-title"
              >
                {data.title}
              </h2>
            )}
            {(data.description || data.subtitle) && (
              <p className="text-body text-muted-foreground max-w-3xl mx-auto">
                {data.description || data.subtitle}
              </p>
            )}
          </div>
        )}

        <div className={`grid grid-cols-2 ${gridCols} gap-8 text-center`}>
          {stats.map((stat, index) => (
            <div key={index} data-testid={`stat-item-${index}`} className="space-y-2">
              <div className="text-h2 text-primary">
                {stat.value}
              </div>
              <div className="text-sm md:text-base text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
