import { useCallback } from "react";
import { useLocation } from "wouter";

function isInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export function useInternalNav(onNavigate?: () => void) {
  const [, setLocation] = useLocation();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }

      const anchor = e.currentTarget;
      const href = anchor.getAttribute("href");
      if (!href) return;

      if (href === "#top") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        onNavigate?.();
        return;
      }

      if (href === "#bottom") {
        e.preventDefault();
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        onNavigate?.();
        return;
      }

      if (isInternalHref(href)) {
        e.preventDefault();
        setLocation(href);
        window.scrollTo(0, 0);
        onNavigate?.();
      }
    },
    [setLocation, onNavigate],
  );

  return handleClick;
}
