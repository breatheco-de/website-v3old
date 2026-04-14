
import * as TablerIcons from "@tabler/icons-react";
import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { NumberedStepsVerticalCardsSection, NumberedStepsStep } from "@shared/schema";

interface NumberedStepsVerticalCardsProps {
  data: NumberedStepsVerticalCardsSection;
}

const getIcon = (iconName: string, className?: string) => {
  const icons = TablerIcons as unknown as Record<string, ComponentType<{ size?: number; className?: string }>>;
  const IconComponent = icons[`Icon${iconName}`];
  return IconComponent ? <IconComponent size={24} className={className || "text-primary"} /> : null;
};

const getBulletIcon = (iconName: string, colorClass: string) => {
  const icons = TablerIcons as unknown as Record<string, ComponentType<{ className?: string }>>;
  const IconComponent = icons[`Icon${iconName}`];
  return IconComponent ? <IconComponent className={`w-4 h-4 ${colorClass} flex-shrink-0 mt-0.5`} /> : null;
};

export default function NumberedStepsVerticalCards({ data }: NumberedStepsVerticalCardsProps) {
  const steps = data.steps || [];

  return (
    <section
      className={`py-16 ${data.background || "bg-muted/30"}`}
      data-testid="section-numbered-steps-vertical-cards"
    >
      <div className="max-w-4xl mx-auto px-4">
        {data.title && (
          <h2
            className="text-3xl md:text-4xl font-bold mb-4 text-foreground text-center"
            data-testid="text-numbered-steps-title"
          >
            {data.title}
          </h2>
        )}

        {data.description && (
          <div className="text-center mb-10">
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              {data.description}
            </p>
            {data.description_link && (
              <a
                href={data.description_link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-base mt-2 inline-block"
                data-testid="link-numbered-steps-description"
              >
                {data.description_link.text}
              </a>
            )}
          </div>
        )}

        <div className="relative">
          {steps.map((step: NumberedStepsStep, index: number) => {
            const bulletChar = step.bullet_char || data.bullet_char;
            const bulletIcon = step.bullet_icon || data.bullet_icon || "Check";
            const bulletIconColor = step.bullet_icon_color || data.bullet_icon_color || "text-primary";
            const isLast = index === steps.length - 1;
            const number = String(index + 1).padStart(2, '0');

            return (
              <div
                key={index}
                className="flex gap-4 md:gap-6"
                data-testid={`numbered-step-${index + 1}`}
              >
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg border-2 border-primary bg-primary/10 flex items-center justify-center flex-shrink-0 relative z-10">
                    <span className="text-lg md:text-xl font-bold text-primary">{number}</span>
                  </div>
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-primary/30 my-2" />
                  )}
                </div>

                <Card className={`flex-1 ${isLast ? 'mb-0' : 'mb-4'}`}>
                  <CardContent className="p-5 md:p-6">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {getIcon(step.icon)}
                      </div>
                      <div className="flex-1">
                        {step.title && (
                          <h3 className="text-lg font-semibold text-foreground">
                            {step.title}
                          </h3>
                        )}
                        {step.text && (
                          <p className="text-muted-foreground mt-1">
                            {step.text}
                          </p>
                        )}
                      </div>
                    </div>

                    {step.bullets && step.bullets.length > 0 && (
                      <ul className="space-y-2 mt-4 pl-13">
                        {step.bullets.map((bullet: string, bulletIndex: number) => (
                          <li
                            key={bulletIndex}
                            className="flex gap-2 items-start text-base text-muted-foreground"
                          >
                            <span className={`${bulletIconColor} flex-shrink-0 mt-0.5`}>
                              {bulletChar
                                ? bulletChar
                                : getBulletIcon(bulletIcon, bulletIconColor)}
                            </span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
