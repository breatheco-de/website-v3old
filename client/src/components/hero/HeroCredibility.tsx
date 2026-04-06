import { createElement, useState, useEffect } from "react";
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
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxHeight: "36px",
        maxWidth: "60px",
        width: "auto",
        height: "auto",
        objectFit: "contain",
        filter: "grayscale(100%) opacity(0.85)",
      }}
    />
  );
}

// ─── CredibilityPill ──────────────────────────────────────────────────────────

const PILL_ROTATION_MS = 2500;

function CredibilityPill({ pill }: { pill: HeroCredibilityPill }) {
  const logos = pill.logos ?? [];
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (logos.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % logos.length);
    }, PILL_ROTATION_MS);
    return () => clearInterval(timer);
  }, [logos.length]);

  return (
    <div
      className="flex items-center gap-3 px-5 py-3 rounded-full w-full h-[76px] overflow-hidden flex-shrink-0"
      style={{
        backgroundColor: pill.background_color || "white",
        border: "1.5px solid rgba(0,0,0,0.09)",
      }}
    >
      {/* Logo area with rotation */}
      {logos.length > 0 && (
        <div className="relative w-16 h-9 flex-shrink-0">
          {logos.map((logo, i) => (
            <div
              key={logo.image_id + i}
              className="absolute inset-0 transition-opacity duration-300"
              style={{ opacity: i === activeIdx ? 1 : 0 }}
            >
              <PillLogo imageId={logo.image_id} />
            </div>
          ))}
        </div>
      )}

      {/* Divider */}
      <div
        className="flex-shrink-0"
        style={{ width: "1px", height: "32px", background: "#D1D5DB" }}
      />

      {/* Category + label */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <span
          className="uppercase font-semibold leading-none mb-1"
          style={{ fontSize: "9px", letterSpacing: "0.13em", color: "#9CA3AF" }}
        >
          {pill.category}
        </span>
        <span className="text-sm font-medium leading-snug" 
          style={{ color: "#111827" ,

                 }}>
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
              className="flex items-center gap-2 mr-10 text-xs whitespace-nowrap"
              style={{ color: "#D1D5DB" }}
            >
              <span className="font-semibold" style={{ color: "#9CA3AF" }}>{item.bold_text}</span>
              <span>{item.light_text}</span>
              <span className="mx-1" style={{ color: "#E5E7EB" }}>&middot;</span>
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
    <section data-testid="section-hero-credibility" className="max-w-6xl mx-auto ">
      <div className="flex flex-col px-4 md:px-10 pt-10 pb-6 w-full max-w-[1200px] mx-auto">
        <div className="flex flex-col md:flex-row items-stretch justify-between gap-8">

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-1 min-w-0 flex-col gap-8 md:max-w-[55%]">
            <div className="flex flex-col gap-3">
              {data.description && (
                <p
                  className="text-muted-foreground leading-relaxed"
                  data-testid="text-hero-description"
                  dangerouslySetInnerHTML={{ __html: data.description }}
                />
              )}
              <h1
                className="font-extrabold text-foreground leading-[1.03]"
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
              className="flex flex-col justify-center gap-5 w-[430px] flex--0"
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
