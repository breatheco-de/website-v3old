import React from "react";

interface CSSMarqueeProps {
  items: string[];
  direction?: "fwd" | "rev";
  speed?: number;
  badgeStyle?: React.CSSProperties;
  maskStyle?: React.CSSProperties;
}

export function CSSMarquee({ items, direction = "fwd", speed = 58, badgeStyle, maskStyle }: CSSMarqueeProps) {
  const repeated = [...items, ...items, ...items, ...items];
  return (
    <div className="overflow-hidden w-full py-[4px]" style={maskStyle}>
      <div
        className={`flex w-max gap-[7px] marquee-${direction}`}
        style={{ "--marquee-speed": `${speed}s` } as React.CSSProperties}
      >
        {repeated.map((item, i) => (
          <span key={i} style={badgeStyle}>{item}</span>
        ))}
      </div>
    </div>
  );
}
