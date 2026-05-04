import { useMemo } from "react";
import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import {
  AVAILABLE_RELATED_FEATURES,
  MAX_FAQ_SECTION_TOPICS,
  MAX_RELATED_FEATURES,
  filterFaqsByRelatedFeatures,
  type RelatedFeature,
  type FaqItem,
} from "@/lib/faqConstants";

interface BankTestimonial {
  student_name: string;
  student_thumb?: string;
  student_video?: string;
  excerpt?: string;
  full_text?: string;
  content?: string;
  short_content?: string;
  related_features?: string[];
  priority?: number;
  rating?: number;
}

interface RelatedFeaturesPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  locale?: string;
  context?: "faq" | "testimonials";
}

function filterTestimonialsByFeatures(
  testimonials: BankTestimonial[],
  features: string[]
): BankTestimonial[] {
  return testimonials.filter((t) => {
    const tFeatures = t.related_features || [];
    return features.some((f) => tFeatures.includes(f));
  });
}

function isValidTestimonial(t: BankTestimonial): boolean {
  const hasRating = t.rating != null && t.rating > 0;
  const hasText = !!(t.excerpt || t.short_content || t.content || t.full_text);
  return hasRating || hasText;
}

export function RelatedFeaturesPicker({ value, onChange, locale = "en", context = "faq" }: RelatedFeaturesPickerProps) {
  const selectedFeatures = value || [];
  const isTestimonials = context === "testimonials";
  const maxSelection = context === "faq" ? MAX_FAQ_SECTION_TOPICS : MAX_RELATED_FEATURES;

  const { data: faqsData } = useQuery<{ faqs: FaqItem[] }>({
    queryKey: ["/api/faqs", locale],
    staleTime: 5 * 60 * 1000,
    enabled: !isTestimonials,
  });

  const { data: testimonialsData } = useQuery<{ testimonials: BankTestimonial[] }>({
    queryKey: ["/api/testimonials", locale],
    staleTime: 5 * 60 * 1000,
    enabled: isTestimonials,
  });

  const faqs = faqsData?.faqs ?? [];
  const testimonials = useMemo(() => {
    return (testimonialsData?.testimonials ?? []).filter(isValidTestimonial);
  }, [testimonialsData]);

  const featureCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const feature of AVAILABLE_RELATED_FEATURES) {
      if (isTestimonials) {
        counts[feature] = filterTestimonialsByFeatures(testimonials, [feature]).length;
      } else {
        counts[feature] = filterFaqsByRelatedFeatures(faqs, {
          relatedFeatures: [feature],
        }).length;
      }
    }

    return counts;
  }, [faqs, testimonials, isTestimonials]);

  const totalForSelection = useMemo(() => {
    if (selectedFeatures.length === 0) return 0;
    if (isTestimonials) {
      return filterTestimonialsByFeatures(testimonials, selectedFeatures).length;
    }
    return filterFaqsByRelatedFeatures(faqs, {
      relatedFeatures: selectedFeatures,
    }).length;
  }, [selectedFeatures, faqs, testimonials, isTestimonials]);

  const toggleFeature = (feature: RelatedFeature) => {
    if (selectedFeatures.includes(feature)) {
      onChange(selectedFeatures.filter(f => f !== feature));
    } else if (selectedFeatures.length < maxSelection) {
      onChange([...selectedFeatures, feature]);
    }
  };

  const formatLabel = (feature: string) => {
    return feature
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const label = isTestimonials ? "Topics" : "FAQ Topics";
  const itemLabel = isTestimonials ? "testimonials" : "FAQs";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground">
          {selectedFeatures.length}/{maxSelection} selected
          {totalForSelection > 0 && (
            <span className="ml-1 text-primary">({totalForSelection} {itemLabel})</span>
          )}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
        {AVAILABLE_RELATED_FEATURES.map((feature) => {
          const isSelected = selectedFeatures.includes(feature);
          const isDisabled = !isSelected && selectedFeatures.length >= maxSelection;
          const count = featureCounts[feature] || 0;

          return (
            <button
              key={feature}
              type="button"
              onClick={() => toggleFeature(feature)}
              disabled={isDisabled}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : isDisabled
                  ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              data-testid={`props-feature-${feature}`}
            >
              {isSelected && <Check className="h-3 w-3" />}
              <span>{formatLabel(feature)}</span>
              <span className={`text-[10px] ${isSelected ? "opacity-75" : "opacity-50"}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
