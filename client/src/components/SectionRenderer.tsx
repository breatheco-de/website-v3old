import type { CSSProperties } from "react";
import { useState, useCallback, useMemo, useRef, useEffect, lazy, Suspense } from "react";
import type { Section, EditOperation, SectionLayout, ResponsiveSpacing, ShowOn } from "@shared/schema";

// ============================================
// Component Load Strategy Registry
// ============================================
// Eager: Above-the-fold, critical for first paint
// Lazy: Below-the-fold, can load after initial render

// EAGER components (imported directly)
import { Hero } from "@/components/hero/Hero";

// Spacing presets in pixels (top, bottom)
const SPACING_PRESETS: Record<string, { top: string; bottom: string }> = {
  none: { top: "0px", bottom: "0px" },
  sm: { top: "16px", bottom: "16px" },
  md: { top: "32px", bottom: "32px" },
  lg: { top: "64px", bottom: "64px" },
  xl: { top: "96px", bottom: "96px" },
};

// Resolve a single spacing value (preset name or custom CSS)
function resolveSpacingValue(val: string): string {
  const preset = SPACING_PRESETS[val];
  if (preset) return preset.top; // All presets have equal top/bottom
  return val; // Return as-is (custom CSS value like "20px")
}

// Parse a single breakpoint's spacing value - supports presets or custom CSS values
// Returns { top, bottom } for the given value string
function parseSpacingValue(value: string): { top: string; bottom: string } {
  // Check if it's a single preset
  if (SPACING_PRESETS[value]) {
    return SPACING_PRESETS[value];
  }

  // Parse two-value format (e.g., "lg xl" or "20px 32px")
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) {
    const resolved = resolveSpacingValue(parts[0]);
    return { top: resolved, bottom: resolved };
  }
  return { 
    top: resolveSpacingValue(parts[0]), 
    bottom: resolveSpacingValue(parts[1] || parts[0]) 
  };
}

// Parse responsive spacing object - returns mobile and desktop values
// Inheritance: if only one breakpoint is specified, the other inherits its value
function parseResponsiveSpacing(value: ResponsiveSpacing | undefined): {
  mobile: { top: string; bottom: string };
  desktop: { top: string; bottom: string };
} | null {
  if (!value) return null;

  // Handle inheritance: if one is missing, use the other's value
  const mobileValue = value.mobile ?? value.desktop ?? "none";
  const desktopValue = value.desktop ?? value.mobile ?? "none";

  return {
    mobile: parseSpacingValue(mobileValue),
    desktop: parseSpacingValue(desktopValue),
  };
}

// Default spacing when YAML doesn't specify values
const DEFAULT_SPACING = { top: "0px", bottom: "0px" };

// Semantic background tokens mapped to CSS variables
const BACKGROUND_TOKENS: Record<string, string> = {
  background: "hsl(var(--background))",
  muted: "hsl(var(--muted))",
  card: "hsl(var(--card))",
  accent: "hsl(var(--accent))",
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  sidebar: "hsl(var(--sidebar-background))",
  destructive: "hsl(var(--destructive))",
};

// Parse background value - supports semantic tokens or custom CSS
function parseBackground(value: string | undefined): string | undefined {
  if (!value || value === "inherit" || value === "none") return undefined;

  // Check if it's a semantic token
  if (BACKGROUND_TOKENS[value]) {
    return BACKGROUND_TOKENS[value];
  }

  // Return as-is for custom values (gradients, colors, etc.)
  return value;
}

