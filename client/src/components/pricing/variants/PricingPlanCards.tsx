/**
 * PricingPlanCards — variant: plan_cards
 *
 * Desktop: side-by-side cards, each showing its own independent feature list with ✓/✗ per feature.
 * Mobile: mini-cards stacked vertically, each with their own features inline (no comparison table).
 *
 * Features are defined per-plan using `features: [{text, not_included?}]`.
 * Use `not_included: true` on a feature to render it with an ✗ icon and line-through text.
 *
 * For a shared feature list with a mobile comparison table, use variant: plan_cards_comparison.
 */
import { IconCheck, IconX } from "@tabler/icons-react";
import { useInternalNav } from "@/hooks/useInternalNav";
import { RichTextContent } from "@/components/ui/rich-text-content";
import type { PricingPlanCardsNewSection, PricingPlanCardsNewPlan, PricingPlanCardsPlanFeature } from "@shared/schema";

interface PricingPlanCardsSectionProps {
  data: PricingPlanCardsNewSection;
}

function CheckIcon({ variant }: { variant: "primary" | "green" | "off" }) {
  if (variant === "off") {
    return (
      <span className="w-5 h-5 rounded-full bg-muted shrink-0 flex items-center justify-center select-none transform-gpu">
        <IconX size={14} className="text-muted-foreground/50" stroke={2.5} />
      </span>
    );
  }
  const bg = variant === "green" ? "bg-green-500" : "bg-primary";
  return (
    <span className={`w-5 h-5 rounded-full ${bg} shrink-0 flex items-center justify-center select-none transform-gpu`}>
      <IconCheck size={13} className="text-white" stroke={2.5} />
    </span>
  );
}

function getCheckVariant(
  plan: PricingPlanCardsNewPlan,
  feature: PricingPlanCardsPlanFeature
): "primary" | "green" | "off" {
  if (feature.not_included) return "off";
  return plan.featured ? "green" : "primary";
}

// ─── Full desktop card ────────────────────────────────────────────────────────

