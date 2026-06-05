import { createElement } from "react";
import { Button } from "@/components/ui/button";
import { useInternalNav } from "@/hooks/useInternalNav";
import { getIcon } from "@/lib/icons";
import type { BannerMarqueeBadges as BannerMarqueeBadgesData } from "@shared/schema";

interface Props {
  data: BannerMarqueeBadgesData;
}

function Badge({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-4 max-md:gap-[0.4rem] py-[0.6rem] px-[1.1rem] max-md:py-[0.3rem] max-md:px-[0.7rem] bg-background rounded-full whitespace-nowrap flex-shrink-0"
      data-testid="badge-marquee-item"
    >
      <span className="w-[0.45rem] h-[0.45rem] max-md:w-[0.35rem] max-md:h-[0.35rem] rounded-full flex-shrink-0 bg-primary/80" />
      <span className="text-[0.9rem] max-md:text-[0.72rem] font-semibold text-foreground">{label}</span>
    </div>
  );
}

function Marquee({
  badges,
  direction,
  speed = 28,
}: {
  badges: string[];
  direction: "fwd" | "rev";
  speed?: number;
}) {
  if (!badges.length) return null;
  const doubled = [...badges, ...badges];
  return (
    <div
      className="overflow-hidden w-full py-[0.6rem] max-md:py-[0.4rem]"
      style={{
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
        maskImage:
          "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
      }}
      data-testid={`marquee-${direction}`}
    >
      <div
        className={`flex w-max marquee-${direction} gap-[1.2rem] max-md:gap-[0.5rem]`}
        style={{ "--marquee-speed": `${speed}s` } as React.CSSProperties}
      >
        {doubled.map((label, i) => (
          <Badge key={i} label={label} />
        ))}
      </div>
    </div>
  );
}

export default function BannerMarqueeBadges({ data }: Props) {
  const handleLinkClick = useInternalNav();
  const {
    subtitle,
    title,
    body,
    cta_buttons,
    top_badges = [],
    bottom_badges = [],
    marquee_speed = 36,
  } = data;

  return (
    <section
      className="overflow-hidden py-12 md:py-8 max-md:py-7"
      data-testid="section-banner-marquee-badges"
    >
      <Marquee badges={top_badges} direction="fwd" speed={marquee_speed} />

      <div
        className="w-full md:w-fit md:max-w-[70rem] mx-auto px-5 md:px-8 py-6 grid grid-cols-1 md:grid-cols-[auto_auto] gap-4 md:gap-8 lg:gap-12 items-center"
        data-testid="banner-marquee-badges-content"
      >
        {/* Left: subtitle + title */}
        <div
          className="flex flex-col gap-4 items-center text-center"
          data-testid="banner-marquee-badges-left"
        >
          {subtitle && (
            <div
              className="text-[0.85rem] md:text-[0.75rem] lg:text-[0.85rem] font-bold tracking-[0.12em] text-primary uppercase"
              data-testid="text-banner-subtitle"
            >
              <span className="inline-block w-[0.55rem] h-[0.55rem] rounded-full bg-[hsl(142_71%_45%)] align-middle mr-[0.45rem]" />
              {subtitle}
            </div>
          )}
          {title && (
            <h2
              className="font-inter font-black leading-[1.02] text-foreground tracking-[-0.02em] m-0 [&_em]:text-primary [&_em]:italic"
              data-testid="text-banner-title"
            >
              {/* Mobile: strip custom font-size so Tailwind controls size */}
              <span
                className="block md:hidden text-[2.6rem]"
                dangerouslySetInnerHTML={{ __html: title.replace(/font-size\s*:[^;"]*;?/gi, "") }}
              />
              {/* Desktop: full rich text with custom font-size preserved */}
              <span
                className="hidden md:block text-[3.75rem] lg:text-[4.8rem]"
                dangerouslySetInnerHTML={{ __html: title }}
              />
            </h2>
          )}
        </div>

        {/* Right: body + CTAs */}
        <div
          className="flex flex-col gap-3 items-center md:items-start max-md:text-center"
          data-testid="banner-marquee-badges-right"
        >
          {body && (
            <p
              className="text-base max-md:text-[0.875rem] text-muted-foreground leading-[1.7] m-0"
              data-testid="text-banner-body"
            >
              {body}
            </p>
          )}
          {cta_buttons && cta_buttons.length > 0 && (
            <div
              className="flex flex-wrap gap-2 mt-1"
              data-testid="banner-marquee-badges-ctas"
            >
              {cta_buttons.map((btn, i) => (
                <Button
                  key={i}
                  variant={
                    btn.variant === "primary"
                      ? "default"
                      : (btn.variant as "outline" | "secondary")
                  }
                  asChild
                  data-testid={`button-banner-cta-${i}`}
                >
                  <a
                    href={btn.url}
                    onClick={handleLinkClick}
                    className="flex items-center gap-2"
                  >
                    {btn.icon &&
                      (() => {
                        const Ic = getIcon(btn.icon);
                        return Ic ? createElement(Ic, { className: "h-4 w-4" }) : null;
                      })()}
                    {btn.text}
                  </a>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Marquee badges={bottom_badges} direction="rev" speed={marquee_speed} />
    </section>
  );
}
