import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IconBold,
  IconItalic,
  IconList,
  IconLink,
  IconLinkOff,
  IconPalette,
  IconLoader2,
  IconSearch,
  IconExternalLink,
  IconTextSize,
  IconLineHeight,
  IconEraser,
  IconLetterCase,
  IconLetterSpacing,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ThemeColor {
  id: string;
  label: string;
  cssVar?: string;
  value?: string;
}

interface ThemeFontSize {
  id: string;
  label: string;
  value: string;
  tailwind: string;
}

interface ThemeLineHeight {
  id: string;
  label: string;
  value: string;
}

interface ThemeFontWeight {
  id: string;
  label: string;
  value: string;
}

interface ThemeLetterSpacing {
  id: string;
  label: string;
  value: string;
}

interface ThemeConfig {
  text?: ThemeColor[];
  fontSizes?: ThemeFontSize[];
  lineHeights?: ThemeLineHeight[];
  fontWeights?: ThemeFontWeight[];
  letterSpacings?: ThemeLetterSpacing[];
}

interface SitemapEntry {
  loc: string;
  label: string;
}

function extractPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url;
  }
}

export interface RichTextAreaProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  locale?: string;
  customOptions?: string[];
  "data-testid"?: string;
}

/** Unwrap color-only spans; clear color from spans that also have italic/bold so the new outer color applies and formatting is preserved. */
function normalizeFragmentColorSpans(fragment: DocumentFragment): void {
  const spans: HTMLSpanElement[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "SPAN") {
      spans.push(node as HTMLSpanElement);
    }
    node.childNodes.forEach(walk);
  };
  fragment.childNodes.forEach(walk);

  // Process innermost spans first (reverse order) so unwrapping doesn't invalidate references
  for (let i = spans.length - 1; i >= 0; i--) {
    const el = spans[i];
    const hasColor = !!el.style.color;
    if (!hasColor) continue;
    const hasOther =
      !!el.style.fontStyle || !!el.style.fontWeight;
    if (hasOther) {
      el.style.color = "";
      if (!el.style.cssText.trim()) el.removeAttribute("style");
    } else {
      // Color-only span: unwrap (replace with its children)
      const parent = el.parentNode;
      if (!parent) continue;
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    }
  }
}

