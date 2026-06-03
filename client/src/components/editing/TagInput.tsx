import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { IconX } from "@tabler/icons-react";

export function TagInput({
  values,
  suggestions,
  onChange,
  placeholder,
  max,
  testId,
}: {
  values: string[];
  suggestions: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  testId?: string;
}) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(inputValue.toLowerCase()) && !values.includes(s),
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addValue = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || values.includes(trimmed)) { setInputValue(""); return; }
    if (max && values.length >= max) {
      onChange([trimmed]);
    } else {
      onChange([...values, trimmed]);
    }
    setInputValue("");
    setOpen(false);
    setHighlightIndex(0);
    inputRef.current?.focus();
  };

  const removeValue = (i: number) => {
    onChange(values.filter((_, idx) => idx !== i));
    inputRef.current?.focus();
  };

  const canAddMore = !max || values.length < max;

  return (
    <div ref={containerRef} className="relative" data-testid={testId}>
      <div
        className="flex flex-wrap gap-1.5 items-center min-h-9 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm cursor-text focus-within:ring-1 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((v, i) => (
          <Badge key={i} variant="secondary" className="flex items-center gap-1 text-xs font-mono font-normal px-1.5 py-0 leading-5">
            {v}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeValue(i); }}
              className="ml-0.5 rounded hover:bg-muted"
            >
              <IconX className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {canAddMore && (
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setOpen(true); setHighlightIndex(0); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                if (filtered.length > 0 && inputValue) {
                  addValue(filtered[highlightIndex] ?? inputValue);
                } else if (inputValue) {
                  addValue(inputValue);
                }
              } else if (e.key === "Backspace" && !inputValue && values.length > 0) {
                removeValue(values.length - 1);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder={values.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[80px] outline-none bg-transparent text-xs placeholder:text-muted-foreground"
          />
        )}
      </div>
      {open && (filtered.length > 0 ? (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
          <ul className="max-h-40 overflow-y-auto py-1">
            {filtered.map((s, i) => (
              <li
                key={s}
                className={`px-3 py-1.5 text-xs cursor-pointer font-mono ${i === highlightIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"}`}
                onMouseDown={(e) => { e.preventDefault(); addValue(s); }}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
          <p className="px-3 py-2 text-xs text-muted-foreground italic">No previous tags found</p>
        </div>
      ))}
    </div>
  );
}
