import { createElement } from "react";
import { Button } from "@/components/ui/button";
import { useImageRegistry } from "@/components/UniversalImage";
import { useInternalNav } from "@/hooks/useInternalNav";
import { getIcon } from "@/lib/icons";
import type { HeroCredibility as HeroCredibilityData, HeroCredibilityPill } from "@shared/schema";

interface HeroCredibilityProps {
  data: HeroCredibilityData;
}

// ─── PillLogo ─────────────────────────────────────────────────────────────────

function PillLogo({ imageId }: { imageId: string }) {
  const { registry, loading } = useImageRegistry();
  if (loading || !registry) return null;
  const entry = registry.images?.[imageId];
  if (!entry) return null;
  return (
    <img
      src={entry.src}
      alt={entry.alt || ""}
      className="max-w-full max-h-full object-contain"
    />
  );
}

// ─── CredibilityPill ──────────────────────────────────────────────────────────

function CredibilityPill({ pill }: { pill: HeroCredibilityPill }) {
  const logos = pill.logos ?? [];

  return (
    <div
      className="flex items-center gap-3 px-5 py-3 rounded-full w-full h-[76px] overflow-hidden"
      style={{
        backgroundColor: pill.background_color || "white",
        border: "1.5px solid #00000018",
      }}
    >
      {logos.length > 0 && (
        <div className="relative w-16 h-9 flex-shrink-0 flex items-center justify-center">
          <PillLogo imageId={logos[0].image_id} />
        </div>
      )}

      <div className="w-px h-8 bg-gray-200 flex-shrink-0" />

      <div className="flex flex-col min-w-0">
        <span className="text-[9px] uppercase tracking-[0.13em] text-gray-400 font-semibold leading-none mb-1">
          {pill.category}
        </span>
        <span className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">
          {pill.label}
        </span>
      </div>
    </div>
  );
}

// ─── WatermarkMarquee ─────────────────────────────────────────────────────────

const DEFAULT_MARQUEE_ITEMS = [
  { bold_text: "Course Report", light_text: "4.9 \u2605" },
  { bold_text: "SwitchUp", light_text: "4.9 \u2605" },
  { bold_text: "Career Karma", light_text: "4.9 \u2605" },
  { bold_text: "Google", light_text: "4.8 \u2605" },
  { bold_text: "5,000+", light_text: "graduates employed worldwide" },
  { bold_text: "55%", light_text: "avg salary increase" },
  { bold_text: "~3 months", light_text: "avg time to hire" },
];

function WatermarkMarquee({ items }: { items: { bold_text: string; light_text: string }[] }) {
  const repeated = [...items, ...items, ...items];
  return (
    <div className="w-full mt-10 relative overflow-hidden">
      <style>{`
        @keyframes hero-credibility-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .hero-credibility-marquee-track {
          display: flex;
          width: max-content;
          animation: hero-credibility-marquee 28s linear infinite;
        }
        .hero-credibility-marquee-fade::before,
        .hero-credibility-marquee-fade::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          width: 120px;
          z-index: 2;
          pointer-events: none;
        }
        .hero-credibility-marquee-fade::before {
          left: 0;
          background: linear-gradient(to right, hsl(var(--background)), transparent);
        }
        .hero-credibility-marquee-fade::after {
          right: 0;
          background: linear-gradient(to left, hsl(var(--background)), transparent);
        }
      `}</style>
      <div className="hero-credibility-marquee-fade relative overflow-hidden">
        <div className="hero-credibility-marquee-track">
          {repeated.map((item, i) => (
            <span
              key={i}
              className="flex items-center gap-2 mr-10 text-xs text-gray-300 whitespace-nowrap"
            >
              <span className="font-semibold text-gray-400">{item.bold_text}</span>
              <span>{item.light_text}</span>
              <span className="text-gray-200 mx-1">&middot;</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── HeroCredibility ──────────────────────────────────────────────────────────

export function HeroCredibility({ data }: HeroCredibilityProps) {
  const handleLinkClick = useInternalNav();
  const pills = data.pills ?? [];
  const showMarquee = data.show_marquee ?? true;
  const marqueeItems = data.marquee_items?.length ? data.marquee_items : DEFAULT_MARQUEE_ITEMS;

  return (
    <section data-testid="section-hero-credibility">
      <div className="flex flex-col px-4 md:px-10 pt-10 pb-6 w-full max-w-[1200px] mx-auto">
        <div className="flex flex-col md:flex-row items-stretch justify-between gap-8">

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-8 md:max-w-[55%]">
            <div className="flex flex-col gap-3">
              {data.description && (
                <p className="text-muted-foreground leading-relaxed" data-testid="text-hero-description">
                  {data.description}
                </p>
              )}
              <h1
                className="font-extrabold text-foreground leading-[1.03]"
                style={{ fontSize: "clamp(46px, 5.5vw, 66px)", letterSpacing: "-0.02em" }}
                data-testid="text-hero-title"
                dangerouslySetInnerHTML={{ __html: data.title || "" }}
              />
            </div>

            {data.cta_buttons && data.cta_buttons.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap" data-testid="hero-cta-buttons">
                {data.cta_buttons.map((button, index) => (
                  <Button
                    key={index}
                    variant={button.variant === "primary" ? "default" : button.variant}
                    size="lg"
                    asChild
                    data-testid={`button-hero-cta-${index}`}
                  >
                    <a href={button.url} onClick={handleLinkClick} className="flex items-center gap-2">
                      {button.icon && (() => {
                        const Ic = getIcon(button.icon);
                        return Ic ? createElement(Ic, { className: "h-4 w-4" }) : null;
                      })()}
                      {button.text}
                    </a>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN — credibility pills ── */}
          {pills.length > 0 && (
            <div
              className="flex flex-col justify-center gap-5 w-full md:w-[430px] md:flex-shrink-0"
              data-testid="hero-credibility-pills"
            >
              {pills.map((pill, i) => (
                <CredibilityPill key={i} pill={pill} />
              ))}
            </div>
          )}
        </div>

        {/* ── WATERMARK MARQUEE ── */}
        {showMarquee && <WatermarkMarquee items={marqueeItems} />}
      </div>
    </section>
  );
}
