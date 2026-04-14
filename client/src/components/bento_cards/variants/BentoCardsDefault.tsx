
import { Card } from "@/components/ui/card";
import * as TablerIcons from "@tabler/icons-react";
import { getCustomIcon } from "@/components/custom-icons";
import { useRef, useState, type ComponentType, type MouseEvent } from "react";
import type { BentoCardsSection } from "@shared/schema";

function getIcon(iconName: string, className?: string, color?: string) {
  const CustomIcon = getCustomIcon(iconName);
  if (CustomIcon) {
    return <CustomIcon width="100%" height="100%" color={color} className={className} />;
  }
  
  const IconComponent = TablerIcons[`Icon${iconName}` as keyof typeof TablerIcons] as ComponentType<{ className?: string; style?: React.CSSProperties }>;
  if (IconComponent) {
    const style = color ? { color } : undefined;
    return <IconComponent className={className || "w-full h-full text-primary"} style={style} />;
  }
  const style = color ? { color } : undefined;
  return <TablerIcons.IconBox className={className || "w-full h-full text-primary"} style={style} />;
}

interface BentoCardsProps {
  data: BentoCardsSection;
}

export default function BentoCards({ data }: BentoCardsProps) {
  const { title, subtitle, description, items, background } = data;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  if (!items || items.length === 0) {
    return null;
  }

  const numCycles = Math.ceil(items.length / 4);
  const totalColumns = numCycles * 3;

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <section
      className={`py-16 md:py-24 overflow-hidden ${background || ""}`}
      data-testid="section-bento-cards"
    >
      <div className="max-w-6xl mx-auto px-4 mb-10">
        {title && (
          <h2
            className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground leading-tight mb-3"
            data-testid="text-bento-cards-title"
          >
            {title}
          </h2>
        )}
        {subtitle && (
          <p
            className="text-lg font-semibold text-primary mb-3"
            data-testid="text-bento-cards-subtitle"
          >
            {subtitle}
          </p>
        )}
        {description && (
          <p
            className="text-muted-foreground text-base leading-relaxed max-w-3xl"
            data-testid="text-bento-cards-description"
          >
            {description}
          </p>
        )}
      </div>

      <div className="hidden lg:block">
        <div
          ref={scrollRef}
          className={`pl-4 overflow-x-auto scrollbar-hide ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{
            marginLeft: "max(1rem, calc(50vw - 576px))",
          }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          data-testid="bento-cards-scroll-container"
        >
          <div
            className="grid gap-5 select-none"
            style={{
              gridTemplateColumns: `repeat(${totalColumns}, minmax(320px, 380px))`,
              gridTemplateRows: "repeat(2, 260px)",
            }}
            data-testid="bento-cards-grid"
          >
            {items.map((item, index) => {
              const itemId =
                item.id || item.title.toLowerCase().replace(/\s+/g, "-");
              const gridConfig = getGridConfig(index);

              return (
                <Card
                  key={itemId}
                  className="p-8 flex flex-col bg-card border-border/50 hover-elevate transition-all duration-300"
                  style={{
                    gridColumn: gridConfig.colSpan,
                    gridRow: gridConfig.rowSpan,
                  }}
                  data-testid={`card-bento-${itemId}`}
                >
                  {item.icon && (
                    <div className="mb-5 w-10 h-10">
                      {getIcon(
                        item.icon,
                        "w-10 h-10",
                        item.icon_color || "hsl(var(--primary))"
                      )}
                    </div>
                  )}
                  <h3
                    className="font-semibold text-foreground text-lg mb-3"
                    data-testid={`text-bento-title-${itemId}`}
                  >
                    {item.title}
                  </h3>
                  {item.description && (
                    <p
                      className="text-sm text-muted-foreground leading-relaxed"
                      data-testid={`text-bento-desc-${itemId}`}
                    >
                      {item.description}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <div className="max-w-6xl mx-auto px-4">
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            data-testid="bento-cards-grid-mobile"
          >
            {items.map((item) => {
              const itemId =
                item.id || item.title.toLowerCase().replace(/\s+/g, "-");

              return (
                <Card
                  key={itemId}
                  className="p-5 flex flex-col bg-card border-border/50"
                  data-testid={`card-bento-mobile-${itemId}`}
                >
                  {item.icon && (
                    <div className="mb-3 w-6 h-6">
                      {getIcon(
                        item.icon,
                        "w-6 h-6",
                        item.icon_color || "hsl(var(--primary))"
                      )}
                    </div>
                  )}
                  <h3
                    className="font-semibold text-foreground text-sm mb-2"
                    data-testid={`text-bento-title-mobile-${itemId}`}
                  >
                    {item.title}
                  </h3>
                  {item.description && (
                    <p
                      className="text-xs text-muted-foreground line-clamp-3"
                      data-testid={`text-bento-desc-mobile-${itemId}`}
                    >
                      {item.description}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function getGridConfig(index: number): { colSpan: string; rowSpan: string } {
  const cycleIndex = Math.floor(index / 4);
  const positionInCycle = index % 4;
  const baseCol = cycleIndex * 3 + 1;

  switch (positionInCycle) {
    case 0:
      return { colSpan: `${baseCol} / ${baseCol + 1}`, rowSpan: "1 / 2" };
    case 1:
      return { colSpan: `${baseCol + 1} / ${baseCol + 2}`, rowSpan: "1 / 2" };
    case 2:
      return { colSpan: `${baseCol} / ${baseCol + 2}`, rowSpan: "2 / 3" };
    case 3:
      return { colSpan: `${baseCol + 2} / ${baseCol + 3}`, rowSpan: "1 / 3" };
    default:
      return { colSpan: "span 1", rowSpan: "span 1" };
  }
}
