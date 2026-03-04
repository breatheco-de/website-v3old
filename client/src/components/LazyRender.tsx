import { useState, useEffect, useRef } from "react";

interface LazyRenderProps {
  children: React.ReactNode;
  rootMargin?: string;
  minHeight?: string;
}

export default function LazyRender({
  children,
  rootMargin = "200px",
  minHeight = "100px",
}: LazyRenderProps) {
  const [isVisible, setIsVisible] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  if (!isVisible) {
    return <div ref={sentinelRef} style={{ minHeight }} />;
  }

  return <>{children}</>;
}
