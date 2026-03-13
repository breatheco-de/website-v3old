import Marquee from "@/lib/marquee";
import { useState, useEffect } from "react";

function parseLogoHeight(value?: string): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

export interface AwardsMarqueeItem {
  id: string;
  logo?: string;
  alt: string;
  logoHeight?: string;
  source?: string;
  name?: string;
  year?: string;
}

interface AwardsMarqueeProps {
  items: AwardsMarqueeItem[];
  speed?: number;
  gradient?: boolean;
  gradientColor?: string;
  gradientWidth?: number;
  bottom_title?: string;
  className?: string;
  title?: string;
  title_above_carousel?: boolean;
}

export function AwardsMarquee({ 
  items, 
  speed = 40,
  gradient = true,
  gradientColor,
  gradientWidth = 100,
  bottom_title,
  className = "",
  title,
  title_above_carousel = false,
}: AwardsMarqueeProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  const responsiveGradientWidth = isDesktop ? gradientWidth : Math.min(gradientWidth, 30);
  
  if (!items || items.length === 0) return null;

  const titleBlock = title ? (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <p className="text-body text-muted-foreground max-w-3xl mx-auto text-center" dangerouslySetInnerHTML={{ __html: title }} />
    </div>
  ) : null;

  return (
    <section className="max-w-6xl mx-auto">
      {title_above_carousel && titleBlock}
      <div className={`${className} px-4`} data-testid="awards-marquee">
        <Marquee
          speed={speed}
          pauseOnHover={false}
          gradient={gradient}
          gradientColor={gradientColor}
          gradientWidth={responsiveGradientWidth}
          autoFill={true}
        >
          {items.map((item, index) => (
            <div 
              key={item.id}
              className="flex items-center justify-center mx-4 transition-opacity duration-brand ease-brand hover:opacity-80"
              data-testid={`marquee-item-${index}`}
            >
              {item.logo ? (
                <img 
                  src={item.logo} 
                  alt={item.alt}
                  style={{ height: parseLogoHeight(item.logoHeight) || 48 }}
                  className="w-auto object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="flex flex-col items-center text-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {item.source} {item.year && `${item.year}`}
                  </span>
                  <span className="text-sm font-medium text-foreground mt-0.5">
                    {item.name}
                  </span>
                </div>
              )}
            </div>
          ))}
        </Marquee>
      </div>
      {!title_above_carousel && titleBlock}
    </section>
  );
}

export default AwardsMarquee;
