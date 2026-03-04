import { useState, useEffect, lazy, Suspense } from "react";
import { IconX, IconChevronUp, IconChevronDown } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import type { LeadFormData } from "@shared/schema";

const LeadForm = lazy(() => import("@/components/LeadForm").then(m => ({ default: m.LeadForm })));

const INLINE_FORM_SELECTOR = "[data-hero-inline-form]";

function isElementInViewport(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function useInlineFormVisible() {
  const initialEl = typeof document !== "undefined" ? document.querySelector(INLINE_FORM_SELECTOR) : null;
  const [isFormVisible, setIsFormVisible] = useState(() => initialEl ? isElementInViewport(initialEl) : false);
  const [enableTransition, setEnableTransition] = useState(false);

  useEffect(() => {
    let intersectionObserver: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let firstFired = false;
    let currentEl: Element | null = null;

    function observeElement(el: Element) {
      if (intersectionObserver) intersectionObserver.disconnect();
      firstFired = false;
      setEnableTransition(false);
      setIsFormVisible(isElementInViewport(el));
      currentEl = el;
      intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          setIsFormVisible(entry.isIntersecting);
          if (!firstFired) {
            firstFired = true;
          } else {
            setEnableTransition(true);
          }
        },
        { threshold: 0 }
      );
      intersectionObserver.observe(el);
    }

    const existing = document.querySelector(INLINE_FORM_SELECTOR);
    if (existing) {
      observeElement(existing);
    }

    mutationObserver = new MutationObserver(() => {
      const el = document.querySelector(INLINE_FORM_SELECTOR);
      if (el && el !== currentEl) {
        observeElement(el);
      } else if (!el && currentEl) {
        if (intersectionObserver) intersectionObserver.disconnect();
        currentEl = null;
        firstFired = false;
        setEnableTransition(false);
        setIsFormVisible(false);
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      intersectionObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, []);

  return { isFormVisible, enableTransition };
}

export interface StickyCtaData {
  type: "sticky_cta";
  version?: string;
  heading: string;
  button_label?: string;
  show_dismiss?: boolean;
  form?: LeadFormData;
}

interface StickyCallToActionProps {
  data: StickyCtaData;
  landingLocations?: string[];
}

function FormSkeleton() {
  return (
    <div className="animate-pulse p-4">
      <div className="h-8 w-48 bg-muted rounded mb-4" />
      <div className="space-y-3">
        <div className="h-10 w-full bg-muted rounded" />
        <div className="h-10 w-full bg-muted rounded" />
        <div className="h-10 w-full bg-muted rounded" />
      </div>
    </div>
  );
}

export function StickyCallToAction({ data, landingLocations }: StickyCallToActionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { isFormVisible: isHiddenByForm, enableTransition } = useInlineFormVisible();
  const editMode = useEditModeOptional();
  const isEditMode = editMode?.isEditMode ?? false;

  const buttonLabel = data.button_label || "Apply Now";

  if (isEditMode) {
    return (
      <div 
        className="w-full py-8 px-4"
        data-testid="sticky-cta-edit-placeholder"
      >
        <div className="max-w-4xl mx-auto border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 bg-muted/20">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <IconChevronUp className="h-5 w-5" />
            <span className="text-sm font-medium">
              This section represents the sticky CTA bar that follows users at the bottom of the screen
            </span>
            <IconChevronUp className="h-5 w-5" />
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-sm">
            <span className="text-foreground font-medium">{data.heading}</span>
            <Button size="sm" disabled>
              {buttonLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isDismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-lg",
        enableTransition && "transition-transform duration-300",
        isExpanded && "max-h-[80vh] overflow-auto",
        isHiddenByForm && "translate-y-full"
      )}
      data-testid="sticky-cta-bar"
    >
      <div className="container mx-auto px-2">
        {!isExpanded ? (
          <div className="flex items-center justify-center flex-wrap py-4 gap-4">
            <p className="text-sm md:text-base font-medium text-foreground">
              {data.heading}
            </p>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsExpanded(true)}
                data-testid="sticky-cta-expand-button"
              >
                {buttonLabel}
                <IconChevronUp className="h-4 w-4 ml-1" />
              </Button>
              {data.show_dismiss && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsDismissed(true)}
                  aria-label="Dismiss"
                  data-testid="sticky-cta-dismiss"
                >
                  <IconX className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-medium text-foreground">
                {data.heading}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                data-testid="sticky-cta-collapse-button"
              >
                <IconChevronDown className="h-4 w-4 mr-1" />
                Collapse
              </Button>
            </div>
            {data.form && (
              <Suspense fallback={<FormSkeleton />}>
                <LeadForm 
                  data={{
                    ...data.form,
                    variant: data.form.variant || "inline",
                    className: cn(data.form.className, "max-w-2xl mx-auto"),
                  }}
                  landingLocations={landingLocations}
                />
              </Suspense>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StickyCallToAction;
