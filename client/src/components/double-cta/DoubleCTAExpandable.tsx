import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UniversalImage } from "@/components/UniversalImage";
import type { DoubleCTASection, DoubleCTABox } from "@shared/schema";
import * as TablerIcons from "@tabler/icons-react";

function getTablerIcon(name: string) {
  const icons = TablerIcons as Record<string, any>;
  return icons[name] || icons[`Icon${name}`] || TablerIcons.IconCircleCheck;
}

type ActiveSide = "left" | "right";

interface DoubleCTAExpandableProps {
  data: DoubleCTASection;
}

function CTABox({
  box,
  isActive,
  isContentExpanded,
  onHover,
  side,
  "data-testid": testId,
}: {
  box: DoubleCTABox;
  isActive: boolean;
  isContentExpanded: boolean;
  onHover: () => void;
  side: ActiveSide;
  "data-testid"?: string;
}) {
  const hasBullets = box.bullets && box.bullets.length > 0;
  const hasImage = !!box.image_id;

  return (
    <Card
      className={cn(
        "relative flex flex-col overflow-hidden p-6 lg:p-8 transition-all duration-500 ease-in-out h-full",
        side == "right" ? "bg-primary/5" : "",
      )}
      onMouseEnter={onHover}
      data-testid={testId}
    >
      {box.heading && (
        <h3
          className={cn(
            "font-bold text-foreground transition-all duration-500 ease-in-out",
            isActive
              ? "text-xl md:text-2xl lg:text-3xl"
              : "opacity-50 text-base lg:text-3xl line-clamp-1",
            side == "right" ? "text-primary" : "",
          )}
          data-testid={`${testId}-heading`}
        >
          {box.heading}
        </h3>
      )}

      <div
        className={cn(
          "flex flex-col flex-1 transition-all duration-500 ease-in-out",
          isActive
            ? "opacity-100 max-h-[1000px] mt-3"
            : "opacity-50 max-h-[1000px] mt-3",
        )}
      >
        {box.image_beside_bullets ? (
          <>
            {box.description && (
              <p
                className={cn(
                  "text-sm md:text-base text-muted-foreground leading-relaxed mb-4",
                  isContentExpanded ? "" : "line-clamp-3",
                )}
                data-testid={`${testId}-description`}
              >
                {box.description}
              </p>
            )}

            {(hasBullets || hasImage) && (
              <div className="flex gap-4 mb-4 flex-1">
                {hasBullets && (
                  <div
                    className="flex flex-col gap-3 flex-1"
                    data-testid={`${testId}-bullets`}
                  >
                    {box.bullets!.map((bullet, i) => {
                      const IconComp = bullet.icon
                        ? getTablerIcon(bullet.icon)
                        : TablerIcons.IconCircleCheck;
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2.5"
                          data-testid={`${testId}-bullet-${i}`}
                        >
                          <Card className="flex-shrink-0 p-1 !rounded-lg">
                            <IconComp className="w-4 h-4 text-primary" />
                          </Card>
                          {bullet.text && (
                            <span className={cn("text-sm text-muted-foreground leading-snug", isContentExpanded ? "" : "line-clamp-1")}>
                              {bullet.text}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {hasImage && (
                  <div
                    className={cn(
                      "relative rounded-lg flex-shrink-0 transition-all duration-100 ease-in-out",
                      isActive
                        ? "w-[120px] md:w-[160px] lg:w-[40%] opacity-100"
                        : "w-0 opacity-0",
                    )}
                    data-testid={`${testId}-image`}
                  >
                    <UniversalImage
                      id={box.image_id!}
                      className="w-full h-full"
                      style={{
                        objectFit:
                          (box.image_object_fit as React.CSSProperties["objectFit"]) ||
                          "cover",
                        objectPosition: box.image_object_position || "center",
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex gap-4 mb-4 flex-1">
            <div className="flex flex-col flex-1 gap-4">
              {box.description && (
                <p
                  className={cn(
                    "text-sm md:text-base text-muted-foreground leading-relaxed",
                    isContentExpanded ? "" : "line-clamp-3",
                  )}
                  data-testid={`${testId}-description`}
                >
                  {box.description}
                </p>
              )}

              {hasBullets && (
                <div
                  className="flex flex-col gap-3"
                  data-testid={`${testId}-bullets`}
                >
                  {box.bullets!.map((bullet, i) => {
                    const IconComp = bullet.icon
                      ? getTablerIcon(bullet.icon)
                      : TablerIcons.IconCircleCheck;
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-2.5"
                        data-testid={`${testId}-bullet-${i}`}
                      >
                        <Card className="flex-shrink-0 p-1 !rounded-lg">
                          <IconComp className="w-4 h-4 text-primary" />
                        </Card>
                        {bullet.text && (
                          <span className={cn("text-sm text-muted-foreground leading-snug", isContentExpanded ? "" : "line-clamp-1")}>
                            {bullet.text}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {hasImage && (
              <div
                className={cn(
                  "relative rounded-lg flex-shrink-0 transition-all duration-100 ease-in-out",
                  isActive
                    ? "w-[120px] md:w-[160px] lg:w-[40%] opacity-100"
                    : "w-0 opacity-0",
                )}
                data-testid={`${testId}-image`}
              >
                <UniversalImage
                  id={box.image_id!}
                  className="w-full h-full"
                  style={{
                    objectFit:
                      (box.image_object_fit as React.CSSProperties["objectFit"]) ||
                      "cover",
                    objectPosition: box.image_object_position || "center",
                  }}
                />
              </div>
            )}
          </div>
        )}

        {box.cta_text && box.cta_url && (
        <div className="mt-auto">
          <a href={box.cta_url} data-testid={`${testId}-cta-link`}>
            <Button
              className="w-full"
              variant={
                box.cta_variant === "secondary"
                  ? "secondary"
                  : box.cta_variant === "outline"
                    ? "outline"
                    : "default"
              }
              data-testid={`${testId}-cta`}
            >
              {box.cta_text}
            </Button>
          </a>
          {box.sub_text && (
            <p
              className="text-xs text-muted-foreground text-center mt-2"
              data-testid={`${testId}-subtext`}
            >
              {box.sub_text}
            </p>
          )}
        </div>
        )}
      </div>
    </Card>
  );
}

export function DoubleCTAExpandable({ data }: DoubleCTAExpandableProps) {
  const { title, subtitle, left, right } = data;
  const [activeSide, setActiveSide] = useState<ActiveSide | null>(null);
  const [contentExpandedSide, setContentExpandedSide] = useState<ActiveSide | null>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const switchToSide = useCallback((side: ActiveSide) => {
    setActiveSide(side);
    if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
    setContentExpandedSide(null);
    contentTimerRef.current = setTimeout(() => {
      setContentExpandedSide(side);
    }, 400);
  }, []);

  useEffect(() => {
    return () => {
      if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (hasAnimated) return;
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setTimeout(() => {
            switchToSide("left");
            setHasAnimated(true);
          }, 600);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasAnimated, switchToSide]);

  const handleHoverLeft = useCallback(() => {
    switchToSide("left");
  }, [switchToSide]);

  const handleHoverRight = useCallback(() => {
    switchToSide("right");
  }, [switchToSide]);

  const isEqual = activeSide === null;

  return (
    <section
      ref={sectionRef}
      className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16"
      data-testid="section-double-cta"
    >
      {(title || subtitle) && (
        <div
          className="text-center mb-8 md:mb-12"
          data-testid="double-cta-header"
        >
          {title && (
            <h2
              className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground"
              data-testid="text-double-cta-title"
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p
              className="text-base md:text-lg text-muted-foreground mt-3 max-w-2xl mx-auto"
              data-testid="text-double-cta-subtitle"
            >
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 h-[400px]">
        {left && (
          <div
            className={cn(
              "transition-all duration-500 ease-in-out",
              "lg:min-w-0",
              isEqual
                ? "lg:flex-1"
                : activeSide === "left"
                  ? "lg:flex-[2]"
                  : "lg:flex-[0.8]",
            )}
            data-testid="double-cta-left-wrapper"
          >
            <CTABox
              box={left}
              isActive={isEqual || activeSide === "left"}
              isContentExpanded={isEqual || contentExpandedSide === "left"}
              onHover={handleHoverLeft}
              side="left"
              data-testid="card-double-cta-left"
            />
          </div>
        )}

        {right && (
          <div
            className={cn(
              "transition-all duration-100 ease-in-out",
              "lg:min-w-0",
              isEqual
                ? "lg:flex-1"
                : activeSide === "right"
                  ? "lg:flex-[2]"
                  : "lg:flex-[0.8]",
            )}
            data-testid="double-cta-right-wrapper"
          >
            <CTABox
              box={right}
              isActive={isEqual || activeSide === "right"}
              isContentExpanded={isEqual || contentExpandedSide === "right"}
              onHover={handleHoverRight}
              side="right"
              data-testid="card-double-cta-right"
            />
          </div>
        )}
      </div>
    </section>
  );
}
