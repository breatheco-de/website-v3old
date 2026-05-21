import type { Request, Response } from "express";
import crypto from "crypto";
import type { VisitorContext } from "@shared/schema";

const VISITOR_COOKIE_NAME = "4g_visitor_id";
const VISITOR_MAX_AGE = 180 * 24 * 60 * 60 * 1000; // 180 days for visitor ID (industry standard)

/**
 * Generate a cryptographically secure visitor ID
 * Uses crypto.randomUUID() for industry-standard uniqueness
 */
function generateVisitorId(): string {
  return crypto.randomUUID();
}

/**
 * Hash a visitor ID for storage (privacy protection)
 * We don't need to reverse this - just need consistent hashing
 */
export function hashVisitorId(visitorId: string): string {
  return crypto.createHash("sha256").update(visitorId).digest("hex").substring(0, 16);
}

/**
 * Get or create a persistent visitor ID (180-day rolling expiry)
 * This is the primary identifier for A/B testing unique visitor counting
 */
export function getOrCreateVisitorId(req: Request, res: Response): string {
  const existing = req.cookies?.[VISITOR_COOKIE_NAME];
  
  if (existing) {
    // Refresh the cookie expiry on each visit (rolling expiry)
    res.cookie(VISITOR_COOKIE_NAME, existing, {
      maxAge: VISITOR_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return existing;
  }

  const visitorId = generateVisitorId();
  res.cookie(VISITOR_COOKIE_NAME, visitorId, {
    maxAge: VISITOR_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return visitorId;
}

/**
 * Legacy: Generate a simple session ID if none exists
 * @deprecated Use getOrCreateVisitorId for experiment tracking
 */
export function getOrCreateSessionId(req: Request, res: Response): string {
  // Now delegates to the proper visitor ID system
  return getOrCreateVisitorId(req, res);
}

/**
 * Build visitor context from request
 */
export function buildVisitorContext(req: Request, sessionId: string): VisitorContext {
  const ua = req.headers["user-agent"] || "";
  const isMobile = /mobile|android|iphone|ipad/i.test(ua);
  const isTablet = /tablet|ipad/i.test(ua);

  const now = new Date();

  // Use locale param (consistent with routes) or lang, fallback to en
  const language = (req.query.locale as string) || (req.query.lang as string) || "en";

  return {
    session_id: sessionId,
    language,
    region: req.query.region as string,
    country: req.query.country as string,
    utm_source: req.query.utm_source as string,
    utm_campaign: req.query.utm_campaign as string,
    utm_medium: req.query.utm_medium as string,
    device: isTablet ? "tablet" : isMobile ? "mobile" : "desktop",
    hour: now.getHours(),
    day_of_week: now.getDay(),
  };
}
