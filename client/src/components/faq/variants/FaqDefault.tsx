import { useMemo } from "react";
import { MessageCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import type { FAQSection as FAQSectionType } from "@shared/schema";
import { useLocation as useWouterLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useInternalNav } from "@/hooks/useInternalNav";
import { filterFaqsByRelatedFeatures, faqItemKey, type FaqItem } from "@/lib/faqConstants";
import { useSession } from "@/contexts/SessionContext";
import { useSectionContext } from "@/contexts/SectionContext";

interface FAQSectionProps {
  data: FAQSectionType;
}

export function FAQSection({ data }: FAQSectionProps) {
  const { slug, contentType } = useSectionContext();
  const programSlug = contentType === "program" ? slug : undefined;
  const handleLinkClick = useInternalNav();
  const [pathname] = useWouterLocation();
  const { i18n } = useTranslation();
  const locale = i18n.language?.startsWith("es") ? "es" : "en";
  const { session } = useSession();
  const sessionLocationSlug = session.location?.slug;

  const locationSlugMatch = pathname.match(/^\/(en|es)\/(location|ubicacion)\/([^/]+)/);
  const locationSlug = locationSlugMatch ? locationSlugMatch[3] : undefined;

  const dynamicData = data as Record<string, unknown>;
  const permanentFilters = (dynamicData.dynamic_entries as Record<string, unknown> | undefined)?.permanent_filters as Record<string, unknown> | undefined;
  const relatedFeatures = (permanentFilters?.related_features as string[] | undefined) ?? (data.related_features as string[] | undefined);
  const hasRelatedFeatures = relatedFeatures && relatedFeatures.length > 0;

  const itemOverrides = (data as Record<string, unknown>).item_overrides as
    | Record<string, { hideOnLocations?: string[] }>
    | undefined;

  const { data: faqsData, isLoading } = useQuery<{ items: FaqItem[] }>({
    queryKey: ["/api/databases/frequently_asked_questions/items"],
    enabled: hasRelatedFeatures || !!locationSlug,
    staleTime: 5 * 60 * 1000,
  });

  const faqItems = useMemo(() => {
    const localeItems = (faqsData?.items ?? []).filter(f => f.locale === locale);

    let dbItems: Array<{ question: string; answer: string }> = [];
    if (localeItems.length > 0 && (hasRelatedFeatures || locationSlug)) {
      dbItems = filterFaqsByRelatedFeatures(localeItems, {
        relatedFeatures: locationSlug ? undefined : (hasRelatedFeatures ? relatedFeatures! : undefined),
        location: locationSlug,
        limit: 9,
        programSlug,
      });
    }

    let items: Array<{ question: string; answer: string }> = [
      ...dbItems,
      ...(data.items || []),
    ];

    if (itemOverrides && Object.keys(itemOverrides).length > 0) {
      const effectiveLocation = locationSlug || sessionLocationSlug;
      if (effectiveLocation) {
        items = items.filter((item) => {
          const key = faqItemKey(item.question);
          const override = itemOverrides[key];
          if (override?.hideOnLocations?.includes(effectiveLocation)) {
            return false;
          }
          return true;
        });
      }
    }

    return items;
  }, [hasRelatedFeatures, relatedFeatures, data.items, faqsData, locationSlug, programSlug, itemOverrides, sessionLocationSlug, locale]);

  if (isLoading && (hasRelatedFeatures || locationSlug)) {
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
      className="max-w-6xl mx-auto px-4"
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
                <MessageCircle size={24} className="text-primary" />
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

export default FAQSection;
