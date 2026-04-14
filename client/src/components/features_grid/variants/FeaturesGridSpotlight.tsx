
import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from "react";
import type { FeaturesGridSpotlightSection, FeaturesGridHighlightItem } from "@shared/schema";
import { Card } from "@/components/ui/card";
import * as TablerIcons from "@tabler/icons-react";
import { getCustomIcon } from "@/components/custom-icons";
import { DotsIndicator } from "@/components/DotsIndicator";
import type { ComponentType } from "react";

function getIcon(iconName: string, className?: string, color?: string) {
  const CustomIcon = getCustomIcon(iconName);
  if (CustomIcon) {
    return <CustomIcon width="100%" height="100%" color={color} className={className} />;
  }
  
  // Handle both "IconRocket" and "Rocket" formats
  const tablerName = iconName.startsWith("Icon") ? iconName : `Icon${iconName}`;
  const IconComponent = TablerIcons[tablerName as keyof typeof TablerIcons] as ComponentType<{ className?: string; style?: React.CSSProperties }>;
  if (IconComponent) {
    const style = color ? { color } : undefined;
    return <IconComponent className={className || "w-full h-full text-primary"} style={style} />;
  }
  const style = color ? { color } : undefined;
  return <TablerIcons.IconBox className={className || "w-full h-full text-primary"} style={style} />;
}

interface SpotlightCardProps {
  item: FeaturesGridHighlightItem;
  iconColor?: string;
  isActive: boolean;
  onActivate: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function SpotlightCard({ 
  item, 
  iconColor, 
  isActive, 
  onActivate,
  onMouseEnter,
  onMouseLeave,
}: SpotlightCardProps) {
  const itemId = item.id || item.title.toLowerCase().replace(/\s+/g, '-');
  
  return (
    <Card 
      className={`
        p-4 md:p-5 cursor-pointer outline-none border-0 rounded-card
        transition-all duration-brand ease-brand
        ${isActive 
          ? 'bg-card shadow-card scale-[1.02]' 
          : 'bg-muted/30 opacity-70 hover:opacity-90'
        }
      `}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onActivate}
      data-testid={`card-spotlight-${itemId}`}
      data-active={isActive}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
          {getIcon(item.icon, "w-full h-full", iconColor)}
        </div>
        
        <div className="flex-1 min-w-0">
          {item.value && (
            <div className="font-bold text-foreground text-xl md:text-2xl font-heading">
              {item.value}
            </div>
          )}
          
          <div className="text-muted-foreground text-sm">
            {item.title}
          </div>
        </div>
      </div>
    </Card>
  );
}

interface FeaturesGridSpotlightProps {
  data: FeaturesGridSpotlightSection;
}

export default function FeaturesGridSpotlight({ data }: FeaturesGridSpotlightProps) {
  const config = data.spotlight_config || {};
  const initialIndex = config.initial_index ?? 0;
  const autoRotateMs = 0;
  const pauseOnHover = config.pause_on_hover ?? true;
  
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const itemCount = data.items.length;
  const columns = data.columns || 3;
  
  const gridColsClass = {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  }[columns] || "md:grid-cols-3";

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (autoRotateMs <= 0 || itemCount < 2) return;
    
    clearTimer();
    intervalRef.current = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % itemCount);
    }, autoRotateMs);
  }, [autoRotateMs, itemCount, clearTimer]);

  useEffect(() => {
    if (!isPaused && autoRotateMs > 0 && itemCount >= 2) {
      startTimer();
    } else {
      clearTimer();
    }
    return () => clearTimer();
  }, [isPaused, startTimer, clearTimer, autoRotateMs, itemCount]);

  const handleMouseEnter = useCallback((index: number) => {
    if (pauseOnHover) {
      setIsPaused(true);
    }
    setActiveIndex(index);
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) {
      setIsPaused(false);
    }
  }, [pauseOnHover]);

  const handleActivate = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const handleDotClick = useCallback((index: number) => {
    setActiveIndex(index);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 100);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % itemCount);
      setIsPaused(true);
      setTimeout(() => setIsPaused(false), 3000);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + itemCount) % itemCount);
      setIsPaused(true);
      setTimeout(() => setIsPaused(false), 3000);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(itemCount - 1);
    }
  }, [itemCount]);

  const handleContainerFocus = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleContainerBlur = useCallback(() => {
    setIsPaused(false);
  }, []);

  return (
    <section 
      className={`${data.background || ''}`}
      data-testid="section-features-grid-spotlight"
      aria-label={data.title || "Feature highlights"}
      aria-roledescription="carousel"
    >
      <div className="max-w-6xl mx-auto px-4">
        {(data.title || data.subtitle) && (
          <div className="text-center mb-8">
            {data.title && (
              <h2 
                className="mb-6 text-foreground"
                data-testid="text-features-grid-title"
              >
                {data.title}
              </h2>
            )}
            {data.subtitle && (
              <p className="text-body text-muted-foreground max-w-3xl mx-auto" style={{ fontSize: '16px' }}>
                {data.subtitle}
              </p>
            )}
          </div>
        )}

        <div 
          ref={containerRef}
          className={`grid grid-cols-1 ${gridColsClass} gap-6 items-stretch outline-none py-4`}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onFocus={handleContainerFocus}
          onBlur={handleContainerBlur}
          role="group"
          aria-label={`Feature carousel, ${itemCount} items. Use arrow keys to navigate.`}
        >
          {data.items.map((item, index) => (
            <SpotlightCard 
              key={item.id || index} 
              item={item} 
              iconColor={item.icon_color || data.icon_color}
              isActive={index === activeIndex}
              onActivate={() => handleActivate(index)}
              onMouseEnter={() => handleMouseEnter(index)}
              onMouseLeave={handleMouseLeave}
            />
          ))}
        </div>
        
        <div className="mt-6">
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {`Showing item ${activeIndex + 1} of ${itemCount}: ${data.items[activeIndex]?.title}`}
          </div>
          <DotsIndicator
            count={itemCount}
            activeIndex={activeIndex}
            onDotClick={handleDotClick}
            ariaLabel="Slide indicators"
          />
        </div>
      </div>
    </section>
  );
}
