import type { Request, Response, NextFunction } from "express";
import { contentIndex, type RedirectEntry } from "./content-index";
import { child } from "./logger";
const log = child({ module: "redirects" });



let redirectMap: Map<string, RedirectEntry> | null = null;
let regexRedirectsBefore: Array<{ regex: RegExp; entry: RedirectEntry }> | null = null;
let fallbackMap: Map<string, RedirectEntry> | null = null;
let regexRedirectsFallback: Array<{ regex: RegExp; entry: RedirectEntry }> | null = null;
let fallbackNonCustomMap: Map<string, RedirectEntry> | null = null;
let regexRedirectsFallbackNonCustom: Array<{ regex: RegExp; entry: RedirectEntry }> | null = null;

export function isRegexPattern(path: string): boolean {
  return /\(.*\)|\[.*\]|\.\*|\.\+|\\d|\\w|\\s|\{\d+[,}]/.test(path);
}

function buildRedirectMap(): Map<string, RedirectEntry> {
  const entries = contentIndex.getRedirects();
  const map = new Map<string, RedirectEntry>();
  const regexBefore: Array<{ regex: RegExp; entry: RedirectEntry }> = [];
  const fbMap = new Map<string, RedirectEntry>();
  const regexFb: Array<{ regex: RegExp; entry: RedirectEntry }> = [];
  const fbNonCustomMap = new Map<string, RedirectEntry>();
  const regexFbNonCustom: Array<{ regex: RegExp; entry: RedirectEntry }> = [];

  for (const entry of entries) {
    const isFallback = entry.priority === "fallback";
    const isCustom = entry.type === "custom";

    if (isRegexPattern(entry.from)) {
      if (entry.from.length > 500) {
        log.warn(`[Redirects] Regex pattern too long, skipping: ${entry.from.substring(0, 50)}...`);
        continue;
      }
      try {
        const regex = new RegExp(`^${entry.from}$`, "i");
        if (isFallback) {
          if (isCustom) {
            regexFb.push({ regex, entry });
          } else {
            regexFbNonCustom.push({ regex, entry });
          }
        } else {
          regexBefore.push({ regex, entry });
        }
      } catch {
        log.warn(`[Redirects] Invalid regex pattern: ${entry.from}`);
      }
    } else {
      if (isFallback) {
        if (isCustom) {
          if (!fbMap.has(entry.from)) {
            fbMap.set(entry.from, entry);
          }
        } else {
          if (!fbNonCustomMap.has(entry.from)) {
            fbNonCustomMap.set(entry.from, entry);
          }
        }
      } else {
        if (!map.has(entry.from)) {
          map.set(entry.from, entry);
        }
      }
    }
  }

  regexRedirectsBefore = regexBefore;
  fallbackMap = fbMap;
  regexRedirectsFallback = regexFb;
  fallbackNonCustomMap = fbNonCustomMap;
  regexRedirectsFallbackNonCustom = regexFbNonCustom;
  const totalBefore = map.size + regexBefore.length;
  const totalFallback = fbMap.size + regexFb.length + fbNonCustomMap.size + regexFbNonCustom.length;
  log.info(`[Redirects] Loaded ${map.size} exact redirects, ${regexBefore.length} regex redirects (before), ${totalFallback} fallback redirects (${fbNonCustomMap.size + regexFbNonCustom.length} non-custom)`);
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

function getQueryString(req: Request): string {
  const url = req.originalUrl;
  const qIndex = url.indexOf('?');
  return qIndex >= 0 ? url.slice(qIndex) : '';
}

export function redirectMiddleware(req: Request, res: Response, next: NextFunction): void {
  const map = getRedirectMap();
  const normalizedPath = normalizePath(req.path);

  const entry = map.get(normalizedPath);
  if (entry) {
    const status = entry.status || 301;
    const target = resolveRedirectTarget(entry, req);
    const qs = getQueryString(req);
    log.info(`[Redirects] ${status}: ${req.path} -> ${target}${qs}`);
    res.redirect(status, target + qs);
    return;
  }

  if (regexRedirectsBefore) {
    for (const { regex, entry: regexEntry } of regexRedirectsBefore) {
      const match = req.path.match(regex);
      if (match) {
        const captureGroups = match.slice(1);
        const status = regexEntry.status || 301;
        const target = resolveRedirectTarget(regexEntry, req, captureGroups);
        const qs = getQueryString(req);
        log.info(`[Redirects] ${status} (regex): ${req.path} -> ${target}${qs}`);
        res.redirect(status, target + qs);
        return;
      }
    }
  }

  next();
}

export function fallbackRedirectMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith("/api/") || req.path.startsWith("/assets/") || req.path.startsWith("/@")) {
    next();
    return;
  }

  getRedirectMap();
  const normalizedPath = normalizePath(req.path);

  // Non-custom (content-defined) fallback redirects fire before the page check —
  // they take priority over any active page at the same URL.
  if (fallbackNonCustomMap) {
    const entry = fallbackNonCustomMap.get(normalizedPath);
    if (entry) {
      const status = entry.status || 301;
      const target = resolveRedirectTarget(entry, req);
      const qs = getQueryString(req);
      log.info(`[Redirects] ${status} (fallback non-custom): ${req.path} -> ${target}${qs}`);
      res.redirect(status, target + qs);
      return;
    }
  }

  if (regexRedirectsFallbackNonCustom) {
    for (const { regex, entry: regexEntry } of regexRedirectsFallbackNonCustom) {
      const match = req.path.match(regex);
      if (match) {
        const captureGroups = match.slice(1);
        const status = regexEntry.status || 301;
        const target = resolveRedirectTarget(regexEntry, req, captureGroups);
        const qs = getQueryString(req);
        log.info(`[Redirects] ${status} (fallback non-custom regex): ${req.path} -> ${target}${qs}`);
        res.redirect(status, target + qs);
        return;
      }
    }
  }

  // Custom fallback redirects only fire when no real page exists at this URL.
  const cleanUrl = req.path.split("?")[0].split("#")[0];
  try {
    if (contentIndex.isKnownUrl(cleanUrl)) {
      next();
      return;
    }
  } catch {}

  if (fallbackMap) {
    const entry = fallbackMap.get(normalizedPath);
    if (entry) {
      const status = entry.status || 301;
      const target = resolveRedirectTarget(entry, req);
      const qs = getQueryString(req);
      log.info(`[Redirects] ${status} (fallback): ${req.path} -> ${target}${qs}`);
      res.redirect(status, target + qs);
      return;
    }
  }

  if (regexRedirectsFallback) {
    for (const { regex, entry: regexEntry } of regexRedirectsFallback) {
      const match = req.path.match(regex);
      if (match) {
        const captureGroups = match.slice(1);
        const status = regexEntry.status || 301;
        const target = resolveRedirectTarget(regexEntry, req, captureGroups);
        const qs = getQueryString(req);
        log.info(`[Redirects] ${status} (fallback regex): ${req.path} -> ${target}${qs}`);
        res.redirect(status, target + qs);
        return;
      }
    }
  }

  next();
}