// Get section layout styles - applies responsive spacing from YAML or defaults
// Uses CSS custom properties + media query for responsive behavior
// paddingY: Applied to wrapper (for sections that DON'T have internal content padding)
// marginY: Applied to wrapper (for spacing between sections)
// background: Applied to wrapper (semantic token or custom CSS)
function getSectionLayoutStyles(section: Section): CSSProperties & Record<string, string> {
  const layoutSection = section as SectionLayout;

  const padding = parseResponsiveSpacing(layoutSection.paddingY);
  const margin = parseResponsiveSpacing(layoutSection.marginY);
  const background = parseBackground(layoutSection.background);

  // Use CSS custom properties for responsive values
  // Global CSS will handle the media query switching via .section-wrapper class
  const styles: CSSProperties & Record<string, string> = {
    // Apply using the responsive CSS variables set by media query in index.css
    paddingTop: 'var(--section-pt)',
    paddingBottom: 'var(--section-pb)',
    marginTop: 'var(--section-mt)',
    marginBottom: 'var(--section-mb)',
  };

  // Set CSS custom properties (index signature for custom properties)
  styles['--section-pt-mobile'] = padding?.mobile.top ?? DEFAULT_SPACING.top;
  styles['--section-pb-mobile'] = padding?.mobile.bottom ?? DEFAULT_SPACING.bottom;
  styles['--section-mt-mobile'] = margin?.mobile.top ?? DEFAULT_SPACING.top;
  styles['--section-mb-mobile'] = margin?.mobile.bottom ?? DEFAULT_SPACING.bottom;
  styles['--section-pt-desktop'] = padding?.desktop.top ?? DEFAULT_SPACING.top;
  styles['--section-pb-desktop'] = padding?.desktop.bottom ?? DEFAULT_SPACING.bottom;
  styles['--section-mt-desktop'] = margin?.desktop.top ?? DEFAULT_SPACING.top;
  styles['--section-mb-desktop'] = margin?.desktop.bottom ?? DEFAULT_SPACING.bottom;

  if (background) {
    styles.background = background;
  }

  return styles;
}

// Get CSS classes for section visibility based on showOn property
// Uses Tailwind responsive classes to show/hide sections at breakpoints
// mobile: hidden at md and up (>= 768px)
// desktop: hidden below md (< 768px)
// all or undefined: visible at all breakpoints
function getSectionVisibilityClasses(showOn: ShowOn | undefined): string {
  switch (showOn) {
    case 'mobile':
      return 'block md:hidden'; // Show on mobile, hide on desktop
    case 'desktop':
      return 'hidden md:block'; // Hide on mobile, show on desktop
    case 'all':
    default:
      return ''; // Visible on all breakpoints
  }
}
// EAGER components - commonly above the fold
import { FeaturesGrid } from "@/components/features-grid/FeaturesGrid";
import { AwardBadges } from "@/components/AwardBadges";
import { AwardsMarquee } from "@/components/AwardsMarquee";
import StatsSection from "@/components/StatsSection";

