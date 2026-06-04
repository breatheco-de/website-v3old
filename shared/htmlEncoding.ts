const HTML_TAG_RE = /<[a-zA-Z][^>]*>/;

function isHtmlMarker(value: unknown): value is { __html: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "__html" in value &&
    typeof (value as Record<string, unknown>).__html === "string" &&
    Object.keys(value).length === 1
  );
}

export function encodeHtmlValues(obj: unknown): unknown {
  if (typeof obj === "string") {
    if (HTML_TAG_RE.test(obj)) {
      return { __html: btoa(unescape(encodeURIComponent(obj))) };
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(encodeHtmlValues);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      result[key] = encodeHtmlValues((obj as Record<string, unknown>)[key]);
    }
    return result;
  }
  return obj;
}

export function decodeHtmlValues(obj: unknown): unknown {
  if (isHtmlMarker(obj)) {
    try {
      return decodeURIComponent(escape(atob(obj.__html)));
    } catch {
      return obj;
    }
  }
  if (Array.isArray(obj)) {
    return obj.map(decodeHtmlValues);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      result[key] = decodeHtmlValues((obj as Record<string, unknown>)[key]);
    }
    return result;
  }
  return obj;
}
