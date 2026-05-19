import path from "path";

export const SAFE_SEGMENT_RE = /^[a-zA-Z0-9_\-]+$/;
export const SAFE_LOCALE_RE = /^[a-z]{2}(-[a-z]{2})?$/;

export function assertSafeSegment(value: string, label: string): void {
  if (!SAFE_SEGMENT_RE.test(value)) {
    throw new Error(`Invalid ${label}: '${value}'. Only alphanumerics, hyphens, and underscores are allowed.`);
  }
}

export function assertSafeLocale(value: string): void {
  if (!SAFE_LOCALE_RE.test(value)) {
    throw new Error(`Invalid locale: '${value}'. Expected a BCP-47 code like 'en' or 'es'.`);
  }
}

export function assertWithinBase(resolvedPath: string, basePath: string): void {
  const rel = path.relative(basePath, resolvedPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path traversal detected: '${resolvedPath}' is outside '${basePath}'.`);
  }
}