// LAZY components - typically below the fold, loaded on demand
const SyllabusSection = lazy(() => import("./SyllabusSection").then(m => ({ default: m.SyllabusSection })));
const ProjectsSection = lazy(() => import("./ProjectsSection").then(m => ({ default: m.ProjectsSection })));
const AILearningSection = lazy(() => import("./AILearningSection").then(m => ({ default: m.AILearningSection })));
const CertificateSection = lazy(() => import("./CertificateSection").then(m => ({ default: m.CertificateSection })));
const WhyLearnAISection = lazy(() => import("./why-learn-ai/WhyLearnAI").then(m => ({ default: m.WhyLearnAISection })));
const PricingSection = lazy(() => import("./PricingSection").then(m => ({ default: m.PricingSection })));
const FAQSection = lazy(() => import("./FAQSection").then(m => ({ default: m.FAQSection })));
const TestimonialsSection = lazy(() => import("./TestimonialsSection").then(m => ({ default: m.TestimonialsSection })));
const WhosHiring = lazy(() => import("@/components/whos-hiring/WhosHiring").then(m => ({ default: m.WhosHiring })));
const FooterSection = lazy(() => import("./FooterSection").then(m => ({ default: m.FooterSection })));
const TwoColumn = lazy(() => import("@/components/TwoColumn").then(m => ({ default: m.TwoColumn })));
const NumberedSteps = lazy(() => import("@/components/NumberedSteps"));
const TestimonialsSlide = lazy(() => import("@/components/TestimonialsSlide"));
const TestimonialsGrid = lazy(() => import("@/components/TestimonialsGrid").then(m => ({ default: m.TestimonialsGrid })));
const DynamicTable = lazy(() => import("@/components/DynamicTable").then(m => ({ default: m.DynamicTable })));
const PressMentions = lazy(() => import("@/components/PressMentions").then(m => ({ default: m.PressMentions })));
const ProgramsListSection = lazy(() => import("./ProgramsListSection").then(m => ({ default: m.ProgramsListSection })));
const CTABannerSection = lazy(() => import("./CTABannerSection").then(m => ({ default: m.CTABannerSection })));
const ProjectShowcase = lazy(() => import("@/components/ProjectShowcase").then(m => ({ default: m.ProjectShowcase })));
const About = lazy(() => import("@/components/About").then(m => ({ default: m.About })));
const ComparisonTable = lazy(() => import("@/components/ComparisonTable").then(m => ({ default: m.ComparisonTable })));
const GeeksVsOthersComparison = lazy(() => import("@/components/GeeksVsOthersComparison").then(m => ({ default: m.GeeksVsOthersComparison })));
const AwardsRow = lazy(() => import("@/components/AwardsRow"));
const HorizontalBars = lazy(() => import("@/components/HorizontalBars").then(m => ({ default: m.HorizontalBars })));
const VerticalBarsCards = lazy(() => import("@/components/VerticalBarsCards").then(m => ({ default: m.VerticalBarsCards })));
const PieCharts = lazy(() => import("@/components/PieCharts").then(m => ({ default: m.PieCharts })));
const LeadForm = lazy(() => import("@/components/LeadForm").then(m => ({ default: m.LeadForm })));
const ApplyFormSection = lazy(() => import("@/components/ApplyFormSection").then(m => ({ default: m.ApplyFormSection })));
const HumanAndAIDuo = lazy(() => import("@/components/HumanAndAIDuo").then(m => ({ default: m.HumanAndAIDuo })));
const FeaturesQuad = lazy(() => import("@/components/features-quad").then(m => ({ default: m.FeaturesQuad })));
const CommunitySupport = lazy(() => import("@/components/CommunitySupport").then(m => ({ default: m.CommunitySupport })));
const TwoColumnAccordionCard = lazy(() => import("@/components/two-column-accordion-card/TwoColumnAccordionCard").then(m => ({ default: m.TwoColumnAccordionCard })));
const BulletTabsShowcase = lazy(() => import("@/components/BulletTabsShowcase").then(m => ({ default: m.BulletTabsShowcase })));
const GraduatesStats = lazy(() => import("@/components/graduates_stats").then(m => ({ default: m.GraduatesStats })));
const ValueProofPanel = lazy(() => import("@/components/ValueProofPanel").then(m => ({ default: m.ValueProofPanel })));
const SplitCards = lazy(() => import("@/components/SplitCards").then(m => ({ default: m.SplitCards })));
const StickyCallToAction = lazy(() => import("@/components/StickyCallToAction").then(m => ({ default: m.StickyCallToAction })));
const BentoCards = lazy(() => import("@/components/bento-cards/BentoCards").then(m => ({ default: m.BentoCards })));
const Banner = lazy(() => import("@/components/Banner").then(m => ({ default: m.Banner })));
const FaqEditor = lazy(() => import("@/components/FaqEditor").then(m => ({ default: m.FaqEditor })));
const ImageRow = lazy(() => import("@/components/sections/ImageRow"));
const CourseSelector = lazy(() => import("@/components/course-selector/CourseSelector").then(m => ({ default: m.CourseSelector })));
const ArticleSection = lazy(() => import("@/components/Article").then(m => ({ default: m.Article })));
const PartnershipCarousel = lazy(() => import("@/components/partnership-carousel/PartnershipCarousel").then(m => ({ default: m.PartnershipCarousel })));
const CareerSupportExplain = lazy(() => import("@/components/career-support-explain/CareerSupportExplain"));
const ProfilesCarousel = lazy(() => import("@/components/profiles-carousel/ProfilesCarousel"));