function applyTextColor(
  cssVar: string,
  editableRef: React.RefObject<HTMLDivElement | null>,
  savedRangeRef: React.MutableRefObject<Range | null>,
  onChange: (html: string) => void
) {
  if (!editableRef.current) return;
  const sel = window.getSelection();
  if (!sel) return;
  if (savedRangeRef.current) {
    try {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    } catch {
      savedRangeRef.current = null;
      return;
    }
  }
  if (sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  const newColor = `hsl(var(${cssVar}))`;

  // If the selection is entirely inside a single <span> and covers the whole span, update its color; otherwise only the selected part gets the new color (via extractContents below)
  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (node?.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "SPAN") {
    const spanEl = node as HTMLSpanElement;
    const wholeSpanRange = document.createRange();
    wholeSpanRange.selectNodeContents(spanEl);
    const sameStart =
      range.compareBoundaryPoints(Range.START_TO_START, wholeSpanRange) === 0;
    const sameEnd =
      range.compareBoundaryPoints(Range.END_TO_END, wholeSpanRange) === 0;
    if (sameStart && sameEnd) {
      spanEl.style.color = newColor;
      onChange(editableRef.current!.innerHTML);
      savedRangeRef.current = null;
      return;
    }
  }

  // If the range contains exactly one node and it's a <span> (range selects the element itself), update its color
  const start = range.startContainer;
  const end = range.endContainer;
  if (
    start === end &&
    start.nodeType === Node.ELEMENT_NODE &&
    range.endOffset - range.startOffset === 1
  ) {
    const singleNode = (start as Element).childNodes[range.startOffset];
    if (singleNode?.nodeType === Node.ELEMENT_NODE && (singleNode as Element).tagName === "SPAN") {
      (singleNode as HTMLSpanElement).style.color = newColor;
      onChange(editableRef.current!.innerHTML);
      savedRangeRef.current = null;
      return;
    }
  }

  const span = document.createElement("span");
  span.style.color = newColor;

  const fragment = range.extractContents();
  normalizeFragmentColorSpans(fragment);
  span.appendChild(fragment);
  range.insertNode(span);

  onChange(editableRef.current!.innerHTML);
  savedRangeRef.current = null;
}

function applyFontSize(
  sizeValue: string,
  editableRef: React.RefObject<HTMLDivElement | null>,
  savedRangeRef: React.MutableRefObject<Range | null>,
  onChange: (html: string) => void
) {
  if (!editableRef.current) return;
  const sel = window.getSelection();
  if (!sel) return;
  if (savedRangeRef.current) {
    try {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    } catch {
      savedRangeRef.current = null;
      return;
    }
  }
  if (sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (node?.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "SPAN") {
    const spanEl = node as HTMLSpanElement;
    const wholeSpanRange = document.createRange();
    wholeSpanRange.selectNodeContents(spanEl);
    const sameStart = range.compareBoundaryPoints(Range.START_TO_START, wholeSpanRange) === 0;
    const sameEnd = range.compareBoundaryPoints(Range.END_TO_END, wholeSpanRange) === 0;
    if (sameStart && sameEnd) {
      spanEl.style.fontSize = sizeValue;
      onChange(editableRef.current!.innerHTML);
      savedRangeRef.current = null;
      return;
    }
  }

  const span = document.createElement("span");
  span.style.fontSize = sizeValue;

  const fragment = range.extractContents();
  const spans: HTMLSpanElement[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === "SPAN") {
      spans.push(n as HTMLSpanElement);
    }
    n.childNodes.forEach(walk);
  };
  fragment.childNodes.forEach(walk);
  for (const s of spans) {
    const hasFontSize = !!s.style.fontSize;
    if (hasFontSize) {
      s.style.fontSize = "";
      if (!s.style.cssText.trim()) s.removeAttribute("style");
    }
  }

  span.appendChild(fragment);
  range.insertNode(span);

  onChange(editableRef.current!.innerHTML);
  savedRangeRef.current = null;
}

function applyLineHeight(
  value: string,
  editableRef: React.RefObject<HTMLDivElement | null>,
  savedRangeRef: React.MutableRefObject<Range | null>,
  onChange: (html: string) => void
) {
  if (!editableRef.current) return;
  const sel = window.getSelection();
  if (!sel) return;
  if (savedRangeRef.current) {
    try {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    } catch {
      savedRangeRef.current = null;
      return;
    }
  }
  if (sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (node?.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "SPAN") {
    const spanEl = node as HTMLSpanElement;
    const wholeSpanRange = document.createRange();
    wholeSpanRange.selectNodeContents(spanEl);
    const sameStart = range.compareBoundaryPoints(Range.START_TO_START, wholeSpanRange) === 0;
    const sameEnd = range.compareBoundaryPoints(Range.END_TO_END, wholeSpanRange) === 0;
    if (sameStart && sameEnd) {
      spanEl.style.lineHeight = value;
      onChange(editableRef.current!.innerHTML);
      savedRangeRef.current = null;
      return;
    }
  }

  const span = document.createElement("span");
  span.style.lineHeight = value;

  const fragment = range.extractContents();
  const spans: HTMLSpanElement[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === "SPAN") {
      spans.push(n as HTMLSpanElement);
    }
    n.childNodes.forEach(walk);
  };
  fragment.childNodes.forEach(walk);
  for (const s of spans) {
    if (s.style.lineHeight) {
      s.style.lineHeight = "";
      if (!s.style.cssText.trim()) s.removeAttribute("style");
    }
  }

  span.appendChild(fragment);
  range.insertNode(span);

  onChange(editableRef.current!.innerHTML);
  savedRangeRef.current = null;
}

function applyFontWeight(
  value: string,
  editableRef: React.RefObject<HTMLDivElement | null>,
  savedRangeRef: React.MutableRefObject<Range | null>,
  onChange: (html: string) => void
) {
  if (!editableRef.current) return;
  const sel = window.getSelection();
  if (!sel) return;
  if (savedRangeRef.current) {
    try {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    } catch {
      savedRangeRef.current = null;
      return;
    }
  }
  if (sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (node?.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "SPAN") {
    const spanEl = node as HTMLSpanElement;
    const wholeSpanRange = document.createRange();
    wholeSpanRange.selectNodeContents(spanEl);
    const sameStart = range.compareBoundaryPoints(Range.START_TO_START, wholeSpanRange) === 0;
    const sameEnd = range.compareBoundaryPoints(Range.END_TO_END, wholeSpanRange) === 0;
    if (sameStart && sameEnd) {
      spanEl.style.fontWeight = value;
      onChange(editableRef.current!.innerHTML);
      savedRangeRef.current = null;
      return;
    }
  }

  const span = document.createElement("span");
  span.style.fontWeight = value;

  const fragment = range.extractContents();
  const spans: HTMLSpanElement[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === "SPAN") {
      spans.push(n as HTMLSpanElement);
    }
    n.childNodes.forEach(walk);
  };
  fragment.childNodes.forEach(walk);
  for (const s of spans) {
    if (s.style.fontWeight) {
      s.style.fontWeight = "";
      if (!s.style.cssText.trim()) s.removeAttribute("style");
    }
  }

  span.appendChild(fragment);
  range.insertNode(span);

  onChange(editableRef.current!.innerHTML);
  savedRangeRef.current = null;
}

function applyLetterSpacing(
  value: string,
  editableRef: React.RefObject<HTMLDivElement | null>,
  savedRangeRef: React.MutableRefObject<Range | null>,
  onChange: (html: string) => void
) {
  if (!editableRef.current) return;
  const sel = window.getSelection();
  if (!sel) return;
  if (savedRangeRef.current) {
    try {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    } catch {
      savedRangeRef.current = null;
      return;
    }
  }
  if (sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (node?.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "SPAN") {
    const spanEl = node as HTMLSpanElement;
    const wholeSpanRange = document.createRange();
    wholeSpanRange.selectNodeContents(spanEl);
    const sameStart = range.compareBoundaryPoints(Range.START_TO_START, wholeSpanRange) === 0;
    const sameEnd = range.compareBoundaryPoints(Range.END_TO_END, wholeSpanRange) === 0;
    if (sameStart && sameEnd) {
      spanEl.style.letterSpacing = value;
      onChange(editableRef.current!.innerHTML);
      savedRangeRef.current = null;
      return;
    }
  }

  const span = document.createElement("span");
  span.style.letterSpacing = value;

  const fragment = range.extractContents();
  const spans: HTMLSpanElement[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === "SPAN") {
      spans.push(n as HTMLSpanElement);
    }
    n.childNodes.forEach(walk);
  };
  fragment.childNodes.forEach(walk);
  for (const s of spans) {
    if (s.style.letterSpacing) {
      s.style.letterSpacing = "";
      if (!s.style.cssText.trim()) s.removeAttribute("style");
    }
  }

  span.appendChild(fragment);
  range.insertNode(span);

  onChange(editableRef.current!.innerHTML);
  savedRangeRef.current = null;
}

function markLightColorSpans(container: HTMLElement) {
  container.querySelectorAll("span[style]").forEach((el) => {
    const span = el as HTMLSpanElement;
    const color = span.style.color;
    if (!color) {
      span.removeAttribute("data-preview-light");
      return;
    }
    const computed = window.getComputedStyle(span).color;
    const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      if (r > 200 && g > 200 && b > 200) {
        span.setAttribute("data-preview-light", "true");
        return;
      }
    }
    span.removeAttribute("data-preview-light");
  });
}

