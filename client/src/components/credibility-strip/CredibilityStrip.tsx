import { useState, useEffect } from "react";
import { UniversalImage } from "@/components/UniversalImage";
import type { CredibilityStripSection, CredibilityStripItem } from "@shared/schema";

function CredibilityItem({
  item,
  borderRadius,
  itemBg,
  sectionHovered,
}: {
  item: CredibilityStripItem;
  borderRadius: string;
  itemBg: string;
  sectionHovered: boolean;
}) {
  const logos = item.logos || [];
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (logos.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % logos.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [logos.length]);

  return (
    <div
      data-testid="credibility-strip-item"
      className={`relative inline-flex items-center gap-2.5 px-3 py-2 border border-border ${borderRadius} ${itemBg} transition-colors duration-200 flex-shrink-0`}
    >
      <div
        className={`absolute inset-0 ${borderRadius} bg-foreground pointer-events-none transition-opacity duration-200 ${
          sectionHovered ? "opacity-[0.05]" : "opacity-0"
        }`}
      />

      {logos.length > 0 && (
        <div className="relative w-[50px] h-9 flex-shrink-0">
          {logos.map((logo, i) => (
            <div
              key={logo.image_id + i}
              className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
              style={{ opacity: i === activeIdx ? 1 : 0 }}
            >
              <UniversalImage
                id={logo.image_id}
                className="max-h-9 max-w-[70px] w-auto object-contain grayscale opacity-85"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {logos.length > 0 && item.label && (
        <div className="w-px h-5 bg-border flex-shrink-0 mx-1" />
      )}

      {item.label && (
        <span
          data-testid="credibility-strip-item-label"
          className="text-sm font-medium text-foreground whitespace-nowrap"
        >
          {item.label}
        </span>
      )}
    </div>
  );
}

export function CredibilityStrip({ data }: { data: CredibilityStripSection }) {
  const [hovered, setHovered] = useState(false);

  const items = data.items || [];
  const multiRow = items.length >= 4;
  const borderRadius = data.item_badge_shape ? "rounded-full" : "rounded-md";
  const itemBg = data.item_background_color || "bg-secondary";
  const sectionBg = data.background || "bg-background";

  const href = data.cta || data.link_url;
  const Wrapper = (href ? "a" : "div") as "a" | "div";
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid="credibility-strip"
      className={`relative ${sectionBg} py-6 flex justify-center items-center transition-colors duration-200 ${
        href ? "cursor-pointer" : ""
      }`}
    >
      <div
        className={`absolute inset-0 bg-foreground pointer-events-none transition-opacity duration-200 ${
          hovered ? "opacity-[0.04]" : "opacity-0"
        }`}
      />

      <div
        className={`relative z-10 max-w-5xl w-full px-6 flex flex-wrap justify-center gap-3 ${
          multiRow ? "max-w-2xl" : ""
        }`}
      >
        {items.map((item, idx) => (
          <CredibilityItem
            key={idx}
            item={item}
            borderRadius={borderRadius}
            itemBg={itemBg}
            sectionHovered={hovered}
          />
        ))}
      </div>
    </Wrapper>
  );
}
