import { useState, useEffect, type CSSProperties } from "react";
import { useImageRegistry } from "@/components/UniversalImage";
import type { CredibilityStripSection, CredibilityStripItem } from "@shared/schema";

function LogoImage({ id }: { id: string }) {
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
        filter: "grayscale(100%) opacity(0.9)",
      }}
    />
  );
}

function CredibilityItem({
  item,
  borderRadius,
  itemBgStyle,
  sectionHovered,
}: {
  item: CredibilityStripItem;
  borderRadius: string;
  itemBgStyle: CSSProperties;
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
      className={`relative flex items-center justify-start gap-2.5 px-3 py-2 border border-border ${borderRadius} transition-colors duration-200 flex-shrink-0`}
      style={itemBgStyle}
    >
       {logos.length > 0 && (
         <div className="relative min-w-[40px] px-4 h-9 ">
           {logos.map((logo, i) => (
             <div
               key={logo.image_id + i}
               className="absolute min-w-[60px] inset-0 transition-opacity duration-200"
               style={{ opacity: i === activeIdx ? 1 : 0 }}
             >
               <LogoImage id={logo.image_id} />
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
          className="text-sm font-medium text-foreground whitespace-nowrap "
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
  const borderRadius = data.item_badge_shape ? "rounded-full" : "rounded-lg";
  const itemBgStyle: CSSProperties = {
    backgroundColor: data.item_background_color || "hsl(var(--secondary))",
  };

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
            itemBgStyle={itemBgStyle}
            sectionHovered={hovered}
          />
        ))}
      </div>
    </Wrapper>
  );
}