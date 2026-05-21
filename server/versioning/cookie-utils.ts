import type { Request, Response } from "express";
import crypto from "crypto";

const VERSIONING_COOKIE_NAME = "4g_versioning";
const VISITOR_COOKIE_NAME = "4g_visitor_id";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const VISITOR_MAX_AGE = 180 * 24 * 60 * 60 * 1000;

export interface VersioningAssignment {
  contentType: string;
  slug: string;
  locale: string;
  variantSlug: string;
  assignedAt: number;
}

export interface VersioningCookie {
  sessionId: string;
  assignments: VersioningAssignment[];
}

function generateVisitorId(): string {
  return crypto.randomUUID();
}

export function hashVisitorId(visitorId: string): string {
  return crypto.createHash("sha256").update(visitorId).digest("hex").substring(0, 16);
}

export function getOrCreateVisitorId(req: Request, res: Response): string {
  const existing = req.cookies?.[VISITOR_COOKIE_NAME];

  if (existing) {
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

export function getOrCreateSessionId(req: Request, res: Response): string {
  return getOrCreateVisitorId(req, res);
}

export function getVersioningCookie(req: Request): VersioningCookie | null {
  try {
    const cookieValue = req.cookies?.[VERSIONING_COOKIE_NAME];
    if (!cookieValue) return null;
    const decoded = Buffer.from(cookieValue, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    if (!parsed.sessionId || !Array.isArray(parsed.assignments)) return null;
    return parsed as VersioningCookie;
  } catch {
    return null;
  }
}

export function setVersioningCookie(
  res: Response,
  sessionId: string,
  assignments: VersioningAssignment[]
): void {
  const cookie: VersioningCookie = { sessionId, assignments };
  const encoded = Buffer.from(JSON.stringify(cookie)).toString("base64");
  res.cookie(VERSIONING_COOKIE_NAME, encoded, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
  });
}

export function buildVisitorContext(req: Request, sessionId: string): {
  session_id: string;
  language: string;
} {
  const language = (req.query.locale as string) || (req.query.lang as string) || "en";
  return { session_id: sessionId, language };
}
