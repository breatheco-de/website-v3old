import { useState, useEffect, useRef, useCallback } from "react";
import type { CertificateSection as CertificateSectionType } from "@shared/schema";
import { CertificateDisplay } from "../CertificateDisplay";
import { cn } from "@/lib/utils";
import { resolveTemplateFallback, hasTemplateVariables } from "@/lib/variable-manager";

interface ParsedValue {
  prefix: string;
  number1: number | null;
  separator: string;
  number2: number | null;
  suffix: string;
  isRange: boolean;
  hasNumber: boolean;
  formatted1: (n: number) => string;
  formatted2: (n: number) => string;
}

function parseStatValue(value: string): ParsedValue {
  const rangeMatch = value.match(/^([^\d]*?)(\d[\d,]*)\s*(-)\s*(\d[\d,]*)(.*)$/);
  if (rangeMatch) {
    const num1 = parseInt(rangeMatch[2].replace(/,/g, ''), 10);
    const num2 = parseInt(rangeMatch[4].replace(/,/g, ''), 10);
    const hasComma1 = rangeMatch[2].includes(',');
    const hasComma2 = rangeMatch[4].includes(',');
    return {
      prefix: rangeMatch[1],
      number1: num1,
      separator: rangeMatch[3],
      number2: num2,
      suffix: rangeMatch[5],
      isRange: true,
      hasNumber: true,
      formatted1: (n: number) => hasComma1 ? n.toLocaleString() : String(n),
      formatted2: (n: number) => hasComma2 ? n.toLocaleString() : String(n),
    };
  }

  const singleMatch = value.match(/^([^\d]*?)(\d[\d,]*)(.*)$/);
  if (singleMatch) {
    const num = parseInt(singleMatch[2].replace(/,/g, ''), 10);
    const hasComma = singleMatch[2].includes(',');
    return {
      prefix: singleMatch[1],
      number1: num,
      separator: '',
      number2: null,
      suffix: singleMatch[3],
      isRange: false,
      hasNumber: true,
      formatted1: (n: number) => hasComma ? n.toLocaleString() : String(n),
      formatted2: () => '',
    };
  }

  return {
    prefix: value,
    number1: null,
    separator: '',
    number2: null,
    suffix: '',
    isRange: false,
    hasNumber: false,
    formatted1: () => '',
    formatted2: () => '',
  };
}

function useCountUp(target: number | null, duration: number, shouldAnimate: boolean): number {
  const [current, setCurrent] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldAnimate || target === null) {
      setCurrent(target ?? 0);
      return;
    }

    setCurrent(0);
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 5);
      setCurrent(Math.round(eased * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration, shouldAnimate]);

  return current;
}

function AnimatedStatValue({ value, shouldAnimate }: { value: string; shouldAnimate: boolean }) {
  const isTemplate = hasTemplateVariables(value);
  const numericValue = isTemplate ? resolveTemplateFallback(value) : value;
  const parsed = parseStatValue(numericValue);
  const count1 = useCountUp(parsed.number1, 1500, shouldAnimate && parsed.hasNumber && !isTemplate);
  const count2 = useCountUp(parsed.number2, 1500, shouldAnimate && parsed.isRange && !isTemplate);

  if (isTemplate) {
    return <>{value}</>;
  }

  if (!parsed.hasNumber) {
    return <>{value}</>;
  }

  if (parsed.isRange) {
    return (
      <>
        {parsed.prefix}
        {parsed.formatted1(count1)}
        {parsed.separator}
        {parsed.formatted2(count2)}
        {parsed.suffix}
      </>
    );
  }

  return (
    <>
      {parsed.prefix}
      {parsed.formatted1(count1)}
      {parsed.suffix}
    </>
  );
}

interface CertificateSectionProps {
  data: CertificateSectionType;
}

export function CertificateSection({ data }: CertificateSectionProps) {
  const [selectedStatIndex, setSelectedStatIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(true); // Start as true so first stat is selected
  const [isVisible, setIsVisible] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mediaQuery.matches);
    // On desktop, start with no selection until hover
    if (mediaQuery.matches) {
      setHasInteracted(false);
    }
    const handler = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
      // Reset interaction state based on device
      setHasInteracted(!e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting && !isVisible) {
      setIsVisible(true);
    }
  }, [isVisible]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.3,
      rootMargin: '0px',
    });

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => observer.disconnect();
  }, [handleIntersection]);

  const selectedStat = data.stats?.[selectedStatIndex];
  const displayDescription = selectedStat?.description || data.description;
  const displayBenefits = selectedStat?.benefits || data.benefits || [];

  return (
    <section 
      data-testid="section-certificate"
    >
      <div className="max-w-6xl mx-auto px-4">
        <h2 
          className="text-h2 mb-10 text-foreground text-center"
          data-testid="text-certificate-title"
        >
          {data.title}
        </h2>

        {data.stats && data.stats.length > 0 && (
          <div 
            ref={statsRef}
            className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-6 mb-8 md:mb-12"
            data-testid="certificate-stats"
          >
            {data.stats.map((stat, index) => (
              <div 
                key={index}
                onMouseEnter={() => {
                  if (isDesktop) {
                    setSelectedStatIndex(index);
                    if (!hasInteracted) {
                      setHasInteracted(true);
                    }
                  }
                }}
                onClick={() => {
                  if (!isDesktop) {
                    setSelectedStatIndex(index);
                    if (!hasInteracted) {
                      setHasInteracted(true);
                    }
                  }
                }}
                className={cn(
                  "text-center p-2 md:p-4 transition-all duration-brand ease-brand cursor-pointer",
                  hasInteracted && selectedStatIndex === index && "scale-[1.2] md:scale-[1.25]",
                  hasInteracted && selectedStatIndex !== index && "hover:bg-muted/50 opacity-50"
                )}
                data-testid={`stat-${index}`}
              >
                <div className="text-2xl md:text-3xl lg:text-h2 font-bold font-heading text-primary mb-1">
                  <AnimatedStatValue value={stat.value} shouldAnimate={isVisible} />
                </div>
                <div className="text-sm md:text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {data.card && (
          <CertificateDisplay
            programName={data.card.program_name || data.card.title}
            description={displayDescription}
            benefits={displayBenefits}
            certificate_position={data.certificate_position || "left"}
            iconSetIndex={selectedStatIndex}
            useSolidCard={data.useSolidCard}
          />
        )}
      </div>
    </section>
  );
}