import { EditableSection } from "@/components/editing/EditableSection";
import { AddSectionButton } from "@/components/editing/AddSectionButton";
import ComponentPickerModal from "@/components/editing/ComponentPickerModal";
import { useToast } from "@/hooks/use-toast";
import { getDebugToken } from "@/hooks/useDebugAuth";
import { emitContentUpdated } from "@/lib/contentEvents";
import { useEditModeOptional, type PreviewBreakpoint } from "@/contexts/EditModeContext";

// Check if a section should be visible based on showOn and current preview breakpoint
// In edit mode: always show all sections (visibility alert is shown instead of hiding)
// In production: CSS handles visibility
function shouldShowSection(showOn: ShowOn | undefined, previewBreakpoint: PreviewBreakpoint | undefined, isEditMode: boolean): boolean {
  // In edit mode, always show all sections (EditableSection will display visibility alerts)
  if (isEditMode) return true;

  // In production, always return true - CSS classes handle responsive visibility
  return true;
}

// Loading fallback for lazy sections
function SectionSkeleton() {
  return (
    <div className="w-full py-16 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-4 w-96 bg-muted rounded" />
        <div className="h-4 w-80 bg-muted rounded" />
      </div>
    </div>
  );
}

interface SectionRendererProps {
  sections: Section[];
  contentType?: "program" | "landing" | "location" | "page";
  slug?: string;
  locale?: string;
  programSlug?: string;
  landingLocations?: string[];
}

function EmptyPageState({ 
  isEditMode, 
  locale, 
  contentType, 
  slug 
}: { 
  isEditMode: boolean; 
  locale?: string; 
  contentType?: "program" | "landing" | "location" | "page";
  slug?: string;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div 
      className="min-h-[60vh] flex items-center justify-center"
      data-testid="empty-sections-state"
    >
      {isEditMode ? (
        <>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-center space-y-4 p-8 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer"
            data-testid="button-add-first-section"
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">
                {locale === "es" ? "Esta página está vacía" : "This page is empty"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === "es" 
                  ? "Haz clic aquí para agregar tu primera sección" 
                  : "Click here to add your first section"}
              </p>
            </div>
          </button>
          {isModalOpen && (
            <ComponentPickerModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              insertIndex={0}
              contentType={contentType}
              slug={slug}
              locale={locale}
            />
          )}
        </>
      ) : (
        <div className="text-center p-8">
          <p className="text-muted-foreground">
            {locale === "es" ? "Contenido próximamente" : "Content coming soon"}
          </p>
        </div>
      )}
    </div>
  );
}

async function sendEditOperation(
  contentType: string,
  slug: string,
  locale: string,
  operations: EditOperation[]
): Promise<{ success: boolean; error?: string }> {
  const token = getDebugToken();
  const response = await fetch("/api/content/edit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body: JSON.stringify({ contentType, slug, locale, operations }),
  });
  return response.json();
}

// Wrapper for lazy-loaded sections
function LazySection({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<SectionSkeleton />}>{children}</Suspense>;
}

