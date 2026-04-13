export const variant = "stats-text-card";

import { useState, useEffect, useRef } from "react";
import type { FeaturesGridStatsTextCardSection } from "@shared/schema";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { AIWorkflowDiagram } from "@/components/AIWorkflowDiagram";
import { Button } from "@/components/ui/button";
import { IconChevronDown } from "@tabler/icons-react";

interface FeaturesGridStatsTextCardProps {
  data: FeaturesGridStatsTextCardSection;
}

export default function FeaturesGridStatsTextCard({
  data,
}: FeaturesGridStatsTextCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const cardAnimationStyle: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "translateX(0)" : "translateX(40px)",
    transition: "opacity 0.6s ease-out 0.8s, transform 0.6s ease-out 0.8s",
  };

  return (
    <section ref={sectionRef} className="py-12" data-testid="section-features-grid-stats-text-card">
      <div className="max-w-6xl mx-auto px-4 overflow-x-hidden">
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
                    value_size={item.value_size}
                    className="text-center"
                    animate={isVisible}
                    animationDelay={index * 200}
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
                      value_size={item.value_size}
                      className="text-center"
                      animate={isVisible}
                      animationDelay={400}
                      data-testid={`stat-${itemId}`}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <Card 
            className={`p-6 md:p-8 order-first md:order-last ${data.card_color || "bg-background"}`}
            style={cardAnimationStyle}
          >
            <div>
              {data.title && (
                <h2
                  className="text-h2 mb-2 text-foreground"
                  data-testid="text-stats-text-card-title"
                >
                  {data.title}
                </h2>
              )}
              {data.subtitle && (
                <p
                  className="text-lg mb-2 text-primary"
                  data-testid="text-stats-text-card-subtitle"
                >
                  {data.subtitle}
                </p>
              )}
            </div>
            {data.description && (
              <>
                <div className="hidden md:block mt-2">
                  <p
                    className="text-body text-muted-foreground leading-relaxed"
                    data-testid="text-stats-text-card-description"
                  >
                    {data.description}
                  </p>
                  <div className="mt-4">
                    <AIWorkflowDiagram className="max-w-md mx-auto" />
                  </div>
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
                      data-testid="text-stats-text-card-description-mobile"
                    >
                      {data.description}
                    </p>
                    <div className="mt-4">
                      <AIWorkflowDiagram className="max-w-md mx-auto" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
