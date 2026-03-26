import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { UniversalImage } from "@/components/UniversalImage";
import { Button } from "@/components/ui/button";
import type { BulletTabsShowcaseSection } from "@shared/schema";

interface BulletTabsShowcaseProps {
  data: BulletTabsShowcaseSection;
}

export function BulletTabsShowcase({ data }: BulletTabsShowcaseProps) {
  const { heading, subheading, subheading_centered = true, variant = "withBigBorder", tabs, image_position = "right" } = data;
  const [activeIndex, setActiveIndex] = useState(0);
  const isWithoutBorder = variant === "withoutBorder";

  if (!tabs || tabs.length === 0) {
    return null;
  }

  const activeTab = tabs[activeIndex];

  const textContent = (
    <div className="flex flex-col justify-center">
      {subheading && !subheading_centered && (
        <p 
          className="text-muted-foreground mb-6 text-base md:text-lg"
          data-testid="text-bullet-tabs-subheading"
        >
          {subheading}
        </p>
      )}
      <div className="space-y-1">
        {tabs.map((tab, index) => (
          <div key={index} className="flex items-stretch gap-1">
            <div className="py-1 flex-shrink-0">
              <div 
                className={`w-1 h-full rounded-full transition-all duration-300 ${
                  activeIndex === index
                    ? "bg-primary"
                    : "bg-muted-foreground/20"
                }`}
              />
            </div>
            <Button
              variant="ghost"
              onClick={() => setActiveIndex(index)}
              className={`flex-1 justify-between text-left whitespace-normal py-2 transition-opacity duration-300 ${
                activeIndex === index ? "opacity-100" : "opacity-40"
              }`}
              data-testid={`button-bullet-tab-${index}`}
            >
              <p 
                className={`text-foreground font-normal whitespace-pre-line ${isWithoutBorder ? "text-base" : "text-lg"}`}
                data-testid={`text-bullet-tab-description-${index}`}
              >
                {tab.description || tab.label}
              </p>
              <span className="flex-shrink-0 ml-2 text-muted-foreground">
                {activeIndex === index
                  ? <ChevronDown className="h-4 w-4" />
                  : <ChevronRight className="h-4 w-4" />
                }
              </span>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  const imageStyle = activeTab.image_object_fit || activeTab.image_object_position ? {
    objectFit: activeTab.image_object_fit || "cover",
    objectPosition: activeTab.image_object_position || "center center",
  } as React.CSSProperties : undefined;

  const imageContent = (
    <div className="relative flex justify-center items-center">
      {isWithoutBorder ? (
        <div key={activeIndex} className="animate-in fade-in duration-300 min-h-[250px] md:min-h-[350px]">
          <UniversalImage
            id={activeTab.image_id}
            preset="full"
            className="w-full h-auto rounded-lg shadow-lg"
            alt={activeTab.label}
            style={imageStyle}
            fieldContext={{ arrayPath: "tabs", index: activeIndex, srcField: "image_id" }}
          />
        </div>
      ) : (
        <div
          className="relative bg-primary/30 rounded-2xl py-14 pl-4 flex justify-end items-center min-h-[300px] md:min-h-[400px] min-w-full"
          data-testid="bullet-tabs-image-container"
        >
          <div key={activeIndex} className="animate-in fade-in duration-300 w-[90%]">
            <UniversalImage
              id={activeTab.image_id}
              preset="full"
              className="w-full h-auto rounded-l-lg shadow-lg"
              alt={activeTab.label}
              style={imageStyle}
              fieldContext={{ arrayPath: "tabs", index: activeIndex, srcField: "image_id" }}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <section className="" data-testid="section-bullet-tabs-showcase">
      <div className="max-w-6xl mx-auto px-4">
        {(heading || (subheading && subheading_centered)) && (
          <div className="text-center mb-12">
            {heading && (
              <h2 
                className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground leading-tight"
                data-testid="text-bullet-tabs-heading"
              >
                {heading}
              </h2>
            )}
            {subheading && subheading_centered && (
              <p 
                className="text-muted-foreground mt-4 text-base md:text-lg max-w-4xl mx-auto"
                data-testid="text-bullet-tabs-subheading-centered"
              >
                {subheading}
              </p>
            )}
          </div>
        )}
        <div className={`grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-8 md:gap-12 ${
          image_position === "left" ? "md:grid-cols-[3fr_2fr]" : ""
        }`}>
          {image_position === "left" ? (
            <>
              <div className="md:col-start-1">{imageContent}</div>
              <div className="md:col-start-2">{textContent}</div>
            </>
          ) : (
            <>
              <div>{textContent}</div>
              <div>{imageContent}</div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default BulletTabsShowcase;