export function renderSection(section: Section, index: number, landingLocations?: string[], programSlug?: string): React.ReactNode {
  const sectionType = (section as { type: string }).type;

  switch (sectionType) {
    // EAGER components - no Suspense needed
    case "hero":
      return <Hero key={index} data={section as Parameters<typeof Hero>[0]["data"]} landingLocations={landingLocations} />;
    case "features_grid":
      return <FeaturesGrid key={index} data={section as Parameters<typeof FeaturesGrid>[0]["data"]} />;
    case "stats":
      return <StatsSection key={index} data={section as Parameters<typeof StatsSection>[0]["data"]} />;
    case "award_badges": {
      const badgeSection = section as unknown as { items?: unknown[]; variant?: "simple" | "detailed"; showBorder?: boolean };
      if (!Array.isArray(badgeSection.items) || badgeSection.items.length === 0) {
        if (process.env.NODE_ENV === "development") {
          console.warn("award_badges section missing required 'items' array");
        }
        return null;
      }
      const validItems = badgeSection.items.filter((item): item is Parameters<typeof AwardBadges>[0]["items"][number] => 
        typeof item === "object" && item !== null && "id" in item && "alt" in item
      );
      if (validItems.length === 0) {
        if (process.env.NODE_ENV === "development") {
          console.warn("award_badges section has no valid items (each item requires 'id' and 'alt')");
        }
        return null;
      }
      return <AwardBadges key={index} items={validItems} variant={badgeSection.variant} showBorder={badgeSection.showBorder} />;
    }
    case "awards_marquee": {
      const marqueeSection = section as unknown as { items?: unknown[]; speed?: number; gradient?: boolean; gradientWidth?: number; bottom_title?: string };
      if (!Array.isArray(marqueeSection.items) || marqueeSection.items.length === 0) {
        if (process.env.NODE_ENV === "development") {
          console.warn("awards_marquee section missing required 'items' array");
        }
        return null;
      }
      const validItems = marqueeSection.items.filter((item): item is Parameters<typeof AwardsMarquee>[0]["items"][number] => 
        typeof item === "object" && item !== null && "id" in item && "alt" in item
      );
      if (validItems.length === 0) {
        if (process.env.NODE_ENV === "development") {
          console.warn("awards_marquee section has no valid items (each item requires 'id' and 'alt')");
        }
        return null;
      }
      return (
        <AwardsMarquee 
          key={index} 
          items={validItems} 
          speed={marqueeSection.speed}
          gradient={marqueeSection.gradient}
          gradientWidth={marqueeSection.gradientWidth}
          bottom_title={marqueeSection.bottom_title}
        />
      );
    }

    // LAZY components - wrapped in Suspense
    case "syllabus":
      return <LazySection key={index}><SyllabusSection data={section as Parameters<typeof SyllabusSection>[0]["data"]} /></LazySection>;
    case "projects":
      return <LazySection key={index}><ProjectsSection data={section as Parameters<typeof ProjectsSection>[0]["data"]} /></LazySection>;
    case "ai_learning":
      return <LazySection key={index}><AILearningSection data={section as Parameters<typeof AILearningSection>[0]["data"]} /></LazySection>;
    case "certificate":
      return <LazySection key={index}><CertificateSection data={section as Parameters<typeof CertificateSection>[0]["data"]} /></LazySection>;
    case "why_learn_ai":
      return <LazySection key={index}><WhyLearnAISection data={section as Parameters<typeof WhyLearnAISection>[0]["data"]} /></LazySection>;
    case "pricing":
      return <LazySection key={index}><PricingSection data={section as Parameters<typeof PricingSection>[0]["data"]} /></LazySection>;
    case "faq":
      return <LazySection key={index}><FAQSection data={section as Parameters<typeof FAQSection>[0]["data"]} programSlug={programSlug} /></LazySection>;
    case "testimonials":
      return <LazySection key={index}><TestimonialsSection data={section as Parameters<typeof TestimonialsSection>[0]["data"]} /></LazySection>;
    case "whos_hiring":
      return <LazySection key={index}><WhosHiring data={section as Parameters<typeof WhosHiring>[0]["data"]} /></LazySection>;
    case "footer":
      return <LazySection key={index}><FooterSection data={section as Parameters<typeof FooterSection>[0]["data"]} /></LazySection>;
    case "two_column":
      return <LazySection key={index}><TwoColumn data={section as Parameters<typeof TwoColumn>[0]["data"]} /></LazySection>;
    case "human_and_ai_duo":
      return <LazySection key={index}><HumanAndAIDuo data={section as Parameters<typeof HumanAndAIDuo>[0]["data"]} /></LazySection>;
    case "features_quad":
      return <LazySection key={index}><FeaturesQuad data={section as Parameters<typeof FeaturesQuad>[0]["data"]} /></LazySection>;
    case "community_support":
      return <LazySection key={index}><CommunitySupport data={section as Parameters<typeof CommunitySupport>[0]["data"]} /></LazySection>;
    case "numbered_steps":
      return <LazySection key={index}><NumberedSteps data={section as Parameters<typeof NumberedSteps>[0]["data"]} /></LazySection>;
    case "testimonials_slide":
      return <LazySection key={index}><TestimonialsSlide data={section as Parameters<typeof TestimonialsSlide>[0]["data"]} /></LazySection>;
    case "testimonials_grid":
      return <LazySection key={index}><TestimonialsGrid data={section as Parameters<typeof TestimonialsGrid>[0]["data"]} /></LazySection>;
    case "dynamic_table":
      return <LazySection key={index}><DynamicTable data={section as Parameters<typeof DynamicTable>[0]["data"]} /></LazySection>;
    case "press_mentions":
      return <LazySection key={index}><PressMentions data={section as Parameters<typeof PressMentions>[0]["data"]} /></LazySection>;
    case "programs_list":
      return <LazySection key={index}><ProgramsListSection data={section as Parameters<typeof ProgramsListSection>[0]["data"]} /></LazySection>;
    case "cta_banner":
      return <LazySection key={index}><CTABannerSection data={section as Parameters<typeof CTABannerSection>[0]["data"]} landingLocations={landingLocations} /></LazySection>;
    case "project_showcase":
    case "projects_showcase":
      return <LazySection key={index}><ProjectShowcase data={section as Parameters<typeof ProjectShowcase>[0]["data"]} /></LazySection>;
    case "about":
      return <LazySection key={index}><About data={section as Parameters<typeof About>[0]["data"]} /></LazySection>;
    case "comparison_table":
      return <LazySection key={index}><ComparisonTable data={section as Parameters<typeof ComparisonTable>[0]["data"]} /></LazySection>;
    case "geeks_vs_others_comparison":
      return <LazySection key={index}><GeeksVsOthersComparison data={section as Parameters<typeof GeeksVsOthersComparison>[0]["data"]} /></LazySection>;
    case "awards_row":
      return <LazySection key={index}><AwardsRow data={section as Parameters<typeof AwardsRow>[0]["data"]} /></LazySection>;
    case "horizontal_bars":
      return <LazySection key={index}><HorizontalBars data={section as Parameters<typeof HorizontalBars>[0]["data"]} /></LazySection>;
    case "vertical_bars_cards":
      return <LazySection key={index}><VerticalBarsCards data={section as Parameters<typeof VerticalBarsCards>[0]["data"]} /></LazySection>;
    case "pie_charts":
      return <LazySection key={index}><PieCharts data={section as Parameters<typeof PieCharts>[0]["data"]} /></LazySection>;
    case "lead_form":
      return <LazySection key={index}><LeadForm data={section as Parameters<typeof LeadForm>[0]["data"]} landingLocations={landingLocations} /></LazySection>;
    case "two_column_accordion_card":
      return <LazySection key={index}><TwoColumnAccordionCard data={section as Parameters<typeof TwoColumnAccordionCard>[0]["data"]} /></LazySection>;
    case "bullet_tabs_showcase":
      return <LazySection key={index}><BulletTabsShowcase data={section as Parameters<typeof BulletTabsShowcase>[0]["data"]} /></LazySection>;
    case "graduates_stats":
      return <LazySection key={index}><GraduatesStats data={section as Parameters<typeof GraduatesStats>[0]["data"]} /></LazySection>;
    case "apply_form":
      return <LazySection key={index}><ApplyFormSection data={section as Parameters<typeof ApplyFormSection>[0]["data"]} landingLocations={landingLocations} /></LazySection>;
    case "value_proof_panel":
      return <LazySection key={index}><ValueProofPanel data={section as Parameters<typeof ValueProofPanel>[0]["data"]} /></LazySection>;
    case "split_cards":
      return <LazySection key={index}><SplitCards data={section as Parameters<typeof SplitCards>[0]["data"]} /></LazySection>;
    case "sticky_cta":
      return <LazySection key={index}><StickyCallToAction data={section as Parameters<typeof StickyCallToAction>[0]["data"]} landingLocations={landingLocations} /></LazySection>;
    case "bento_cards":
      return <LazySection key={index}><BentoCards data={section as Parameters<typeof BentoCards>[0]["data"]} /></LazySection>;
    case "banner":
      return <LazySection key={index}><Banner data={section as Parameters<typeof Banner>[0]["data"]} /></LazySection>;
    case "faq_editor":
      return <LazySection key={index}><FaqEditor data={section as Parameters<typeof FaqEditor>[0]["data"]} /></LazySection>;
    case "image_row":
      return <LazySection key={index}><ImageRow data={section as Parameters<typeof ImageRow>[0]["data"]} /></LazySection>;
    case "course_selector":
      return <LazySection key={index}><CourseSelector data={section as Parameters<typeof CourseSelector>[0]["data"]} /></LazySection>;
    case "article":
      return <LazySection key={index}><ArticleSection data={section as Parameters<typeof ArticleSection>[0]["data"]} /></LazySection>;
    case "partnership_carousel":
      return <LazySection key={index}><PartnershipCarousel data={section as any} /></LazySection>;
    case "career_support_explain":
      return <LazySection key={index}><CareerSupportExplain data={section as Parameters<typeof CareerSupportExplain>[0]["data"]} /></LazySection>;
    case "profiles_carousel":
      return <LazySection key={index}><ProfilesCarousel data={section as Parameters<typeof ProfilesCarousel>[0]["data"]} /></LazySection>;
    default: {
      if (process.env.NODE_ENV === "development") {
        console.warn(`Unknown section type: ${sectionType}`);
      }
      return null;
    }
  }
}