export function RichTextArea({
  value,
  onChange,
  placeholder = "Write something…",
  className,
  minHeight = "120px",
  locale = "en",
  customOptions,
  "data-testid": testId,
}: RichTextAreaProps) {
  const editableRef = useRef<HTMLDivElement | null>(null);
  const initialSynced = useRef(false);
  const savedSelectionRef = useRef<Range | null>(null);
  const savedLinkSelectionRef = useRef<Range | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const [lineHeightOpen, setLineHeightOpen] = useState(false);
  const [fontWeightOpen, setFontWeightOpen] = useState(false);
  const [letterSpacingOpen, setLetterSpacingOpen] = useState(false);
  const [customFontSizeMode, setCustomFontSizeMode] = useState(false);
  const [customFontSizeVal, setCustomFontSizeVal] = useState("");
  const [customFontWeightMode, setCustomFontWeightMode] = useState(false);
  const [customFontWeightVal, setCustomFontWeightVal] = useState("");
  const [customLetterSpacingMode, setCustomLetterSpacingMode] = useState(false);
  const [customLetterSpacingVal, setCustomLetterSpacingVal] = useState("");
  const [customLineHeightMode, setCustomLineHeightMode] = useState(false);
  const [customLineHeightVal, setCustomLineHeightVal] = useState("");

  const allowCustomFontSize = customOptions?.includes("custom-font-size") ?? false;
  const allowCustomFontWeight = customOptions?.includes("custom-font-weight") ?? false;
  const allowCustomLetterSpacing = customOptions?.includes("custom-letter-spacing") ?? false;
  const allowCustomLineHeight = customOptions?.includes("custom-line-height") ?? false;

  const [activeFontSize, setActiveFontSize] = useState<string | null>(null);
  const [activeFontWeight, setActiveFontWeight] = useState<string | null>(null);
  const [activeLetterSpacing, setActiveLetterSpacing] = useState<string | null>(null);
  const [activeLineHeight, setActiveLineHeight] = useState<string | null>(null);

  const detectSelectionStyle = useCallback(() => {
    const sel = window.getSelection();
    let node: Node | null = null;
    if (sel && sel.rangeCount > 0) {
      node = sel.getRangeAt(0).startContainer;
    } else if (savedSelectionRef.current) {
      node = savedSelectionRef.current.startContainer;
    }
    if (!node) return null;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
    if (!el) return null;
    return window.getComputedStyle(el as HTMLElement);
  }, []);

  const detectActiveFontSize = useCallback(() => {
    const cs = detectSelectionStyle();
    if (!cs) { setActiveFontSize(null); return; }
    const pxVal = parseFloat(cs.fontSize);
    if (isNaN(pxVal)) { setActiveFontSize(null); return; }
    setActiveFontSize(`${(pxVal / 16).toFixed(4).replace(/\.?0+$/, "")}rem`);
  }, [detectSelectionStyle]);

  const detectActiveFontWeight = useCallback(() => {
    const cs = detectSelectionStyle();
    if (!cs) { setActiveFontWeight(null); return; }
    setActiveFontWeight(cs.fontWeight || null);
  }, [detectSelectionStyle]);

  const detectActiveLetterSpacing = useCallback(() => {
    const cs = detectSelectionStyle();
    if (!cs) { setActiveLetterSpacing(null); return; }
    const raw = cs.letterSpacing;
    if (!raw || raw === "normal") { setActiveLetterSpacing("0em"); return; }
    const pxVal = parseFloat(raw);
    if (isNaN(pxVal)) { setActiveLetterSpacing(null); return; }
    const fontSize = parseFloat(cs.fontSize) || 16;
    setActiveLetterSpacing(`${(pxVal / fontSize).toFixed(4).replace(/\.?0+$/, "")}em`);
  }, [detectSelectionStyle]);

  const detectActiveLineHeight = useCallback(() => {
    const cs = detectSelectionStyle();
    if (!cs) { setActiveLineHeight(null); return; }
    const raw = cs.lineHeight;
    if (!raw || raw === "normal") { setActiveLineHeight(null); return; }
    const pxVal = parseFloat(raw);
    const fsPx = parseFloat(cs.fontSize) || 16;
    if (isNaN(pxVal) || isNaN(fsPx)) { setActiveLineHeight(null); return; }
    setActiveLineHeight(`${(pxVal / fsPx).toFixed(4).replace(/\.?0+$/, "")}`);
  }, [detectSelectionStyle]);

  const [linkHoverPopover, setLinkHoverPopover] = useState<{
    anchor: HTMLAnchorElement;
    rect: DOMRect;
  } | null>(null);
  const linkPopoverRef = useRef<HTMLDivElement | null>(null);

  // Keep "last non-collapsed selection" so we still have it when user opens color popover (focus move collapses selection)
  useEffect(() => {
    const onSelectionChange = () => {
      const el = editableRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed) return;
      if (!el.contains(range.commonAncestorContainer)) return;
      savedSelectionRef.current = range.cloneRange();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState("");
  const [linkCustomMode, setLinkCustomMode] = useState(false);
  const [linkCustomUrl, setLinkCustomUrl] = useState("");

  const { data: theme, isLoading: themeLoading } = useQuery<ThemeConfig>({
    queryKey: ["/api/theme"],
  });

  const { data: sitemapUrls = [], isLoading: sitemapLoading } = useQuery<SitemapEntry[]>({
    queryKey: ["/api/sitemap-urls", locale],
    queryFn: async () => {
      const response = await fetch(`/api/sitemap-urls?locale=${locale}`);
      if (!response.ok) throw new Error("Failed to load sitemap URLs");
      return response.json();
    },
    enabled: linkOpen,
  });

  const filteredLinkUrls = useMemo(() => {
    if (!linkSearchQuery.trim()) return sitemapUrls;
    const q = linkSearchQuery.toLowerCase();
    return sitemapUrls.filter(
      (entry) =>
        entry.loc.toLowerCase().includes(q) || entry.label.toLowerCase().includes(q)
    );
  }, [sitemapUrls, linkSearchQuery]);

  const textColors = theme?.text ?? [];
  const fontSizes = theme?.fontSizes ?? [];
  const lineHeights = theme?.lineHeights ?? [];
  const fontWeights = theme?.fontWeights ?? [];
  const letterSpacings = theme?.letterSpacings ?? [];

  useEffect(() => {
    if (!editableRef.current || initialSynced.current) return;
    initialSynced.current = true;
    editableRef.current.innerHTML = value || "";
    markLightColorSpans(editableRef.current);
  }, [value]);

  const getCleanInnerHTML = useCallback(() => {
    if (!editableRef.current) return "";
    const clone = editableRef.current.cloneNode(true) as HTMLDivElement;
    clone.querySelectorAll("[data-preview-light]").forEach((el) => {
      el.removeAttribute("data-preview-light");
    });
    return clone.innerHTML;
  }, []);

  const handleInput = useCallback(() => {
    if (editableRef.current) {
      onChange(getCleanInnerHTML());
      markLightColorSpans(editableRef.current);
    }
  }, [onChange, getCleanInnerHTML]);

  const applyCommand = useCallback(
    (command: string, value?: string) => {
      editableRef.current?.focus();
      document.execCommand(command, false, value ?? undefined);
      handleInput();
    },
    [handleInput],
  );

  const handleBold = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      applyCommand("bold");
    },
    [applyCommand],
  );

  const handleItalic = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      applyCommand("italic");
    },
    [applyCommand],
  );

  const handleBulletList = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      applyCommand("insertUnorderedList");
    },
    [applyCommand],
  );

  const handleRemoveFormatting = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!editableRef.current) return;
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editableRef.current);
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.execCommand("removeFormat");
      editableRef.current.querySelectorAll("[style]").forEach((el) => {
        (el as HTMLElement).removeAttribute("style");
      });
      onChange(editableRef.current.innerHTML);
    },
    [onChange],
  );

  const handleLinkPopoverOpen = useCallback((open: boolean) => {
    if (open) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editableRef.current) {
        const range = sel.getRangeAt(0);
        if (!range.collapsed && editableRef.current.contains(range.commonAncestorContainer)) {
          savedLinkSelectionRef.current = range.cloneRange();
        }
      }
      setLinkSearchQuery("");
      setLinkCustomMode(false);
      setLinkCustomUrl("");
    } else {
      savedLinkSelectionRef.current = null;
    }
    setLinkOpen(open);
  }, []);

  const applyLink = useCallback(
    (url: string) => {
      if (!url?.trim()) return;
      const sel = window.getSelection();
      if (sel && savedLinkSelectionRef.current) {
        try {
          sel.removeAllRanges();
          sel.addRange(savedLinkSelectionRef.current);
        } catch {
          savedLinkSelectionRef.current = null;
        }
      }
      savedLinkSelectionRef.current = null;
      editableRef.current?.focus();
      applyCommand("createLink", url.trim());
      setLinkOpen(false);
    },
    [applyCommand],
  );

  const handleLinkCustomSubmit = useCallback(() => {
    applyLink(linkCustomUrl);
  }, [applyLink, linkCustomUrl]);

  const handleColorSelect = useCallback(
    (cssVar: string) => {
      if (!cssVar) return;
      editableRef.current?.focus();
      applyTextColor(cssVar, editableRef, savedSelectionRef, onChange);
      setColorOpen(false);
      requestAnimationFrame(() => {
        if (editableRef.current) markLightColorSpans(editableRef.current);
      });
    },
    [onChange],
  );

  const handleFontSizeSelect = useCallback(
    (sizeValue: string) => {
      if (!sizeValue) return;
      editableRef.current?.focus();
      applyFontSize(sizeValue, editableRef, savedSelectionRef, onChange);
      setFontSizeOpen(false);
    },
    [onChange],
  );

  const handleLineHeightSelect = useCallback(
    (lhValue: string) => {
      if (!lhValue) return;
      editableRef.current?.focus();
      applyLineHeight(lhValue, editableRef, savedSelectionRef, onChange);
      setLineHeightOpen(false);
    },
    [onChange],
  );

  const handleFontWeightSelect = useCallback(
    (weightValue: string) => {
      if (!weightValue) return;
      editableRef.current?.focus();
      applyFontWeight(weightValue, editableRef, savedSelectionRef, onChange);
      setFontWeightOpen(false);
    },
    [onChange],
  );

  const handleLetterSpacingSelect = useCallback(
    (spacingValue: string) => {
      if (!spacingValue) return;
      editableRef.current?.focus();
      applyLetterSpacing(spacingValue, editableRef, savedSelectionRef, onChange);
      setLetterSpacingOpen(false);
    },
    [onChange],
  );

  const handleCustomFontSizeApply = useCallback(() => {
    const px = parseFloat(customFontSizeVal);
    if (!isNaN(px) && px > 0) {
      const rem = (px / 16).toFixed(4).replace(/\.?0+$/, "") + "rem";
      handleFontSizeSelect(rem);
    }
    setCustomFontSizeMode(false);
    setCustomFontSizeVal("");
  }, [customFontSizeVal, handleFontSizeSelect]);

  const handleCustomFontWeightApply = useCallback(() => {
    const w = parseFloat(customFontWeightVal);
    if (!isNaN(w) && w >= 100 && w <= 900) {
      handleFontWeightSelect(String(Math.round(w / 100) * 100));
    }
    setCustomFontWeightMode(false);
    setCustomFontWeightVal("");
  }, [customFontWeightVal, handleFontWeightSelect]);

  const handleCustomLetterSpacingApply = useCallback(() => {
    const v = parseFloat(customLetterSpacingVal);
    if (!isNaN(v)) {
      handleLetterSpacingSelect(`${v}em`);
    }
    setCustomLetterSpacingMode(false);
    setCustomLetterSpacingVal("");
  }, [customLetterSpacingVal, handleLetterSpacingSelect]);

  const handleCustomLineHeightApply = useCallback(() => {
    const v = parseFloat(customLineHeightVal);
    if (!isNaN(v) && v > 0) {
      handleLineHeightSelect(String(v));
    }
    setCustomLineHeightMode(false);
    setCustomLineHeightVal("");
  }, [customLineHeightVal, handleLineHeightSelect]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (!html) return;
    e.preventDefault();
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.body.querySelectorAll("*").forEach((el) => {
      const s = (el as HTMLElement).style;
      if (s.color) s.color = "";
      if (s.backgroundColor) s.backgroundColor = "";
      if (s.background) s.background = "";
      if (!s.cssText.trim()) el.removeAttribute("style");
    });
    const clean = doc.body.innerHTML;
    document.execCommand("insertHTML", false, clean);
    handleInput();
  }, [handleInput]);

  const handleColorTriggerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleColorPopoverOpen = useCallback((open: boolean) => {
    setColorOpen(open);
  }, []);

  const handleLinkHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = editableRef.current;
    if (!el) return;
    const target = (e.target as Node);
    if (!el.contains(target)) return;
    const a = (e.target as Element).closest?.("a");
    if (a && el.contains(a)) {
      setLinkHoverPopover({ anchor: a as HTMLAnchorElement, rect: a.getBoundingClientRect() });
    }
  }, []);

  const handleLinkHoverLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as Node | null;
    if (related && linkPopoverRef.current?.contains(related)) return;
    setLinkHoverPopover(null);
  }, []);

  const handleUnlink = useCallback(() => {
    if (!linkHoverPopover || !editableRef.current) return;
    const { anchor } = linkHoverPopover;
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(anchor);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    document.execCommand("unlink", false);
    if (editableRef.current) onChange(editableRef.current.innerHTML);
    setLinkHoverPopover(null);
  }, [linkHoverPopover, onChange]);

  return (
    <div className={cn("rounded-md border border-input bg-background overflow-hidden", className)}>
      {/* Toolbar - same visual style as section editor */}
      <div className="flex items-center gap-0.5 p-1 border-b border-input bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onMouseDown={handleBold}
          title="Bold"
          data-testid={testId ? `${testId}-bold` : undefined}
        >
          <IconBold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onMouseDown={handleItalic}
          title="Italic"
          data-testid={testId ? `${testId}-italic` : undefined}
        >
          <IconItalic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onMouseDown={handleBulletList}
          title="Bullet list"
          data-testid={testId ? `${testId}-bullet-list` : undefined}
        >
          <IconList className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onMouseDown={handleRemoveFormatting}
          title="Remove formatting"
          data-testid={testId ? `${testId}-remove-formatting` : undefined}
        >
          <IconEraser className="h-4 w-4" />
        </Button>

        <Popover open={linkOpen} onOpenChange={handleLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onMouseDown={(e) => e.preventDefault()}
              title="Insert link"
              data-testid={testId ? `${testId}-link` : undefined}
            >
              <IconLink className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 z-[10000]" align="start">
            <div className="p-2 border-b">
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={linkSearchQuery}
                  onChange={(e) => {
                    setLinkSearchQuery(e.target.value);
                    setLinkCustomMode(false);
                  }}
                  placeholder="Search pages..."
                  className="h-8 pl-8 text-sm"
                  autoFocus
                  data-testid={testId ? `${testId}-link-search` : undefined}
                />
              </div>
            </div>
            {linkCustomMode ? (
              <div className="p-2 space-y-2">
                <p className="text-xs text-muted-foreground">Enter a custom URL:</p>
                <div className="flex gap-2">
                  <Input
                    value={linkCustomUrl}
                    onChange={(e) => setLinkCustomUrl(e.target.value)}
                    placeholder="/custom-url or https://..."
                    className="h-8 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleLinkCustomSubmit()}
                    data-testid={testId ? `${testId}-link-custom-input` : undefined}
                  />
                  <Button size="sm" className="h-8" onClick={handleLinkCustomSubmit} data-testid={testId ? `${testId}-link-custom-save` : undefined}>
                    Save
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => setLinkCustomMode(false)}
                  className="text-xs text-muted-foreground hover:underline px-1 py-0.5 rounded"
                >
                  Back to search
                </button>
              </div>
            ) : (
              <>
                <ScrollArea className="h-[200px]">
                  {sitemapLoading ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      Loading pages...
                    </div>
                  ) : filteredLinkUrls.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      {linkSearchQuery ? "No pages found" : "No pages available"}
                    </div>
                  ) : (
                    <div className="p-1">
                      {filteredLinkUrls.map((entry: SitemapEntry, index: number) => (
                        <button
                          key={entry.loc}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyLink(extractPath(entry.loc));
                          }}
                          className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 flex items-start gap-2"
                          data-testid={testId ? `${testId}-link-option-${index}` : undefined}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground truncate text-xs">
                              {entry.label}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {extractPath(entry.loc)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <div className="p-2 border-t">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setLinkCustomMode(true);
                      setLinkCustomUrl("");
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted/50"
                    data-testid={testId ? `${testId}-link-custom-toggle` : undefined}
                  >
                    <IconExternalLink className="h-4 w-4" />
                    <span>Use custom URL</span>
                  </button>
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>

        <Popover open={colorOpen} onOpenChange={handleColorPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onMouseDown={handleColorTriggerMouseDown}
              title="Text color"
              data-testid={testId ? `${testId}-color-trigger` : undefined}
            >
              <IconPalette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 z-[10000]" align="start">
            {themeLoading ? (
              <div className="flex items-center justify-center h-12 w-32">
                <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {textColors.map((color) => {
                  const cssValue = color.cssVar
                    ? `hsl(var(${color.cssVar}))`
                    : color.value ?? "";
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (color.cssVar) handleColorSelect(color.cssVar);
                      }}
                      className="w-7 h-7 rounded border-2 border-border hover:border-primary/50 transition-all"
                      title={color.label}
                      style={{ background: cssValue }}
                      data-testid={testId ? `${testId}-color-${color.id}` : undefined}
                    />
                  );
                })}
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Popover open={fontSizeOpen} onOpenChange={(open) => { setFontSizeOpen(open); if (open) detectActiveFontSize(); else { setCustomFontSizeMode(false); setCustomFontSizeVal(""); } }}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onMouseDown={(e) => e.preventDefault()}
              title="Font size"
              data-testid={testId ? `${testId}-fontsize-trigger` : undefined}
            >
              <IconTextSize className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1 z-[10000]" align="start">
            {themeLoading ? (
              <div className="flex items-center justify-center h-12 w-32">
                <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {fontSizes.map((size) => {
                  const isActive = activeFontSize !== null && Math.abs(parseFloat(activeFontSize) - parseFloat(size.value)) < 0.001;
                  return (
                  <button
                    key={size.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleFontSizeSelect(size.value);
                    }}
                    className={`flex items-center justify-between gap-4 px-3 py-1.5 rounded-md text-left hover:bg-muted/50 transition-colors${isActive ? " bg-accent/20 font-medium" : ""}`}
                    data-testid={testId ? `${testId}-fontsize-${size.id}` : undefined}
                  >
                    <span style={{ fontSize: size.value }} className="text-foreground">
                      {size.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{size.tailwind}</span>
                  </button>
                  );
                })}
                {allowCustomFontSize && (
                  customFontSizeMode ? (
                    <div className="border-t mt-0.5 pt-1 px-1 space-y-1">
                      <p className="text-xs text-muted-foreground px-2">Size in px:</p>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          min={1}
                          value={customFontSizeVal}
                          onChange={(e) => setCustomFontSizeVal(e.target.value)}
                          className="h-7 text-xs w-20"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); handleCustomFontSizeApply(); }
                            if (e.key === "Escape") { setCustomFontSizeMode(false); setCustomFontSizeVal(""); }
                          }}
                          onBlur={handleCustomFontSizeApply}
                          data-testid={testId ? `${testId}-fontsize-custom-input` : undefined}
                        />
                        <Button size="sm" className="h-7 text-xs px-2" onMouseDown={(e) => e.preventDefault()} onClick={handleCustomFontSizeApply} data-testid={testId ? `${testId}-fontsize-custom-apply` : undefined}>
                          Apply
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (activeFontSize && !fontSizes.some(s => Math.abs(parseFloat(activeFontSize) - parseFloat(s.value)) < 0.001)) {
                          setCustomFontSizeVal(String(Math.round(parseFloat(activeFontSize) * 16)));
                        }
                        setCustomFontSizeMode(true);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-left hover:bg-muted/50 transition-colors border-t mt-0.5 pt-2 text-xs text-muted-foreground w-full"
                      data-testid={testId ? `${testId}-fontsize-custom-toggle` : undefined}
                    >
                      Custom (px)…
                    </button>
                  )
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Popover open={lineHeightOpen} onOpenChange={(open) => { setLineHeightOpen(open); if (open) detectActiveLineHeight(); else { setCustomLineHeightMode(false); setCustomLineHeightVal(""); } }}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onMouseDown={(e) => e.preventDefault()}
              title="Line height"
              data-testid={testId ? `${testId}-lineheight-trigger` : undefined}
            >
              <IconLineHeight className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1 z-[10000]" align="start">
            {themeLoading ? (
              <div className="flex items-center justify-center h-12 w-32">
                <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {lineHeights.map((lh) => {
                  const isActive = activeLineHeight !== null && Math.abs(parseFloat(activeLineHeight) - parseFloat(lh.value)) < 0.01;
                  return (
                  <button
                    key={lh.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleLineHeightSelect(lh.value);
                    }}
                    className={`flex items-center justify-between gap-4 px-3 py-1.5 rounded-md text-left hover:bg-muted/50 transition-colors${isActive ? " bg-accent/20 font-medium" : ""}`}
                    data-testid={testId ? `${testId}-lineheight-${lh.id}` : undefined}
                  >
                    <span className="text-foreground text-sm">{lh.label}</span>
                    <span className="text-xs text-muted-foreground">{lh.value}</span>
                  </button>
                  );
                })}
                {allowCustomLineHeight && (
                  customLineHeightMode ? (
                    <div className="border-t mt-0.5 pt-1 px-1 space-y-1">
                      <p className="text-xs text-muted-foreground px-2">Line height:</p>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          min={0.5}
                          step={0.1}
                          value={customLineHeightVal}
                          onChange={(e) => setCustomLineHeightVal(e.target.value)}
                          className="h-7 text-xs w-20"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); handleCustomLineHeightApply(); }
                            if (e.key === "Escape") { setCustomLineHeightMode(false); setCustomLineHeightVal(""); }
                          }}
                          onBlur={handleCustomLineHeightApply}
                          data-testid={testId ? `${testId}-lineheight-custom-input` : undefined}
                        />
                        <Button size="sm" className="h-7 text-xs px-2" onMouseDown={(e) => e.preventDefault()} onClick={handleCustomLineHeightApply} data-testid={testId ? `${testId}-lineheight-custom-apply` : undefined}>
                          Apply
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (activeLineHeight && !lineHeights.some(lh => Math.abs(parseFloat(activeLineHeight) - parseFloat(lh.value)) < 0.01)) {
                          setCustomLineHeightVal(activeLineHeight);
                        }
                        setCustomLineHeightMode(true);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-left hover:bg-muted/50 transition-colors border-t mt-0.5 pt-2 text-xs text-muted-foreground w-full"
                      data-testid={testId ? `${testId}-lineheight-custom-toggle` : undefined}
                    >
                      Custom…
                    </button>
                  )
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Popover open={fontWeightOpen} onOpenChange={(open) => { setFontWeightOpen(open); if (open) detectActiveFontWeight(); else { setCustomFontWeightMode(false); setCustomFontWeightVal(""); } }}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onMouseDown={(e) => e.preventDefault()}
              title="Font weight"
              data-testid={testId ? `${testId}-fontweight-trigger` : undefined}
            >
              <IconLetterCase className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1 z-[10000]" align="start">
            {themeLoading ? (
              <div className="flex items-center justify-center h-12 w-32">
                <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {fontWeights.map((fw) => {
                  const isActive = activeFontWeight !== null && Math.abs(parseFloat(activeFontWeight) - parseFloat(fw.value)) < 1;
                  return (
                  <button
                    key={fw.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleFontWeightSelect(fw.value);
                    }}
                    className={`flex items-center justify-between gap-4 px-3 py-1.5 rounded-md text-left hover:bg-muted/50 transition-colors${isActive ? " bg-accent/20 font-medium" : ""}`}
                    data-testid={testId ? `${testId}-fontweight-${fw.id}` : undefined}
                  >
                    <span className="text-foreground text-sm" style={{ fontWeight: fw.value }}>{fw.label}</span>
                    <span className="text-xs text-muted-foreground">{fw.value}</span>
                  </button>
                  );
                })}
                {allowCustomFontWeight && (
                  customFontWeightMode ? (
                    <div className="border-t mt-0.5 pt-1 px-1 space-y-1">
                      <p className="text-xs text-muted-foreground px-2">Weight (100–900):</p>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          min={100}
                          max={900}
                          step={100}
                          value={customFontWeightVal}
                          onChange={(e) => setCustomFontWeightVal(e.target.value)}
                          className="h-7 text-xs w-20"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); handleCustomFontWeightApply(); }
                            if (e.key === "Escape") { setCustomFontWeightMode(false); setCustomFontWeightVal(""); }
                          }}
                          onBlur={handleCustomFontWeightApply}
                          data-testid={testId ? `${testId}-fontweight-custom-input` : undefined}
                        />
                        <Button size="sm" className="h-7 text-xs px-2" onMouseDown={(e) => e.preventDefault()} onClick={handleCustomFontWeightApply} data-testid={testId ? `${testId}-fontweight-custom-apply` : undefined}>
                          Apply
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (activeFontWeight && !fontWeights.some(fw => Math.abs(parseFloat(activeFontWeight) - parseFloat(fw.value)) < 1)) {
                          setCustomFontWeightVal(activeFontWeight);
                        }
                        setCustomFontWeightMode(true);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-left hover:bg-muted/50 transition-colors border-t mt-0.5 pt-2 text-xs text-muted-foreground w-full"
                      data-testid={testId ? `${testId}-fontweight-custom-toggle` : undefined}
                    >
                      Custom…
                    </button>
                  )
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Popover open={letterSpacingOpen} onOpenChange={(open) => { setLetterSpacingOpen(open); if (open) detectActiveLetterSpacing(); else { setCustomLetterSpacingMode(false); setCustomLetterSpacingVal(""); } }}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onMouseDown={(e) => e.preventDefault()}
              title="Letter spacing"
              data-testid={testId ? `${testId}-letterspacing-trigger` : undefined}
            >
              <IconLetterSpacing className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1 z-[10000]" align="start">
            {themeLoading ? (
              <div className="flex items-center justify-center h-12 w-32">
                <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {letterSpacings.map((ls) => {
                  const isActive = activeLetterSpacing !== null && Math.abs(parseFloat(activeLetterSpacing) - parseFloat(ls.value)) < 0.001;
                  return (
                  <button
                    key={ls.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleLetterSpacingSelect(ls.value);
                    }}
                    className={`flex items-center justify-between gap-4 px-3 py-1.5 rounded-md text-left hover:bg-muted/50 transition-colors${isActive ? " bg-accent/20 font-medium" : ""}`}
                    data-testid={testId ? `${testId}-letterspacing-${ls.id}` : undefined}
                  >
                    <span className="text-foreground text-sm" style={{ letterSpacing: ls.value }}>{ls.label}</span>
                    <span className="text-xs text-muted-foreground">{ls.value}</span>
                  </button>
                  );
                })}
                {allowCustomLetterSpacing && (
                  customLetterSpacingMode ? (
                    <div className="border-t mt-0.5 pt-1 px-1 space-y-1">
                      <p className="text-xs text-muted-foreground px-2">Spacing (em):</p>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          step={0.01}
                          value={customLetterSpacingVal}
                          onChange={(e) => setCustomLetterSpacingVal(e.target.value)}
                          className="h-7 text-xs w-20"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); handleCustomLetterSpacingApply(); }
                            if (e.key === "Escape") { setCustomLetterSpacingMode(false); setCustomLetterSpacingVal(""); }
                          }}
                          onBlur={handleCustomLetterSpacingApply}
                          data-testid={testId ? `${testId}-letterspacing-custom-input` : undefined}
                        />
                        <Button size="sm" className="h-7 text-xs px-2" onMouseDown={(e) => e.preventDefault()} onClick={handleCustomLetterSpacingApply} data-testid={testId ? `${testId}-letterspacing-custom-apply` : undefined}>
                          Apply
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (activeLetterSpacing && !letterSpacings.some(ls => Math.abs(parseFloat(activeLetterSpacing) - parseFloat(ls.value)) < 0.001)) {
                          setCustomLetterSpacingVal(activeLetterSpacing.replace("em", ""));
                        }
                        setCustomLetterSpacingMode(true);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-left hover:bg-muted/50 transition-colors border-t mt-0.5 pt-2 text-xs text-muted-foreground w-full"
                      data-testid={testId ? `${testId}-letterspacing-custom-toggle` : undefined}
                    >
                      Custom (em)…
                    </button>
                  )
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
      <div
        className="relative"
        onMouseOver={handleLinkHover}
        onMouseLeave={handleLinkHoverLeave}
      >
        <div
          ref={editableRef}
          contentEditable
          data-placeholder={placeholder}
          className={cn(
            "min-h-[120px] px-3 py-2 text-sm outline-none overflow-auto rich-text-bullets",
            "focus:ring-2 focus:ring-ring focus:ring-offset-0",
            "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground",
            "[&_a]:underline [&_a]:text-primary [&_a]:cursor-pointer",
            "[&_[data-preview-light]]:!text-muted-foreground",
          )}
          style={{ minHeight }}
          onInput={handleInput}
          onPaste={handlePaste}
          data-testid={testId}
        />
        {linkHoverPopover && (
          <div
            ref={linkPopoverRef}
            data-link-popover
            className="fixed z-[10001] flex items-center gap-1 rounded-md border border-border bg-popover px-2 py-1 shadow-md"
            style={{
              top: linkHoverPopover.rect.top - 36,
              left: linkHoverPopover.rect.left,
            }}
          >
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleUnlink}
              className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
              title="Remove link"
            >
              <IconLinkOff className="h-3.5 w-3.5" />
              Remove link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
