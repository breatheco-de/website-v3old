import type { Request, Response, NextFunction } from "express";
import { contentIndex, type RedirectEntry } from "./content-index";

let redirectMap: Map<string, RedirectEntry> | null = null;
let regexRedirects: Array<{ regex: RegExp; entry: RedirectEntry }> | null = null;

export function isRegexPattern(path: string): boolean {
  return /\(.*\)|\[.*\]|\.\*|\.\+|\\d|\\w|\\s|\{\d+[,}]/.test(path);
}

function buildRedirectMap(): Map<string, RedirectEntry> {
  const entries = contentIndex.getRedirects();
  const map = new Map<string, RedirectEntry>();
  const regexList: Array<{ regex: RegExp; entry: RedirectEntry }> = [];

  for (const entry of entries) {
    if (isRegexPattern(entry.from)) {
      if (entry.from.length > 500) {
        console.warn(`[Redirects] Regex pattern too long, skipping: ${entry.from.substring(0, 50)}...`);
        continue;
      }
      try {
        const regex = new RegExp(`^${entry.from}$`, "i");
        regexList.push({ regex, entry });
      } catch {
        console.warn(`[Redirects] Invalid regex pattern: ${entry.from}`);
      }
    } else {
      if (!map.has(entry.from)) {
        map.set(entry.from, entry);
      }
    }
  }

  regexRedirects = regexList;
  console.log(`[Redirects] Loaded ${map.size} exact redirects, ${regexList.length} regex redirects`);
  return map;
}

function getRedirectMap(): Map<string, RedirectEntry> {
  if (!redirectMap) {
    redirectMap = buildRedirectMap();
  }
  return redirectMap;
}

function normalizePath(urlPath: string): string {
  let normalized = urlPath.toLowerCase();
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function detectLocale(req: Request): string {
  const acceptLang = req.headers["accept-language"];
  if (acceptLang && typeof acceptLang === "string") {
    const primary = acceptLang.split(",")[0]?.trim().toLowerCase() || "";
    if (primary.startsWith("es")) return "es";
  }
  return "en";
}

function resolveRedirectTarget(entry: RedirectEntry, req: Request, captureGroups?: string[]): string {
  let target: string;
  if (typeof entry.to === "string") {
    target = entry.to;
  } else {
    const locale = detectLocale(req);
    target = entry.to[locale] || entry.to["en"] || Object.values(entry.to)[0] || "/";
  }

  if (captureGroups && captureGroups.length > 0) {
    for (let i = 0; i < captureGroups.length; i++) {
      target = target.replace(new RegExp(`\\$${i + 1}`, "g"), captureGroups[i]);
    }
  }

  return target;
}

export function redirectMiddleware(req: Request, res: Response, next: NextFunction): void {
  const map = getRedirectMap();
  const normalizedPath = normalizePath(req.path);

  const entry = map.get(normalizedPath);
  if (entry) {
    const status = entry.status || 301;
    const target = resolveRedirectTarget(entry, req);
    console.log(`[Redirects] ${status}: ${req.path} -> ${target}`);
    res.redirect(status, target);
    return;
  }

  if (regexRedirects) {
    for (const { regex, entry: regexEntry } of regexRedirects) {
      const match = req.path.match(regex);
      if (match) {
        const captureGroups = match.slice(1);
        const status = regexEntry.status || 301;
        const target = resolveRedirectTarget(regexEntry, req, captureGroups);
        console.log(`[Redirects] ${status} (regex): ${req.path} -> ${target}`);
        res.redirect(status, target);
        return;
      }
    }
  }

  next();
}

export function getRedirects(): Array<{ from: string; to: string | Record<string, string>; type: string; status: number; source: string }> {
  const map = getRedirectMap();
  const result: Array<{ from: string; to: string | Record<string, string>; type: string; status: number; source: string }> = [];

  for (const [from, entry] of map) {
    result.push({
      from,
      to: entry.to,
      type: entry.type,
      status: entry.status || 301,
      source: entry.source,
    });
  }

  if (regexRedirects) {
    for (const { entry } of regexRedirects) {
      result.push({
        from: entry.from,
        to: entry.to,
        type: entry.type,
        status: entry.status || 301,
        source: entry.source,
      });
    }
  }

  return result;
}

export function lookupRedirect(urlPath: string): RedirectEntry | undefined {
  const map = getRedirectMap();
  const exact = map.get(normalizePath(urlPath));
  if (exact) return exact;

  if (regexRedirects) {
    for (const { regex, entry } of regexRedirects) {
      if (regex.test(urlPath)) {
        return entry;
      }
    }
  }

  return undefined;
}

export function clearRedirectCache(): void {
  redirectMap = null;
  regexRedirects = null;
  console.log("[Redirects] Cache cleared");
}
