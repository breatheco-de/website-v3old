import { useLocation } from "wouter";
import { usePageSections } from "@/contexts/PageSectionsContext";

function isInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export function useInternalNav(onNavigate?: () => void) {
  const [, setLocation] = useLocation();
  const pageSections = usePageSections();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
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

    if (href.startsWith("#")) {
      e.preventDefault();
      const id = href.slice(1);
      const el = document.getElementById(id);
      if (el) {
        if (el.dataset.sectionType === "modal") {
          window.location.hash = id;
        } else {
          window.dispatchEvent(new CustomEvent("scrollToSection", { detail: { targetId: id } }));
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
            });
          });
        }
      }
      onNavigate?.();
      return;
    }

    if (isInternalHref(href)) {
      e.preventDefault();
      setLocation(href);
      window.scrollTo(0, 0);
      onNavigate?.();
    }
  };

  /**
   * Programmatic navigation. For `inline#sectionId` URLs, returns the section
   * data from the page context (to render inline) instead of navigating.
   * For all other URL types, handles navigation as a side effect and returns null.
   */
  const navigate = (url: string): Record<string, unknown> | null => {
    if (!url) return null;

    if (url.startsWith("inline#")) {
      const sectionId = url.slice(7);
      return pageSections[sectionId] ?? null;
    }

    if (url === "#top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      onNavigate?.();
      return null;
    }

    if (url === "#bottom") {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      onNavigate?.();
      return null;
    }

    if (url.startsWith("#")) {
      const id = url.slice(1);
      const el = document.getElementById(id);
      if (el) {
        if (el.dataset.sectionType === "modal") {
          window.location.hash = id;
        } else {
          window.dispatchEvent(new CustomEvent("scrollToSection", { detail: { targetId: id } }));
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
            });
          });
        }
      }
      onNavigate?.();
      return null;
    }

    if (isInternalHref(url)) {
      setLocation(url);
      window.scrollTo(0, 0);
      onNavigate?.();
      return null;
    }

    window.open(url, "_blank", "noopener,noreferrer");
    return null;
  };

  const handler = handleClick as typeof handleClick & { navigate: typeof navigate };
  handler.navigate = navigate;
  return handler;
}
