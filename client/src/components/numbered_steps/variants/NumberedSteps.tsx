export const variant = "default";

import { useState } from "react";
import * as TablerIcons from "@tabler/icons-react";
import { IconChevronDown } from "@tabler/icons-react";
import type { ComponentType } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface NumberedStepsStep {
  icon: string;
  text?: string;
  title?: string;
  bullets?: string[];
  bullet_icon?: string;
  bullet_icon_color?: string;
  bullet_char?: string;
}

export interface NumberedStepsData {
  title?: string;
  description?: string;
  description_link?: {
    text: string;
    url: string;
  };
  steps: NumberedStepsStep[];
  background?: string;
  bullet_icon?: string;
  bullet_icon_color?: string;
  bullet_char?: string;
  collapsible_mobile?: boolean;
  variant?: "default" | "spotlight" | "bubbleText" | "verticalCards";
}

interface NumberedStepsProps {
  data: NumberedStepsData;
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

interface StepNumberProps {
  index: number;
  variant: "default" | "spotlight";
  size?: "sm" | "md" | "lg";
}

const StepNumber = ({ index, variant, size = "md" }: StepNumberProps) => {
  const number = String(index + 1).padStart(2, '0');
  
  if (variant === "spotlight") {
    const sizeClasses = {
      sm: "text-2xl",
      md: "text-3xl", 
      lg: "text-4xl"
    };
    return (
      <div className="flex flex-col items-start">
        <span className="text-xs font-medium text-primary uppercase tracking-wide">Step</span>
        <span className={`${sizeClasses[size]} font-bold text-primary leading-none`}>{number}</span>
      </div>
    );
  }
  
  // Default variant - circle style
  const circleClasses = {
    sm: "w-10 h-10 text-base",
    md: "w-14 h-14 text-xl",
    lg: "w-20 h-20 text-3xl"
  };
  
  return (
    <div className={`${circleClasses[size]} rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center`}>
      <span className="font-bold text-primary">{number}</span>
    </div>
  );
};

export { StepNumber };

export default function NumberedSteps({ data }: NumberedStepsProps) {
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  const toggleStep = (index: number) => {
    setExpandedSteps(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <section 
      className={`${data.background || "bg-muted/30"}`}
      data-testid="section-numbered-steps"
    >
      <div className="max-w-6xl mx-auto px-4">
        <h2 
          className="text-h2 mb-4 text-foreground text-center"
          data-testid="text-numbered-steps-title"
        >
          {data.title}
        </h2>
        
        {data.description && (
          <div className="text-center mb-10">
            <p className="text-body text-muted-foreground max-w-3xl mx-auto">
              {data.description}
            </p>
            {data.description_link && (
              <a 
                href={data.description_link.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline text-body mt-2 inline-block"
                data-testid="link-numbered-steps-description"
              >
                {data.description_link.text}
              </a>
            )}
          </div>
        )}

        {/* Mobile: Vertical timeline with collapsible steps */}
        <div className="md:hidden relative pl-16">
          {(data.steps || []).map((step, index) => {
            const bulletChar = step.bullet_char || data.bullet_char;
            const bulletIcon = step.bullet_icon || data.bullet_icon || "Check";
            const bulletIconColor = step.bullet_icon_color || data.bullet_icon_color || "text-primary";
            const isLast = index === (data.steps || []).length - 1;
            const collapsibleEnabled = data.collapsible_mobile !== false;
            const hasCollapsibleContent = collapsibleEnabled && step.title && (step.bullets?.length || step.text);
            const isExpanded = expandedSteps[index] || false;
            
            return (
              <div 
                key={index} 
                className="relative pb-5 last:pb-0"
                data-testid={`numbered-step-mobile-${index + 1}`}
              >
                {/* Circle on the left */}
                <div className="absolute left-[-3.5rem] w-10 h-10 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center">
                  <span className="text-base font-bold text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                {/* Connecting line to next circle - only if not last */}
                {!isLast && (
                  <div className="absolute left-[-2.375rem] top-10 bottom-[-0.75rem] w-0.5 bg-primary/30 z-0" />
                )}
                
                {hasCollapsibleContent ? (
                  <Collapsible open={isExpanded} onOpenChange={() => toggleStep(index)}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center gap-2 pt-2 cursor-pointer">
                        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {getIcon(step.icon)}
                        </div>
                        <h3 className="text-base font-semibold text-foreground flex-1 text-left">
                          {step.title}
                        </h3>
                        <IconChevronDown 
                          className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2">
                        {step.text && (
                          <p className="text-sm text-muted-foreground pl-10 mb-2">
                            {step.text}
                          </p>
                        )}
                        {step.bullets && step.bullets.length > 0 && (
                          <ul className="space-y-1 text-left pl-10">
                            {step.bullets.map((bullet, bulletIndex) => (
                              <li 
                                key={bulletIndex}
                                className="flex gap-2 items-start text-sm text-muted-foreground"
                              >
                                <span className={`${bulletIconColor} flex-shrink-0 mt-0.5`}>
                                  {bulletChar 
                                    ? bulletChar 
                                    : getBulletIcon(bulletIcon, bulletIconColor)
                                  }
                                </span>
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <>
                    <div className="flex items-start gap-2 mb-2 pt-2">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {getIcon(step.icon)}
                      </div>
                      {step.title && (
                        <h3 className="text-base font-semibold text-foreground">
                          {step.title}
                        </h3>
                      )}
                      {step.text && !step.title && (
                        <p className="text-base text-foreground">
                          {step.text}
                        </p>
                      )}
                    </div>
                    
                    {step.bullets && step.bullets.length > 0 && (
                      <ul className="space-y-1 text-left pl-10">
                        {step.bullets.map((bullet, bulletIndex) => (
                          <li 
                            key={bulletIndex}
                            className="flex gap-2 items-start text-sm text-muted-foreground"
                          >
                            <span className={`${bulletIconColor} flex-shrink-0 mt-0.5`}>
                              {bulletChar 
                                ? bulletChar 
                                : getBulletIcon(bulletIcon, bulletIconColor)
                              }
                            </span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop: Horizontal timeline */}
        <div className="hidden md:grid md:grid-cols-3 gap-8 relative">
          <div className="absolute top-10 left-[16.67%] right-[16.67%] h-0.5 bg-primary/30 z-0" />
          
          {(data.steps || []).map((step, index) => {
            const bulletChar = step.bullet_char || data.bullet_char;
            const bulletIcon = step.bullet_icon || data.bullet_icon || "Check";
            const bulletIconColor = step.bullet_icon_color || data.bullet_icon_color || "text-primary";
            
            return (
              <div 
                key={index} 
                className="flex flex-col items-center relative"
                data-testid={`numbered-step-${index + 1}`}
              >
                <div className="flex items-center justify-center w-full mb-3 relative">
                  <div className="w-20 h-20 rounded-full border-2 border-primary bg-background flex items-center justify-center flex-shrink-0 relative z-10">
                    <div className="absolute inset-0 bg-primary/10 rounded-full" />
                    <span className="text-h2 text-primary relative z-10">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {getIcon(step.icon)}
                  </div>
                  {step.title && (
                    <h3 className="text-lg font-semibold text-foreground">
                      {step.title}
                    </h3>
                  )}
                  {step.text && !step.title && (
                    <p className="text-base text-foreground">
                      {step.text}
                    </p>
                  )}
                </div>
                
                {step.bullets && step.bullets.length > 0 && (
                  <ul className="space-y-2 text-left">
                    {step.bullets.map((bullet, bulletIndex) => (
                      <li 
                        key={bulletIndex}
                        className="flex gap-2 items-start text-base text-muted-foreground"
                      >
                        <span className={`${bulletIconColor} flex-shrink-0 mt-0.5`}>
                          {bulletChar 
                            ? bulletChar 
                            : getBulletIcon(bulletIcon, bulletIconColor)
                          }
                        </span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
