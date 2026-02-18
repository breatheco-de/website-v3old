import { useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { IconMessageCircle } from "@tabler/icons-react";
import type { FAQSection as FAQSectionType } from "@shared/schema";
import { useLocation as useWouterLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useInternalNav } from "@/hooks/useInternalNav";
import { filterFaqsByRelatedFeatures, type FaqItem } from "@/lib/faqConstants";

interface FAQSectionProps {
  data: FAQSectionType;
  programSlug?: string;
}

export function FAQSection({ data, programSlug }: FAQSectionProps) {
  const handleLinkClick = useInternalNav();
  const [pathname] = useWouterLocation();
  const { i18n } = useTranslation();
  const locale = i18n.language?.startsWith("es") ? "es" : "en";
  
  // Detect if we're on a location page and extract location slug
  const locationSlugMatch = pathname.match(/^\/(en|es)\/(location|ubicacion)\/([^/]+)/);
  const locationSlug = locationSlugMatch ? locationSlugMatch[3] : undefined;
  
  const hasInlineItems = data.items && data.items.length > 0;
  const hasRelatedFeatures = data.related_features && data.related_features.length > 0;
  
  const { data: faqsData, isLoading } = useQuery<{ faqs: FaqItem[] }>({
    queryKey: ["/api/faqs", locale],
    enabled: hasRelatedFeatures,
    staleTime: 5 * 60 * 1000,
  });
  
  const faqItems = useMemo(() => {
    if (hasRelatedFeatures && faqsData?.faqs) {
      return filterFaqsByRelatedFeatures(faqsData.faqs, {
        relatedFeatures: data.related_features!,
        location: locationSlug,
        limit: 9,
        programSlug,
      });
    }
    
    if (hasInlineItems) {
      return data.items!;
    }
    
    return [];
  }, [hasRelatedFeatures, hasInlineItems, data.related_features, data.items, faqsData, locationSlug, programSlug]);
  
  if (isLoading && hasRelatedFeatures) {
    return (
      <section data-testid="section-faq">
        <div className="max-w-6xl mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-10 w-64 bg-muted rounded mx-auto mb-8" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }
  
  if (faqItems.length === 0) {
    return null;
  }
  
  return (
    <section 
      data-testid="section-faq"
    >
      <div className="max-w-6xl mx-auto px-4">
        <h2 
          className="mb-8 text-center text-foreground text-[36px]"
          data-testid="text-faq-title"
        >
          {data.title}
        </h2>
        
        <div className="bg-background rounded-card border overflow-hidden">
          <Accordion type="single" collapsible>
            {faqItems.map((item, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="border-0 border-b last:border-b-0 px-6"
                data-testid={`accordion-faq-${index}`}
              >
                <AccordionTrigger 
                  className="text-left font-medium text-foreground hover:no-underline py-4 text-base"
                  data-testid={`button-faq-${index}`}
                >
                  {item.question}
                </AccordionTrigger>
                <AccordionContent 
                  className="text-muted-foreground pb-4 leading-relaxed whitespace-pre-line"
                  data-testid={`text-faq-answer-${index}`}
                >
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {data.cta && (data.cta.text || data.cta.button) && (
          <div 
            className="mt-12 text-center p-8 rounded-lg bg-muted/30 border"
            data-testid="faq-cta"
          >
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <IconMessageCircle size={24} className="text-primary" />
              </div>
            </div>
            {data.cta.text && (
              <p className="text-lg text-foreground mb-4">{data.cta.text}</p>
            )}
            {data.cta.button && (
              <Button asChild data-testid="button-faq-cta">
                <a href={data.cta.button.url} onClick={handleLinkClick} target="_blank" rel="noopener noreferrer">
                  {data.cta.button.label}
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