// Mobile Preview using real iframe for proper media query support
function MobilePreviewFrame({ sections }: { sections: Section[] }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Send sections to iframe
  const sendToIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    iframe.contentWindow.postMessage({ type: 'preview-update', sections }, '*');
    iframe.contentWindow.postMessage({ type: 'theme-update', theme }, '*');
  }, [sections]);

  // Listen for iframe ready message and send sections
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'preview-ready') {
        sendToIframe();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sendToIframe]);

  // Re-send when sections change
  useEffect(() => {
    sendToIframe();
  }, [sections, sendToIframe]);

  const handleIframeLoad = useCallback(() => {
    // Send after iframe loads
    setTimeout(sendToIframe, 100);
  }, [sendToIframe]);

  return (
    <div className="flex justify-center bg-muted/50 min-h-screen py-8">
      <div 
        className="w-[375px] bg-background shadow-2xl rounded-[32px] overflow-hidden border-4 border-foreground/20 relative"
        style={{ height: 'calc(100vh - 4rem)' }}
      >
        {/* Phone notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground/20 rounded-b-xl z-10" />
        <iframe
          ref={iframeRef}
          onLoad={handleIframeLoad}
          src="/preview-frame"
          className="w-full h-full border-0"
          title="Vista previa móvil"
        />
      </div>
    </div>
  );
}

export function SectionRenderer({ sections, contentType, slug, locale, programSlug, landingLocations }: SectionRendererProps) {
  const { toast } = useToast();
  const editMode = useEditModeOptional();
  const isEditMode = editMode?.isEditMode ?? false;
  const previewBreakpoint = editMode?.previewBreakpoint;

  const renderSectionWithContext = useCallback((section: Section, index: number) => {
    const sectionType = (section as { type: string }).type;

    if (sectionType === "cta_banner") {
      return <LazySection key={index}><CTABannerSection data={section as Parameters<typeof CTABannerSection>[0]["data"]} programContext={programSlug} landingLocations={landingLocations} /></LazySection>;
    }

    if (sectionType === "lead_form") {
      return <LazySection key={index}><LeadForm data={section as Parameters<typeof LeadForm>[0]["data"]} programContext={programSlug} landingLocations={landingLocations} /></LazySection>;
    }

    return renderSection(section, index, landingLocations, programSlug);
  }, [programSlug, landingLocations]);

  const handleMoveUp = useCallback(async (index: number) => {
    if (!contentType || !slug || !locale || index <= 0) return;

    const result = await sendEditOperation(contentType, slug, locale, [
      { action: "reorder_sections", from: index, to: index - 1 }
    ]);

    if (result.success) {
      toast({ title: "Section moved up" });
      emitContentUpdated({ contentType, slug, locale });
    } else {
      toast({ title: "Failed to move section", description: result.error, variant: "destructive" });
    }
  }, [contentType, slug, locale, toast]);

  const handleMoveDown = useCallback(async (index: number) => {
    if (!contentType || !slug || !locale || index >= sections.length - 1) return;

    const result = await sendEditOperation(contentType, slug, locale, [
      { action: "reorder_sections", from: index, to: index + 1 }
    ]);

    if (result.success) {
      toast({ title: "Section moved down" });
      emitContentUpdated({ contentType, slug, locale });
    } else {
      toast({ title: "Failed to move section", description: result.error, variant: "destructive" });
    }
  }, [contentType, slug, locale, sections.length, toast]);

  const handleDelete = useCallback(async (index: number) => {
    if (!contentType || !slug || !locale) return;

    if (!window.confirm("Are you sure you want to delete this section? This cannot be undone.")) {
      return;
    }

    const result = await sendEditOperation(contentType, slug, locale, [
      { action: "remove_item", path: "sections", index }
    ]);

    if (result.success) {
      toast({ title: "Section deleted" });
      emitContentUpdated({ contentType, slug, locale });
    } else {
      toast({ title: "Failed to delete section", description: result.error, variant: "destructive" });
    }
  }, [contentType, slug, locale, toast]);

  const handleDuplicate = useCallback(async (index: number) => {
    if (!contentType || !slug || !locale) return;

    const sectionToDuplicate = sections[index];
    if (!sectionToDuplicate) return;

    if (!window.confirm("Duplicate this section?")) {
      return;
    }

    const result = await sendEditOperation(contentType, slug, locale, [
      { action: "add_item", path: "sections", index: index + 1, item: sectionToDuplicate }
    ]);

    if (result.success) {
      toast({ title: "Section duplicated" });
      emitContentUpdated({ contentType, slug, locale });
    } else {
      toast({ title: "Failed to duplicate section", description: result.error, variant: "destructive" });
    }
  }, [contentType, slug, locale, sections, toast]);

  const isMobilePreview = isEditMode && previewBreakpoint === 'mobile';

  const content = (
    <>
      <AddSectionButton
        insertIndex={0}
        sections={sections}
        contentType={contentType}
        slug={slug}
        locale={locale}
      />
      {sections.length === 0 && (
        <EmptyPageState 
          isEditMode={isEditMode} 
          locale={locale} 
          contentType={contentType}
          slug={slug}
        />
      )}
      {sections.map((section, index) => {
        const sectionType = (section as { type: string }).type;
        const renderedSection = renderSectionWithContext(section, index);
        const layoutStyles = getSectionLayoutStyles(section);
        const showOn = (section as SectionLayout).showOn;

        // In edit mode: previewBreakpoint controls visibility, no CSS classes needed
        // In production: CSS classes handle responsive visibility
        const isVisible = shouldShowSection(showOn, previewBreakpoint, isEditMode);
        const visibilityClasses = isEditMode ? '' : getSectionVisibilityClasses(showOn);

        if (!renderedSection) return null;

        // In edit mode, hide section content but keep AddSectionButton for insertion points
        if (!isVisible && isEditMode) {
          return (
            <div key={index}>
              <AddSectionButton
                insertIndex={index + 1}
                sections={sections}
                contentType={contentType}
                slug={slug}
                locale={locale}
              />
            </div>
          );
        }

        const sectionId = (section as SectionLayout).section_id || `${sectionType}-${index}`;
        return (
          <div key={index} id={sectionId} className={`section-wrapper ${visibilityClasses}`.trim()} style={layoutStyles}>
            <EditableSection
              section={section}
              index={index}
              sectionType={sectionType}
              contentType={contentType}
              slug={slug}
              locale={locale}
              totalSections={sections.length}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            >
              {renderedSection}
            </EditableSection>
            <AddSectionButton
              insertIndex={index + 1}
              sections={sections}
              contentType={contentType}
              slug={slug}
              locale={locale}
            />
          </div>
        );
      })}
    </>
  );

  if (isMobilePreview) {
    return (
      <MobilePreviewFrame sections={sections} />
    );
  }

  return content;
}