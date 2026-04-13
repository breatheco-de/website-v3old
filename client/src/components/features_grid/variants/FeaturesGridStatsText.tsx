
import { useState } from "react";
import type { FeaturesGridStatsTextSection } from "@shared/schema";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { IconChevronDown } from "@tabler/icons-react";
import { RichTextContent } from "@/components/ui/rich-text-content";

interface FeaturesGridStatsTextProps {
  data: FeaturesGridStatsTextSection;
}

export default function FeaturesGridStatsText({ data }: FeaturesGridStatsTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section 
      className={`py-12 ${data.background || 'bg-primary/5'}`}
      data-testid="section-features-grid-stats-text"
    >
      <div>
        <div className="flex flex-col md:flex-row gap-8 md:gap-12 md:items-center">
          <div className="flex flex-col gap-4 md:w-[280px] lg:w-[420px] md:flex-shrink-0">
            <div className="grid grid-cols-2 gap-6">
              {data.items.slice(0, 2).map((item, index) => {
                const itemId = item.id || `stat-${index}`;
                return (
                  <StatCard
                    key={itemId}
                    value={item.value}
                    title={item.title}
                    use_card={false}
                    card_color="bg-transparent"
                    size="small"
                    value_size="text-4xl md:text-4xl lg:text-5xl"
                    className="text-center"
                    data-testid={`stat-${itemId}`}
                  />
                );
              })}
            </div>
            {data.items.length > 2 && (
              <div className="flex justify-center">
                {data.items.slice(2, 3).map((item, index) => {
                  const itemId = item.id || `stat-${index + 2}`;
                  return (
                    <StatCard
                      key={itemId}
                      value={item.value}
                      title={item.title}
                      use_card={false}
                      card_color="bg-transparent"
                      size="small"
                      value_size="text-3xl md:text-4xl lg:text-5xl"
                      className="text-center"
                      data-testid={`stat-${itemId}`}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex-1">
            <div>
              {data.title && (
                <h2
                  className="text-2xl md:text-h2 mb-2 text-foreground"
                  data-testid="text-stats-text-title"
                >
                  {data.title}
                </h2>
              )}
              {data.subtitle && (
                <p
                  className="text-lg mb-2 text-primary"
                  data-testid="text-stats-text-subtitle"
                >
                  {data.subtitle}
                </p>
              )}
            </div>
            {data.description && (
              <>
                <div className="hidden md:block mt-2">
                  <RichTextContent
                    html={data.description}
                    className="text-base text-muted-foreground leading-relaxed"
                    data-testid="text-stats-text-description"
                  />
                  {/* <p
                    className="text-body text-muted-foreground leading-relaxed"
                    data-testid="text-stats-text-description"
                  >
                    {data.description}
                  </p> */}
                </div>
                <div className="md:hidden">
                  <Button
                    variant="ghost"
                    className="p-0 h-auto mt-3 text-primary text-base font-medium hover:bg-transparent hover:underline flex items-center gap-1"
                    onClick={() => setIsExpanded(!isExpanded)}
                    data-testid="button-toggle-description"
                  >
                    {isExpanded ? "See less" : "See more"}
                    <IconChevronDown
                      className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </Button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[600px] opacity-100 mt-4" : "max-h-0 opacity-0"}`}
                  >
                    <p
                      className="text-body text-muted-foreground leading-relaxed"
                      data-testid="text-stats-text-description-mobile"
                    >
                      {data.description}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