function PricingCard({ plan }: { plan: PricingPlanCardsNewPlan }) {
  const handleLinkClick = useInternalNav();
  const isFeatured = plan.featured;
  const features = plan.features ?? [];

  return (
    <div
      className={`relative flex flex-col rounded-[18px] p-4 h-full w-full ${
        isFeatured
          ? "bg-card border border-border shadow-[0_0_50px_10px_rgba(0,132,255,0.09),0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.05)]"
          : "bg-muted/50 border border-border shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      }`}
      data-testid={`card-pricing-plan-${plan.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {plan.top_badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[11px] font-extrabold tracking-widest uppercase px-4 py-1 rounded-full whitespace-nowrap shadow-[0_2px_10px_rgba(34,197,94,0.4)]">
          {plan.top_badge}
        </div>
      )}

      <div className="flex items-start justify-between mb-1">
        <span className="text-base font-extrabold tracking-tight text-foreground" data-testid={`text-plan-name-${plan.name}`}>
          {plan.name}
        </span>
        <span
          className={`text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full ${
            isFeatured ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
          }`}
        >
          {plan.tag}
        </span>
      </div>

      <p className="text-[13px] mb-2 text-muted-foreground">{plan.for_label}</p>

      <div className="flex items-end gap-px mb-1">
        <span className="text-base font-extrabold mb-1.5 text-foreground">{plan.currency}</span>
        <span className="text-[36px] font-extrabold leading-none tracking-[-0.03em] text-foreground">
          {plan.amount}
        </span>
        {plan.cents && (
          <span className="text-[20px] font-extrabold mb-0.5 text-foreground">{plan.cents}</span>
        )}
        <span className="text-sm ml-1 mb-1.5 font-medium text-muted-foreground">{plan.period}</span>
      </div>

      <p className="text-xs mb-3 text-muted-foreground">{plan.billing_note}</p>

      <div className="h-px mb-3 bg-border" />

      {features.length > 0 && (
        <div className="flex flex-col mb-3">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <CheckIcon variant={getCheckVariant(plan, f)} />
              <span
                className={`text-xs leading-snug font-medium ${
                  f.not_included
                    ? "text-muted-foreground/50 line-through decoration-muted-foreground/30"
                    : "text-foreground/80"
                }`}
              >
                {f.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {plan.bottom_badges && plan.bottom_badges.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-[11px] text-muted-foreground font-medium">
            {plan.bottom_label ?? "Financing with"}
          </span>
          {plan.bottom_badges.map((badge) => (
            <span
              key={badge}
              className="text-[11px] font-extrabold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      <a
        href={plan.cta.url}
        onClick={handleLinkClick}
        data-testid={`button-cta-plan-${plan.name.toLowerCase().replace(/\s+/g, "-")}`}
        className={`mt-auto w-full py-3 rounded-xl text-[15px] font-extrabold cursor-pointer flex items-center justify-center ${
          isFeatured
            ? "bg-green-500 hover:bg-green-600 text-white border-0 shadow-[0_3px_12px_rgba(34,197,94,0.35)] transition-colors duration-150"
            : "bg-primary text-primary-foreground hover:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.12)] transition-[box-shadow] duration-150"
        }`}
      >
        {plan.cta.label}
      </a>
    </div>
  );
}

// ─── Mobile mini card ─────────────────────────────────────────────────────────

function MiniPricingCard({ plan }: { plan: PricingPlanCardsNewPlan }) {
  const handleLinkClick = useInternalNav();
  const isFeatured = plan.featured;
  const features = plan.features ?? [];

  return (
    <div className="relative flex flex-col">
      {plan.top_badge && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[9px] font-extrabold tracking-widest uppercase px-3 py-0.5 rounded-full whitespace-nowrap shadow-[0_2px_8px_rgba(34,197,94,0.4)] z-10">
          {plan.top_badge}
        </div>
      )}
      <div
        className={`mt-2 flex flex-col rounded-[16px] p-3.5 h-full ${
          isFeatured
            ? "bg-card border border-border shadow-[0_0_30px_6px_rgba(0,132,255,0.08),0_2px_8px_rgba(0,0,0,0.06)]"
            : "bg-muted/50 border border-border"
        }`}
      >
        <div className="flex items-start justify-between mb-1.5">
          <span className="text-[15px] font-extrabold tracking-tight text-foreground leading-tight">
            {plan.name}
          </span>
          <span
            className={`text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-full ml-2 shrink-0 ${
              isFeatured ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
            }`}
          >
            {plan.tag}
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground mb-2">{plan.for_label}</p>

        <div className="flex items-end gap-px mb-0.5">
          <span className="text-xs font-extrabold mb-1 text-foreground">{plan.currency}</span>
          <span className="text-[26px] font-extrabold leading-none tracking-[-0.03em] text-foreground">
            {plan.amount}
          </span>
          {plan.cents && (
            <span className="text-sm font-extrabold mb-0.5 text-foreground">{plan.cents}</span>
          )}
          <span className="text-xs ml-0.5 mb-1 font-medium text-muted-foreground">{plan.period}</span>
        </div>

        <p className="text-[10px] text-muted-foreground mb-2">{plan.billing_note}</p>

        {features.length > 0 && (
          <div className="flex flex-col mb-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span
                  className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center select-none ${
                    f.not_included ? "bg-muted" : isFeatured ? "bg-green-500" : "bg-primary"
                  }`}
                >
                  {f.not_included ? (
                    <IconX size={10} className="text-muted-foreground/50" stroke={2.5} />
                  ) : (
                    <IconCheck size={9} className="text-white" stroke={2.5} />
                  )}
                </span>
                <span
                  className={`text-[10px] leading-snug font-medium ${
                    f.not_included
                      ? "text-muted-foreground/50 line-through decoration-muted-foreground/30"
                      : "text-foreground/80"
                  }`}
                >
                  {f.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {plan.bottom_badges && plan.bottom_badges.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span className="text-[10px] text-muted-foreground font-medium">
              {plan.bottom_label ?? "Financing with"}
            </span>
            {plan.bottom_badges.map((badge) => (
              <span
                key={badge}
                className="text-[10px] font-extrabold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        <a
          href={plan.cta.url}
          onClick={handleLinkClick}
          data-testid={`button-cta-mini-plan-${plan.name.toLowerCase().replace(/\s+/g, "-")}`}
          className={`mt-auto w-full py-2.5 rounded-xl text-[13px] font-extrabold cursor-pointer flex items-center justify-center ${
            isFeatured
              ? "bg-green-500 hover:bg-green-600 text-white border-0 shadow-[0_2px_8px_rgba(34,197,94,0.35)] transition-colors duration-150"
              : "bg-primary text-primary-foreground hover:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.12)] transition-[box-shadow] duration-150"
          }`}
        >
          {plan.cta.label}
        </a>
      </div>
    </div>
  );
}

// ─── Main section component ───────────────────────────────────────────────────

export function PricingPlanCardsSection({ data }: PricingPlanCardsSectionProps) {
  return (
    <section className="bg-background py-8 sm:py-14 px-4 sm:px-5 font-inter" data-testid="section-pricing-plan-cards">
      <div className="max-w-5xl mx-auto">

        <div className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-[11px] font-bold tracking-widest uppercase px-3.5 py-1 rounded-full mb-5">
          Pricing
        </div>

        <RichTextContent
          html={data.title}
          className="text-[24px] sm:text-[30px] font-black text-foreground tracking-tight leading-tight mb-1.5 prose-p:m-0 prose-p:leading-tight [&>*]:font-black"
          data-testid="text-pricing-plan-cards-title"
        />

        {data.subtitle && (
          <p className="text-sm text-muted-foreground mb-8 sm:mb-4 leading-relaxed" data-testid="text-pricing-plan-cards-subtitle">
            {data.subtitle}
          </p>
        )}

        {/* ── MOBILE LAYOUT — mini-cards with per-plan features, no comparison table ── */}
        <div className="sm:hidden flex flex-col gap-5 pt-3.5">
          {data.plans.map((plan) => (
            <MiniPricingCard key={plan.name} plan={plan} />
          ))}
        </div>

        {/* ── DESKTOP LAYOUT ──────────────────────────────────── */}
        {/* pt-3.5 reserves space for the absolute top_badge so all cards align */}
        <div className="hidden sm:flex flex-wrap items-stretch justify-center gap-[30px] pt-3.5">
          {data.plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex w-full max-w-[370px] flex-1 min-w-[260px] hover:-translate-y-1 will-change-transform transition-transform duration-200 ${
                !plan.featured ? "bg-card rounded-[20px]" : ""
              }`}
            >
              <PricingCard plan={plan} />
            </div>
          ))}
        </div>

        {/* ── OPTIONAL ADD-ON ──────────────────────────────────── */}
        {data.addon && (
          <div
            className="mt-6 bg-card border border-border rounded-2xl px-4 sm:px-5 py-3 sm:py-4 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.05)]"
            data-testid="container-pricing-addon"
          >
            {data.addon.label && (
              <p className="text-[10px] sm:text-[11px] font-bold tracking-widest uppercase text-muted-foreground/60 mb-1.5 sm:mb-2">
                {data.addon.label}
              </p>
            )}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs sm:text-sm font-bold text-foreground mb-0.5">{data.addon.title}</p>
                {data.addon.description && (
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                    {data.addon.description}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end shrink-0">
                <p className="text-[26px] sm:text-[30px] font-extrabold text-foreground tracking-tight leading-none">
                  <sup className="text-xs sm:text-sm align-super">{data.addon.currency}</sup>
                  {data.addon.amount}
                </p>
                {data.addon.period && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{data.addon.period}</p>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

export default PricingPlanCardsSection;
