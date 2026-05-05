
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { NumberedStepsBubbleTextSection } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";

interface StepNumberProps {
  index: number;
  size?: "sm" | "md" | "lg";
}

function StepNumber({ index, size = "md" }: StepNumberProps) {
  const number = String(index + 1).padStart(2, '0');
  
  const sizeClasses = {
    sm: "text-2xl",
    md: "text-3xl", 
    lg: "text-4xl"
  };
  
  return (
    <div className="flex flex-col items-start bg-primary/20 p-2 rounded group-hover:animate-heartbeat">
      <span className="text-xs font-medium text-primary uppercase tracking-wide">Step</span>
      <span className={`${sizeClasses[size]} font-bold text-primary leading-none`}>{number}</span>
    </div>
  );
}

interface NumberedStepsBubbleTextProps {
  data: NumberedStepsBubbleTextSection;
}

export default function NumberedStepsBubbleText({ data }: NumberedStepsBubbleTextProps) {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [expandedCard, setExpandedCard] = useState<number | null>(0);
  const steps = data.steps || [];

  const handleStepInteraction = (index: number) => {
    setActiveStep(index);
  };

  const toggleCard = (index: number) => {
    setExpandedCard(expandedCard === index ? null : index);
  };

  const getActiveContent = () => {
    if (!steps[activeStep]) return null;
    const step = steps[activeStep];
    return {
      title: step.title,
      text: step.text,
      bullets: step.bullets || [],
    };
  };

  const activeContent = getActiveContent();

  return (
    <section
      className={`py-16 ${data.background || "bg-muted/30"}`}
      data-testid="section-numbered-steps-bubble-text"
    >
      <div className="max-w-6xl mx-auto px-4">
        {data.title && (
          <h2
            className="text-3xl md:text-4xl font-bold mb-4 text-foreground text-center"
            data-testid="text-numbered-steps-title"
          >
            {data.title}
          </h2>
        )}

        {data.description && (
        <div className="text-center mb-4">
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto text-center mb-3">
            {data.description}
          </p>
          {data.description_link && (
            <a className="text-primary hover:underline text-base mt-2" href={data.description_link?.url} target="_blank" rel="noopener noreferrer">
              {data.description_link?.text}
            </a>
          )}
        </div>
        )}

        {/* Mobile & Tablet: Vertical cards layout */}
        <div className="lg:hidden">
          <div className="relative max-w-2xl mx-auto">
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              const number = String(index + 1).padStart(2, '0');

              return (
                <div
                  key={index}
                  className="flex gap-4 md:gap-6"
                  data-testid={`numbered-step-mobile-${index + 1}`}
                >
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg border-2 border-primary bg-primary/10 flex items-center justify-center flex-shrink-0 relative z-10">
                      <span className="text-lg md:text-xl font-bold text-primary">{number}</span>
                    </div>
                    {!isLast && (
                      <div className="w-0.5 flex-1 bg-primary/30 my-2" />
                    )}
                  </div>
                  <Card className={`flex-1 w-full ${isLast ? 'mb-0' : 'mb-4'}`}>
                    <CardContent className="!p-4">
                      <button
                        onClick={() => toggleCard(index)}
                        className="flex items-center justify-between w-full text-left"
                        aria-expanded={expandedCard === index}
                        data-testid={`button-toggle-step-${index + 1}`}
                      >
                        {step.title && (
                          <h3 className="text-lg font-semibold text-foreground">
                            {step.title}
                          </h3>
                        )}
                        <ChevronDown 
                          className={`w-5 h-5 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${
                            expandedCard === index ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      <div className={`overflow-hidden transition-all duration-300 ${
                        expandedCard === index ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'
                      }`}>
                        {step.text && (
                          <p className="text-muted-foreground">
                            {step.text}
                          </p>
                        )}

                        {step.bullets && step.bullets.length > 0 && (
                          <ul className="space-y-2 mt-3">
                            {step.bullets.map((bullet, bulletIndex) => (
                              <li
                                key={bulletIndex}
                                className="flex gap-2 items-start text-base text-muted-foreground"
                              >
                                <span className="text-primary flex-shrink-0 mt-0.5">•</span>
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop: CSS Grid Triangle layout with connectors */}
        <div className="hidden lg:block relative">
          {/* SVG Curved Connector Lines - Dotted */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            fill="none"
          >
            {/* Step 1 (bottom-left) to Step 2 (top-center) */}
            <path
              d="M 18 68 C 22 28, 44 19, 50 22"
              stroke="hsl(var(--primary) / 0.4)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="6 8"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
            {/* Step 2 (top-center) to Step 3 (bottom-right) */}
            <path
              d="M 50 22 C 56 19, 75 28, 80 68"
              stroke="hsl(var(--primary) / 0.4)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="6 8"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="relative grid grid-cols-[1fr_minmax(450px,2fr)_1fr] grid-rows-[auto_1fr] gap-4">
            {/* Step 2 - Top Center (row 1, col 2) - Title above, step number below */}
            {steps[1] && (
              <div
                className="col-start-2 row-start-1 flex flex-col items-center justify-center pb-6"
                data-testid="numbered-step-2"
              >
                <button
                  onClick={() => handleStepInteraction(1)}
                  onMouseEnter={() => setActiveStep(1)}
                  aria-label={steps[1].title || "Step 2"}
                  aria-expanded={activeStep === 1}
                  className={`group relative flex flex-col items-center gap-2 p-3 rounded-lg transition-all cursor-pointer ${
                    activeStep === 1 ? "scale-105" : "hover:scale-102"
                  }`}
                  data-active={activeStep === 1}
                  data-testid="button-numbered-step-2"
                >
                  {steps[1].title && (
                    <h3 className="relative z-10 text-lg font-semibold text-foreground leading-tight text-center max-w-[160px] transition-opacity group-data-[active=false]:opacity-40 group-hover:opacity-100">
                      {steps[1].title}
                    </h3>
                  )}
                  {/* Radial gradient fade - starts solid in center, fades outward to both sides */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-24 bg-[radial-gradient(ellipse_at_center,_hsl(var(--background))_0%,_hsl(var(--background)/0.8)_20%,_transparent_100%)] pointer-events-none" />
                  <div className="relative z-10 bg-background ps-2 pe-1 me-1">
                    <div className="transition-opacity group-data-[active=false]:opacity-40 group-hover:opacity-100">
                      <StepNumber index={1} size="md" />
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Step 1 - Bottom Left (row 2, col 1) - Title at left, step number at right */}
            {steps[0] && (
              <div
                className="col-start-1 row-start-2 flex items-center justify-end h-full mr-8"
                data-testid="numbered-step-1"
              >
                <button
                  onClick={() => handleStepInteraction(0)}
                  onMouseEnter={() => setActiveStep(0)}
                  aria-label={steps[0].title || "Step 1"}
                  aria-expanded={activeStep === 0}
                  className={`group relative flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${
                    activeStep === 0 ? "scale-105" : "hover:scale-102"
                  }`}
                  data-active={activeStep === 0}
                  data-testid="button-numbered-step-1"
                >
                  {/* Gradient fade for line - vertical fade */}
                  <div className="absolute -right-12 -top-16 w-24 h-48 bg-gradient-to-t from-background via-background/100 to-transparent pointer-events-none" />
                  {steps[0].title && (
                    <h3 className="relative text-lg font-semibold text-foreground leading-tight max-w-[140px] text-right transition-opacity group-data-[active=false]:opacity-40 group-hover:opacity-100">
                      {steps[0].title}
                    </h3>
                  )}
                  <div className="relative bg-background py-1">
                    <div className="transition-opacity group-data-[active=false]:opacity-40 group-hover:opacity-100">
                      <StepNumber index={0} size="md" />
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Center Content - row 2, col 2 - No background, just arrow indicator */}
            <div
              className="col-start-2 row-start-2 flex items-center justify-center"
            >
              <div
                className="relative p-10 w-full max-w-[420px] min-h-[200px] lg:min-h-[280px] flex flex-col items-center justify-center text-center"
                data-testid="bubble-content"
              >
                {/* Arrow indicator - simple 2-line outline chevron */}
                {activeStep === 0 && (
                  <svg className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-6" viewBox="0 0 16 24" fill="none">
                    <path d="M12 4 L4 12 L12 20" stroke="hsl(var(--primary) / 0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {activeStep === 1 && (
                  <svg className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-4" viewBox="0 0 24 16" fill="none">
                    <path d="M4 12 L12 4 L20 12" stroke="hsl(var(--primary) / 0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {activeStep === 2 && (
                  <svg className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-6" viewBox="0 0 16 24" fill="none">
                    <path d="M4 4 L12 12 L4 20" stroke="hsl(var(--primary) / 0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {activeContent && (
                  <div key={activeStep} className="animate-in fade-in duration-300">
                    {activeContent.title && (
                      <h4 className="text-xl font-semibold text-foreground mb-4 flex items-center justify-center gap-2">
                        <span className="text-primary font-bold text-2xl">
                          {String(activeStep + 1).padStart(2, "0")}
                        </span>
                        {activeContent.title}
                      </h4>
                    )}
                    {activeContent.text && (
                      <p className="text-muted-foreground mb-4 text-base">{activeContent.text}</p>
                    )}
                    {activeContent.bullets.length > 0 && (
                      <ul className="space-y-3 text-left">
                        {activeContent.bullets.map((bullet, bulletIndex) => (
                          <li
                            key={bulletIndex}
                            className="flex gap-2 items-start text-base text-muted-foreground"
                          >
                            <span className="text-foreground flex-shrink-0 mt-1">•</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 3 - Bottom Right (row 2, col 3) - Step number and title at right */}
            {steps[2] && (
              <div
                className="col-start-3 row-start-2 flex items-center justify-start h-full ml-4"
                data-testid="numbered-step-3"
              >
                <button
                  onClick={() => handleStepInteraction(2)}
                  onMouseEnter={() => setActiveStep(2)}
                  aria-label={steps[2].title || "Step 3"}
                  aria-expanded={activeStep === 2}
                  className={`group relative flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${
                    activeStep === 2 ? "scale-105" : "hover:scale-102"
                  }`}
                  data-active={activeStep === 2}
                  data-testid="button-numbered-step-3"
                >
                  {/* Gradient fade for line - vertical fade */}
                  <div className="absolute -left-12 -top-16 w-24 h-48 bg-gradient-to-t from-background via-background/100 to-transparent pointer-events-none" />
                  <div className="relative bg-background py-1">
                    <div className="transition-opacity group-data-[active=false]:opacity-40 group-hover:opacity-100">
                      <StepNumber index={2} size="md" />
                    </div>
                  </div>
                  {steps[2].title && (
                    <h3 className="relative text-lg font-semibold text-foreground leading-tight max-w-[140px] text-left transition-opacity group-data-[active=false]:opacity-40 group-hover:opacity-100">
                      {steps[2].title}
                    </h3>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
