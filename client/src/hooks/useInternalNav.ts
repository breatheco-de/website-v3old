import { useEffect } from "react";
import { useLocation } from "wouter";
import { usePageSections } from "@/contexts/PageSectionsContext";

function isInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

/** Replace {qs:paramName} and {qs:paramName|fallback} tokens with values from
 *  the current URL's querystring.
 *  - If the named param is present: use its value.
 *  - If absent and a fallback is provided (e.g. {qs:cohort|bootcamp-2025}): use the fallback.
 *  - If absent and no fallback: strip the entire key=value pair from the URL. */
function resolveQsTokens(str: string): string {
  const qIdx = str.indexOf("?");
  if (qIdx === -1) return str;

  const urlParams = new URLSearchParams(window.location.search);
  const base = str.slice(0, qIdx);
  const pairs = str.slice(qIdx + 1).split("&").filter(Boolean);

  const resolved = pairs
    .map((pair) => {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) return pair;
      const k = pair.slice(0, eqIdx);
      const v = pair.slice(eqIdx + 1);
      const match = v.match(/^\{qs:([^|}\s]+)(?:\|([^}]*))?\}$/);
      if (match) {
        const paramName = match[1];
        const fallback = match[2]; // undefined if no fallback was specified
        const val = urlParams.get(paramName);
        if (val !== null) return `${k}=${encodeURIComponent(val)}`;
        if (fallback !== undefined) return `${k}=${encodeURIComponent(fallback)}`;
        return null; // no value, no fallback → strip pair
      }
      return pair;
    })
    .filter((p): p is string => p !== null);

  return resolved.length > 0 ? `${base}?${resolved.join("&")}` : base;
}

/** For a hash URL like "#pricing?cohort=x", separate the element id from the extra querystring */
function parseHashHref(href: string): { id: string; extraSearch: string } {
  const withoutHash = href.slice(1);
  const qIdx = withoutHash.indexOf("?");
  if (qIdx === -1) return { id: withoutHash, extraSearch: "" };
  return {
    id: withoutHash.slice(0, qIdx),
    extraSearch: withoutHash.slice(qIdx + 1),
  };
}

/** Merge two querystrings — extra params are set on top of existing ones */
function mergeSearch(existing: string, extra: string): string {
  if (!extra) return existing;
  const base = new URLSearchParams(existing.startsWith("?") ? existing.slice(1) : existing);
  const added = new URLSearchParams(extra);
  added.forEach((v, k) => base.set(k, v));
  const str = base.toString();
  return str ? `?${str}` : "";
}

/** Module-level flag so we only register the global middle-click listener once */
let _globalMiddleClickInstalled = false;

export function useInternalNav(onNavigate?: () => void) {
  const [, setLocation] = useLocation();
  const pageSections = usePageSections();

  /** Register a global mousedown listener once that pre-resolves {qs:} tokens
   *  in any anchor's href when the user middle-clicks (button 1), so the
   *  browser's built-in "open in new tab" reads the resolved URL. */
  useEffect(() => {
    if (_globalMiddleClickInstalled) return;
    _globalMiddleClickInstalled = true;
    document.addEventListener("mousedown", (e: MouseEvent) => {
      if (e.button !== 1) return;
      const anchor = (e.target as Element)?.closest("a");
      if (!anchor) return;
      const raw = anchor.getAttribute("href");
      if (!raw?.includes("{qs:")) return;
      const resolved = resolveQsTokens(raw);
      if (resolved === raw) return;
      anchor.setAttribute("href", resolved);
      setTimeout(() => anchor.setAttribute("href", raw), 0);
    });
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }

    const anchor = e.currentTarget;
    const rawHref = anchor.getAttribute("href");
    if (!rawHref) return;

    const href = resolveQsTokens(rawHref);

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
      const { id, extraSearch } = parseHashHref(href);
      const el = document.getElementById(id);
      if (el) {
        if (el.dataset.sectionType === "modal") {
          window.location.hash = id;
        } else {
          window.dispatchEvent(new CustomEvent("scrollToSection", { detail: { targetId: id } }));
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              const mergedSearch = mergeSearch(window.location.search, extraSearch);
              history.replaceState(null, "", `${window.location.pathname}${mergedSearch}#${id}`);
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
    } else {
      // External URL — always open in new tab with resolved href (handles {qs:} tokens too)
      e.preventDefault();
      window.open(href, "_blank", "noopener,noreferrer");
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

    const resolved = resolveQsTokens(url);

    if (resolved.startsWith("inline#")) {
      const sectionId = resolved.slice(7);
      return pageSections[sectionId] ?? null;
    }

    if (resolved === "#top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      onNavigate?.();
      return null;
    }

    if (resolved === "#bottom") {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      onNavigate?.();
      return null;
    }

    if (resolved.startsWith("#")) {
      const { id, extraSearch } = parseHashHref(resolved);
      const el = document.getElementById(id);
      if (el) {
        if (el.dataset.sectionType === "modal") {
          window.location.hash = id;
        } else {
          window.dispatchEvent(new CustomEvent("scrollToSection", { detail: { targetId: id } }));
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              const mergedSearch = mergeSearch(window.location.search, extraSearch);
              history.replaceState(null, "", `${window.location.pathname}${mergedSearch}#${id}`);
            });
          });
        }
      }
      onNavigate?.();
      return null;
    }

    if (isInternalHref(resolved)) {
      setLocation(resolved);
      window.scrollTo(0, 0);
      onNavigate?.();
      return null;
    }

    window.open(resolved, "_blank", "noopener,noreferrer");
    return null;
  };

  /** Intercept middle-click (button 1) on anchors that contain {qs:} tokens.
   *  Modern browsers open-in-new-tab on `auxclick`, not `mousedown`, so
   *  preventDefault on mousedown is too early. Instead we temporarily swap
   *  the href to the resolved URL so the browser reads the correct value
   *  when it processes auxclick, then restore immediately after. */
  const handleMouseDown = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 1) return; // only middle-click
    const anchor = e.currentTarget;
    const rawHref = anchor.getAttribute("href");
    if (!rawHref || !rawHref.includes("{qs:")) return;
    const href = resolveQsTokens(rawHref);
    if (href === rawHref) return; // nothing changed, let browser handle it
    anchor.setAttribute("href", href);
    setTimeout(() => anchor.setAttribute("href", rawHref), 0);
  };

  const handler = handleClick as typeof handleClick & {
    navigate: typeof navigate;
    onMouseDown: typeof handleMouseDown;
  };
  handler.navigate = navigate;
  handler.onMouseDown = handleMouseDown;
  return handler;
}