export function getRedirects(): Array<{ from: string; to: string | Record<string, string>; type: string; status: number; source: string; priority?: string }> {
  const map = getRedirectMap();
  const result: Array<{ from: string; to: string | Record<string, string>; type: string; status: number; source: string; priority?: string }> = [];

  for (const [from, entry] of map) {
    result.push({
      from,
      to: entry.to,
      type: entry.type,
      status: entry.status || 301,
      source: entry.source,
      priority: entry.priority,
    });
  }

  if (fallbackMap) {
    for (const [from, entry] of fallbackMap) {
      result.push({
        from,
        to: entry.to,
        type: entry.type,
        status: entry.status || 301,
        source: entry.source,
        priority: entry.priority,
      });
    }
  }

  if (regexRedirectsBefore) {
    for (const { entry } of regexRedirectsBefore) {
      result.push({
        from: entry.from,
        to: entry.to,
        type: entry.type,
        status: entry.status || 301,
        source: entry.source,
        priority: entry.priority,
      });
    }
  }

  if (regexRedirectsFallback) {
    for (const { entry } of regexRedirectsFallback) {
      result.push({
        from: entry.from,
        to: entry.to,
        type: entry.type,
        status: entry.status || 301,
        source: entry.source,
        priority: entry.priority,
      });
    }
  }

  return result;
}

