import { useState } from "react";
import { X } from "lucide-react";
import type { TagInputProps } from "../types";

export function TagInput({ tags, setTags, placeholder, suggestions, testId, transform }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  
  const filteredSuggestions = suggestions?.filter(
    s => s.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(s)
  ).slice(0, 6) || [];
  
  const addTag = (value: string) => {
    const processed = transform ? transform(value) : value.trim();
    if (processed && !tags.includes(processed)) {
      setTags([...tags, processed]);
    }
    setInputValue("");
    setShowSuggestions(false);
  };
  
  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (showSuggestions && filteredSuggestions.length > 0) {
        addTag(filteredSuggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === "ArrowDown" && showSuggestions) {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
    } else if (e.key === "ArrowUp" && showSuggestions) {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };
  
  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 p-2 min-h-[38px] rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-primary/10 text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] text-sm bg-transparent outline-none"
          data-testid={testId}
        />
      </div>
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 py-1 rounded-md border bg-popover shadow-md max-h-[150px] overflow-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={() => addTag(suggestion)}
              className={`w-full px-3 py-1.5 text-left text-sm ${
                index === highlightedIndex ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
