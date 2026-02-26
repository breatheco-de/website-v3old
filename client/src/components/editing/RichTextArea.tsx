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
  IconEraser,
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

interface ThemeConfig {
  text?: ThemeColor[];
  fontSizes?: ThemeFontSize[];
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

export function RichTextArea({
  value,
  onChange,
  placeholder = "Write something…",
  className,
  minHeight = "120px",
  locale = "en",
  "data-testid": testId,
}: RichTextAreaProps) {
  const editableRef = useRef<HTMLDivElement | null>(null);
  const initialSynced = useRef(false);
  const savedSelectionRef = useRef<Range | null>(null);
  const savedLinkSelectionRef = useRef<Range | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
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

  // Sync value only once on mount (parent should use key to remount when section/field changes)
  useEffect(() => {
    if (!editableRef.current || initialSynced.current) return;
    initialSynced.current = true;
    editableRef.current.innerHTML = value || "";
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

        <Popover open={fontSizeOpen} onOpenChange={setFontSizeOpen}>
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
                {fontSizes.map((size) => (
                  <button
                    key={size.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleFontSizeSelect(size.value);
                    }}
                    className="flex items-center justify-between gap-4 px-3 py-1.5 rounded-md text-left hover:bg-muted/50 transition-colors"
                    data-testid={testId ? `${testId}-fontsize-${size.id}` : undefined}
                  >
                    <span style={{ fontSize: size.value }} className="text-foreground">
                      {size.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{size.tailwind}</span>
                  </button>
                ))}
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