export function lookupRedirect(urlPath: string): RedirectEntry | undefined {
  const map = getRedirectMap();
  const normalized = normalizePath(urlPath);

  const exact = map.get(normalized);
  if (exact) return exact;

  if (fallbackMap) {
    const fbExact = fallbackMap.get(normalized);
    if (fbExact) return fbExact;
  }

  if (regexRedirectsBefore) {
    for (const { regex, entry } of regexRedirectsBefore) {
      if (regex.test(urlPath)) {
        return entry;
      }
    }
  }

  if (regexRedirectsFallback) {
    for (const { regex, entry } of regexRedirectsFallback) {
      if (regex.test(urlPath)) {
        return entry;
      }
    }
  }

  return undefined;
}

export interface RedirectTestResult {
  match: boolean;
  from?: string;
  to?: string | Record<string, string>;
  resolvedTo?: string;
  status?: number;
  priority?: string;
  source?: string;
  matchType?: "exact" | "regex";
  captureGroups?: string[];
  pageExists?: boolean;
  destinationExists?: boolean;
}

function resolveTarget(entry: RedirectEntry, locale: string, captureGroups?: string[]): string {
  let target = typeof entry.to === "string" ? entry.to : (entry.to[locale] || entry.to["en"] || Object.values(entry.to)[0] || "/");
  if (captureGroups) {
    for (let i = 0; i < captureGroups.length; i++) {
      target = target.replace(new RegExp(`\\$${i + 1}`, "g"), captureGroups[i]);
    }
  }
  return target;
}

function makeResult(entry: RedirectEntry, locale: string, matchType: "exact" | "regex", priority?: string, captureGroups?: string[]): RedirectTestResult {
  const resolvedTo = resolveTarget(entry, locale, captureGroups);
  return {
    match: true,
    from: entry.from,
    to: entry.to,
    resolvedTo,
    status: entry.status || 301,
    priority: priority || entry.priority || "before",
    source: entry.source,
    matchType,
    captureGroups,
  };
}

export function testRedirect(rawInput: string, locale: string = "en"): RedirectTestResult {
  let urlPath = rawInput;
  try {
    if (/^https?:\/\//i.test(urlPath)) {
      urlPath = new URL(urlPath).pathname;
    }
  } catch {}
  urlPath = urlPath.split("?")[0].split("#")[0];
  if (!urlPath.startsWith("/")) urlPath = "/" + urlPath;

  const map = getRedirectMap();
  const normalized = normalizePath(urlPath);

  const exact = map.get(normalized);
  if (exact) return makeResult(exact, locale, "exact");

  if (regexRedirectsBefore) {
    for (const { regex, entry } of regexRedirectsBefore) {
      const m = urlPath.match(regex);
      if (m) return makeResult(entry, locale, "regex", undefined, m.slice(1));
    }
  }

  if (fallbackNonCustomMap) {
    const fbNc = fallbackNonCustomMap.get(normalized);
    if (fbNc) return makeResult(fbNc, locale, "exact", "fallback");
  }

  if (regexRedirectsFallbackNonCustom) {
    for (const { regex, entry } of regexRedirectsFallbackNonCustom) {
      const m = urlPath.match(regex);
      if (m) return makeResult(entry, locale, "regex", "fallback", m.slice(1));
    }
  }

  const isKnown = contentIndex.isKnownUrl(urlPath);

  if (!isKnown) {
    if (fallbackMap) {
      const fb = fallbackMap.get(normalized);
      if (fb) return makeResult(fb, locale, "exact", "fallback");
    }

    if (regexRedirectsFallback) {
      for (const { regex, entry } of regexRedirectsFallback) {
        const m = urlPath.match(regex);
        if (m) return makeResult(entry, locale, "regex", "fallback", m.slice(1));
      }
    }
  }

  return { match: false, pageExists: contentIndex.isKnownUrl(urlPath) };
}

export function clearRedirectCache(): void {
  redirectMap = null;
  regexRedirectsBefore = null;
  fallbackMap = null;
  regexRedirectsFallback = null;
  log.info("[Redirects] Cache cleared");
}
