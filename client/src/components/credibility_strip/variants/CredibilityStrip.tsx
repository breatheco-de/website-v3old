export const variant = "default";

import { useState, useEffect, type CSSProperties } from "react";
import { useImageRegistry } from "@/components/UniversalImage";
import type { CredibilityStripSection, CredibilityStripItem } from "@shared/schema";

export function LogoImage({ id, colored }: { id: string; colored?: boolean }) {
  const { registry, loading } = useImageRegistry();
  if (loading || !registry) return null;
  const entry = registry.images?.[id];
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
        maxHeight: "45px",
        maxWidth: "50px",
        width: "auto",
        height: "auto",
        objectFit: "contain",
        filter: colored ? "none" : "grayscale(100%) opacity(0.9)",
      }}
    />
  );
}

function CredibilityItem({
  item,
  borderRadius,
  itemBgStyle,
  sectionHovered,
  tick,
  colored,
  isMobile,
}: {
  item: CredibilityStripItem;
  borderRadius: string;
  itemBgStyle: CSSProperties;
  sectionHovered: boolean;
  tick: number;
  colored?: boolean;
  isMobile?: boolean;
}) {
  const logos = item.logos || [];
  const activeIdx = logos.length > 0 ? tick % logos.length : 0;

  return (
    <div
      data-testid="credibility-strip-item"
      className={`relative flex items-center justify-start gap-2.5 px-3 py-2 transition-colors duration-200 ${
        isMobile
          ? "w-full"
          : `border border-border ${borderRadius} flex-shrink-0`
      }`}
      style={isMobile ? undefined : itemBgStyle}
    >
       {logos.length > 0 && (
         <div className="relative min-w-[40px] px-4 h-9 ">
           {logos.map((logo, i) => (
             <div
               key={logo.image_id + i}
               className="absolute min-w-[60px] inset-0 transition-opacity duration-200"
               style={{ opacity: i === activeIdx ? 1 : 0 }}
             >
               <LogoImage id={logo.image_id} colored={colored} />
             </div>
           ))}
         </div>
       )}

      <div
        className="ms-4"
        style={{
          width: "1px",
          height: "14px",
          background: "#D1D5DB",
          flexShrink: 0,
        }}
      />

      {item.label && (
        <span
          data-testid="credibility-strip-item-label"
          className="text-sm font-medium text-foreground"
        >
          {item.label}
        </span>
      )}
    </div>
  );
}

export default function CredibilityStrip({ data }: { data: CredibilityStripSection }) {
  const [hovered, setHovered] = useState(false);

  const items = data.items || [];
  const count = items.length;
  const borderRadius = data.item_badge_shape ? "rounded-full" : "rounded-lg";
  const itemBgStyle: CSSProperties = {
    backgroundColor: data.item_background_color || "hsl(var(--secondary))",
  };
  const rotationMs = data.logo_swap_speed_milisec ?? data.logo_rotation_ms_time ?? 2000;
  const coloredLogos = data.colored_logos ?? false;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const hasManyLogos = items.some((item) => (item.logos || []).length > 1);
    if (!hasManyLogos) return;
    const timer = setInterval(() => setTick((t) => t + 1), rotationMs);
    return () => clearInterval(timer);
  }, [items, rotationMs]);

  const href = data.cta || data.link_url;
  const Wrapper = (href ? "a" : "div") as "a" | "div";
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid="credibility-strip"
      className={`relative py-6 flex justify-center items-center transition-colors duration-200 ${
        href ? "cursor-pointer" : ""
      }`}
    >
      <div
        className={`absolute inset-0 bg-foreground pointer-events-none transition-opacity duration-200 ${
          hovered ? "opacity-[0.04]" : "opacity-0"
        }`}
      />

      <div className="relative z-10 max-w-5xl w-full px-6">
        {/* Mobile: accordion skin */}
        <div className="md:hidden border border-border rounded-lg overflow-hidden">
          {items.map((item, idx) => (
            <div key={idx}>
              {idx > 0 && <hr className="border-t border-border" />}
              <CredibilityItem
                item={item}
                borderRadius={borderRadius}
                itemBgStyle={itemBgStyle}
                sectionHovered={hovered}
                tick={tick}
                colored={coloredLogos}
                isMobile={true}
              />
            </div>
          ))}
        </div>

        {/* Desktop: equal-width single row */}
        <div
          className="hidden md:grid gap-3"
          style={{ gridTemplateColumns: `repeat(${count || 1}, 1fr)` }}
        >
          {items.map((item, idx) => (
            <CredibilityItem
              key={idx}
              item={item}
              borderRadius={borderRadius}
              itemBgStyle={itemBgStyle}
              sectionHovered={hovered}
              tick={tick}
              colored={coloredLogos}
              isMobile={false}
            />
          ))}
        </div>
      </div>
    </Wrapper>
  );
}
