import React, { useState, useLayoutEffect, useRef } from "react";

interface CSSMarqueeProps {
  children: React.ReactNode;
  direction?: "fwd" | "rev";
  speed?: number;
  gradient?: boolean;
  gradientWidth?: number;
  maskStyle?: React.CSSProperties;
  pauseOnHover?: boolean;
  play?: boolean;
  className?: string;
}

export function CSSMarquee({
  children,
  direction = "fwd",
  speed = 58,
  gradient = false,
  gradientWidth = 80,
  maskStyle,
  pauseOnHover = false,
  play = true,
  className,
}: CSSMarqueeProps) {
  const [hovered, setHovered] = useState(false);
  const copyRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!copyRef.current) return;
    const w = copyRef.current.offsetWidth;
    if (w > 0) {
      // The CSS animation moves -50% of the 4-copy track = 2 content widths per loop.
      // To match react-fast-marquee semantics where speed = px/s:
      // duration (s) = (2 * contentWidth) / speed
      setDuration((2 * w) / speed);
    }
  }, [speed]);

  const computedMask: React.CSSProperties = gradient
    ? {
        WebkitMaskImage: `linear-gradient(to right, transparent 0%, black ${gradientWidth}px, black calc(100% - ${gradientWidth}px), transparent 100%)`,
        maskImage: `linear-gradient(to right, transparent 0%, black ${gradientWidth}px, black calc(100% - ${gradientWidth}px), transparent 100%)`,
      }
    : {};

  const outerStyle: React.CSSProperties = maskStyle ?? computedMask;

  const isRunning = play && !(pauseOnHover && hovered);

  const trackStyle: React.CSSProperties = {
    "--marquee-speed": `${duration ?? speed}s`,
    animationPlayState: isRunning ? "running" : "paused",
  } as React.CSSProperties;

  return (
    <div
      className={`overflow-hidden w-full${className ? ` ${className}` : ""}`}
      style={outerStyle}
      onMouseEnter={() => pauseOnHover && setHovered(true)}
      onMouseLeave={() => pauseOnHover && setHovered(false)}
    >
      <div className={`flex w-max marquee-${direction}`} style={trackStyle}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            ref={i === 0 ? copyRef : undefined}
            className="flex items-center"
            aria-hidden={i > 0 ? true : undefined}
          >
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}
