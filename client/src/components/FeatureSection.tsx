import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { IconChevronDown, IconArrowRight } from "@tabler/icons-react";
import { useState } from "react";
import type { Icon } from "@tabler/icons-react";
import { UniversalImage } from "@/components/UniversalImage";

interface Feature {
  title: string;
  description: string;
  icon?: string;
}

interface FeatureAction {
  label: string;
  description: string;
  icon?: Icon;
  color?: string;
  iconColor?: string;
  href?: string;
  onClick?: () => void;
}

interface DecorationAsset {
  src: string;
  alt: string;
}

interface FeatureSectionProps {
  variant?: "detailed" | "notion";
  title?: string;
  heading?: string;
  subheading?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaIcon?: React.ReactNode;
  features?: Feature[];
  actions?: FeatureAction[];
  decorations?: DecorationAsset[];
}

export default function FeatureSection({
  variant = "detailed",
  title,
  heading,
  subheading,
  ctaLabel,
  ctaHref,
  ctaIcon,
  features = [],
  actions = [],
  decorations = [],
}: FeatureSectionProps) {
  if (variant === "notion") {
    const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

    const toggleCard = (index: number) => {
      const newExpanded = new Set(expandedCards);
      if (newExpanded.has(index)) {
        newExpanded.delete(index);
      } else {
        newExpanded.add(index);
      }
      setExpandedCards(newExpanded);
    };

    return (
      <section className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {heading && (
            <h2 className="text-h2 mb-4 hidden md:block lg:hidden">
              {heading}
            </h2>
          )}
          <div className="flex flex-col md:flex-row md:items-end lg:items-start md:justify-between gap-4 md:gap-8 mb-8">
            <div className="flex-1">
              {heading && (
                <h2 className="text-h2 mb-4 md:hidden lg:block">
                  {heading}
                </h2>
              )}
              {subheading && (
                <p className="text-muted-foreground text-body mb-0 md:mb-4">
                  {subheading}
                </p>
              )}
              {ctaLabel && ctaHref && (
                <a
                  href={ctaHref}
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                  data-testid="link-feature-cta"
                >
                  {ctaLabel}
                  {ctaIcon || <IconArrowRight className="w-4 h-4" />}
                </a>
              )}
            </div>

            {decorations.length > 0 && (
              <div className="hidden md:flex -space-x-4 items-center lg:self-end">
                {decorations.map((decoration, index) => (
                  <Avatar
                    key={index}
                    className="h-[70px] w-[70px] lg:h-20 lg:w-20 border-2 border-background"
                    style={{ zIndex: decorations.length - index }}
                    data-testid={`avatar-decoration-${index}`}
                  >
                    <AvatarImage
                      src={decoration.src}
                      alt={decoration.alt}
                      className="object-cover"
                    />
                    <AvatarFallback>
                      {decoration.alt.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {actions.map((action, index) => {
              const isExpanded = expandedCards.has(index);

              return (
                <Card
                  key={index}
                  className={`hover-elevate active-elevate-2 cursor-pointer overflow-hidden border-t-4 ${action.color || ""}`}
                  onClick={() => toggleCard(index)}
                  data-testid={`button-feature-action-${index}`}
                >
                  <CardContent className="p-2 md:p-3">
                    <div className="flex items-start gap-3 w-full">
                      {action.icon && (
                        <action.icon
                          className={`h-5 w-5 flex-shrink-0 mt-0.5 ${action.iconColor || ""}`}
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-medium">
                            {action.label}
                          </span>
                          <IconChevronDown
                            className={`w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                        {isExpanded && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {action.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4">
      {title && (
        <h2 className="text-h2 text-center mb-12">{title}</h2>
      )}

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {features.map((feature, index) => (
          <Card key={index} data-testid={`card-feature-${index}`}>
            <CardHeader>
              {feature.icon && (
                <div className="mb-2">
                  <UniversalImage id={feature.icon} alt="" className="h-12 w-12" />
                </div>
              )}
              <CardTitle className="text-body font-bold">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
