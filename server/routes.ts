import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getQueueStats, enqueueOptimization, getPendingOptimizations, getFailedEntries, retryFailedImages, resetOptimizeSession, getOptimizeSession, enqueueExternalImage } from "./image-registry";
import { getAllQueueState } from "./image-queue-state";

let workerRunNow: (() => void) | null = null;

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { execSync as _execSync, execFile } from "child_process";
import {
  versioningUpdateSchema,
  type CareerProgram,
  type LandingPage,
  type LocationPage,
  type TemplatePage,
} from "@shared/schema";
import {
  getSitemap,
  clearSitemapCache,
  getSitemapCacheStatus,
  getSitemapUrls,
} from "./sitemap";
import { markFileAsModified } from "./sync-state";
import { deepMerge } from "./utils/deepMerge";
import { regenerateSectionIds } from "./utils/regenerateSectionIds";
import { databaseManager } from "./database";
import {
  redirectMiddleware,
  getRedirects,
  clearRedirectCache,
  testRedirect,
} from "./redirects";
import {
  getSchema,
  getMergedSchemas,
  getAvailableSchemaKeys,
  clearSchemaCache,
} from "./schema-org";
import {
  getRegistryOverview,
  getComponentInfo,
  listVersions,
  loadSchema,
  loadExamples,
  createNewVersion,
  getExampleFilePath,
  saveExample,
  createExample,
  loadAllFieldEditors,
  applyComponentSectionDefaults,
  applyComponentImageSizes,
  getVariantByExample,
  getVariantExamples,
  deleteExample,
  deleteVariant,
} from "./component-registry";
import {
  editContent,
  editCommonContent,
  getContentForEdit,
} from "./content-editor";
import { bindingManager } from "./bindings";
import {
  escapeTemplateVars,
  escapeObjectVars,
  unescapeObjectVars,
  unescapeYamlDump,
} from "@shared/templateVars";
import {
  getVersioningManager,
  readUserId,
  getVersioningCookie,
  setVersioningCookie,
  buildUserContext,
} from "./versioning";
import { mediaGallery } from "./media-gallery";
import { media } from "./media";
import multer from "multer";
import { contentIndex, type ContentType } from "./content-index";
import { regenerateSectionIds } from "./utils/regenerateSectionIds";
import { runScan as runComponentInsightsScan, readInsightsFile, suggestNext as suggestNextComponent } from "./component-insights";
import { validateFieldSource, validateFieldMapping, extractByDotPath } from "../scripts/validation/shared/fieldMappingValidator";
import {
  getFolder,
  getType,
  isValidType,
  getAllTypes,
  getAllFolders,
  getAllConfigs,
  getDatabaseName,
  getFieldMapping,
  getLookupKey,
  getLocaleKey,
  getLocaleDefault,
  getIndexes,
  hasDatabaseSingle,
  getContentTypeConfig,
  updateContentTypeConfig,
  addContentType,
  getDatabaseConfig,
  getLabel,
  normalizeUrlPattern,
  getLocaleSource,
  resolveContentTypeUrl,
  getLayout,
  resolveLayout,
  listAvailableMenus,
  getDirectory,
} from "./content-types";
import { resolveFieldValue, applyTransformIfNeeded } from "./transform";
import { resolveSingleVars } from "./single-resolver";
import {
  normalizeLocale,
  getSupportedLocales,
  getDefaultLocale,
  getLocaleEntries,
  updateLocaleSettings,
  getHomePage,
} from "./settings";
import { variableManager } from "./variable-manager";
import { getValidationService } from "../scripts/validation/service";
import { getCanonicalUrl, normalizeUrl } from "../scripts/validation/shared/canonicalUrls";
import {
  isNonLocalFilesystemSrc,
  buildRegistrySrcToIdMap,
  resolveRegistryReference,
} from "../scripts/validation/shared/imageRegistrySrc";
import type { ProgressEvent } from "../scripts/validation/fixers/types";
import { gcs } from "./gcs";
import { z } from "zod";
import {
  generateSsrSchemaHtml,
  generateDatabaseSsrHtml,
  generateListingSsrHtml,
  clearSsrSchemaCache,
  loadRawYaml,
  resolveFaqItems,
  buildFaqPageSchema,
  type FaqSection,
} from "./ssr-schema";
import {
  fetchMarkdownContent,
  clearMarkdownCache,
  clearMarkdownCacheByUrl,
} from "./markdown";
import { resolveDynamicEntries } from "./dynamic-entries";
import { loadDatabaseSinglePage, mergeSingleTemplate } from "./database-single-loader";
import { getBaseUrl } from "./hreflang";
import * as userManager from "./user-manager";
import * as userStore from "./user-store";
import type { CapabilityName } from "./user-store";

const BREATHECODE_HOST =
  process.env.VITE_BREATHECODE_HOST || "https://breathecode.herokuapp.com";

/**
 * Extract a Breathecode token from the request.
 * Checks Authorization header ("Token <token>") and X-Debug-Token header.
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  const debugToken = req.headers["x-debug-token"] as string | undefined;
  if (authHeader?.startsWith("Token ")) return authHeader.slice(6);
  if (debugToken) return debugToken;
  return null;
}

/**
 * Verify that the requesting user has a specific capability.
 * In development mode, always grants access (returns authorized: true).
 * In production, validates the token via userManager and checks capability via userStore.
 *
 * Returns { authorized, token, username }.
 * If not authorized, writes the appropriate error response before returning.
 */
async function requireCapability(
  req: Request,
  res: Response,
  capName: CapabilityName,
  contentType?: string
): Promise<{ authorized: boolean; token: string | null; username: string | null; author: string | null }> {
  // Resolve effective content type: prefer the explicit arg, then fall back to
  // common request locations so scoped routes that omit the arg are still enforced.
  const resolvedContentType: string | undefined =
    contentType ||
    (req.params as Record<string, string>).contentType ||
    (req.params as Record<string, string>).type ||
    req.body?.contentType ||
    req.body?.type ||
    undefined;

  const isDevelopment = process.env.NODE_ENV !== "production";
  const token = extractToken(req);

  if (isDevelopment) {
    // In dev mode, resolve username from token if present, but always allow
    if (token) {
      try {
        const profile = await userManager.validateToken(token);
        if (profile.valid && profile.username) {
          return { authorized: true, token, username: profile.username, author: profile.username };
        }
      } catch {
        // Ignore errors in dev
      }
    }
    return { authorized: true, token, username: null, author: null };
  }

  if (!token) {
    res.status(401).json({ error: "Authorization required" });
    return { authorized: false, token: null, username: null, author: null };
  }

  const profile = await userManager.validateToken(token);
  if (!profile.valid || !profile.username) {
    res.status(401).json({ error: "Your session has expired. Please log in again." });
    return { authorized: false, token, username: null, author: null };
  }

  if (!userStore.hasCapability(profile.username, capName, resolvedContentType)) {
    res.status(403).json({ error: `Insufficient permissions: ${capName} required` });
    return { authorized: false, token, username: profile.username, author: null };
  }

  // author = resolved Breathecode username (the single commit-author resolution path)
  const author = await userManager.resolveCommitAuthor(token);
  return { authorized: true, token, username: profile.username, author };
}

function safeYamlLoad(yamlStr: string): unknown {
  const { escaped, map } = escapeTemplateVars(yamlStr);
  const parsed = yaml.load(escaped);
  return unescapeObjectVars(parsed, map);
}

function safeYamlDump(obj: unknown, opts?: yaml.DumpOptions): string {
  const { escaped, map } = escapeObjectVars(obj);
  const dumped = yaml.dump(escaped, opts);
  return unescapeYamlDump(dumped, map);
}

function coerceToOriginalType(newValue: string, originalValue: unknown): unknown {
  if (typeof originalValue === "number") {
    const n = Number(newValue);
    return Number.isNaN(n) ? newValue : n;
  }
  if (typeof originalValue === "boolean") {
    return newValue === "true";
  }
  return newValue;
}

function coerceStringValue(value: string): unknown {
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function invalidateContentCaches(contentType?: string): void {
  if (contentType) {
    contentIndex.invalidateCommonFields(contentType);
  }
  clearSsrSchemaCache();
}

type FixerItemStatus = "ok" | "skipped" | "failed";

interface ValidationFixRunLogEntry {
  at: number;
  imageId: string;
  status: FixerItemStatus;
  message: string;
}

interface ValidationFixRunState {
  runId: string;
  pipelineRoot: string;
  fixerName: string;
  running: boolean;
  total: number;
  processed: number;
  ok: number;
  skipped: number;
  failed: number;
  startedAt: number;
  completedAt?: number;
  message?: string;
  log: ValidationFixRunLogEntry[];
}

const MAX_VALIDATION_RUNS = 10;
const MAX_RUN_LOG_ENTRIES = 1000;
const validationRuns = new Map<string, ValidationFixRunState>();
const validationRunOrder: string[] = [];

function createValidationFixRun(pipelineRoot: string, fixerName: string): ValidationFixRunState {
  const runId = `fix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const run: ValidationFixRunState = {
    runId,
    pipelineRoot,
    fixerName,
    running: false,
    total: 0,
    processed: 0,
    ok: 0,
    skipped: 0,
    failed: 0,
    startedAt: Date.now(),
    log: [],
  };
  validationRuns.set(runId, run);
  validationRunOrder.unshift(runId);
  while (validationRunOrder.length > MAX_VALIDATION_RUNS) {
    const toRemove = validationRunOrder.pop();
    if (toRemove) {
      validationRuns.delete(toRemove);
    }
  }
  return run;
}

function appendValidationRunLog(run: ValidationFixRunState, entry: ValidationFixRunLogEntry): void {
  run.log.push(entry);
  if (run.log.length > MAX_RUN_LOG_ENTRIES) {
    run.log.splice(0, run.log.length - MAX_RUN_LOG_ENTRIES);
  }
}

function applyFixerProgress(run: ValidationFixRunState, event: ProgressEvent): void {
  if (event.type === "start") {
    run.total = event.total;
    run.processed = 0;
    run.ok = 0;
    run.skipped = 0;
    run.failed = 0;
    return;
  }

  run.processed += 1;
  if (event.status === "ok") run.ok += 1;
  if (event.status === "skipped") run.skipped += 1;
  if (event.status === "failed") run.failed += 1;
  appendValidationRunLog(run, {
    at: Date.now(),
    imageId: event.id,
    status: event.status,
    message: event.message,
  });
}

function resolveFixerPipeline(
  rootFixerName: string,
  getFixerByName: (name: string) => { runAfter?: string[] } | undefined,
): string[] {
  const ordered: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (name: string): void => {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`Circular fixer dependency detected at "${name}"`);
    }
    const fixer = getFixerByName(name);
    if (!fixer) {
      throw new Error(`Fixer "${name}" not found`);
    }
    visiting.add(name);
    for (const dep of fixer.runAfter ?? []) {
      visit(dep);
    }
    visiting.delete(name);
    visited.add(name);
    ordered.push(name);
  };

  visit(rootFixerName);
  return ordered;
}

// Schema for career-programs listing page (custom page type)
const careerProgramsListingSchema = z.object({
  slug: z.string(),
  template: z.string(),
  title: z.string(),
  meta: z.object({
    page_title: z.string(),
    description: z.string(),
    redirects: z.array(z.string()).optional(),
    robots: z.string().optional(),
    priority: z.number().optional(),
    change_frequency: z.string().optional(),
  }),
  page_content: z.object({
    hero_title: z.string(),
    hero_subtitle: z.string(),
    search_placeholder: z.string(),
    difficulty_label: z.string(),
    difficulty_all: z.string(),
    difficulty_beginner: z.string(),
    difficulty_intermediate: z.string(),
    difficulty_advanced: z.string(),
    no_results: z.string(),
  }),
  courses: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      duration: z.string(),
      difficulty: z.string(),
      lessons: z.number(),
      link: z.string().optional(),
    }),
  ),
});

function loadCareerProgramsListing(locale: string) {
  const result = contentIndex.loadContent({
    contentType: "page",
    slug: "career-programs",
    schema: careerProgramsListingSchema,
    localeOrVariant: locale,
  });

  if (!result.success) {
    console.error(result.error);
    return null;
  }

  return result.data;
}

function applyMetaFallback(data: Record<string, unknown>): void {
  if (!data.meta || typeof data.meta !== "object") {
    data.meta = {};
  }
  const meta = data.meta as Record<string, unknown>;
  if (!meta.page_title) {
    const fallbackTitle = data.title ?? data.name ?? data.slug;
    if (fallbackTitle) {
      meta.page_title = String(fallbackTitle);
    }
  }
  if (!meta.description) {
    meta.description = "";
  }
}

function injectCanonicalIfMissing(
  data: Record<string, unknown>,
  contentType: string,
  locale: string,
): void {
  if (!data.meta || typeof data.meta !== "object") return;
  const meta = data.meta as Record<string, unknown>;
  if (meta.canonical_url) return;
  const urlPath = resolveContentTypeUrl(contentType, data, locale);
  if (!urlPath) return;
  meta.canonical_url = getBaseUrl() + urlPath;
}

function loadCareerProgram(slug: string, locale: string): CareerProgram | null {
  const result = contentIndex.loadContent<CareerProgram>({
    contentType: "program",
    slug,
    localeOrVariant: locale,
  });

  if (!result.success) {
    console.error(result.error);
    return null;
  }

  applyMetaFallback(result.data as Record<string, unknown>);
  if (result.data.sections) {
    applyComponentSectionDefaults(result.data.sections as unknown[]);
    applyComponentImageSizes(result.data.sections as unknown[]);
  }
  return result.data;
}

function listCareerPrograms(
  locale: string,
): Array<{ slug: string; title: string; bc_slug: string }> {
  const slugs = contentIndex.listContentSlugs("program");
  const programs: Array<{ slug: string; title: string; bc_slug: string }> = [];

  for (const slug of slugs) {
    const program = loadCareerProgram(slug, locale);
    if (program) {
      const commonData = contentIndex.loadCommonData("program", slug);
      if (commonData?.valid_lead_form_option === false) continue;
      const bcSlug = (commonData?.bc_slug as string) || slug;
      programs.push({
        slug: program.slug,
        title: program.title,
        bc_slug: bcSlug,
      });
    }
  }

  return programs;
}

function loadLandingPage(slug: string, locale?: string): LandingPage | null {
  const effectiveLocale = locale || ((contentIndex.loadCommonData("landing", slug)?.locale as string) || getDefaultLocale());
  const result = contentIndex.loadContent<LandingPage>({
    contentType: "landing",
    slug,
    localeOrVariant: effectiveLocale,
  });

  if (!result.success) {
    console.error(result.error);
    return null;
  }

  applyMetaFallback(result.data as Record<string, unknown>);
  if (result.data.sections) {
    applyComponentSectionDefaults(result.data.sections as unknown[]);
    applyComponentImageSizes(result.data.sections as unknown[]);
  }
  return result.data;
}

function listLandingPages(): Array<{
  slug: string;
  title: string;
  locale: string;
}> {
  const slugs = contentIndex.listContentSlugs("landing");
  const landings: Array<{ slug: string; title: string; locale: string }> = [];

  for (const slug of slugs) {
    const commonData = contentIndex.loadCommonData("landing", slug);
    const locale = (commonData?.locale as string) || getDefaultLocale();
    const landing = loadLandingPage(slug, locale);
    if (landing) {
      const landingSlug = landing.slug || slug;
      const landingTitle = landing.title || "";
      if (landingTitle) {
        landings.push({ slug: landingSlug, title: landingTitle, locale });
      }
    }
  }

  return landings;
}

function loadLocationPage(slug: string, locale: string): LocationPage | null {
  const result = contentIndex.loadContent<LocationPage>({
    contentType: "location",
    slug,
    localeOrVariant: locale,
  });

  if (!result.success) {
    console.error(result.error);
    return null;
  }

  applyMetaFallback(result.data as Record<string, unknown>);
  if (result.data.sections) {
    applyComponentSectionDefaults(result.data.sections as unknown[]);
    applyComponentImageSizes(result.data.sections as unknown[]);
  }
  return result.data;
}

function listLocationPages(locale: string): Array<{
  slug: string;
  name: string;
  city: string;
  country: string;
  region: string;
}> {
  const slugs = contentIndex.listContentSlugs("location");
  const locations: Array<{
    slug: string;
    name: string;
    city: string;
    country: string;
    region: string;
  }> = [];

  for (const slug of slugs) {
    const location = loadLocationPage(slug, locale);
    if (location && location.visibility === "listed") {
      locations.push({
        slug: location.slug,
        name: location.name,
        city: location.city,
        country: location.country,
        region: location.region,
      });
    }
  }

  return locations;
}

// Template Pages (marketing-content/pages/)
function loadTemplatePage(slug: string, locale: string): TemplatePage | null {
  const result = contentIndex.loadContent<TemplatePage>({
    contentType: "page",
    slug,
    localeOrVariant: locale,
  });

  if (!result.success) {
    console.error(result.error);
    return null;
  }

  applyMetaFallback(result.data as Record<string, unknown>);
  if (result.data.sections) {
    applyComponentSectionDefaults(result.data.sections as unknown[]);
    applyComponentImageSizes(result.data.sections as unknown[]);
  }
  return result.data;
}

function buildSingleEntryFromContent(
  contentType: string,
  pageData: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const mapping = getFieldMapping(contentType);
  if (!mapping || Object.keys(mapping).length === 0) return undefined;

  const entry: Record<string, unknown> = {};
  for (const [key, source] of Object.entries(mapping)) {
    const value = resolveFieldValue(source, pageData);
    if (value !== undefined) {
      entry[key] = value;
    }
  }
  return Object.keys(entry).length > 0 ? entry : undefined;
}

function listTemplatePages(
  locale: string,
): Array<{ slug: string; title: string }> {
  const slugs = contentIndex.listContentSlugs("page");
  const pages: Array<{ slug: string; title: string }> = [];

  for (const slug of slugs) {
    const page = loadTemplatePage(slug, locale);
    if (page) {
      pages.push({
        slug: page.slug,
        title: page.title,
      });
    }
  }

  return pages;
}

function detectLanguageFromRequest(req: Request): "en" | "es" {
  const acceptLang = req.headers["accept-language"] || "";
  const primary = acceptLang.split(",")[0]?.trim().toLowerCase() || "";
  if (primary.startsWith("es")) return "es";
  return "en";
}

export async function registerRoutes(app: Express): Promise<Server> {
  media.initFromEnv();


  const { loadSyncLog, logSync, getInstanceId } = await import("./sync-log");
  const { loadSyncStateFromBucket } = await import("./sync-state");

  await loadSyncLog();
  const { getReplitCheckpoint, refreshGithubCommit } = await import(
    "./sync-log"
  );
  logSync(
    "RESTART",
    `Server started (instance=${getInstanceId()}, checkpoint=${getReplitCheckpoint()}, env=${process.env.NODE_ENV || "development"}, pid=${process.pid})`,
  );
  refreshGithubCommit();

  // Attach user ID from the X-User-Id header (sent by the client on
  // every request) to req so that all downstream routes can access it without
  // individually reading the cookie. Registered before any route handlers so
  // every route has access. The cookie-based path in cookie-utils.ts remains
  // as the authoritative fallback for versioning routes.
  app.use((req, _res, next) => {
    const headerValue = req.headers["x-user-id"];
    const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (raw && raw.trim()) {
      (req as Request & { userId?: string }).userId = raw.trim();
    }
    next();
  });

  app.get("/api/geo", async (req, res) => {
    try {
      const forwarded = req.headers["x-forwarded-for"];
      const clientIp =
        typeof forwarded === "string"
          ? forwarded.split(",")[0].trim()
          : req.socket.remoteAddress || "";

      const url =
        clientIp && clientIp !== "127.0.0.1" && clientIp !== "::1"
          ? `http://ip-api.com/json/${clientIp}?fields=status,city,country,countryCode,regionName,timezone,lat,lon`
          : `http://ip-api.com/json/?fields=status,city,country,countryCode,regionName,timezone,lat,lon`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        res.status(502).json({ status: "fail" });
        return;
      }
      const data = await response.json();
      res.json(data);
    } catch {
      res.status(502).json({ status: "fail" });
    }
  });

  app.get("/apply", (req, res) => {
    const lang = detectLanguageFromRequest(req);
    const target = lang === "es" ? "/es/aplica" : "/en/apply";
    const qs = Object.keys(req.query).length
      ? "?" +
        new URLSearchParams(req.query as Record<string, string>).toString()
      : "";
    res.redirect(302, target + qs);
  });

  // Apply redirect middleware for 301 redirects from YAML content
  app.use(redirectMiddleware);

  app.post("/api/debug/validate-token", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ valid: false, error: "Token required" });
        return;
      }

      const profile = await userManager.validateToken(token);

      if (!profile.valid || !profile.username) {
        res.json({ valid: false, capabilities: [], userName: "", expiresAt: profile.expiresAt ?? null, error: profile.error });
        return;
      }

      // Auto-register user; if this is the very first user, grant webmaster role
      const wasFirstUser = userStore.isFirstUser();
      userStore.upsertUser({
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
      });
      if (wasFirstUser) {
        userStore.assignRoles(profile.username, ["webmaster"]);
        console.log(`[UserStore] First user "${profile.username}" auto-assigned webmaster role`);
      }

      const capabilities = userStore.getEffectiveCapabilities(profile.username);
      const userName = profile.username;

      res.json({ valid: true, capabilities, userName, username: profile.username, expiresAt: profile.expiresAt ?? null });
    } catch (error) {
      console.error("Token validation error:", error);
      res.json({ valid: false, capabilities: [] });
    }
  });

  // Check token validity without full re-validation (for session refresh)
  app.post("/api/debug/check-session", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ valid: false, error: "Token required" });
        return;
      }

      // Get token info including expiration from Breathecode
      let tokenInfoResponse;
      try {
        tokenInfoResponse = await fetch(
          `${BREATHECODE_HOST}/v1/auth/token/${token}`,
          { method: "GET" },
        );
      } catch (networkError) {
        // Network error - don't invalidate session, return error status
        console.error("Network error checking session:", networkError);
        res.json({
          valid: false,
          networkError: true,
          error: "Network error checking token",
        });
        return;
      }

      if (!tokenInfoResponse.ok) {
        // Token is invalid or expired (401/404 etc)
        res.json({ valid: false, expired: true });
        return;
      }

      const tokenInfo = (await tokenInfoResponse.json()) as {
        token?: string;
        token_type?: string;
        expires_at?: string;
        user_id?: number;
      };

      // Check if token is expired
      if (tokenInfo.expires_at) {
        const expiresAt = new Date(tokenInfo.expires_at);
        if (expiresAt <= new Date()) {
          res.json({
            valid: false,
            expired: true,
            expiresAt: tokenInfo.expires_at,
          });
          return;
        }
      }

      res.json({
        valid: true,
        expired: false,
        expiresAt: tokenInfo.expires_at || null,
      });
    } catch (error) {
      console.error("Session check error:", error);
      // Unknown error - don't invalidate session
      res.json({
        valid: false,
        networkError: true,
        error: "Failed to check session",
      });
    }
  });

  app.get("/api/geo", async (req, res) => {
    try {
      const apiKey = process.env.IPAPI_PRO_KEY;
      const forwarded = (req.headers["x-forwarded-for"] as string)
        ?.split(",")[0]
        ?.trim();
      const rawIp = forwarded || req.ip || "";
      const isLocal =
        !rawIp ||
        rawIp === "127.0.0.1" ||
        rawIp === "::1" ||
        rawIp === "::ffff:127.0.0.1";
      const ipSegment = isLocal ? "" : `/${rawIp}`;
      const fields =
        "status,city,country,countryCode,regionName,timezone,lat,lon";
      const url = apiKey
        ? `https://pro.ip-api.com/json${ipSegment}?key=${apiKey}&fields=${fields}`
        : `http://ip-api.com/json${ipSegment}?fields=${fields}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        res.status(502).json({ status: "fail" });
        return;
      }
      const data = await response.json();
      res.json(data);
    } catch {
      res.status(502).json({ status: "fail" });
    }
  });

  // Cloudflare Turnstile endpoints
  app.get("/api/turnstile/site-key", (_req, res) => {
    const siteKey = process.env.TURNSTILE_SITE_KEY;
    if (!siteKey) {
      res.status(500).json({ error: "Turnstile site key not configured" });
      return;
    }
    res.json({ siteKey });
  });

  app.post("/api/turnstile/verify", async (req, res) => {
    try {
      const { token } = req.body;
      const secretKey = process.env.TURNSTILE_SECRET_KEY;

      if (!token) {
        res.status(400).json({ success: false, error: "Token required" });
        return;
      }

      if (!secretKey) {
        res.status(500).json({
          success: false,
          error: "Turnstile secret key not configured",
        });
        return;
      }

      const verifyResponse = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: secretKey,
            response: token,
          }),
        },
      );

      const result = (await verifyResponse.json()) as {
        success: boolean;
        "error-codes"?: string[];
      };

      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({
          success: false,
          error: "Verification failed",
          codes: result["error-codes"],
        });
      }
    } catch (error) {
      console.error("Turnstile verification error:", error);
      res.status(500).json({ success: false, error: "Verification failed" });
    }
  });

  // Theme configuration endpoint
  app.get("/api/theme", (_req, res) => {
    try {
      const themePath = path.join(
        process.cwd(),
        "marketing-content",
        "theme.json",
      );
      if (!fs.existsSync(themePath)) {
        res.status(404).json({ error: "Theme configuration not found" });
        return;
      }
      const themeContent = fs.readFileSync(themePath, "utf-8");
      const theme = JSON.parse(themeContent);
      res.json(theme);
    } catch (error) {
      console.error("Error loading theme:", error);
      res.status(500).json({ error: "Failed to load theme configuration" });
    }
  });

  app.put("/api/theme/colors", (req, res) => {
    try {
      const { light, dark } = req.body as { light?: Record<string, string>; dark?: Record<string, string> };
      const themePath = path.join(process.cwd(), "marketing-content", "theme.json");
      if (!fs.existsSync(themePath)) {
        res.status(404).json({ error: "Theme configuration not found" });
        return;
      }
      const theme = JSON.parse(fs.readFileSync(themePath, "utf-8"));
      theme.colors = { light: light || {}, dark: dark || {} };
      fs.writeFileSync(themePath, JSON.stringify(theme, null, 2));
      markFileAsModified('marketing-content/theme.json');
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving theme colors:", error);
      res.status(500).json({ error: "Failed to save theme colors" });
    }
  });

  app.put("/api/theme/preview-examples", (req, res) => {
    try {
      const examples = req.body as Array<{ component: string; version: string; example: string }>;
      const themePath = path.join(process.cwd(), "marketing-content", "theme.json");
      if (!fs.existsSync(themePath)) {
        res.status(404).json({ error: "Theme configuration not found" });
        return;
      }
      const theme = JSON.parse(fs.readFileSync(themePath, "utf-8"));
      theme.preview_examples = Array.isArray(examples) ? examples : [];
      fs.writeFileSync(themePath, JSON.stringify(theme, null, 2));
      markFileAsModified('marketing-content/theme.json');
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving preview examples:", error);
      res.status(500).json({ error: "Failed to save preview examples" });
    }
  });

  app.put("/api/theme/palettes", async (req, res) => {
    try {
      const auth = await requireCapability(req, res, "theme_edit");
      if (!auth.authorized) return;

      const paletteEntrySchema = z.object({
        id: z.string(),
        label: z.string(),
        cssVar: z.string().optional(),
        value: z.string().optional(),
        lightValue: z.string().optional(),
        darkValue: z.string().optional(),
      });
      const bodySchema = z.object({
        backgrounds: z.array(paletteEntrySchema),
        text: z.array(paletteEntrySchema),
        accents: z.array(paletteEntrySchema),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid palette data", details: parsed.error.issues });
        return;
      }

      const themePath = path.join(process.cwd(), "marketing-content", "theme.json");
      if (!fs.existsSync(themePath)) {
        res.status(404).json({ error: "Theme configuration not found" });
        return;
      }
      const theme = JSON.parse(fs.readFileSync(themePath, "utf-8"));

      const knownVars = new Set<string>([
        ...Object.keys((theme.colors?.light as Record<string, string>) || {}),
        ...Object.keys((theme.colors?.dark as Record<string, string>) || {}),
      ]);

      const unknownVarWarnings: string[] = [];
      const allEntries = [
        ...parsed.data.backgrounds,
        ...parsed.data.text,
        ...parsed.data.accents,
      ];
      for (const entry of allEntries) {
        if (entry.cssVar && !knownVars.has(entry.cssVar)) {
          unknownVarWarnings.push(`${entry.id}: unknown cssVar "${entry.cssVar}"`);
        }
      }

      theme.backgrounds = parsed.data.backgrounds;
      theme.text = parsed.data.text;
      theme.accents = parsed.data.accents;

      const themeDir = path.dirname(themePath);
      const tmpPath = path.join(themeDir, `.theme.${Date.now()}.tmp`);
      fs.writeFileSync(tmpPath, JSON.stringify(theme, null, 2));
      fs.renameSync(tmpPath, themePath);
      markFileAsModified('marketing-content/theme.json');

      if (unknownVarWarnings.length > 0) {
        res.json({ ok: true, warnings: unknownVarWarnings });
      } else {
        res.json({ ok: true });
      }
    } catch (error) {
      console.error("Error saving theme palettes:", error);
      res.status(500).json({ error: "Failed to save theme palettes" });
    }
  });

  app.get("/api/variables", (_req, res) => {
    res.json(variableManager.getDefinitions());
  });

  app.put("/api/variables/:name", (req, res) => {
    try {
      const { name } = req.params;
      const body = req.body;

      const { action } = body as { action: string };
      if (!action) {
        return res.status(400).json({ error: "action is required" });
      }

      switch (action) {
        case "set_default": {
          const { value } = body as { value: string };
          if (value === undefined) {
            return res.status(400).json({ error: "value is required" });
          }
          variableManager.updateDefault(name, value);
          break;
        }
        case "add_condition": {
          const { condition } = body as {
            condition: { query: Record<string, string>; value: string };
          };
          if (!condition || !condition.query || condition.value === undefined) {
            return res
              .status(400)
              .json({ error: "condition with query and value is required" });
          }
          variableManager.addCondition(name, condition);
          break;
        }
        case "update_condition": {
          const { index, condition } = body as {
            index: number;
            condition: { query: Record<string, string>; value: string };
          };
          if (
            index === undefined ||
            !condition ||
            !condition.query ||
            condition.value === undefined
          ) {
            return res.status(400).json({
              error: "index and condition with query and value are required",
            });
          }
          variableManager.updateCondition(name, index, condition);
          break;
        }
        case "delete_condition": {
          const { index } = body as { index: number };
          if (index === undefined) {
            return res.status(400).json({ error: "index is required" });
          }
          variableManager.deleteCondition(name, index);
          break;
        }
        case "reorder_conditions": {
          const { fromIndex, toIndex } = body as {
            fromIndex: number;
            toIndex: number;
          };
          if (fromIndex === undefined || toIndex === undefined) {
            return res
              .status(400)
              .json({ error: "fromIndex and toIndex are required" });
          }
          variableManager.reorderConditions(name, fromIndex, toIndex);
          break;
        }
        default:
          return res.status(400).json({ error: `Unknown action: ${action}` });
      }

      res.json({
        success: true,
        definitions: variableManager.getDefinitions(),
      });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: err?.message || "Failed to update variable" });
    }
  });

  app.delete("/api/variables/:name", (req, res) => {
    try {
      const { name } = req.params;
      const body = req.body;

      if (body.level) {
        const { level, key } = body as { level: string; key?: string };
        const VALID_LEVELS = [
          "default",
          "by_locale",
          "by_region",
          "by_location",
        ];
        if (!level) {
          return res.status(400).json({ error: "level is required" });
        }
        if (!VALID_LEVELS.includes(level)) {
          return res.status(400).json({
            error: `Invalid level. Must be one of: ${VALID_LEVELS.join(", ")}`,
          });
        }
        if (level !== "default" && !key) {
          return res
            .status(400)
            .json({ error: "key is required for non-default levels" });
        }
        const result = variableManager.deleteVariableEntry(name, level, key);
        if (!result) {
          return res.status(404).json({ error: "Variable not found" });
        }
        return res.json({
          success: true,
          definitions: variableManager.getDefinitions(),
        });
      }

      const { action, index } = body as { action?: string; index?: number };
      if (action === "delete_condition" && index !== undefined) {
        variableManager.deleteCondition(name, index);
        return res.json({
          success: true,
          definitions: variableManager.getDefinitions(),
        });
      }

      return res
        .status(400)
        .json({ error: "level or action with index is required" });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: err?.message || "Failed to delete variable entry" });
    }
  });

  app.get("/api/variables/:name/usage", (req, res) => {
    try {
      const { name } = req.params;
      const files = contentIndex.getVariableUsage(name);
      res.json({ variable: name, files });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: err?.message || "Failed to get variable usage" });
    }
  });

  app.post("/api/variables/:name/rename", (req, res) => {
    try {
      const { name: oldName } = req.params;
      const { newName, author } = req.body as { newName: string; author?: string };
      const authorName = author && typeof author === "string" ? author : undefined;

      if (!newName || typeof newName !== "string") {
        return res.status(400).json({ error: "newName is required" });
      }

      const sanitized = newName.trim().replace(/\s+/g, "_").toLowerCase();
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sanitized)) {
        return res.status(400).json({
          error:
            "Invalid variable name. Use letters, numbers, and underscores only.",
        });
      }

      const affectedFiles = contentIndex.getVariableUsage(oldName);

      const pattern = new RegExp(
        `\\{\\{\\s*${oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s*(?:\\|[^}]*)?)\\}\\}`,
        "g",
      );

      const updatedFiles: string[] = [];
      for (const relPath of affectedFiles) {
        const absPath = path.join(process.cwd(), relPath);
        if (!fs.existsSync(absPath)) continue;

        const content = fs.readFileSync(absPath, "utf-8");
        const newContent = content.replace(pattern, `{{ ${sanitized}$1}}`);
        if (newContent !== content) {
          fs.writeFileSync(absPath, newContent, "utf-8");
          markFileAsModified(relPath, authorName);
          updatedFiles.push(relPath);
        }
      }

      variableManager.renameVariable(oldName, sanitized);

      contentIndex.refresh();
      invalidateContentCaches();

      res.json({
        success: true,
        oldName,
        newName: sanitized,
        updatedFiles,
        definitions: variableManager.getDefinitions(),
      });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: err?.message || "Failed to rename variable" });
    }
  });

  app.get("/api/career-programs", (req, res) => {
    const locale = normalizeLocale(req.query.locale as string);
    const _location = req.query.location as string | undefined;
    const programs = listCareerPrograms(locale);
    res.json(programs);
  });

  app.get("/api/career-programs/:slug", (req, res) => {
    const { slug } = req.params;
    const locale = normalizeLocale(req.query.locale as string);
    const forceVariant = req.query.force_variant as string | undefined;
    const forceVersion = req.query.force_version
      ? parseInt(req.query.force_version as string, 10)
      : undefined;

    let program: CareerProgram | null = null;
    let versioningInfo: {
      variant: string;
    } | null = null;

    // If force_variant is provided, load that variant directly (for preview)
    if (forceVariant) {
      const versioningManager = getVersioningManager();
      const forcedContent = versioningManager.getVariantContent("program", slug, forceVariant, locale);
      if (forcedContent) {
        program = forcedContent as unknown as CareerProgram;
        versioningInfo = { variant: forceVariant };
      }
    }

    // Normal versioning flow if not forcing a variant
    if (!program) {
      const userId = readUserId(req, res);
      const versioningCookie = getVersioningCookie(req);
      const existingAssignments = versioningCookie?.assignments || [];
      const existing = existingAssignments.find(
        (a) => a.contentType === "program" && a.slug === slug && a.locale === locale
      );

      const versioningManager = getVersioningManager();
      const assignedVariant = versioningManager.getAssignment(
        "program",
        slug,
        locale,
        userId,
        existing?.variantSlug,
      );

      if (assignedVariant) {
        const variantContent = versioningManager.getVariantContent("program", slug, assignedVariant, locale);
        if (variantContent) {
          program = variantContent as unknown as CareerProgram;
          versioningInfo = { variant: assignedVariant };

          const updatedAssignments = [
            ...existingAssignments.filter(
              (a) => !(a.contentType === "program" && a.slug === slug && a.locale === locale)
            ),
            { contentType: "program", slug, locale, variantSlug: assignedVariant, assignedAt: Date.now() },
          ];
          setVersioningCookie(res, userId, updatedAssignments);
        }
      }
    }

    // Fall back to default content
    if (!program) {
      program = loadCareerProgram(slug, locale);
    }

    if (!program) {
      res.status(404).json({ error: "Career program not found" });
      return;
    }

    const programData = program as unknown as Record<string, unknown>;
    const programRaw = contentIndex.loadMergedContent("program", slug, locale);
    const layout = resolveLayout("program", programRaw.data || {});
    const singleEntry = buildSingleEntryFromContent("program", programData);
    injectCanonicalIfMissing(programData, "program", locale);
    const { layout: _stripLayout, ...rest } = programData;
    res.json({
      ...rest,
      ...(singleEntry ? { singleEntry } : {}),
      layout,
    });
  });

  // Landing pages API
  app.get("/api/landings", (_req, res) => {
    const landings = listLandingPages();
    res.json(landings);
  });

  app.get("/api/landings/:slug", async (req, res) => {
    const { slug } = req.params;
    const forceVariant = req.query.force_variant as string | undefined;
    const forceVersion = req.query.force_version
      ? parseInt(req.query.force_version as string, 10)
      : undefined;

    // Resolve the folder slug first — the URL slug may be locale-specific
    // (e.g. "4geeks-vs-otros-landing" → folder "4geeks-vs-others-landing")
    const baseSlug = contentIndex.resolveBaseSlug(slug, "landing");

    // Get locale from query param, _common.yml, or default — then verify it exists
    const queryLocale = req.query.locale as string | undefined;
    const supported = getSupportedLocales();
    const validQueryLocale = queryLocale && supported.includes(queryLocale) ? queryLocale : undefined;
    const commonData = contentIndex.loadCommonData("landing", baseSlug);
    let locale = validQueryLocale || (commonData?.locale as string) || getDefaultLocale();
    const availableLocales = contentIndex.getAvailableLocalesOrVariants("landing" as ContentType, baseSlug);
    if (availableLocales.length > 0 && !availableLocales.includes(locale)) {
      locale = availableLocales[0];
    }
    // If the URL slug is locale-specific (e.g. the ES slug of a bilingual page),
    // detect which locale it belongs to and override the default locale detection
    if (!validQueryLocale) {
      const detectedLocale = contentIndex.resolveLocaleFromUrlSlug(slug, "landing");
      if (detectedLocale && availableLocales.includes(detectedLocale)) {
        locale = detectedLocale;
      }
    }

    let landing: LandingPage | null = null;
    let landingVersioningInfo: { variant: string } | null = null;

    // If force_variant is provided, load that variant directly (for preview)
    if (forceVariant) {
      const versioningManager = getVersioningManager();
      const forcedContent = versioningManager.getVariantContent("landing", baseSlug, forceVariant, locale);
      if (forcedContent) {
        landing = forcedContent as LandingPage;
        landingVersioningInfo = { variant: forceVariant };
      }
    }

    // Normal versioning flow if not forcing a variant
    if (!landing) {
      const userId = readUserId(req, res);
      const versioningCookie = getVersioningCookie(req);
      const existingAssignments = versioningCookie?.assignments || [];
      const existing = existingAssignments.find(
        (a) => a.contentType === "landing" && a.slug === baseSlug && a.locale === locale
      );

      const versioningManager = getVersioningManager();
      const assignedVariant = versioningManager.getAssignment(
        "landing",
        baseSlug,
        locale,
        userId,
        existing?.variantSlug,
      );

      if (assignedVariant) {
        const variantContent = versioningManager.getVariantContent("landing", baseSlug, assignedVariant, locale);
        if (variantContent) {
          landing = variantContent as LandingPage;
          landingVersioningInfo = { variant: assignedVariant };

          const updatedAssignments = [
            ...existingAssignments.filter(
              (a) => !(a.contentType === "landing" && a.slug === baseSlug && a.locale === locale)
            ),
            { contentType: "landing", slug: baseSlug, locale, variantSlug: assignedVariant, assignedAt: Date.now() },
          ];
          setVersioningCookie(res, userId, updatedAssignments);
        }
      }
    }

    // Fall back to default content
    if (!landing) {
      landing = loadLandingPage(slug, locale);
    }

    if (!landing) {
      res.status(404).json({ error: "Landing page not found" });
      return;
    }

    const landingLocations =
      (commonData?.locations as string[] | undefined) || undefined;
    const landingData = landing as unknown as Record<string, unknown>;

    if (landing.sections && Array.isArray(landing.sections)) {
      (landing as any).sections = await resolveDynamicEntries(landing.sections as any, locale);
      applyComponentImageSizes((landing as any).sections as unknown[]);
    }

    const rawMerged = contentIndex.loadMergedContent("landing", slug, locale);
    const layout = resolveLayout("landing", rawMerged.data || commonData || {});
    const singleEntry = buildSingleEntryFromContent("landing", landingData);
    injectCanonicalIfMissing(landingData, "landing", locale);
    const { layout: _stripLayout, ...restLanding } = landingData;
    res.json({
      ...restLanding,
      ...(singleEntry ? { singleEntry } : {}),
      locale,
      landing_locations: landingLocations,
      layout,
    });
  });

  // Locations API
  app.get("/api/locations", (req, res) => {
    const locale = normalizeLocale(req.query.locale as string);
    const region = req.query.region as string | undefined;
    let locations = listLocationPages(locale);

    if (region) {
      locations = locations.filter((loc) => loc.region === region);
    }

    res.json(locations);
  });

  app.get("/api/locations/:slug", async (req, res) => {
    const { slug } = req.params;
    const locale = normalizeLocale(req.query.locale as string);
    const forceVariant = req.query.force_variant as string | undefined;

    let location = null;

    if (forceVariant) {
      const versioningManager = getVersioningManager();
      const forcedContent = versioningManager.getVariantContent("location", slug, forceVariant, locale);
      if (forcedContent) {
        location = forcedContent as ReturnType<typeof loadLocationPage>;
      }
    }

    if (!location) {
      location = loadLocationPage(slug, locale);
    }

    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    const locationData = location as unknown as Record<string, unknown>;
    if (locationData.sections && Array.isArray(locationData.sections)) {
      applyComponentSectionDefaults(locationData.sections);
      locationData.sections = await resolveDynamicEntries(locationData.sections as any, locale) as any;
      applyComponentImageSizes(locationData.sections);
    }
    const locationRaw = contentIndex.loadMergedContent("location", slug, locale);
    const layout = resolveLayout("location", locationRaw.data || {});
    const singleEntry = buildSingleEntryFromContent("location", locationData);
    injectCanonicalIfMissing(locationData, "location", locale);
    const { layout: _stripLayout, ...restLocation } = locationData;
    res.json({
      ...restLocation,
      ...(singleEntry ? { singleEntry } : {}),
      layout,
    });
  });

  // Template Pages API
  app.get("/api/pages", (req, res) => {
    const locale = normalizeLocale(req.query.locale as string);
    const pages = listTemplatePages(locale);
    res.json(pages);
  });

  // Special handler for career-programs listing page (custom page type)
  app.get("/api/pages/career-programs", (req, res) => {
    const locale = normalizeLocale(req.query.locale as string);

    const page = loadCareerProgramsListing(locale);

    if (!page) {
      res.status(404).json({ error: "Career programs listing page not found" });
      return;
    }

    const cpPageData = page as unknown as Record<string, unknown>;
    const cpRaw = contentIndex.loadMergedContent("page", "career-programs", locale);
    const cpLayout = resolveLayout("page", cpRaw.data || {});
    injectCanonicalIfMissing(cpPageData, "page", locale);
    const { layout: _cpStripLayout, ...cpRest } = cpPageData;
    res.json({ ...cpRest, layout: cpLayout });
  });

  // Special handler for apply page (includes programs and locations from _common.yml)
  app.get("/api/pages/apply", (req, res) => {
    const locale = normalizeLocale(req.query.locale as string);
    const forceVariant = req.query.force_variant as string | undefined;

    let page = null;

    if (forceVariant) {
      const versioningManager = getVersioningManager();
      const forcedContent = versioningManager.getVariantContent("page", "apply", forceVariant, locale);
      if (forcedContent) {
        page = forcedContent as ReturnType<typeof loadTemplatePage>;
      }
    }

    if (!page) {
      page = loadTemplatePage("apply", locale);
    }

    if (!page) {
      res.status(404).json({ error: "Apply page not found" });
      return;
    }

    const commonData = contentIndex.loadCommonData("page", "apply");
    const applyRaw = contentIndex.loadMergedContent("page", "apply", locale);
    const layout = resolveLayout("page", applyRaw.data || {});
    const applyData = page as unknown as Record<string, unknown>;
    injectCanonicalIfMissing(applyData, "page", locale);
    const { layout: _stripLayout, ...restApply } = applyData;

    res.json({
      ...restApply,
      programs: commonData?.programs || [],
      locations: commonData?.locations || [],
      layout,
    });
  });

  // Apply form submission endpoint
  app.post("/api/apply", (req, res) => {
    try {
      const {
        program,
        location,
        firstName,
        lastName,
        email,
        phone,
        consentMarketing,
        consentSms,
        locale,
      } = req.body;

      // Validate required fields
      if (
        !program ||
        !location ||
        !firstName ||
        !lastName ||
        !email ||
        !phone
      ) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      // Log the application (in production, this would send to a CRM or database)
      console.log("New application received:", {
        program,
        location,
        firstName,
        lastName,
        email,
        phone,
        consentMarketing,
        consentSms,
        locale,
        timestamp: new Date().toISOString(),
      });

      // In the future, this could:
      // 1. Send to Breathecode API
      // 2. Add to a CRM
      // 3. Send confirmation email
      // 4. Store in database

      res.json({ success: true, message: "Application received" });
    } catch (error) {
      console.error("Error processing application:", error);
      res.status(500).json({ error: "Failed to process application" });
    }
  });

  app.get("/api/pages/:slug", async (req, res) => {
    const { slug } = req.params;
    const locale = normalizeLocale(req.query.locale as string);
    const forceVariant = req.query.force_variant as string | undefined;

    let page = null;

    if (forceVariant) {
      const versioningManager = getVersioningManager();
      const forcedContent = versioningManager.getVariantContent("page", slug, forceVariant, locale);
      if (forcedContent) {
        page = forcedContent as ReturnType<typeof loadTemplatePage>;
      }
    }

    if (!page) {
      page = loadTemplatePage(slug, locale);
    }

    if (!page) {
      res.status(404).json({ error: "Template page not found" });
      return;
    }

    if (page.sections && Array.isArray(page.sections)) {
      page.sections = (await resolveDynamicEntries(
        page.sections,
        locale,
      )) as any;
      applyComponentSectionDefaults(page.sections);
      applyComponentImageSizes(page.sections);
    }

    const pageData = page as unknown as Record<string, unknown>;
    const pageRaw = contentIndex.loadMergedContent("page", slug, locale);
    const layout = resolveLayout("page", pageRaw.data || {});
    const singleEntry = buildSingleEntryFromContent("page", pageData);
    if (singleEntry) {
      pageData.singleEntry = singleEntry;
    }
    injectCanonicalIfMissing(pageData, "page", locale);
    const { layout: _stripLayout, ...restPage } = pageData;
    res.json({ ...restPage, layout });
  });

  app.get("/api/content-pages/:contentType/:slug", async (req, res) => {
    const { contentType, slug } = req.params;
    const locale = normalizeLocale(req.query.locale as string);

    if (!isValidType(contentType)) {
      res.status(404).json({ error: `Unknown content type: ${contentType}` });
      return;
    }

    if (hasDatabaseSingle(contentType)) {
      const page = await loadDatabaseSinglePage(contentType, slug, locale);
      if (!page) {
        res.status(404).json({ error: `${contentType} entry not found` });
        return;
      }
      if (page.sections && Array.isArray(page.sections)) {
        page.sections = (await resolveDynamicEntries(page.sections, locale)) as any;
        applyComponentImageSizes(page.sections as unknown[]);
      }
      const dbPageData = page as unknown as Record<string, unknown>;
      const dbSingleEntry = (dbPageData.singleEntry as Record<string, unknown>) || {};
      if (Object.keys(dbSingleEntry).length > 0) {
        const dbResolved = resolveSingleVars(dbPageData, dbSingleEntry) as Record<string, unknown>;
        Object.assign(dbPageData, dbResolved);
      }
      const dbRaw = contentIndex.loadMergedContent(contentType, slug, locale);
      const dbLayout = resolveLayout(contentType, dbRaw.data || {});
      injectCanonicalIfMissing(dbPageData, contentType, locale);
      const { layout: _dbStripLayout, ...dbRest } = dbPageData;
      res.json({ ...dbRest, layout: dbLayout });
      return;
    }

    const result = contentIndex.loadContent({
      contentType,
      slug,
      localeOrVariant: locale,
    });

    if (!result.success) {
      res.status(404).json({ error: `${contentType} entry not found` });
      return;
    }

    const page = result.data;

    if (page.sections && Array.isArray(page.sections)) {
      page.sections = (await resolveDynamicEntries(page.sections, locale)) as any;
      applyComponentImageSizes(page.sections as unknown[]);
    }

    const genericPageData = page as unknown as Record<string, unknown>;
    const genericRaw = contentIndex.loadMergedContent(contentType, slug, locale);
    const genericLayout = resolveLayout(contentType, genericRaw.data || {});
    const singleEntry = buildSingleEntryFromContent(contentType, genericPageData);
    if (singleEntry) {
      genericPageData.singleEntry = singleEntry;
      const resolved = resolveSingleVars(genericPageData, singleEntry) as Record<string, unknown>;
      Object.assign(genericPageData, resolved);
    }
    injectCanonicalIfMissing(genericPageData, contentType, locale);
    const { layout: _genericStripLayout, ...genericRest } = genericPageData;
    res.json({ ...genericRest, layout: genericLayout });
  });

  // Dynamic sitemap with caching
  app.get("/sitemap.xml", (req, res) => {
    const xml = getSitemap();
    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=3600"); // Browser cache for 1 hour
    res.send(xml);
  });

  // Get Breathecode host configuration (for debug tools)
  app.get("/api/debug/breathecode-host", (req, res) => {
    const defaultHost = "https://breathecode.herokuapp.com";
    res.json({
      host: BREATHECODE_HOST,
      isDefault: BREATHECODE_HOST === defaultHost,
    });
  });

  // Sitemap cache status (for debug tools)
  app.get("/api/debug/sitemap-cache-status", (req, res) => {
    const status = getSitemapCacheStatus();
    res.json(status);
  });

  // Sitemap URLs as JSON (for debug tools)
  app.get("/api/debug/sitemap-urls", (req, res) => {
    const urls = getSitemapUrls();
    res.json(urls);
  });

  // Public sitemap URLs endpoint for menu editor
  app.get("/api/sitemap-urls", (req, res) => {
    const locale = req.query.locale as string | undefined;
    const urls = getSitemapUrls();

    if (locale) {
      const langPrefixes = ["/en/", "/es/", "/fr/", "/de/", "/pt/", "/it/"];
      const filteredUrls = urls.filter((entry) => {
        const path = entry.loc.replace(/^https?:\/\/[^/]+/, "");
        const matchesLocale = path.startsWith(`/${locale}/`);
        const isNeutral = !langPrefixes.some((prefix) =>
          path.startsWith(prefix),
        );
        return matchesLocale || isNeutral;
      });
      res.json(filteredUrls);
    } else {
      res.json(urls);
    }
  });

  // Returns sections for a given page path — used by LinkPicker's Section/Modal tabs
  // when a contextPath is set (e.g. in per-page CTA override rows)
  app.get("/api/page-sections", async (req, res) => {
    try {
      const pagePath = req.query.path as string;

      if (!pagePath) {
        res.status(400).json({ error: "Missing path query parameter", sections: [] });
        return;
      }

      const normalizedPath = normalizeUrl(pagePath);
      const resolved = contentIndex.resolveUrl(normalizedPath);

      let effectiveLocale = (req.query.locale as string) || "en";
      if (resolved && !req.query.locale && resolved.patternLocale) {
        effectiveLocale =
          resolved.patternLocale === "default" ? "en" : resolved.patternLocale;
      }

      let rawData: Record<string, unknown> | null = null;

      if (resolved && !resolved.fromDatabase) {
        const merged = contentIndex.loadMergedContent(
          resolved.contentType,
          resolved.slug,
          effectiveLocale,
        );
        if (merged.data) {
          rawData = merged.data;
        }
      }

      if (!rawData) {
        const service = getValidationService();
        let context = service.getContext();
        if (!context) {
          context = await service.buildContext();
        }

        const matchingFiles = (context.contentFiles as any[]).filter(
          (f: any) => normalizeUrl(getCanonicalUrl(f)) === normalizedPath,
        );

        const file =
          matchingFiles.find((f: any) => f.locale === effectiveLocale) ||
          matchingFiles.find((f: any) => f.locale !== "_common") ||
          matchingFiles[0] ||
          null;

        if (!file) {
          res.json({ sections: [] });
          return;
        }

        rawData = {};
        try {
          const commonPath = path.join(path.dirname(file.filePath), "_common.yml");
          if (fs.existsSync(commonPath)) {
            const commonData =
              (safeYamlLoad(fs.readFileSync(commonPath, "utf-8")) as Record<string, unknown>) || {};
            rawData = { ...commonData };
          }
          if (fs.existsSync(file.filePath)) {
            const localeData =
              (safeYamlLoad(fs.readFileSync(file.filePath, "utf-8")) as Record<string, unknown>) || {};
            rawData = { ...rawData, ...localeData };
          }
        } catch {}
      }

      const includeYaml = req.query.includeYaml === "true";
      const rawSections = (rawData.sections as any[]) || [];
      const sections = rawSections
        .filter((s: any) => s?.type)
        .map((s: any, index: number) => {
          const base: Record<string, unknown> = {
            type: s.type as string,
            section_id: (s.section_id as string) || null,
            label:
              (s.title as string) ||
              (s.heading as string) ||
              `${s.type} (section ${index + 1})`,
          };
          if (includeYaml) {
            base.yamlContent = safeYamlDump([s], { lineWidth: -1 });
          }
          return base;
        });

      res.json({ sections });
    } catch (e) {
      res.status(500).json({ error: String(e), sections: [] });
    }
  });

  // ============================================================================
  // Blog API routes
  // ============================================================================
  app.get("/api/blog/posts", async (req, res) => {
    try {
      const locale = req.query.locale as string | undefined;
      const category = req.query.category as string | undefined;
      const page = req.query.page
        ? parseInt(req.query.page as string, 10)
        : undefined;
      const limit = Math.min(
        parseInt(req.query.limit as string, 10) || 12,
        100,
      );
      const posts = await databaseManager.fetchMappedItems("blog");
      const localeKey = getLocaleKey("blog") || "lang";
      let filtered = locale
        ? posts.filter((p) => (p as any)[localeKey] === normalizeLocale(locale))
        : posts;

      if (category) {
        filtered = filtered.filter((p: any) => {
          return (p.category?.slug || "") === category;
        });
      }

      const categories = Array.from(
        new Set(
          (locale
            ? posts.filter(
                (p) => (p as any)[localeKey] === normalizeLocale(locale),
              )
            : posts
          )
            .map((p: any) => p.category?.slug || "")
            .filter(Boolean),
        ),
      ).sort();

      const total = filtered.length;
      const stripped = filtered.map((p: any) => {
        const { content, readme, ...rest } = p;
        return rest;
      });

      if (page && page > 0) {
        const totalPages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const paginated = stripped.slice(start, start + limit);
        res.json({
          count: paginated.length,
          total,
          page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          categories,
          results: paginated,
        });
      } else {
        res.json({
          count: total,
          total,
          categories,
          results: stripped,
        });
      }
    } catch (error) {
      console.error("[Blog] Error fetching posts:", error);
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/blog/posts/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const locale = req.query.locale as string | undefined;
      const posts = await databaseManager.fetchMappedItems("blog");
      const localeKey = getLocaleKey("blog") || "lang";
      const normalizedLocale = locale ? normalizeLocale(locale) : undefined;
      const post = normalizedLocale
        ? posts.find(
            (p) =>
              p.slug === slug && (p as any)[localeKey] === normalizedLocale,
          ) || posts.find((p) => p.slug === slug)
        : posts.find((p) => p.slug === slug);

      if (!post) {
        res.status(404).json({ error: "Blog post not found" });
        return;
      }

      let content = (post as any).content || "";
      if (!content && (post as any).readme_url) {
        content = await fetchMarkdownContent((post as any).readme_url);
      }

      const blogLayout = resolveLayout("blog", post as unknown as Record<string, unknown>);
      res.json({ ...post, content, layout: blogLayout });
    } catch (error) {
      console.error("[Blog] Error fetching post:", error);
      res.status(500).json({ error: "Failed to fetch blog post" });
    }
  });

  app.get("/api/blog/cache-status", (_req, res) => {
    const dbName = getDatabaseName("blog");
    if (!dbName) {
      res.json({ exists: false, age_hours: null, post_count: null });
      return;
    }
    const info = databaseManager.getCacheInfo(dbName);
    res.json({
      exists: !!info,
      age_hours: info
        ? Math.round(
            ((Date.now() - new Date(info.fetched_at).getTime()) /
              (60 * 60 * 1000)) *
              10,
          ) / 10
        : null,
      post_count: info?.item_count ?? null,
    });
  });

  app.delete("/api/blog/cache/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const posts = await databaseManager.fetchMappedItems("blog");
      const post = posts.find((p) => p.slug === slug);
      if ((post as any)?.readme_url) {
        clearMarkdownCacheByUrl((post as any).readme_url);
      }
      clearMarkdownCache(slug);
      res.json({ success: true, message: `Cache cleared for "${slug}"` });
    } catch (error) {
      console.error("[Blog] Error clearing post cache:", error);
      res.status(500).json({ error: "Failed to clear post cache" });
    }
  });

  app.post("/api/debug/clear-blog-cache", async (_req, res) => {
    const dbName = getDatabaseName("blog");
    if (dbName && databaseManager.exists(dbName)) {
      await databaseManager.fetchItems(dbName, true).catch(() => {});
    }
    clearMarkdownCache();
    res.json({
      success: true,
      message: "Blog cache cleared (database will re-fetch on next request)",
    });
  });

  app.get("/api/blog/config", (_req, res) => {
    try {
      const config = getContentTypeConfig("blog");
      res.json(config || {});
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.put("/api/blog/config", (req, res) => {
    try {
      const body = req.body;
      if (!body || typeof body !== "object") {
        res.status(400).json({ error: "Request body must be a JSON object" });
        return;
      }
      const update: Partial<import("./content-types").ContentTypeEntry> = {};
      if (body.url_pattern !== undefined) update.url_pattern = body.url_pattern;
      if (body.database !== undefined) update.database = body.database;
      updateContentTypeConfig("blog", update);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/database-single/:contentType/:slug", async (req, res) => {
    try {
      const { contentType, slug } = req.params;
      const locale = normalizeLocale(req.query.locale as string);

      if (!hasDatabaseSingle(contentType)) {
        res
          .status(400)
          .json({
            error: `Content type "${contentType}" is not database-backed`,
          });
        return;
      }

      const page = await loadDatabaseSinglePage(contentType, slug, locale);
      if (!page) {
        res
          .status(404)
          .json({ error: `Item not found: ${contentType}/${slug}` });
        return;
      }

      const dbSingleRaw = contentIndex.loadMergedContent(contentType, slug, locale);
      const dbSingleLayout = resolveLayout(contentType, dbSingleRaw.data || (page as unknown as Record<string, unknown>));
      const dbSingleData = page as unknown as Record<string, unknown>;
      injectCanonicalIfMissing(dbSingleData, contentType, locale);
      const { layout: _dbSingleStripLayout, ...dbSingleRest } = dbSingleData;
      res.json({ ...dbSingleRest, layout: dbSingleLayout });
    } catch (error) {
      console.error("[DatabaseSingle] Error:", error);
      res.status(500).json({ error: "Failed to load database single page" });
    }
  });

  // ── Generic Content Type API Routes ──

  app.get("/api/content-types", (_req, res) => {
    try {
      const configs = getAllConfigs();
      const result: Record<string, unknown>[] = [];
      for (const [type, config] of Object.entries(configs)) {
        result.push({
          name: type,
          label: getLabel(type),
          directory: config.directory,
          has_database: !!config.database?.slug,
          database_slug: config.database?.slug || null,
          has_field_mapping: !!(
            config.field_mapping &&
            Object.keys(config.field_mapping).filter(
              (k) => !k.startsWith("_"),
            ).length > 0
          ),
          unique_fields: config.unique_fields ?? ["slug"],
          field_mapping_keys: Object.keys(config.field_mapping ?? {}).filter(
            (k) => !k.startsWith("_"),
          ),
          url_pattern: config.url_pattern,
          locale_key: config.field_mapping?._locale || null,
          static_entry_count: contentIndex.findByType(type).length,
          layout: getLayout(type),
        });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/content-types", (req, res) => {
    try {
      const { name, directory, url_pattern } = req.body;
      if (!name || typeof name !== "string") {
        res.status(400).json({ error: "Name is required" });
        return;
      }
      if (!/^[a-z][a-z0-9_-]*$/.test(name)) {
        res
          .status(400)
          .json({
            error:
              "Name must be lowercase alphanumeric (hyphens and underscores allowed)",
          });
        return;
      }
      if (!url_pattern) {
        res.status(400).json({ error: "URL pattern is required" });
        return;
      }

      const normalizedPattern = normalizeUrlPattern(url_pattern);

      const patternValues = Object.values(normalizedPattern) as string[];
      for (const p of patternValues) {
        if (!p.includes(":slug")) {
          res.status(400).json({ error: "URL pattern must include :slug" });
          return;
        }
        if (!p.startsWith("/")) {
          res.status(400).json({ error: "URL pattern must start with /" });
          return;
        }
      }
      const dir = directory || name;

      addContentType(name, {
        directory: dir,
        url_pattern: normalizedPattern,
      });

      contentIndex.refresh();
      clearSitemapCache();

      res.json({
        success: true,
        name,
        directory: dir,
        url_pattern: normalizedPattern,
      });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  app.get("/api/settings/home-page", (_req, res) => {
    res.json(getHomePage());
  });

  app.get("/api/settings/locales", (_req, res) => {
    res.json({
      default_locale: getDefaultLocale(),
      supported_locales: getLocaleEntries(),
    });
  });

  app.put("/api/settings/locales", (req, res) => {
    try {
      const { default_locale, supported_locales } = req.body;
      updateLocaleSettings({ default_locale, supported_locales });
      res.json({
        success: true,
        default_locale: getDefaultLocale(),
        supported_locales: getLocaleEntries(),
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || String(err) });
    }
  });

  app.get("/api/migrations", (_req, res) => {
    try {
      const migrationsDir = path.join(process.cwd(), "scripts", "migrations");
      if (!fs.existsSync(migrationsDir)) {
        res.json([]);
        return;
      }
      const files = fs.readdirSync(migrationsDir)
        .filter(f => /^\d{3}_[\w]+\.ts$/.test(f))
        .sort();
      const result = files.map(filename => {
        const fullPath = path.join(migrationsDir, filename);
        const content = fs.readFileSync(fullPath, "utf-8");
        const nameMatch = content.match(/@migration\s+([^\n*]+)/);
        const descMatch = content.match(/@description\s+([^\n*]+(?:\n\s*\*\s+[^\n*@]+)*)/);
        const name = nameMatch ? nameMatch[1].trim() : filename.replace(/\.ts$/, "");
        const description = descMatch
          ? descMatch[1].replace(/\n\s*\*\s*/g, " ").trim()
          : "No description provided.";
        return { filename, name, description };
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.post("/api/migrations/run", (req, res) => {
    const { filename } = req.body || {};
    if (!filename || !/^\d{3}_[\w]+\.ts$/.test(filename)) {
      res.status(400).json({ error: "Invalid migration filename." });
      return;
    }
    const migrationsDir = path.join(process.cwd(), "scripts", "migrations");
    const fullPath = path.join(migrationsDir, filename);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: "Migration script not found." });
      return;
    }
    execFile(
      "npx",
      ["tsx", fullPath],
      { cwd: process.cwd(), timeout: 120000 },
      (err, stdout, stderr) => {
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();
        if (err && err.killed) {
          res.json({ success: false, output: `Timed out after 120s.\n${output}` });
        } else if (err && err.code !== 0) {
          res.json({ success: false, output: output || err.message });
        } else {
          res.json({ success: true, output });
        }
      },
    );
  });

  app.get("/api/content-types/:type/config", (req, res) => {
    try {
      const { type } = req.params;
      const config = getContentTypeConfig(type);
      if (!config) {
        res.status(404).json({ error: `Content type "${type}" not found` });
        return;
      }
      res.json({
        name: type,
        label: getLabel(type),
        directory: config.directory,
        field_mapping: config.field_mapping || null,
        indexes: config.indexes || null,
        database: config.database || null,
        url_pattern: config.url_pattern,
        static_entry_count: contentIndex.findByType(type).length,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/content-types/:type/validate-field", (req, res) => {
    try {
      const { type } = req.params;
      const source = req.query.source as string;
      if (!source) {
        res.status(400).json({ error: "source query parameter is required" });
        return;
      }
      const config = getContentTypeConfig(type);
      if (!config) {
        res.status(404).json({ error: `Content type "${type}" not found` });
        return;
      }
      const result = validateFieldSource(type, source);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/content-types/:type/validate-mappings", (req, res) => {
    try {
      const { type } = req.params;
      const config = getContentTypeConfig(type);
      if (!config) {
        res.status(404).json({ error: `Content type "${type}" not found` });
        return;
      }
      const { field_mapping } = req.body || {};
      if (!field_mapping || typeof field_mapping !== "object") {
        res.status(400).json({ error: "field_mapping object is required in body" });
        return;
      }
      const result = validateFieldMapping(type, field_mapping);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.put("/api/content-types/:type/config", (req, res) => {
    try {
      const { type } = req.params;
      const config = getContentTypeConfig(type);
      if (!config) {
        res.status(404).json({ error: `Content type "${type}" not found` });
        return;
      }
      const body = req.body;
      if (!body || typeof body !== "object") {
        res.status(400).json({ error: "Request body must be a JSON object" });
        return;
      }

      if (body.field_mapping && !config.database?.slug) {
        const validation = validateFieldMapping(type, body.field_mapping);
        if (!validation.allValid) {
          const invalidFields = Object.entries(validation.results)
            .filter(([, r]) => !r.valid)
            .map(([k]) => k);
          res.status(400).json({
            error: `Some field mappings reference properties not found in all entries: ${invalidFields.join(", ")}`,
            validation: validation.results,
          });
          return;
        }
      }

      const update: Partial<import("./content-types").ContentTypeEntry> = {};
      if (body.url_pattern !== undefined) update.url_pattern = body.url_pattern;
      if (body.field_mapping !== undefined) update.field_mapping = body.field_mapping;
      if (body.indexes !== undefined) update.indexes = body.indexes;
      if (body.unique_fields !== undefined) update.unique_fields = body.unique_fields;
      if (body.database !== undefined) update.database = body.database;
      updateContentTypeConfig(type, update);
      contentIndex.invalidateCommonFields(type);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/content-types/:type/available-properties", (req, res) => {
    try {
      const { type } = req.params;
      const config = getContentTypeConfig(type);
      if (!config) {
        res.status(404).json({ error: `Content type "${type}" not found` });
        return;
      }
      const result = contentIndex.getCommonFields(type);
      const excludeMapped = req.query.exclude_mapped === "true";
      if (excludeMapped && config.field_mapping) {
        const mappedSources = new Set(
          Object.values(config.field_mapping).map((v) =>
            typeof v === "string" ? (v.startsWith("function:") ? null : v) : (v as { source: string }).source
          ).filter(Boolean)
        );
        return res.json({
          common: result.common.filter((k) => !mappedSources.has(k)),
          partial: result.partial.filter((p) => !mappedSources.has(p.key)),
        });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/content-types/:type/single-field-values", (req, res) => {
    try {
      const { type } = req.params;
      const field = req.query.field as string;
      const locale = (req.query.locale as string) || "en";
      if (!field) {
        res.status(400).json({ error: "field query parameter is required" });
        return;
      }
      const config = getContentTypeConfig(type);
      if (!config) {
        res.status(404).json({ error: `Content type "${type}" not found` });
        return;
      }
      const mapping = getFieldMapping(type);
      const source = mapping?.[field];
      if (!source || typeof source !== "string") {
        res.status(404).json({ error: `Field "${field}" not found in field_mapping` });
        return;
      }

      const slugs = contentIndex.listContentSlugs(type as ContentType);
      const entries: Array<{ slug: string; value: unknown; url: string | null }> = [];
      for (const slug of slugs) {
        const locales = contentIndex.getAvailableLocalesOrVariants(type as ContentType, slug);
        const entryLocale = locales.includes(locale) ? locale : locales[0];
        if (!entryLocale) continue;
        const { data } = contentIndex.loadMergedContent(type, slug, entryLocale);
        if (!data) continue;
        const value = extractByDotPath(data, source);
        let url: string | null = null;
        try {
          url = resolveContentTypeUrl(type, data as Record<string, unknown>, entryLocale);
        } catch {}
        entries.push({ slug, value: value ?? null, url });
      }
      res.json({ field, source, entries });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/content-types/:type/single-template-sections", (req, res) => {
    try {
      const { type } = req.params;
      const locale = ((req.query.locale as string) || "en").replace(/[^a-z-]/g, "");
      if (!isValidType(type)) {
        res.status(404).json({ error: `Unknown content type: ${type}` });
        return;
      }
      if (!hasDatabaseSingle(type)) {
        res.status(400).json({ error: `Content type "${type}" does not use a single template` });
        return;
      }
      const merged = mergeSingleTemplate(type, locale);
      if (!merged) {
        res.status(404).json({ error: "Single template not found" });
        return;
      }
      if (!Array.isArray(merged.sections)) {
        res.status(404).json({ error: "No sections array in single template" });
        return;
      }
      const sectionYamls = (merged.sections as unknown[]).map((s) =>
        safeYamlDump(s, { lineWidth: -1, noRefs: true }),
      );
      res.json({ sections: sectionYamls });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/content-types/:type/entry-fields", (req, res) => {
    try {
      const { type } = req.params;
      const slugParam = req.query.slug as string | undefined;
      const localeParam = req.query.locale as string | undefined;

      const config = getContentTypeConfig(type);
      if (!config) {
        res.status(404).json({ error: `Content type "${type}" not found` });
        return;
      }

      const fieldMapping = config.field_mapping ?? {};
      const fieldKeys = Object.keys(fieldMapping).filter((k) => !k.startsWith("_"));

      const slugs = contentIndex.listContentSlugs(type as ContentType);
      if (slugs.length === 0) {
        res.json({ slug: null, title: null, fields: {}, computed: [] });
        return;
      }

      const targetSlug = slugParam && slugs.includes(slugParam) ? slugParam : slugs[0];
      const availableLocales = contentIndex.getAvailableLocalesOrVariants(type as ContentType, targetSlug);
      const entryLocale = localeParam && availableLocales.includes(localeParam) ? localeParam : availableLocales[0];
      if (!entryLocale) {
        res.json({ slug: null, title: null, fields: {}, computed: [] });
        return;
      }

      const { data } = contentIndex.loadMergedContent(type, targetSlug, entryLocale);
      if (!data) {
        res.json({ slug: null, title: null, fields: {}, computed: [] });
        return;
      }

      const fields: Record<string, string | boolean | number | null> = {};
      const computed: string[] = [];

      for (const key of fieldKeys) {
        const rawMapping = fieldMapping[key];
        const mappingValue =
          typeof rawMapping === "string"
            ? rawMapping
            : typeof rawMapping === "object" && rawMapping !== null
            ? (rawMapping as { source: string }).source
            : null;

        if (typeof mappingValue === "string" && mappingValue.startsWith("function:")) {
          computed.push(key);
          const fallback = extractByDotPath(data, key);
          fields[key] = fallback != null ? String(fallback) : null;
        } else if (typeof mappingValue === "string") {
          const value = extractByDotPath(data, mappingValue);
          if (value == null) {
            fields[key] = null;
          } else if (typeof value === "boolean" || typeof value === "number") {
            fields[key] = value;
          } else {
            fields[key] = String(value);
          }
        } else {
          fields[key] = null;
        }
      }

      const nullFields = Object.entries(fields)
        .filter(([k, v]) => v === null && !computed.includes(k))
        .map(([k]) => k);
      if (nullFields.length > 0) {
        for (const otherSlug of slugs) {
          if (nullFields.length === 0) break;
          if (otherSlug === targetSlug) continue;
          const otherLocales = contentIndex.getAvailableLocalesOrVariants(type as ContentType, otherSlug);
          if (!otherLocales.length) continue;
          const otherResult = contentIndex.loadMergedContent(type, otherSlug, otherLocales[0]);
          if (!otherResult?.data) continue;
          for (let i = nullFields.length - 1; i >= 0; i--) {
            const fk = nullFields[i];
            const mp = fieldMapping[fk];
            const mv = typeof mp === "string" ? mp : typeof mp === "object" && mp !== null ? (mp as { source: string }).source : null;
            if (typeof mv !== "string" || mv.startsWith("function:")) continue;
            const v = extractByDotPath(otherResult.data, mv);
            if (v != null) {
              if (typeof v === "boolean" || typeof v === "number") {
                fields[fk] = v;
              } else {
                fields[fk] = String(v);
              }
              nullFields.splice(i, 1);
            }
          }
        }
      }

      const titleRaw = extractByDotPath(data, "title");
      const title = titleRaw != null ? String(titleRaw) : null;

      res.json({ slug: targetSlug, title, fields, computed });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/content-type/:name/single-defaults", (req, res) => {
    try {
      const { name } = req.params;
      const folder = getFolder(name);
      if (!folder) {
        res.status(404).json({ error: `Content type "${name}" not found` });
        return;
      }
      const filePath = path.join(process.cwd(), "marketing-content", folder, "_common.single.yml");
      if (!fs.existsSync(filePath)) {
        res.json({ defaults: {} });
        return;
      }
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = contentIndex.safeYamlLoad(raw) || {};
      res.json({ defaults: parsed });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.put("/api/content-type/:name/single-defaults", (req, res) => {
    try {
      const { name } = req.params;
      const folder = getFolder(name);
      if (!folder) {
        res.status(404).json({ error: `Content type "${name}" not found` });
        return;
      }
      const body = req.body;
      if (!body || typeof body !== "object") {
        res.status(400).json({ error: "Request body must be a JSON object" });
        return;
      }
      const filePath = path.join(process.cwd(), "marketing-content", folder, "_common.single.yml");
      let existing: Record<string, unknown> = {};
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        existing = contentIndex.safeYamlLoad(raw) || {};
      }
      const merged = deepMerge(existing, body);
      const { escaped, map } = escapeObjectVars(merged);
      const dumped = yaml.dump(escaped, { lineWidth: 120, noRefs: true });
      const yamlStr = unescapeYamlDump(dumped, map);
      fs.writeFileSync(filePath, yamlStr, "utf-8");
      const author = (req.body as Record<string, unknown>).author as string | undefined;
      markFileAsModified(filePath, author || "api");
      invalidateContentCaches(name);
      res.json({ success: true, defaults: merged });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/content-types/:type/items", async (req, res) => {
    try {
      const { type } = req.params;
      const config = getContentTypeConfig(type);
      if (!config?.database?.slug) {
        res
          .status(400)
          .json({ error: `Content type "${type}" has no database configured` });
        return;
      }
      const dbName = config.database.slug;
      if (!databaseManager.exists(dbName)) {
        res.status(404).json({ error: `Database "${dbName}" not found` });
        return;
      }

      const locale = req.query.locale as string | undefined;

      const result = await databaseManager.fetchItems(dbName);
      let items = result.items as Record<string, unknown>[];

      const mapping = config.field_mapping;
      const regularMapping: Record<string, string> = {};
      const rawFieldRefs: Record<string, string> = {};
      if (mapping) {
        for (const [key, value] of Object.entries(mapping)) {
          if (key.startsWith("_")) continue;
          const sourcePath = typeof value === "object" ? value.source : value;
          if (sourcePath.startsWith("raw.")) {
            rawFieldRefs[key] = sourcePath.slice(4);
          } else if (sourcePath.startsWith("db.")) {
            regularMapping[key] = sourcePath.slice(3);
          } else {
            regularMapping[key] = sourcePath;
          }
        }
      }

      let rawItems: Record<string, unknown>[] | null = null;
      if (Object.keys(rawFieldRefs).length > 0) {
        rawItems = databaseManager.getRawItems(dbName);
      }

      const localeFieldKey = getLocaleKey(type);
      const localeDefault = getLocaleDefault(type);

      if (
        Object.keys(regularMapping).length > 0 ||
        Object.keys(rawFieldRefs).length > 0
      ) {
        items = items.map((item, idx) => {
          const mapped: Record<string, unknown> = { ...item };
          const itemSlug = String(item.slug ?? item.id ?? idx);
          for (const [targetField, sourcePath] of Object.entries(
            regularMapping,
          )) {
            const value = resolveFieldValue(sourcePath, item, targetField, {
              contentType: type,
              slug: itemSlug,
              fieldPath: targetField,
            });
            if (value !== undefined) mapped[targetField] = value;
          }
          if (rawItems && rawItems[idx]) {
            for (const [targetField, sourcePath] of Object.entries(
              rawFieldRefs,
            )) {
              const value = resolveFieldValue(
                sourcePath,
                rawItems[idx],
                targetField,
                { contentType: type, slug: itemSlug, fieldPath: targetField },
              );
              if (value !== undefined) mapped[targetField] = value;
            }
          }
          return mapped;
        });
      }

      const localeSource = getLocaleSource(type);
      if (localeFieldKey) {
        items = items.map((item) => {
          const locVal = String(item[localeFieldKey] || "");
          const normalized = localeSource
            ? applyTransformIfNeeded(localeSource, locVal)
            : locVal;
          return { ...item, [localeFieldKey]: normalized || localeDefault };
        });
      }

      if (locale && localeFieldKey) {
        const normalizedLocale = normalizeLocale(locale);
        items = items.filter((item) => {
          const val = String(item[localeFieldKey] || localeDefault);
          return val === normalizedLocale;
        });
      }

      const indexes = getIndexes(type);
      for (const idx of indexes) {
        const filterVal = req.query[idx] as string | undefined;
        if (filterVal !== undefined && filterVal !== "") {
          items = items.filter((item) => {
            const val = String(item[idx] || "").toLowerCase();
            return val === filterVal.toLowerCase();
          });
        }
      }

      const stripped = items.map((item) => {
        const { content, readme, ...rest } = item as Record<string, unknown>;
        return rest;
      });

      res.json({ count: stripped.length, results: stripped });
    } catch (err) {
      console.error(
        `[ContentTypes] Error fetching items for ${req.params.type}:`,
        err,
      );
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/content-types/:type/static-entries", (req, res) => {
    try {
      const { type } = req.params;
      const entries = contentIndex.findByType(type);
      const versioningManager = getVersioningManager();
      const results = entries.map((entry) => {
        const urls = contentIndex.getLocaleUrls(entry.slug, type);
        const versionCounts = versioningManager.getVersionCounts(type, entry.slug);
        return {
          slug: entry.slug,
          title: entry.title || entry.slug,
          locales: entry.locales.filter(
            (l) => !l.startsWith("_") && !l.includes("."),
          ),
          urls,
          versionCounts,
        };
      });
      res.json({ count: results.length, results });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/content-types/:type/cache-status", (req, res) => {
    try {
      const { type } = req.params;
      const config = getContentTypeConfig(type);
      if (!config?.database?.slug) {
        res.json({ exists: false, age_hours: null, post_count: null });
        return;
      }
      const dbName = config.database.slug;
      const cachePath = path.join(process.cwd(), ".cache", `db-${dbName}.json`);
      if (!fs.existsSync(cachePath)) {
        res.json({ exists: false, age_hours: null, post_count: null });
        return;
      }
      try {
        const raw = fs.readFileSync(cachePath, "utf-8");
        const cached = JSON.parse(raw) as {
          fetched_at: string;
          items: unknown[];
        };
        const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
        const ageHours = Math.round((ageMs / (60 * 60 * 1000)) * 10) / 10;
        res.json({
          exists: true,
          age_hours: ageHours,
          post_count: cached.items.length,
        });
      } catch {
        res.json({ exists: false, age_hours: null, post_count: null });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/content-types/:type/seo-entries", async (req, res) => {
    try {
      const { type } = req.params;
      const localeFilter = req.query.locale as string | undefined;
      const config = getContentTypeConfig(type);
      if (!config) {
        res.status(404).json({ error: `Content type "${type}" not found` });
        return;
      }
      const urlPattern = config.url_pattern as Record<string, string> | undefined;

      // ── DB-backed ────────────────────────────────────────────────────────────
      if (config.database?.slug) {
        const dbName = config.database.slug;
        if (!databaseManager.exists(dbName)) {
          res.status(404).json({ error: `Database "${dbName}" not found` });
          return;
        }
        // Return cache_missing rather than erroring when no cache file exists
        const cacheFilePath = path.join(process.cwd(), ".cache", `db-${dbName}.json`);
        if (!fs.existsSync(cacheFilePath)) {
          res.json({ contentType: type, source: "db", cache_missing: true, count: 0, entries: [] });
          return;
        }
        const items = await databaseManager.fetchMappedItems(type);
        const localeKey = getLocaleKey(type) || "lang";
        const cacheInfo = databaseManager.getCacheInfo(dbName);
        const cacheAgeHours = cacheInfo?.fetched_at
          ? Math.round((Date.now() - new Date(cacheInfo.fetched_at).getTime()) / (60 * 60 * 1000) * 10) / 10
          : null;

        const uniqueLocales = [...new Set(items.map(item => String(item[localeKey] || "en")))];
        const templates: Record<string, Record<string, unknown> | null> = {};
        for (const locale of uniqueLocales) {
          templates[locale] = mergeSingleTemplate(type, locale);
        }

        const entries = items
          .filter(item => !localeFilter || String(item[localeKey] || "en") === localeFilter)
          .map(item => {
            const locale = String(item[localeKey] || "en");
            const template = templates[locale];
            const rawMeta = resolveSingleVars(template?.meta ?? {}, item) as Record<string, unknown>;
            const resolvedMeta: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(rawMeta)) {
              resolvedMeta[k] = (typeof v === "string" && /\{\{.*?\}\}/.test(v)) ? null : v;
            }
            let url: string | null = null;
            if (urlPattern && typeof item.slug === "string") {
              const tpl = urlPattern[locale] || urlPattern["default"] || null;
              if (tpl) {
                url = tpl.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, key: string) => {
                  if (key === "slug") return item.slug as string;
                  const val = item[key];
                  if (val === undefined || val === null || val === "") return "";
                  if (typeof val === "object" && "slug" in (val as Record<string, unknown>)) {
                    return String((val as Record<string, unknown>).slug) || "";
                  }
                  return String(val);
                });
              }
            }
            return {
              slug: item.slug ?? null,
              contentType: type,
              locale,
              url,
              title: item.title ?? null,
              meta: resolvedMeta,
              schema: template?.schema ?? null,
            };
          });

        res.json({ contentType: type, source: "db", cache_age_hours: cacheAgeHours, count: entries.length, entries });
        return;
      }

      // ── YAML-backed ──────────────────────────────────────────────────────────
      const dir = getDirectory(type);
      const contentDir = path.join(process.cwd(), "marketing-content", dir);
      if (!fs.existsSync(contentDir)) {
        res.status(404).json({ error: `Content directory not found: marketing-content/${dir}` });
        return;
      }

      const entries: unknown[] = [];
      const slugDirs = fs.readdirSync(contentDir, { withFileTypes: true }).filter(d => d.isDirectory());

      for (const slugDir of slugDirs) {
        const slug = slugDir.name;
        const slugPath = path.join(contentDir, slug);
        try {
          const files = fs.readdirSync(slugPath).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));

          const localeFiles = files
            .map(f => f.replace(/\.(yml|yaml)$/, ""))
            .filter(n => /^[a-z]{2}(-[a-z]{2})?$/.test(n));

          if (localeFiles.length === 0) continue;

          let commonData: Record<string, unknown> = {};
          const commonPath = path.join(slugPath, "_common.yml");
          if (fs.existsSync(commonPath)) {
            try {
              commonData = contentIndex.safeYamlLoad(fs.readFileSync(commonPath, "utf-8")) || {};
            } catch { /* ignore broken _common.yml */ }
          }

          for (const locale of localeFiles) {
            if (localeFilter && locale !== localeFilter) continue;
            const localePath = path.join(slugPath, `${locale}.yml`);
            if (!fs.existsSync(localePath)) continue;

            try {
              const localeData = contentIndex.safeYamlLoad(fs.readFileSync(localePath, "utf-8")) || {};
              const merged = deepMerge(commonData, localeData) as Record<string, unknown>;

              const rawMeta = (merged.meta as Record<string, unknown>) ?? {};
              const { data: resolvedMeta } = variableManager.resolveDeep(rawMeta, { locale });

              let url: string | null = null;
              if (urlPattern) {
                const tpl = urlPattern[locale] || urlPattern["default"] || null;
                if (tpl) url = tpl.replace(":slug", slug);
              }

              entries.push({
                slug,
                contentType: type,
                locale,
                url,
                title: typeof merged.title === "string" ? merged.title : null,
                meta: resolvedMeta,
                schema: (merged.schema as Record<string, unknown>) ?? null,
              });
            } catch (fileErr) {
              entries.push({ slug, contentType: type, locale, url: null, title: null, meta: {}, schema: null, parse_error: String(fileErr) });
            }
          }
        } catch (slugErr) {
          entries.push({ slug, contentType: type, locale: null, url: null, title: null, meta: {}, schema: null, parse_error: String(slugErr) });
        }
      }

      res.json({ contentType: type, source: "yaml", cache_age_hours: null, count: entries.length, entries });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/content-types/:type/clear-cache", async (req, res) => {
    try {
      const { type } = req.params;
      const config = getContentTypeConfig(type);
      if (!config?.database?.slug) {
        res
          .status(400)
          .json({ error: `Content type "${type}" has no database configured` });
        return;
      }
      const dbName = config.database.slug;
      if (databaseManager.exists(dbName)) {
        await databaseManager.fetchItems(dbName, true);
      }
      clearMarkdownCache();
      res.json({
        success: true,
        message: `Cache cleared for "${type}" (database: ${dbName})`,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/content-types/:type/cache/:slug", async (req, res) => {
    try {
      const { type, slug } = req.params;
      const config = getContentTypeConfig(type);
      if (!config?.database?.slug) {
        res
          .status(400)
          .json({ error: `Content type "${type}" has no database configured` });
        return;
      }
      clearMarkdownCache(slug);
      res.json({ success: true, message: `Cache cleared for "${slug}"` });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/content-types/:type/db-overrides/:slug", (req, res) => {
    try {
      const { type, slug } = req.params;
      const config = getContentTypeConfig(type);
      if (!config?.database?.slug) {
        res.status(400).json({ error: `Content type "${type}" has no database configured` });
        return;
      }
      const dbName = config.database.slug;
      if (!databaseManager.exists(dbName)) {
        res.status(404).json({ error: `Database "${dbName}" not found` });
        return;
      }
      const rawOverrides = databaseManager.getDbOverridesForEntry(dbName, slug);
      if (!rawOverrides) {
        res.json({ overrides: {}, originals: {} });
        return;
      }
      // Build a reverse map: dbPath -> templateKey using the field mapping
      const fm = getFieldMapping(type);
      const reverseMap: Record<string, string> = {};
      if (fm) {
        for (const [templateKey, dbPath] of Object.entries(fm)) {
          if (typeof dbPath === "string" && !dbPath.startsWith("function:") && !templateKey.startsWith("_")) {
            reverseMap[dbPath] = templateKey;
          }
        }
      }
      // Return overrides keyed by template key (falling back to DB key if no reverse mapping)
      const overrides: Record<string, unknown> = {};
      for (const [dbKey, value] of Object.entries(rawOverrides)) {
        const templateKey = reverseMap[dbKey] ?? dbKey;
        overrides[templateKey] = value;
      }
      // Return originals: the raw (pre-override) field values for each overridden key.
      // The fm (content-types registry field mapping) maps templateKey → dbConfigFieldName,
      // which is the key that exists in the DB-config-mapped item from getOriginalMappedItem.
      const lookupKey = getLookupKey(type) || "slug";
      const originalItem = databaseManager.getOriginalMappedItem(dbName, slug, lookupKey);
      const originals: Record<string, unknown> = {};
      if (originalItem) {
        for (const templateKey of Object.keys(overrides)) {
          // fm[templateKey] gives the DB config field name (e.g. "preview_image" for "image")
          const dbConfigField = fm?.[templateKey] ?? templateKey;
          const raw = originalItem[dbConfigField] ?? originalItem[templateKey];
          if (raw !== undefined && raw !== null) originals[templateKey] = raw;
        }
      }
      res.json({ overrides, originals });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/db-overrides", async (_req, res) => {
    try {
      const allConfigs = getAllConfigs();
      const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|svg|avif|tiff?|bmp|ico)(\?[^)]*)?$/i;
      const result: Array<{ contentType: string; dbName: string; slug: string; fields: Record<string, unknown> }> = [];
      for (const [contentType, config] of Object.entries(allConfigs)) {
        const dbName = config.database?.slug;
        if (!dbName) continue;
        const overrides = databaseManager.listOverrides(dbName);
        for (const { slug, fields } of overrides) {
          const imageFields: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(fields)) {
            if (typeof value === "string" && IMAGE_EXT_RE.test(value)) {
              imageFields[key] = value;
            }
          }
          if (Object.keys(imageFields).length > 0) {
            result.push({ contentType, dbName, slug, fields: imageFields });
          }
        }
      }
      res.json({ overrides: result });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/content-types/:type/db-overrides/:slug", async (req, res) => {
    try {
      const { type, slug } = req.params;
      const rawFieldKey = req.query.field as string | undefined;
      const config = getContentTypeConfig(type);
      if (!config?.database?.slug) {
        res.status(400).json({ error: `Content type "${type}" has no database configured` });
        return;
      }
      const dbName = config.database.slug;
      if (!databaseManager.exists(dbName)) {
        res.status(404).json({ error: `Database "${dbName}" not found` });
        return;
      }
      let fieldKey = rawFieldKey;
      if (rawFieldKey) {
        const fm = getFieldMapping(type);
        const mappedPath = fm ? fm[rawFieldKey] : undefined;
        if (mappedPath && typeof mappedPath === "string" && !mappedPath.startsWith("function:")) {
          fieldKey = mappedPath;
        }
      }
      const cleared = databaseManager.clearDbOverride(dbName, slug, fieldKey);
      res.json({
        success: true,
        cleared,
        message: cleared
          ? rawFieldKey
            ? `Override for field "${rawFieldKey}" on "${slug}" cleared`
            : `All overrides for "${slug}" cleared`
          : `No override found for "${slug}"${rawFieldKey ? ` field "${rawFieldKey}"` : ""}`,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/content-types/:type/entries/:slug/migrate-legacy", async (req, res) => {
    try {
      const { type, slug } = req.params;
      const config = getContentTypeConfig(type);
      if (!config) {
        res.status(400).json({ error: `Unknown content type "${type}"` });
        return;
      }
      const dir = path.join(process.cwd(), "marketing-content", config.directory, slug);
      const promotedPath = path.join(dir, "promoted.yml");
      if (!fs.existsSync(promotedPath)) {
        res.status(400).json({ error: "Not a legacy entry — promoted.yml not found" });
        return;
      }
      const commonPath = path.join(dir, "_common.yml");
      let locale = "en";
      if (fs.existsSync(commonPath)) {
        const commonData = safeYamlLoad(fs.readFileSync(commonPath, "utf-8")) as Record<string, unknown> | null;
        if (commonData?.locale && typeof commonData.locale === "string") {
          locale = commonData.locale.trim().replace(/^["']|["']$/g, "");
        }
      }
      const destPath = path.join(dir, `${locale}.yml`);
      if (fs.existsSync(destPath)) {
        res.status(409).json({ error: `Already migrated — ${locale}.yml already exists` });
        return;
      }
      fs.renameSync(promotedPath, destPath);
      contentIndex.refresh();
      clearSitemapCache();
      invalidateContentCaches(type);
      res.json({ success: true, locale, newFile: `${locale}.yml` });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/content-types/:type/ai/analyze-fields", async (req, res) => {
    try {
      const { sample_posts } = req.body || {};
      if (
        !sample_posts ||
        !Array.isArray(sample_posts) ||
        sample_posts.length === 0
      ) {
        res.status(400).json({ error: "sample_posts array is required" });
        return;
      }

      const { getLLMService } = await import("./ai/LLMService");
      const llm = getLLMService();

      const samples = sample_posts.slice(0, 3);
      const truncated = JSON.stringify(samples, null, 2).slice(0, 8000);
      const contentTypeName = req.params.type;

      const systemPrompt = `You are a data analyst. Given sample data objects from an API, identify which fields map to standard content properties. Only map fields that actually exist in the data.

Respond with valid JSON only, no markdown.`;

      const userPrompt = `Analyze these sample "${contentTypeName}" objects and map their fields to standard properties:

${truncated}

Return JSON with this exact structure:
{
  "field_mapping": {
    "title": "<source field name or dot.path>",
    "slug": "<source field name or dot.path>",
    "description": "<source field name or dot.path or null>",
    "image": "<source field name or dot.path or null>",
    "author": "<source field name or dot.path or null>",
    "published_at": "<source field name or dot.path or null>",
    "updated_at": "<source field name or dot.path or null>",
    "status": "<source field name or dot.path or null>",
    "category": "<source field name or dot.path or null>",
    "tags": "<source field name or dot.path or null>",
    "lang": "<source field name or dot.path or null>",
    "content": "<source field name or dot.path to body/markdown/html content or null>",
    "content_url": "<source field name or dot.path to markdown/content URL or null>"
  },
  "available_fields": ["<all top-level and notable nested fields found>"],
  "notes": "<any observations about the data structure>"
}

Important: Only include mappings where you are confident the field exists. Use dot notation for nested fields (e.g. "author.name", "category.slug").`;

      const result = await llm.complete(userPrompt, {
        systemPrompt,
        temperature: 0.1,
        maxTokens: 1500,
      });

      let parsed;
      try {
        const cleaned = result
          .replace(/```json?\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { raw: result, error: "Failed to parse AI response" };
      }

      res.json(parsed);
    } catch (err) {
      console.error("AI analyze-fields error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // ── End Generic Content Type API Routes ──

  app.post("/api/blog/ai/analyze-response", async (req, res) => {
    try {
      const { sample_payload } = req.body || {};
      if (!sample_payload) {
        res.status(400).json({ error: "sample_payload is required" });
        return;
      }

      const { getLLMService } = await import("./ai/LLMService");
      const llm = getLLMService();

      const truncated = JSON.stringify(sample_payload).slice(0, 8000);

      const systemPrompt = `You are an API response analyst. Given a JSON API response, determine:
1. The dot-notation path to the array of items (posts/articles). If the response IS a direct array, use empty string "".
2. Whether pagination is present, and if so what type (offset-based, cursor-based, page-based, or none).
3. The pagination metadata fields and how to use them.

Respond with valid JSON only, no markdown.`;

      const userPrompt = `Analyze this API response and determine the data extraction path and pagination strategy:

${truncated}

Return JSON with this exact structure:
{
  "results_path": "<dot.path to array or empty string if direct array>",
  "array_length": <number of items found>,
  "pagination": {
    "type": "none" | "offset" | "cursor" | "page",
    "has_more_field": "<field name or null>",
    "total_field": "<field name indicating total count or null>",
    "next_field": "<field with next page URL or cursor or null>",
    "strategy_description": "<human-readable description of how to paginate>"
  },
  "sample_item_keys": ["<list of top-level keys from first item>"]
}`;

      const result = await llm.complete(userPrompt, {
        systemPrompt,
        temperature: 0.1,
        maxTokens: 1000,
      });

      let parsed;
      try {
        const cleaned = result
          .replace(/```json?\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { raw: result, error: "Failed to parse AI response" };
      }

      res.json(parsed);
    } catch (err) {
      console.error("AI analyze-response error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/blog/ai/analyze-fields", async (req, res) => {
    try {
      const { sample_posts } = req.body || {};
      if (
        !sample_posts ||
        !Array.isArray(sample_posts) ||
        sample_posts.length === 0
      ) {
        res.status(400).json({ error: "sample_posts array is required" });
        return;
      }

      const { getLLMService } = await import("./ai/LLMService");
      const llm = getLLMService();

      const samples = sample_posts.slice(0, 3);
      const truncated = JSON.stringify(samples, null, 2).slice(0, 8000);

      const systemPrompt = `You are a blog post data analyst. Given sample blog post objects from an API, identify which fields map to standard blog post properties. Only map fields that actually exist in the data.

Respond with valid JSON only, no markdown.`;

      const userPrompt = `Analyze these sample blog post objects and map their fields to standard properties:

${truncated}

Return JSON with this exact structure:
{
  "field_mapping": {
    "title": "<source field name or dot.path>",
    "slug": "<source field name or dot.path>",
    "description": "<source field name or dot.path or null>",
    "image": "<source field name or dot.path or null>",
    "author": "<source field name or dot.path or null>",
    "published_at": "<source field name or dot.path or null>",
    "updated_at": "<source field name or dot.path or null>",
    "status": "<source field name or dot.path or null>",
    "category": "<source field name or dot.path or null>",
    "tags": "<source field name or dot.path or null>",
    "lang": "<source field name or dot.path or null>",
    "content": "<source field name or dot.path to body/markdown/html content or null>",
    "content_url": "<source field name or dot.path to markdown/content URL or null>"
  },
  "available_fields": ["<all top-level and notable nested fields found>"],
  "notes": "<any observations about the data structure>"
}

Important: Only include mappings where you are confident the field exists. Use dot notation for nested fields (e.g. "author.name", "category.slug").`;

      const result = await llm.complete(userPrompt, {
        systemPrompt,
        temperature: 0.1,
        maxTokens: 1500,
      });

      let parsed;
      try {
        const cleaned = result
          .replace(/```json?\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { raw: result, error: "Failed to parse AI response" };
      }

      res.json(parsed);
    } catch (err) {
      console.error("AI analyze-fields error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/blog/llm-config", async (_req, res) => {
    try {
      const { getLLMConfig } = await import("./ai/LLMService");
      const config = getLLMConfig();
      res.json({
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        provider: {
          api_key_env: config.provider?.api_key_env || "",
          base_url_env: config.provider?.base_url_env || "",
        },
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.put("/api/blog/llm-config", async (req, res) => {
    try {
      const body = req.body;
      if (!body) {
        res.status(400).json({ error: "Body is required" });
        return;
      }

      const configPath = path.resolve("marketing-content/llm.yml");
      const newConfig: Record<string, unknown> = {
        provider: {
          api_key_env:
            body.provider?.api_key_env || "AI_INTEGRATIONS_OPENAI_API_KEY",
          base_url_env:
            body.provider?.base_url_env || "AI_INTEGRATIONS_OPENAI_BASE_URL",
        },
        model: body.model || "gpt-4o-mini",
        temperature: body.temperature ?? 0.3,
        max_tokens: body.max_tokens || 4000,
      };

      const yamlStr = yaml.dump(newConfig, { lineWidth: -1 });
      fs.writeFileSync(configPath, yamlStr, "utf-8");

      const { reloadLLMConfig } = await import("./ai/LLMService");
      reloadLLMConfig();

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Database routes ──────────────────────────────────────────
  app.get("/api/databases", (_req, res) => {
    try {
      const databases = databaseManager.list();
      const cacheStats = databaseManager.getCacheStats();
      res.json(
        databases.map((db) => ({
          name: db.name,
          label: db.config.name,
          description: db.config.description || null,
          source_type: db.config.source.type,
          field_count: databaseManager.getFieldCount(db.name),
          cache_item_count: cacheStats.perDb[db.name]?.item_count ?? null,
          cache_fetched_at: cacheStats.perDb[db.name]?.fetched_at ?? null,
          cache_file_size_bytes: cacheStats.totalFileSizeBytes,
        })),
      );
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/databases", (req, res) => {
    try {
      const { slug, config } = req.body;
      if (!slug || !config || !config.name || !config.source) {
        res
          .status(400)
          .json({ error: "slug, config.name, and config.source are required" });
        return;
      }
      databaseManager.create(slug, config);
      res.json({ success: true, name: slug, config });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already exists")) {
        res.status(409).json({ error: msg });
      } else {
        res.status(400).json({ error: msg });
      }
    }
  });

  app.get("/api/databases/:name", (req, res) => {
    try {
      const config = databaseManager.get(req.params.name);
      const cacheInfo = databaseManager.getCacheInfo(req.params.name);
      res.json({
        name: req.params.name,
        config,
        cache_status: cacheInfo,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) {
        res.status(404).json({ error: msg });
      } else {
        res.status(500).json({ error: msg });
      }
    }
  });

  app.get("/api/databases/:name/raw-fields", (req, res) => {
    try {
      const fields = databaseManager.getRawFields(req.params.name);
      res.json({ fields });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) {
        res.status(404).json({ error: msg });
      } else {
        res.status(500).json({ error: msg });
      }
    }
  });

  app.get("/api/databases/:name/raw-sample", (req, res) => {
    try {
      const rawItems = databaseManager.getRawItems(req.params.name);
      if (!rawItems || rawItems.length === 0) {
        res.json({ items: [], count: 0 });
        return;
      }
      const limit = Math.min(Number(req.query.limit) || 3, 10);
      res.json({ items: rawItems.slice(0, limit), count: rawItems.length });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) {
        res.status(404).json({ error: msg });
      } else {
        res.status(500).json({ error: msg });
      }
    }
  });

  app.get("/api/databases/:name/raw-items", (req, res) => {
    try {
      const rawItems = databaseManager.getRawItems(req.params.name);
      res.json({ items: rawItems || [], item_count: rawItems?.length ?? 0 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) {
        res.status(404).json({ error: msg });
      } else {
        res.status(500).json({ error: msg });
      }
    }
  });

  app.post("/api/databases/:name/analyze-fields", async (req, res) => {
    try {
      const dbName = req.params.name;
      const rawItems = databaseManager.getRawItems(dbName);
      if (!rawItems || rawItems.length === 0) {
        res
          .status(400)
          .json({ error: "No cached data available. Fetch data first." });
        return;
      }

      const sample = rawItems.slice(0, 3);
      const sampleKeys = Object.keys(sample[0] || {}).slice(0, 50);

      const prompt = `You are analyzing raw API response data to suggest a field mapping that normalizes it into clean database fields.

Here are ${sample.length} sample items from the API (showing up to 50 top-level keys):
${JSON.stringify(
  sample.map((item) => {
    const filtered: Record<string, unknown> = {};
    for (const k of sampleKeys) {
      const val = item[k];
      if (val !== null && val !== undefined && val !== "") {
        filtered[k] =
          typeof val === "object" ? JSON.stringify(val).slice(0, 100) : val;
      }
    }
    return filtered;
  }),
  null,
  2,
)}

Suggest a field_mapping that maps the most useful raw fields to clean, normalized keys.
Focus on fields that are commonly needed: id, slug, title, description, status, language/locale, dates, author info, categories, tags, images, URLs.
Skip fields that are internal IDs, computed values, or rarely useful.

Return JSON with this exact structure:
{
  "field_mapping": {
    "normalized_key": "source.field.path",
    ...
  },
  "notes": "Brief explanation of the mapping choices"
}

Values should be dot-notation paths into the raw data (e.g., "author.name" for { author: { name: "..." } }).
Do NOT prefix values with "raw." or "db." — just use the plain field path.
Keep normalized keys lowercase with underscores. Aim for 10-25 of the most useful fields.`;

      const { getLLMService } = await import("./ai/LLMService");
      const llm = getLLMService();

      const systemPrompt =
        "You are a data analyst that suggests field mappings for normalizing raw API data. Respond with valid JSON only, no markdown.";
      const result = await llm.complete(prompt, {
        systemPrompt,
        temperature: 0.2,
        maxTokens: 2000,
      });
      let parsed: Record<string, unknown>;
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        parsed = jsonMatch
          ? JSON.parse(jsonMatch[0])
          : { raw: result, error: "No JSON found" };
      } catch {
        parsed = { raw: result, error: "Failed to parse AI response" };
      }

      if (parsed.field_mapping && typeof parsed.field_mapping === "object") {
        const cleaned: Record<string, string> = {};
        for (const [key, val] of Object.entries(
          parsed.field_mapping as Record<string, string>,
        )) {
          const strVal = String(val);
          cleaned[key] = strVal.startsWith("raw.")
            ? strVal.slice(4)
            : strVal.startsWith("db.")
              ? strVal.slice(3)
              : strVal;
        }
        parsed.field_mapping = cleaned;
      }

      res.json(parsed);
    } catch (err) {
      console.error("AI analyze-fields (database) error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/databases/:name/items", async (req, res) => {
    try {
      const result = await databaseManager.fetchItems(req.params.name);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) {
        res.status(404).json({ error: msg });
      } else {
        res.status(500).json({ error: msg });
      }
    }
  });

  app.put("/api/databases/:name/items", async (req, res) => {
    try {
      const dbName = req.params.name;
      const config = databaseManager.get(dbName);

      if (config.source.type !== "local") {
        res.status(400).json({ error: "Only local databases support item editing" });
        return;
      }

      const { items } = req.body;
      if (!Array.isArray(items)) {
        res.status(400).json({ error: "items must be an array" });
        return;
      }

      const localConfig = config.source.local!;
      const filename = localConfig.filename;
      const resultsPath = localConfig.results_path;

      const filePath = path.join(process.cwd(), "marketing-content", "db", dbName, filename);
      if (!fs.existsSync(path.dirname(filePath))) {
        res.status(404).json({ error: `Database directory not found` });
        return;
      }

      const data: unknown = resultsPath ? { [resultsPath]: items } : items;
      const yamlStr = safeYamlDump(data, { lineWidth: 120 });
      fs.writeFileSync(filePath, yamlStr);

      databaseManager.clearCache(dbName);

      const relPath = `marketing-content/db/${dbName}/${filename}`;
      markFileAsModified(relPath, "api");

      res.json({ success: true, count: items.length });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) {
        res.status(404).json({ error: msg });
      } else {
        res.status(500).json({ error: msg });
      }
    }
  });

  app.post("/api/databases/:name/refresh", async (req, res) => {
    try {
      const result = await databaseManager.fetchItems(req.params.name, true);
      res.json(result);
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put("/api/databases/:name/config", (req, res) => {
    try {
      const config = req.body;
      if (!config || !config.name || !config.source) {
        res
          .status(400)
          .json({ error: "Invalid config: name and source are required" });
        return;
      }
      databaseManager.update(req.params.name, config);
      res.json({ success: true });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete("/api/databases/:name", (req, res) => {
    try {
      databaseManager.delete(req.params.name);
      res.json({ success: true });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/databases/:name/test", async (req, res) => {
    try {
      const source = req.body?.source;
      if (!source) {
        res.status(400).json({ error: "source config required in body" });
        return;
      }
      const dbSlug = req.params.name === "_test" ? req.body?.slug : req.params.name;
      const result = await databaseManager.test(source, dbSlug);
      res.json(result);
    } catch (err: unknown) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── Dataset file management routes ───────────────────────────

  const DATASET_EXTENSIONS_SET = new Set([".json", ".csv", ".yaml", ".yml"]);

  app.get("/api/databases/check-file", (req, res) => {
    const slug = (req.query.slug as string) || "";
    const filename = (req.query.filename as string) || "";
    if (!slug || !filename) {
      res.status(400).json({ error: "slug and filename are required" });
      return;
    }
    const filePath = path.join(process.cwd(), "marketing-content", "db", slug, filename);
    res.json({ exists: fs.existsSync(filePath), path: `marketing-content/db/${slug}/${filename}` });
  });

  app.get("/api/databases/datasets", async (req, res) => {
    try {
      const results: {
        id: string;
        filename: string;
        dbSlug: string;
        provider: "local";
        path: string;
      }[] = [];

      if (fs.existsSync(path.join(process.cwd(), "marketing-content", "db"))) {
        const dbDir = path.join(process.cwd(), "marketing-content", "db");
        const slugDirs = fs.readdirSync(dbDir).filter((f) => {
          return fs.statSync(path.join(dbDir, f)).isDirectory();
        });
        for (const slug of slugDirs) {
          const slugDir = path.join(dbDir, slug);
          const files = fs.readdirSync(slugDir).filter((f) => {
            const ext = path.extname(f).toLowerCase();
            return DATASET_EXTENSIONS_SET.has(ext) && f !== "config.yml";
          });
          for (const file of files) {
            results.push({
              id: `${slug}/${file}`,
              filename: file,
              dbSlug: slug,
              provider: "local",
              path: `marketing-content/db/${slug}/${file}`,
            });
          }
        }
      }

      res.json({ datasets: results });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  const datasetUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (DATASET_EXTENSIONS_SET.has(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${ext}. Allowed: .json, .csv, .yaml, .yml`));
      }
    },
  });

  app.post(
    "/api/databases/upload-dataset",
    datasetUpload.single("file"),
    async (req, res) => {
      try {
        const file = (req as any).file;
        if (!file) {
          res.status(400).json({ error: "No file provided" });
          return;
        }
        const slug = (req.body?.slug as string) || "";
        if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
          res.status(400).json({ error: "A valid database slug is required" });
          return;
        }
        const ext = path.extname(file.originalname).toLowerCase();
        if (!DATASET_EXTENSIONS_SET.has(ext)) {
          res.status(400).json({ error: `Unsupported file type: ${ext}` });
          return;
        }

        const targetDir = path.join(process.cwd(), "marketing-content", "db", slug);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const filename = file.originalname;
        const targetPath = path.join(targetDir, filename);
        fs.writeFileSync(targetPath, file.buffer);

        res.json({
          provider: "local",
          filename,
          slug,
          path: `marketing-content/db/${slug}/${filename}`,
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message || "Upload failed" });
      }
    }
  );

  // Clear sitemap cache (requires token validation)
  app.post("/api/debug/clear-sitemap-cache", async (req, res) => {
    try {
      const auth = await requireCapability(req, res, "content_publish");
      if (!auth.authorized) return;

      const result = clearSitemapCache();
      res.json(result);
    } catch (error) {
      console.error("Error clearing sitemap cache:", error);
      res.status(500).json({ error: "Failed to clear cache" });
    }
  });

  // Clear page-level cache for a specific URL
  app.post("/api/debug/clear-page-cache", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Token ", "");
      const isDevelopment = process.env.NODE_ENV !== "production";

      if (!isDevelopment && !token) {
        res.status(401).json({ error: "Authorization required" });
        return;
      }

      if (!isDevelopment && token) {
        const response = await fetch(
          `${BREATHECODE_HOST}/v1/auth/user/me/capability/webmaster`,
          {
            method: "GET",
            headers: {
              Authorization: `Token ${token}`,
              Academy: "4",
            },
          },
        );
        if (response.status !== 200) {
          res.status(403).json({ error: "Invalid or unauthorized token" });
          return;
        }
      }

      const { url } = req.body as { url?: string };
      if (!url) {
        res.status(400).json({ error: "Missing 'url' in request body" });
        return;
      }

      let urlPath: string;
      try {
        urlPath = new URL(url).pathname;
      } catch {
        urlPath = url;
      }

      // Use content index URL parsing for reliable type+slug resolution
      let resolved = contentIndex.parseContentUrl(urlPath);

      // Fall back to home page for root/locale-only paths like /, /en, /es
      if (!resolved) {
        const LOCALE_ONLY = new Set(["/", "/en", "/es", "/en/", "/es/"]);
        const isLocaleOnly = LOCALE_ONLY.has(urlPath) || /^\/[a-z]{2}\/?$/.test(urlPath);
        if (isLocaleOnly) {
          const homePage = getHomePage();
          if (homePage?.type && homePage?.slug) {
            resolved = { contentType: homePage.type, slug: homePage.slug, locale: "en" };
          }
        }
      }

      if (resolved) {
        invalidateContentCaches(resolved.contentType);
        if (resolved.slug) {
          clearMarkdownCache(resolved.slug);
        }
      }

      res.json({ success: true, message: `Cache refreshed for ${urlPath}` });
    } catch (error) {
      console.error("Error clearing page cache:", error);
      res.status(500).json({ error: "Failed to clear page cache" });
    }
  });

  // Get active redirects (for debug tools)
  app.get("/api/debug/redirects", (req, res) => {
    const redirects = getRedirects();
    res.json({
      count: redirects.length,
      redirects,
    });
  });

  app.get("/api/locale-urls", (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        res.status(400).json({ error: "Missing 'url' query parameter" });
        return;
      }

      const parsed = contentIndex.parseContentUrl(url);
      if (!parsed) {
        res
          .status(400)
          .json({ error: "Could not determine content type from URL" });
        return;
      }

      const baseSlug = contentIndex.resolveBaseSlug(
        parsed.slug,
        parsed.contentType,
      );
      const urls = contentIndex.getLocaleUrls(baseSlug, parsed.contentType);
      res.json({ urls, contentType: parsed.contentType, slug: baseSlug });
    } catch (err) {
      console.error("[API] Failed to resolve locale URLs:", err);
      res.status(500).json({ error: "Failed to resolve locale URLs" });
    }
  });

  app.get("/api/debug/redirects/locale-urls", (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        res.status(400).json({ error: "Missing 'url' query parameter" });
        return;
      }

      const parsed = contentIndex.parseContentUrl(url);
      if (!parsed) {
        res
          .status(400)
          .json({ error: "Could not determine content type from URL" });
        return;
      }

      const baseSlug = contentIndex.resolveBaseSlug(
        parsed.slug,
        parsed.contentType,
      );
      const urls = contentIndex.getLocaleUrls(baseSlug, parsed.contentType);
      res.json({ urls, contentType: parsed.contentType, slug: baseSlug });
    } catch (err) {
      console.error("[Debug] Failed to resolve locale URLs:", err);
      res.status(500).json({ error: "Failed to resolve locale URLs" });
    }
  });

  // Add a new redirect (for debug tools)
  app.post("/api/debug/redirects", (req, res) => {
    try {
      const {
        from,
        to,
        allLanguages,
        status: redirectStatus,
        isCustomDestination,
        priority: redirectPriority,
        author,
      } = req.body;
      const authorName = author && typeof author === "string" ? author : undefined;
      const statusCode =
        redirectStatus && [301, 302].includes(redirectStatus)
          ? redirectStatus
          : 301;
      const priority = redirectPriority === "fallback" ? "fallback" : "before";

      if (!from || !to) {
        res
          .status(400)
          .json({ error: "Both 'from' and 'to' fields are required" });
        return;
      }

      let normalizedFrom = (from as string).startsWith("/")
        ? (from as string)
        : `/${from}`;
      normalizedFrom = normalizedFrom.toLowerCase();
      if (normalizedFrom.length > 1 && normalizedFrom.endsWith("/")) {
        normalizedFrom = normalizedFrom.slice(0, -1);
      }

      const destUrl = to as string;

      if (isCustomDestination) {
        const customFilePath = path.join(
          process.cwd(),
          "marketing-content",
          "custom-redirects.yml",
        );

        let parsed: {
          redirects: Array<{
            from: string;
            to: string;
            status?: number;
            priority?: string;
          }>;
        } = { redirects: [] };
        if (fs.existsSync(customFilePath)) {
          const raw = fs.readFileSync(customFilePath, "utf-8");
          const loaded = safeYamlLoad(raw) as { redirects?: unknown[] } | null;
          if (loaded && Array.isArray(loaded.redirects)) {
            parsed.redirects = loaded.redirects as Array<{
              from: string;
              to: string;
              status?: number;
              priority?: string;
            }>;
          }
        }

        if (
          parsed.redirects.some((r) => r.from?.toLowerCase() === normalizedFrom)
        ) {
          res.status(409).json({
            error: `Redirect "${normalizedFrom}" already exists in custom-redirects.yml`,
          });
          return;
        }

        const newEntry: {
          from: string;
          to: string;
          status?: number;
          priority?: string;
        } = { from: normalizedFrom, to: destUrl };
        if (statusCode !== 301) {
          newEntry.status = statusCode;
        }
        if (priority === "fallback") {
          newEntry.priority = "fallback";
        }
        parsed.redirects.push(newEntry);

        const yamlContent = safeYamlDump(parsed, {
          lineWidth: -1,
          noRefs: true,
        });
        fs.writeFileSync(customFilePath, yamlContent, "utf-8");
        markFileAsModified(customFilePath, authorName);

        contentIndex.scan();
        clearRedirectCache();

        res.json({
          success: true,
          message: `Custom redirect added: ${normalizedFrom} -> ${destUrl}`,
          file: "marketing-content/custom-redirects.yml",
        });
        return;
      }

      // Parse destination URL to find the content entry
      const parsed = contentIndex.parseContentUrl(destUrl);
      if (!parsed) {
        res.status(400).json({
          error: "Could not determine content type from destination URL",
        });
        return;
      }

      const { contentType, locale } = parsed;
      const resolvedSlug = contentIndex.resolveBaseSlug(
        parsed.slug,
        contentType,
      );
      const entries = contentIndex.findBySlug(resolvedSlug, { contentType });
      if (entries.length === 0) {
        res.status(404).json({
          error: `No content found for slug "${parsed.slug}" in ${contentType}`,
        });
        return;
      }

      const entry = entries[0];
      const basePath = path.join(process.cwd(), entry.directory);

      let targetFile: string;
      if (allLanguages) {
        targetFile = "_common.yml";
      } else {
        targetFile = `${locale}.yml`;
      }

      const filePath = path.join(basePath, targetFile);

      let yamlData: Record<string, unknown> = {};
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        yamlData = (safeYamlLoad(raw) as Record<string, unknown>) || {};
      }

      if (!yamlData.meta || typeof yamlData.meta !== "object") {
        yamlData.meta = {};
      }
      const meta = yamlData.meta as Record<string, unknown>;
      if (!Array.isArray(meta.redirects)) {
        meta.redirects = [];
      }
      const redirects = meta.redirects as unknown[];

      const existingPath = (r: unknown) => {
        if (typeof r === "string") return r.toLowerCase();
        if (typeof r === "object" && r !== null && "path" in r)
          return (r as { path: string }).path.toLowerCase();
        return "";
      };

      if (redirects.some((r) => existingPath(r) === normalizedFrom)) {
        res.status(409).json({
          error: `Redirect "${normalizedFrom}" already exists in ${targetFile}`,
        });
        return;
      }

      if (statusCode !== 301) {
        redirects.push({ path: normalizedFrom, status: statusCode });
      } else {
        redirects.push(normalizedFrom);
      }

      const yamlContent = safeYamlDump(yamlData, {
        lineWidth: -1,
        noRefs: true,
      });
      fs.writeFileSync(filePath, yamlContent, "utf-8");
      markFileAsModified(filePath, authorName);

      contentIndex.scan();
      clearRedirectCache();

      res.json({
        success: true,
        message: `Redirect added: ${normalizedFrom} -> ${destUrl}`,
        file: `${entry.directory}/${targetFile}`,
      });
    } catch (err) {
      console.error("[Debug] Failed to add redirect:", err);
      res.status(500).json({ error: "Failed to add redirect" });
    }
  });

  // Delete a redirect (for debug tools)
  app.delete("/api/debug/redirects", (req, res) => {
    try {
      const { from, source, author } = req.body;
      const authorName = author && typeof author === "string" ? author : undefined;

      if (!from || !source) {
        res
          .status(400)
          .json({ error: "Both 'from' and 'source' fields are required" });
        return;
      }

      let normalizedFrom = (from as string).startsWith("/")
        ? (from as string)
        : `/${from}`;
      normalizedFrom = normalizedFrom.toLowerCase();
      if (normalizedFrom.length > 1 && normalizedFrom.endsWith("/")) {
        normalizedFrom = normalizedFrom.slice(0, -1);
      }

      const sourceFile = source as string;

      const resolvedSource = path.resolve(process.cwd(), sourceFile);
      const marketingDir = path.resolve(process.cwd(), "marketing-content");
      if (
        !resolvedSource.startsWith(marketingDir + path.sep) &&
        resolvedSource !== marketingDir
      ) {
        res.status(400).json({ error: "Invalid source file path" });
        return;
      }
      if (!sourceFile.endsWith(".yml") && !sourceFile.endsWith(".yaml")) {
        res.status(400).json({ error: "Invalid source file type" });
        return;
      }

      if (sourceFile === "marketing-content/custom-redirects.yml") {
        const customFilePath = path.join(
          process.cwd(),
          "marketing-content",
          "custom-redirects.yml",
        );

        if (!fs.existsSync(customFilePath)) {
          res.status(404).json({ error: "Custom redirects file not found" });
          return;
        }

        const raw = fs.readFileSync(customFilePath, "utf-8");
        const loaded = safeYamlLoad(raw) as {
          redirects?: Array<{ from: string; to: string; status?: number }>;
        } | null;

        if (!loaded || !Array.isArray(loaded.redirects)) {
          res
            .status(404)
            .json({ error: "No redirects found in custom redirects file" });
          return;
        }

        const originalLength = loaded.redirects.length;
        loaded.redirects = loaded.redirects.filter((r) => {
          let rFrom = r.from?.startsWith("/") ? r.from : `/${r.from}`;
          rFrom = rFrom.toLowerCase();
          if (rFrom.length > 1 && rFrom.endsWith("/"))
            rFrom = rFrom.slice(0, -1);
          return rFrom !== normalizedFrom;
        });

        if (loaded.redirects.length === originalLength) {
          res.status(404).json({
            error: `Redirect "${normalizedFrom}" not found in custom-redirects.yml`,
          });
          return;
        }

        const yamlContent = safeYamlDump(loaded, {
          lineWidth: -1,
          noRefs: true,
        });
        fs.writeFileSync(customFilePath, yamlContent, "utf-8");
        markFileAsModified(customFilePath, authorName);

        contentIndex.scan();
        clearRedirectCache();

        res.json({
          success: true,
          message: `Custom redirect "${normalizedFrom}" deleted`,
        });
        return;
      }

      const filePath = path.join(process.cwd(), sourceFile);

      if (!fs.existsSync(filePath)) {
        res
          .status(404)
          .json({ error: `Source file "${sourceFile}" not found` });
        return;
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = (safeYamlLoad(raw) as Record<string, unknown>) || {};

      const meta = parsed.meta as Record<string, unknown> | undefined;
      if (!meta || !Array.isArray(meta.redirects)) {
        res
          .status(404)
          .json({ error: `No redirects found in "${sourceFile}"` });
        return;
      }

      const redirects = meta.redirects as unknown[];
      const originalLength = redirects.length;

      const getRedirectPath = (r: unknown): string => {
        if (typeof r === "string") {
          let p = r.startsWith("/") ? r : `/${r}`;
          p = p.toLowerCase();
          if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
          return p;
        }
        if (typeof r === "object" && r !== null && "path" in r) {
          let p = (r as { path: string }).path;
          p = p.startsWith("/") ? p : `/${p}`;
          p = p.toLowerCase();
          if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
          return p;
        }
        return "";
      };

      meta.redirects = redirects.filter(
        (r) => getRedirectPath(r) !== normalizedFrom,
      );

      if ((meta.redirects as unknown[]).length === originalLength) {
        res.status(404).json({
          error: `Redirect "${normalizedFrom}" not found in "${sourceFile}"`,
        });
        return;
      }

      const yamlContent = safeYamlDump(parsed, { lineWidth: -1, noRefs: true });
      fs.writeFileSync(filePath, yamlContent, "utf-8");
      markFileAsModified(filePath, authorName);

      contentIndex.scan();
      clearRedirectCache();

      res.json({
        success: true,
        message: `Redirect "${normalizedFrom}" deleted from "${sourceFile}"`,
      });
    } catch (err) {
      console.error("[Debug] Failed to delete redirect:", err);
      res.status(500).json({ error: "Failed to delete redirect" });
    }
  });

  app.patch("/api/debug/redirects/reorder", (req, res) => {
    try {
      const { redirects, author } = req.body;
      const authorName = author && typeof author === "string" ? author : undefined;

      if (!Array.isArray(redirects)) {
        res.status(400).json({
          error: "'redirects' must be an array of {from, to, status?} entries",
        });
        return;
      }

      for (const entry of redirects) {
        if (!entry || typeof entry !== "object" || !entry.from || !entry.to) {
          res
            .status(400)
            .json({ error: "Each redirect must have 'from' and 'to' fields" });
          return;
        }
      }

      const customFilePath = path.join(
        process.cwd(),
        "marketing-content",
        "custom-redirects.yml",
      );

      const newEntries = redirects.map(
        (r: {
          from: string;
          to: string;
          status?: number;
          priority?: string;
        }) => {
          const entry: {
            from: string;
            to: string;
            status?: number;
            priority?: string;
          } = { from: r.from, to: r.to };
          if (r.status && r.status !== 301) entry.status = r.status;
          if (r.priority === "fallback") entry.priority = "fallback";
          return entry;
        },
      );

      const yamlContent = safeYamlDump(
        { redirects: newEntries },
        { lineWidth: -1, noRefs: true },
      );
      fs.writeFileSync(customFilePath, yamlContent, "utf-8");
      markFileAsModified(customFilePath, authorName);

      contentIndex.scan();
      clearRedirectCache();

      res.json({
        success: true,
        message: `Custom redirects reordered (${newEntries.length} entries)`,
      });
    } catch (err) {
      console.error("[Debug] Failed to reorder redirects:", err);
      res.status(500).json({ error: "Failed to reorder redirects" });
    }
  });

  app.get("/api/debug/redirects/test", async (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ error: "Missing 'url' query parameter" });
      return;
    }
    const locale = (req.query.locale as string) || getDefaultLocale();
    const result = testRedirect(url, locale);

    if (result.match && result.resolvedTo) {
      const resolved = contentIndex.resolveUrl(result.resolvedTo);
      if (!resolved) {
        result.destinationExists = false;
      } else if (resolved.fromDatabase) {
        try {
          const items = await databaseManager.fetchMappedItems(
            resolved.contentType,
          );
          const exists = items.some(
            (item) => String(item.slug) === resolved.slug,
          );
          result.destinationExists = exists;
        } catch {
          result.destinationExists = false;
        }
      } else {
        result.destinationExists = true;
      }
    }

    res.json(result);
  });

  app.patch("/api/debug/redirects/priority", (req, res) => {
    try {
      const { from, priority, author } = req.body;
      const authorName = author && typeof author === "string" ? author : undefined;

      if (!from || typeof from !== "string") {
        res.status(400).json({ error: "'from' is required" });
        return;
      }

      if (priority !== "before" && priority !== "fallback") {
        res
          .status(400)
          .json({ error: "'priority' must be 'before' or 'fallback'" });
        return;
      }

      const customFilePath = path.join(
        process.cwd(),
        "marketing-content",
        "custom-redirects.yml",
      );

      if (!fs.existsSync(customFilePath)) {
        res.status(404).json({ error: "custom-redirects.yml not found" });
        return;
      }

      const raw = fs.readFileSync(customFilePath, "utf-8");
      const parsed = yaml.load(raw) as { redirects?: any[] } | null;
      const entries = parsed?.redirects || [];

      const entry = entries.find((r: any) => r.from === from);
      if (!entry) {
        res
          .status(404)
          .json({ error: "Redirect not found in custom-redirects.yml" });
        return;
      }

      if (priority === "fallback") {
        entry.priority = "fallback";
      } else {
        delete entry.priority;
      }

      const yamlContent = safeYamlDump(
        { redirects: entries },
        { lineWidth: -1, noRefs: true },
      );
      fs.writeFileSync(customFilePath, yamlContent, "utf-8");
      markFileAsModified(customFilePath, authorName);

      contentIndex.scan();
      clearRedirectCache();

      res.json({
        success: true,
        priority: priority === "fallback" ? "fallback" : "before",
      });
    } catch (err) {
      console.error("[Debug] Failed to update redirect priority:", err);
      res.status(500).json({ error: "Failed to update redirect priority" });
    }
  });

  // Menus API - list all menu files (excludes translation files like .es.yml)
  app.get("/api/menus", (_req, res) => {
    const menusDir = path.join(process.cwd(), "marketing-content", "menus");

    if (!fs.existsSync(menusDir)) {
      res.json({ menus: [] });
      return;
    }

    // Filter for .yml/.yaml files, excluding translation files (e.g., main-navbar.es.yml)
    const translationPattern = /\.[a-z]{2}\.(yml|yaml)$/;
    const files = fs
      .readdirSync(menusDir)
      .filter(
        (f) =>
          (f.endsWith(".yml") || f.endsWith(".yaml")) &&
          !translationPattern.test(f),
      );

    const menus = files.map((file) => {
      const name = file.replace(/\.(yml|yaml)$/, "");
      return { name, file };
    });

    res.json({ menus });
  });

  // Create a new menu file
  app.post("/api/menus", (req, res) => {
    const { name, type } = req.body || {};

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required" });
      return;
    }

    // Validate slug: lowercase letters, numbers, hyphens only
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugPattern.test(name)) {
      res.status(400).json({ error: "name must be a valid slug (lowercase letters, numbers, and hyphens only)" });
      return;
    }

    const resolvedType = type || "navbar";
    if (resolvedType !== "navbar" && resolvedType !== "footer") {
      res.status(400).json({ error: "type must be 'navbar' or 'footer'" });
      return;
    }

    const menusDir = path.join(process.cwd(), "marketing-content", "menus");

    if (!fs.existsSync(menusDir)) {
      fs.mkdirSync(menusDir, { recursive: true });
    }

    const fileName = `${name}.yml`;
    const filePath = path.join(menusDir, fileName);
    const filePathYaml = path.join(menusDir, `${name}.yaml`);

    if (fs.existsSync(filePath) || fs.existsSync(filePathYaml)) {
      res.status(409).json({ error: `A menu named '${name}' already exists` });
      return;
    }

    const scaffold =
      resolvedType === "navbar"
        ? `navbar:\n  items: []\n`
        : `footer:\n  columns: []\n`;

    fs.writeFileSync(filePath, scaffold, "utf8");

    res.status(201).json({ name, file: fileName });
  });

  app.get("/api/menus/:name/usage", (req, res) => {
    try {
      const { name } = req.params;
      const configs = getAllConfigs();
      const defaultContentTypes: { name: string; position: "top" | "bottom" | "both" }[] = [];
      for (const [typeName, config] of Object.entries(configs)) {
        const top = config.layout?.menu?.top === name;
        const bottom = config.layout?.menu?.bottom === name;
        if (top && bottom) {
          defaultContentTypes.push({ name: typeName, position: "both" });
        } else if (top) {
          defaultContentTypes.push({ name: typeName, position: "top" });
        } else if (bottom) {
          defaultContentTypes.push({ name: typeName, position: "bottom" });
        }
      }

      const rawOverrides = contentIndex.getMenuUsageByMenuId(name);
      const overrides = rawOverrides.filter(o => {
        const matchesDefault = defaultContentTypes.some(
          d => d.name === o.contentType && (d.position === "both" || d.position === o.position)
        );
        if (matchesDefault && o.source === "_common.yml") return false;
        return true;
      });

      res.json({ defaultContentTypes, overrides });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/menus/:name", (req, res) => {
    try {
      const { name } = req.params;

      // Validate name is a safe slug — same rule as POST /api/menus
      const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugPattern.test(name)) {
        res.status(400).json({ error: "Invalid menu name" });
        return;
      }

      const menusDir = path.join(process.cwd(), "marketing-content", "menus");

      // Find main file (yml or yaml)
      const mainYml = path.join(menusDir, `${name}.yml`);
      const mainYaml = path.join(menusDir, `${name}.yaml`);
      const mainFile = fs.existsSync(mainYml) ? mainYml : fs.existsSync(mainYaml) ? mainYaml : null;

      if (!mainFile) {
        res.status(404).json({ error: `Menu "${name}" not found` });
        return;
      }

      type LayoutObj = Record<string, unknown> & { menu?: { top?: string | null; bottom?: string | null } };

      const cleanMenuRef = (parsed: Record<string, unknown>, position: "top" | "bottom" | "both"): boolean => {
        const layout = parsed.layout as LayoutObj | undefined;
        if (!layout?.menu) return false;
        let changed = false;
        if ((position === "top" || position === "both") && layout.menu.top === name) {
          delete layout.menu.top;
          changed = true;
        }
        if ((position === "bottom" || position === "both") && layout.menu.bottom === name) {
          delete layout.menu.bottom;
          changed = true;
        }
        if (changed) {
          if (Object.keys(layout.menu).length === 0) delete layout.menu;
          if (Object.keys(layout).length === 0) delete parsed.layout;
        }
        return changed;
      };

      // 1. Clean up layout references in content-types.yml
      const configs = getAllConfigs();
      for (const [typeName, config] of Object.entries(configs)) {
        const top = config.layout?.menu?.top === name;
        const bottom = config.layout?.menu?.bottom === name;
        if (!top && !bottom) continue;

        const currentMenu = config.layout?.menu || {};
        const newMenu: { top?: string | null; bottom?: string | null } = {
          top: top ? null : (currentMenu.top ?? null),
          bottom: bottom ? null : (currentMenu.bottom ?? null),
        };
        updateContentTypeConfig(typeName, { layout: { menu: newMenu } });

        // Also clean any page-level overrides for this content type
        const position: "top" | "bottom" | "both" = top && bottom ? "both" : top ? "top" : "bottom";
        const slugs = contentIndex.listContentSlugs(typeName);
        for (const slug of slugs) {
          const commonPath = contentIndex.getCommonFilePath(typeName, slug);
          if (!fs.existsSync(commonPath)) continue;
          try {
            const raw = fs.readFileSync(commonPath, "utf-8");
            const parsed = yaml.load(raw) as Record<string, unknown> | null;
            if (!parsed) continue;
            if (cleanMenuRef(parsed, position)) {
              fs.writeFileSync(commonPath, yaml.dump(parsed, { lineWidth: 120, noRefs: true }), "utf-8");
            }
          } catch {}
        }
      }

      // 2. Clean page-level overrides not covered by content-type defaults above
      const rawOverrides = contentIndex.getMenuUsageByMenuId(name);
      for (const override of rawOverrides) {
        const commonPath = contentIndex.getCommonFilePath(override.contentType, override.slug);
        if (!fs.existsSync(commonPath)) continue;
        try {
          const raw = fs.readFileSync(commonPath, "utf-8");
          const parsed = yaml.load(raw) as Record<string, unknown> | null;
          if (!parsed) continue;
          if (cleanMenuRef(parsed, override.position)) {
            fs.writeFileSync(commonPath, yaml.dump(parsed, { lineWidth: 120, noRefs: true }), "utf-8");
          }
        } catch {}
      }

      // 3. Delete the main file and any translation variant files
      fs.unlinkSync(mainFile);
      try {
        // Safe: name is already validated as a slug (no special regex chars)
        const translationPattern = new RegExp(`^${name}\\.[a-z]{2}(?:\\.[a-z]{2})?\\.(yml|yaml)$`);
        const dir = fs.readdirSync(menusDir);
        for (const f of dir) {
          if (translationPattern.test(f)) {
            fs.unlinkSync(path.join(menusDir, f));
          }
        }
      } catch {}

      contentIndex.refresh();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.put("/api/content-types/:type/layout", async (req, res) => {
    try {
      const { type } = req.params;
      const auth = await requireCapability(req, res, "content_types_manage");
      if (!auth.authorized) return;
      const config = getContentTypeConfig(type);
      if (!config) {
        res.status(404).json({ error: `Content type "${type}" not found` });
        return;
      }
      const body = req.body;
      if (!body?.menu || typeof body.menu !== "object") {
        res.status(400).json({ error: "Request body must include { menu: { top?: string|null, bottom?: string|null } }" });
        return;
      }

      for (const key of ["top", "bottom"] as const) {
        if (key in body.menu && body.menu[key] !== null && typeof body.menu[key] !== "string") {
          res.status(400).json({ error: `menu.${key} must be a string or null` });
          return;
        }
      }

      const currentLayout = config.layout?.menu || { top: null, bottom: null };
      const newMenu: { top?: string | null; bottom?: string | null } = {};
      if ("top" in body.menu) newMenu.top = body.menu.top;
      else newMenu.top = currentLayout.top;
      if ("bottom" in body.menu) newMenu.bottom = body.menu.bottom;
      else newMenu.bottom = currentLayout.bottom;

      updateContentTypeConfig(type, { layout: { menu: newMenu } });

      const slugs = contentIndex.listContentSlugs(type);
      for (const slug of slugs) {
        const commonPath = contentIndex.getCommonFilePath(type, slug);
        if (!fs.existsSync(commonPath)) continue;
        try {
          const raw = fs.readFileSync(commonPath, "utf-8");
          const parsed = yaml.load(raw) as Record<string, unknown> | null;
          if (!parsed?.layout) continue;
          const layout = parsed.layout as { menu?: { top?: string | null; bottom?: string | null } };
          if (!layout.menu) continue;
          let changed = false;
          if ("top" in body.menu && layout.menu.top !== undefined) {
            delete layout.menu.top;
            changed = true;
          }
          if ("bottom" in body.menu && layout.menu.bottom !== undefined) {
            delete layout.menu.bottom;
            changed = true;
          }
          if (changed) {
            if (Object.keys(layout.menu).length === 0) {
              delete (parsed.layout as any).menu;
            }
            if (Object.keys(parsed.layout as any).length === 0) {
              delete parsed.layout;
            }
            fs.writeFileSync(commonPath, yaml.dump(parsed, { lineWidth: 120, noRefs: true }), "utf-8");
          }
        } catch {}
      }

      contentIndex.refresh();
      invalidateContentCaches(type);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/menus/:name", (req, res) => {
    const { name } = req.params;
    const locale = req.query.locale as string | undefined;
    const menusDir = path.join(process.cwd(), "marketing-content", "menus");

    let filePath: string | null = null;

    if (locale && locale !== getDefaultLocale()) {
      const localizedBase = `${name}.${locale}`;
      const localizedYml = path.join(menusDir, `${localizedBase}.yml`);
      const localizedYaml = path.join(menusDir, `${localizedBase}.yaml`);
      if (fs.existsSync(localizedYml)) filePath = localizedYml;
      else if (fs.existsSync(localizedYaml)) filePath = localizedYaml;
    }

    if (!filePath) {
      const baseYml = path.join(menusDir, `${name}.yml`);
      const baseYaml = path.join(menusDir, `${name}.yaml`);
      if (fs.existsSync(baseYml)) filePath = baseYml;
      else if (fs.existsSync(baseYaml)) filePath = baseYaml;
    }

    if (!filePath) {
      res.status(404).json({ error: "Menu not found" });
      return;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = safeYamlLoad(content);
      const raw = req.query.raw === "true";
      if (raw) {
        res.json({ name, locale: locale || "en", data });
        return;
      }

      const context = {
        locale: locale || "en",
        location: req.query.location as string | undefined,
        region: req.query.region as string | undefined,
      };
      const { data: resolved } = variableManager.resolveDeep(data, context);
      res.json({ name, locale: locale || "en", data: resolved });
    } catch (error) {
      console.error(`Error loading menu ${name}:`, error);
      res.status(500).json({ error: "Failed to parse menu file" });
    }
  });

  // DEPRECATED: Old menu save endpoint - redirect to new separated endpoints
  // Use PUT /api/menus/:name/structure for structural changes (English only, propagates to translations)
  // Use PUT /api/menus/:name/translations?locale=xx for text-only changes
  app.post("/api/menus/:name", (req, res) => {
    res.status(410).json({
      error:
        "This endpoint is deprecated. Use the separated endpoints instead.",
      alternatives: {
        structure:
          "PUT /api/menus/:name/structure - For structural changes (English only, propagates to translations)",
        translations:
          "PUT /api/menus/:name/translations?locale=xx - For text-only changes",
      },
    });
  });

  // Helper function to sync menu structure from English (master) to translation
  function syncMenuStructure(
    master: any,
    translation: any,
    previousMaster?: any,
  ): any {
    if (master?.footer) {
      return syncFooterStructure(master, translation || {}, previousMaster);
    }

    if (!master?.navbar?.items || !translation?.navbar?.items) {
      return translation;
    }

    const masterItems = master.navbar.items;
    const translationItems = translation.navbar.items;
    const syncedItems: any[] = [];

    for (let i = 0; i < masterItems.length; i++) {
      const masterItem = masterItems[i];
      const existingTranslation = translationItems[i];

      if (existingTranslation) {
        const syncedItem = syncMenuItem(masterItem, existingTranslation);
        syncedItems.push(syncedItem);
      } else {
        const newItem = createTranslationPlaceholder(masterItem);
        syncedItems.push(newItem);
      }
    }

    return { navbar: { items: syncedItems } };
  }

  function syncFooterStructure(
    master: any,
    translation: any,
    previousMaster?: any,
  ): any {
    const mf = master.footer;
    const tf = translation.footer || {};
    const pf = previousMaster?.footer || {};
    const result: any = {};

    result.columns = (tf.columns || []).map((transCol: any) => ({
      title: transCol.title,
      items: (transCol.items || []).map((transItem: any) => ({
        label: transItem.label,
        href: transItem.href,
      })),
    }));

    if (mf.columns) {
      const prevColumns = pf.columns || [];
      const prevColTitleToIndex = new Map<string, number>();
      const prevItemsByIndex = new Map<number, Set<string>>();
      for (let i = 0; i < prevColumns.length; i++) {
        prevColTitleToIndex.set(prevColumns[i].title, i);
        prevItemsByIndex.set(
          i,
          new Set((prevColumns[i].items || []).map((it: any) => it.label)),
        );
      }

      for (const masterCol of mf.columns) {
        const prevIndex = prevColTitleToIndex.get(masterCol.title);

        if (prevIndex === undefined) {
          result.columns.push({
            title: `[TRANSLATE] ${masterCol.title}`,
            items: (masterCol.items || []).map((item: any) => ({
              label: `[TRANSLATE] ${item.label}`,
              href: item.href,
            })),
          });
        } else {
          const prevItems = prevItemsByIndex.get(prevIndex) || new Set();
          const newItems = (masterCol.items || []).filter(
            (item: any) => !prevItems.has(item.label),
          );

          if (newItems.length > 0 && result.columns[prevIndex]) {
            for (const newItem of newItems) {
              result.columns[prevIndex].items.push({
                label: `[TRANSLATE] ${newItem.label}`,
                href: newItem.href,
              });
            }
          }
        }
      }
    }

    result.socials = (tf.socials || []).map((transSocial: any) => ({
      name: transSocial.name,
      icon: transSocial.icon,
      link: transSocial.link,
    }));

    if (mf.socials) {
      const prevSocialIcons = new Set(
        (pf.socials || []).map((s: any) => s.icon),
      );
      for (const masterSocial of mf.socials) {
        if (!prevSocialIcons.has(masterSocial.icon)) {
          result.socials.push({
            name: masterSocial.name,
            icon: masterSocial.icon,
            link: masterSocial.link,
          });
        }
      }
    }

    result.legal_links = (tf.legal_links || []).map((transLink: any) => ({
      label: transLink.label,
      href: transLink.href,
    }));

    if (mf.legal_links) {
      const prevLegalLabels = new Set(
        (pf.legal_links || []).map((l: any) => l.label),
      );
      for (const masterLink of mf.legal_links) {
        if (!prevLegalLabels.has(masterLink.label)) {
          result.legal_links.push({
            label: `[TRANSLATE] ${masterLink.label}`,
            href: masterLink.href,
          });
        }
      }
    }

    if (mf.subscribe_text !== undefined) {
      result.subscribe_text =
        tf.subscribe_text || `[TRANSLATE] ${mf.subscribe_text}`;
    }
    if (mf.copyright_text !== undefined) {
      result.copyright_text =
        tf.copyright_text || `[TRANSLATE] ${mf.copyright_text}`;
    }

    return { footer: result };
  }

  function syncMenuItem(master: any, translation: any): any {
    const result: any = {
      // TEXT field - from translation
      label: translation.label || `[TRANSLATE] ${master.label}`,
      // STRUCTURE fields - ALWAYS from master
      href: master.href,
      component: master.component,
    };

    if (master.dropdown) {
      result.dropdown = syncDropdown(
        master.dropdown,
        translation.dropdown || {},
      );
    }

    return result;
  }

  function syncDropdown(master: any, translation: any): any {
    const result: any = {
      type: master.type,
      title: translation.title || `[TRANSLATE] ${master.title}`,
      description:
        translation.description || `[TRANSLATE] ${master.description}`,
    };

    if (master.icon) result.icon = master.icon;

    // Sync items array (for cards and simple-list types)
    if (master.items) {
      result.items = master.items.map((masterItem: any, idx: number) => {
        const transItem = translation.items?.[idx] || {};
        return syncDropdownItem(masterItem, transItem);
      });
    }

    // Sync columns (for columns type)
    if (master.columns) {
      result.columns = master.columns.map((masterCol: any, idx: number) => {
        const transCol = translation.columns?.[idx] || {};
        return {
          title: transCol.title || `[TRANSLATE] ${masterCol.title}`,
          items: masterCol.items.map((masterItem: any, itemIdx: number) => {
            const transItem = transCol.items?.[itemIdx] || {};
            return {
              // TEXT field - from translation
              label: transItem.label || `[TRANSLATE] ${masterItem.label}`,
              // STRUCTURE field - ALWAYS from master
              href: masterItem.href,
            };
          }),
        };
      });
    }

    // Sync groups (for grouped-list type)
    if (master.groups) {
      result.groups = master.groups.map((masterGroup: any, idx: number) => {
        const transGroup = translation.groups?.[idx] || {};
        return {
          // TEXT field - from translation
          title: transGroup.title || `[TRANSLATE] ${masterGroup.title}`,
          items: masterGroup.items.map((masterItem: any, itemIdx: number) => {
            const transItem = transGroup.items?.[itemIdx] || {};
            return {
              // TEXT field - from translation
              label: transItem.label || `[TRANSLATE] ${masterItem.label}`,
              // STRUCTURE field - ALWAYS from master
              href: masterItem.href,
            };
          }),
        };
      });
    }

    // Sync footer
    if (master.footer) {
      result.footer = {
        // TEXT fields - from translation
        text: translation.footer?.text || `[TRANSLATE] ${master.footer.text}`,
        linkText:
          translation.footer?.linkText ||
          `[TRANSLATE] ${master.footer.linkText}`,
        // STRUCTURE field - ALWAYS from master
        href: master.footer.href,
      };
    }

    return result;
  }

  function syncDropdownItem(master: any, translation: any): any {
    const result: any = {};

    // TEXT fields - from translation if provided
    if (master.title !== undefined) {
      result.title = translation.title || `[TRANSLATE] ${master.title}`;
    }
    if (master.label !== undefined) {
      result.label = translation.label || `[TRANSLATE] ${master.label}`;
    }
    if (master.description !== undefined) {
      result.description =
        translation.description || `[TRANSLATE] ${master.description}`;
    }
    if (master.cta !== undefined) {
      result.cta = translation.cta || `[TRANSLATE] ${master.cta}`;
    }
    // STRUCTURE field - ALWAYS from master
    if (master.href !== undefined) {
      result.href = master.href;
    }
    if (master.icon !== undefined) {
      result.icon = master.icon;
    }

    return result;
  }

  function createTranslationPlaceholder(master: any): any {
    const result: any = {
      label: `[TRANSLATE] ${master.label}`,
      href: master.href,
      component: master.component,
    };

    if (master.dropdown) {
      result.dropdown = syncDropdown(master.dropdown, {});
    }

    return result;
  }

  // Structure endpoint - Only for English, propagates to all translation files
  // Used for: reordering items, adding/deleting items, changing icons, changing hrefs
  app.put("/api/menus/:name/structure", (req, res) => {
    const { name } = req.params;
    const { data, author } = req.body;
    const authorName = author && typeof author === "string" ? author : undefined;

    if (!data) {
      res.status(400).json({ error: "Missing data in request body" });
      return;
    }

    const menusDir = path.join(process.cwd(), "marketing-content", "menus");

    // Structure changes can ONLY be made to English (master) file
    let filePath = path.join(menusDir, `${name}.yml`);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(menusDir, `${name}.yaml`);
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(menusDir, `${name}.yml`);
    }

    try {
      let previousData: any = null;
      if (fs.existsSync(filePath)) {
        try {
          const previousContent = fs.readFileSync(filePath, "utf-8");
          previousData = safeYamlLoad(previousContent) as any;
        } catch (e) {}
      }

      const yamlContent = safeYamlDump(data, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
      });
      fs.writeFileSync(filePath, yamlContent, "utf-8");
      markFileAsModified(filePath, authorName);

      const syncResults: Record<string, string> = {};
      const translationLocales = ["es", "fr", "de", "pt", "it"];

      for (const targetLocale of translationLocales) {
        const translationFileName = `${name}.${targetLocale}.yml`;
        const translationFilePath = path.join(menusDir, translationFileName);

        if (fs.existsSync(translationFilePath)) {
          try {
            const translationContent = fs.readFileSync(
              translationFilePath,
              "utf-8",
            );
            const translationData = safeYamlLoad(translationContent) as any;

            const syncedData = syncMenuStructure(
              data,
              translationData,
              previousData,
            );

            const syncedYaml = safeYamlDump(syncedData, {
              indent: 2,
              lineWidth: -1,
              noRefs: true,
              sortKeys: false,
            });
            fs.writeFileSync(translationFilePath, syncedYaml, "utf-8");
            markFileAsModified(translationFilePath, authorName);
            syncResults[targetLocale] = "synced";
          } catch (syncError) {
            console.error(
              `Error syncing structure to ${targetLocale}:`,
              syncError,
            );
            syncResults[targetLocale] = "error";
          }
        }
      }

      res.json({
        success: true,
        name,
        endpoint: "structure",
        syncResults,
        message: "Structure updated in English and synced to all translations",
      });
    } catch (error) {
      console.error(`Error saving menu structure ${name}:`, error);
      res.status(500).json({ error: "Failed to save menu structure" });
    }
  });

  // Translations endpoint - For any locale, only updates text fields
  // Used for: updating title, description, label, cta text
  // CANNOT modify structure (item count, order, icons, hrefs)
  app.put("/api/menus/:name/translations", (req, res) => {
    const { name } = req.params;
    const locale = req.query.locale as string;
    const { data, author } = req.body;
    const authorName = author && typeof author === "string" ? author : undefined;

    if (!data) {
      res.status(400).json({ error: "Missing data in request body" });
      return;
    }

    if (!locale) {
      res.status(400).json({ error: "Locale query parameter is required" });
      return;
    }

    const menusDir = path.join(process.cwd(), "marketing-content", "menus");
    const isDefaultLocale = locale === getDefaultLocale();

    // Build filename based on locale
    const fileBaseName = isDefaultLocale ? name : `${name}.${locale}`;

    let filePath = path.join(menusDir, `${fileBaseName}.yml`);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(menusDir, `${fileBaseName}.yaml`);
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(menusDir, `${fileBaseName}.yml`);
    }

    // Translations endpoint is for text and link changes in ANY locale (including English)
    // For structure changes (icon, add/delete), use the /structure endpoint instead
    const masterFilePath = path.join(menusDir, `${name}.yml`);
    if (!fs.existsSync(masterFilePath)) {
      res.status(400).json({
        error: "English master file not found. Cannot update translations.",
      });
      return;
    }

    let dataToSave = data;

    const isFooterMenu = data?.footer && !data?.navbar;

    if (isFooterMenu && !isDefaultLocale) {
      dataToSave = data;
    } else {
      try {
        const masterContent = fs.readFileSync(masterFilePath, "utf-8");
        const masterData = safeYamlLoad(masterContent) as any;

        dataToSave = mergeTextOnlyFromTranslation(masterData, data);
      } catch (e) {
        console.error("Error syncing translation to master structure:", e);
        res
          .status(500)
          .json({ error: "Failed to sync translation with master structure" });
        return;
      }
    }

    try {
      const yamlContent = safeYamlDump(dataToSave, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
      });
      fs.writeFileSync(filePath, yamlContent, "utf-8");
      markFileAsModified(filePath, authorName);

      res.json({
        success: true,
        name,
        locale,
        endpoint: "translations",
        message: isDefaultLocale
          ? "English text updated"
          : `${locale} translations updated`,
      });
    } catch (error) {
      console.error(`Error saving menu translations ${name}:`, error);
      res.status(500).json({ error: "Failed to save menu translations" });
    }
  });

  // STRICT text-only merge: Deep-clone master, overlay ONLY translatable fields from translation
  // Translatable fields: label, title, description, cta, text, linkText, href
  // ALL other fields preserved from master (including unknown/extra keys)
  const TEXT_FIELDS = new Set([
    "label",
    "title",
    "description",
    "cta",
    "text",
    "linkText",
    "href",
  ]);

  function mergeTextOnlyFromTranslation(master: any, translation: any): any {
    if (!master?.navbar?.items && !master?.footer) {
      throw new Error(
        "Master file is missing navbar.items or footer structure",
      );
    }

    // For footer files, use the footer-aware structure sync which preserves translations
    if (master?.footer && !master?.navbar) {
      return syncFooterStructure(master, translation || {});
    }

    // Deep clone master to preserve ALL structure
    const result = JSON.parse(JSON.stringify(master));

    // Overlay text fields from translation onto the cloned master (starting at root)
    if (translation) {
      overlayTextFieldsOnObject(result, translation);
    }

    // Marquee config is locale-specific — if the translation carries its own
    // navbar.marquee block, use it wholesale instead of the English master's.
    if (translation?.navbar?.marquee !== undefined) {
      if (!result.navbar) result.navbar = {};
      result.navbar.marquee = translation.navbar.marquee;
    }

    return result;
  }

  function overlayTextFieldsOnItems(
    masterItems: any[],
    translationItems: any[],
  ): void {
    for (
      let i = 0;
      i < masterItems.length && i < translationItems.length;
      i++
    ) {
      overlayTextFieldsOnObject(masterItems[i], translationItems[i]);
    }
  }

  function overlayTextFieldsOnObject(master: any, translation: any): void {
    if (
      !master ||
      !translation ||
      typeof master !== "object" ||
      typeof translation !== "object"
    ) {
      return;
    }

    // Overlay text fields from translation onto master
    for (const key of Object.keys(master)) {
      if (TEXT_FIELDS.has(key) && translation[key] !== undefined) {
        // This is a text field - take value from translation
        master[key] = translation[key];
      } else if (
        Array.isArray(master[key]) &&
        Array.isArray(translation[key])
      ) {
        // Recursively process arrays (items, columns, groups, etc.)
        for (
          let i = 0;
          i < master[key].length && i < translation[key].length;
          i++
        ) {
          overlayTextFieldsOnObject(master[key][i], translation[key][i]);
        }
      } else if (
        typeof master[key] === "object" &&
        master[key] !== null &&
        translation[key]
      ) {
        // Recursively process nested objects (dropdown, footer, etc.)
        overlayTextFieldsOnObject(master[key], translation[key]);
      }
      // All other fields (href, icon, component, type, etc.) stay from master
    }
  }

  // Clear redirect cache (for debug tools)
  app.post("/api/debug/clear-redirect-cache", (req, res) => {
    clearRedirectCache();
    res.json({ success: true, message: "Redirect cache cleared" });
  });

  // Schema.org API endpoints
  app.get("/api/schema", (req, res) => {
    const keys = getAvailableSchemaKeys();
    res.json({ available: keys });
  });

  app.get("/api/schema/:key", (req, res) => {
    const { key } = req.params;
    const locale = normalizeLocale(req.query.locale as string);

    const schema = getSchema(key, locale);

    if (!schema) {
      res.status(404).json({ error: "Schema not found" });
      return;
    }

    res.json(schema);
  });

  app.post("/api/schema/merge", (req, res) => {
    const { include, overrides } = req.body;
    const locale = normalizeLocale(req.query.locale as string);

    if (!include || !Array.isArray(include)) {
      res.status(400).json({ error: "include array required" });
      return;
    }

    const schemas = getMergedSchemas({ include, overrides }, locale);
    res.json({ schemas });
  });

  app.post("/api/debug/clear-schema-cache", (req, res) => {
    clearSchemaCache();
    clearSsrSchemaCache();
    res.json({ success: true, message: "Schema cache cleared" });
  });

  app.get("/api/brand-context", (req, res) => {
    try {
      const filePath = path.join(process.cwd(), "marketing-content", "brand-context.yml");
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: "brand-context.yml not found" });
        return;
      }
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = yaml.load(raw);
      res.json(parsed);
    } catch (err) {
      res.status(500).json({ error: "Failed to read brand-context.yml", message: String(err) });
    }
  });

  app.get("/api/seo/overview", (req, res) => {
    try {
      const entries = contentIndex.listAll();
      const seoEntries = contentIndex.getAllSeoEntries();

      const intentDistribution: Record<string, Record<string, number>> = {};
      const clusterMap = new Map<string, string[]>();
      const orphanPages: { slug: string; contentType: string; intent: string; filePath: string }[] = [];
      const featureCoverage: Record<string, number> = {};
      const faqCoverage: { slug: string; contentType: string; locale: string; faqCount: number }[] = [];
      const schemaCoverage: Record<string, number> = {};

      let totalPages = 0;
      let withPillar = 0;
      let withIntent = 0;
      let withFocusFeatures = 0;
      let withFaq = 0;
      let withSchema = 0;

      const highPriorityTypes = new Set(["programs", "landings", "landing"]);

      for (const entry of entries) {
        const ct = entry.contentType;
        for (const locale of entry.locales) {
          if (locale.startsWith("_") || locale.includes(".")) continue;
          totalPages++;

          const merged = contentIndex.loadMergedContent(ct, entry.slug, locale);
          if (!merged.data) continue;
          const data = merged.data as Record<string, unknown>;

          const seo = data.seo as Record<string, unknown> | undefined;
          const schema = data.schema as { include?: string[] } | undefined;
          const sections = data.sections as { type?: string }[] | undefined;

          const intent = (seo?.intent as string) || "unknown";
          const pillar = typeof seo?.pillar === "string" && seo.pillar ? seo.pillar : undefined;
          const focusFeatures = Array.isArray(seo?.focus_features)
            ? (seo!.focus_features as string[]).filter((f) => typeof f === "string")
            : [];

          if (!intentDistribution[ct]) intentDistribution[ct] = {};
          intentDistribution[ct][intent] = (intentDistribution[ct][intent] || 0) + 1;

          if (seo?.intent) withIntent++;

          if (pillar) {
            withPillar++;
            const cluster = clusterMap.get(pillar) || [];
            if (!cluster.includes(entry.slug)) cluster.push(entry.slug);
            clusterMap.set(pillar, cluster);
          } else if (highPriorityTypes.has(ct)) {
            orphanPages.push({
              slug: entry.slug,
              contentType: ct,
              intent,
              filePath: merged.filePath,
            });
          }

          if (focusFeatures.length > 0) {
            withFocusFeatures++;
            for (const f of focusFeatures) {
              featureCoverage[f] = (featureCoverage[f] || 0) + 1;
            }
          }

          if (schema?.include && schema.include.length > 0) {
            withSchema++;
            for (const schemaType of schema.include) {
              schemaCoverage[schemaType] = (schemaCoverage[schemaType] || 0) + 1;
            }
          }

          if (Array.isArray(sections)) {
            const faqSections = sections.filter((s) => s?.type === "faq");
            if (faqSections.length > 0) {
              withFaq++;
              faqCoverage.push({
                slug: entry.slug,
                contentType: ct,
                locale,
                faqCount: faqSections.length,
              });
            }
          }
        }
      }

      const clusters = Array.from(clusterMap.entries()).map(([pillarUrl, clusterSlugs]) => ({
        pillarUrl,
        clusterSlugs,
        clusterCount: clusterSlugs.length,
      }));

      const uniqueOrphans = orphanPages.filter(
        (o, i, arr) => arr.findIndex((x) => x.slug === o.slug && x.contentType === o.contentType) === i,
      );

      res.json({
        intentDistribution,
        clusters,
        orphanPages: uniqueOrphans,
        featureCoverage,
        faqCoverage,
        schemaCoverage,
        totals: {
          totalPages,
          withPillar,
          withIntent,
          withFocusFeatures,
          withFaq,
          withSchema,
        },
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to build SEO overview", message: String(err) });
    }
  });

  app.get("/api/seo-preview/:contentType/:slug", async (req, res) => {
    try {
      const { contentType, slug } = req.params;
      const locale = normalizeLocale(
        (req.query.locale as string) || getDefaultLocale(),
      );

      if (!isValidType(contentType)) {
        res.status(400).json({
          error: `Invalid content type. Must be one of: ${getAllFolders().join(", ")}`,
        });
        return;
      }

      if (hasDatabaseSingle(contentType)) {
        const page = await loadDatabaseSinglePage(contentType, slug, locale);
        if (!page) {
          res.status(404).json({ error: "Content not found" });
          return;
        }

        const singleEntry = (page.singleEntry as Record<string, unknown>) || {};
        const resolvedPage = resolveSingleVars(page, singleEntry) as typeof page;

        const meta = (resolvedPage.meta as Record<string, unknown>) || {};
        const schema = resolvedPage.schema as
          | {
              include?: string[];
              overrides?: Record<string, Record<string, unknown>>;
            }
          | undefined;

        let schemaOrg: Record<string, unknown>[] = [];
        if (schema?.include && schema.include.length > 0) {
          schemaOrg = getMergedSchemas(schema, locale);
        }

        const schemaInclude = (schema?.include as string[]) || [];
        const schemaOverrides =
          (schema?.overrides as Record<string, Record<string, unknown>>) || {};

        res.json({
          meta,
          faqSchema: null,
          schemaOrg,
          schemaInclude,
          schemaOverrides,
          title: (resolvedPage.title as string) || "",
          slug: (resolvedPage.slug as string) || slug,
        });
        return;
      }

      const pageData = loadRawYaml(contentType, slug, locale);
      if (!pageData) {
        res.status(404).json({ error: "Content not found" });
        return;
      }

      const meta = (pageData.meta as Record<string, unknown>) || {};
      const schema = pageData.schema as
        | {
            include?: string[];
            overrides?: Record<string, Record<string, unknown>>;
          }
        | undefined;

      let faqSchema: Record<string, unknown> | null = null;
      const sections = pageData.sections as
        | Array<Record<string, unknown>>
        | undefined;
      if (sections) {
        // Extract location slug if we're on a location page
        const locationSlug =
          getType(contentType) === "location" ? slug : undefined;
        // Extract program slug if we're on a program page
        const programSlug =
          getType(contentType) === "program" ? slug : undefined;

        const allFaqItems: Array<{ question: string; answer: string }> = [];
        for (const section of sections) {
          if (section.type === "faq") {
            const items = resolveFaqItems(
              section as unknown as FaqSection,
              locale,
              locationSlug,
              programSlug,
            );
            allFaqItems.push(...items);
          }
        }
        if (allFaqItems.length > 0) {
          faqSchema = buildFaqPageSchema(allFaqItems);
        }
      }

      let schemaOrg: Record<string, unknown>[] = [];
      if (schema?.include && schema.include.length > 0) {
        schemaOrg = getMergedSchemas(schema, locale);
      }

      const schemaInclude = (schema?.include as string[]) || [];
      const schemaOverrides =
        (schema?.overrides as Record<string, Record<string, unknown>>) || {};

      const responseData: Record<string, unknown> = {
        meta,
        faqSchema,
        schemaOrg,
        schemaInclude,
        schemaOverrides,
        title: pageData.title || "",
        slug: pageData.slug || slug,
      };

      if (getType(contentType) === "landing") {
        const commonData = contentIndex.loadCommonData("landing", slug);
        responseData.locations = (commonData?.locations as string[]) || [];
        responseData.availableLocations = listLocationPages(locale).map(
          (loc) => ({
            slug: loc.slug,
            name: loc.name,
            city: loc.city,
            country: loc.country,
          }),
        );
      }

      res.json(responseData);
    } catch (error) {
      console.error("[SEO Preview] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/content/update-locations", async (req, res) => {
    try {
      const auth = await requireCapability(req, res, "content_edit_structure", req.body.contentType || req.body.type || undefined);
      if (!auth.authorized) return;

      const { contentType, slug, locations, author } = req.body;
      if (!contentType || !slug || !Array.isArray(locations)) {
        res.status(400).json({
          error:
            "Missing required fields: contentType, slug, locations (array)",
        });
        return;
      }
      if (getType(contentType) !== "landing") {
        res
          .status(400)
          .json({ error: "Locations can only be updated for landings" });
        return;
      }

      const authorName =
        author && typeof author === "string" ? author : undefined;

      const result = editCommonContent({
        contentType,
        slug,
        operations: [
          {
            action: "update_field",
            path: "locations",
            value: locations.length > 0 ? locations : null,
          },
        ],
        author: authorName,
      });

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      const landingDir = contentIndex.getContentFolderPath(contentType, slug);
      const variantFiles = fs
        .readdirSync(landingDir)
        .filter((f) => f.endsWith(".yml") && f !== "_common.yml");
      const strippedVariants: string[] = [];
      for (const variantFile of variantFiles) {
        const variantPath = path.join(landingDir, variantFile);
        try {
          const variantContent = fs.readFileSync(variantPath, "utf-8");
          const variantData = safeYamlLoad(variantContent) as Record<
            string,
            unknown
          >;
          if (variantData && "locations" in variantData) {
            delete variantData.locations;
            const variantYaml = safeYamlDump(variantData, {
              lineWidth: -1,
              noRefs: true,
              quotingType: '"',
              forceQuotes: false,
            });
            fs.writeFileSync(variantPath, variantYaml, "utf-8");
            markFileAsModified(variantPath, authorName);
            strippedVariants.push(variantFile);
          }
        } catch (e) {
          console.warn(
            `[Update Locations] Could not process variant ${variantFile}:`,
            e,
          );
        }
      }
      if (strippedVariants.length > 0) {
        console.log(
          `[Update Locations] Removed locations from variants: ${strippedVariants.join(", ")}`,
        );
      }

      contentIndex.refresh();
      invalidateContentCaches(contentType);

      res.json({
        success: true,
        locations: locations.length > 0 ? locations : [],
        strippedVariants,
      });
    } catch (error) {
      console.error("[Update Locations] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Versioning debug endpoints
  app.get("/api/debug/versioning", (req, res) => {
    const versioningManager = getVersioningManager();
    const stats = versioningManager.getStats();
    res.json({
      stats,
      totalVariants: Object.keys(stats).length,
    });
  });

  app.post("/api/debug/clear-versioning-cache", (req, res) => {
    const versioningManager = getVersioningManager();
    versioningManager.clearCache();
    res.json({ success: true, message: "Versioning cache cleared" });
  });

  // GitHub sync status endpoint
  app.get("/api/github/sync-status", async (req, res) => {
    try {
      const { getGitHubSyncStatus } = await import("./github");
      const status = await getGitHubSyncStatus();
      res.json(status);
    } catch (error) {
      console.error("Error checking GitHub sync status:", error);
      res.status(500).json({ error: "Failed to check sync status" });
    }
  });

  // GitHub webhook endpoint - receives push events for auto-pull
  app.post("/api/github/webhook", async (req, res) => {
    try {
      const { logSync } = await import("./sync-log");
      const signature = req.headers["x-hub-signature-256"] as string;
      if (!signature) {
        logSync("WEBHOOK", "Rejected: missing signature header");
        res.status(401).json({ error: "Missing signature" });
        return;
      }

      const { getWebhookInfo } = await import("./sync-state");
      const webhookInfo = getWebhookInfo();
      if (!webhookInfo) {
        logSync("WEBHOOK", "Rejected: no webhook configured in sync state");
        res.status(500).json({ error: "No webhook configured" });
        return;
      }

      const { verifyWebhookSignature } = await import("./github");
      const rawBody = (req as any).rawBody;
      const payload = rawBody
        ? rawBody.toString("utf-8")
        : JSON.stringify(req.body);

      if (
        !verifyWebhookSignature(payload, signature, webhookInfo.webhookSecret)
      ) {
        logSync("WEBHOOK", "Rejected: invalid HMAC signature");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      const event = req.headers["x-github-event"] as string;

      if (event === "ping") {
        logSync("WEBHOOK", "Received ping event — webhook is active");
        res.json({ ok: true, message: "pong" });
        return;
      }

      if (event !== "push") {
        logSync("WEBHOOK", `Ignored event: ${event}`);
        res.json({ ok: true, message: `Ignored event: ${event}` });
        return;
      }

      const pushPayload = req.body;
      const commitSha = pushPayload.after;
      const pusher = pushPayload.pusher?.name || "unknown";

      const { getAutoCommitStatus } = await import("./auto-commit");
      const { lastCommitSha } = getAutoCommitStatus();
      if (
        lastCommitSha &&
        commitSha &&
        (commitSha === lastCommitSha ||
          commitSha.startsWith(lastCommitSha) ||
          lastCommitSha.startsWith(commitSha))
      ) {
        logSync(
          "WEBHOOK",
          `Push ${commitSha?.slice(0, 7)} by ${pusher}: skipping auto-pull — commit was pushed by this instance`,
          pusher,
        );
        res.json({ ok: true, message: "Self-push, skipping auto-pull" });
        return;
      }

      const commits = pushPayload.commits || [];

      // Extract the real CMS author from commit messages — format: "[Auto-sync] Author Name updated file.yml"
      // All commits share the same GitHub token so pusher.name is always the same technical user.
      const autoSyncAuthorRe = /^\[Auto-sync\] (.+?) updated /;
      const realAuthor = (() => {
        const messages = [
          pushPayload.head_commit?.message,
          ...commits.map((c: { message?: string }) => c.message),
        ].filter(Boolean) as string[];
        for (const msg of messages) {
          const m = msg.match(autoSyncAuthorRe);
          if (m) return m[1];
        }
        return null;
      })();
      const person = realAuthor ?? pusher;

      const changedFiles = new Set<string>();
      for (const commit of commits) {
        for (const f of commit.added || []) changedFiles.add(f);
        for (const f of commit.modified || []) changedFiles.add(f);
        for (const f of commit.removed || []) changedFiles.add(f);
      }

      const marketingFiles = Array.from(changedFiles).filter((f) =>
        f.startsWith("marketing-content/"),
      );

      if (marketingFiles.length === 0) {
        logSync(
          "WEBHOOK",
          `Push ${commitSha?.slice(0, 7)} by ${person}: no marketing-content files changed`,
          person,
        );
        res.json({ ok: true, message: "No marketing-content files changed" });
        return;
      }

      logSync(
        "WEBHOOK",
        `Push ${commitSha?.slice(0, 7)} by ${person}: ${marketingFiles.length} marketing-content files changed`,
        person,
      );

      const isAutoPullEnabled =
        process.env.GITHUB_SYNC_ENABLED === "true" &&
        process.env.GITHUB_AUTO_PULL_ENABLED === "true";
      if (!isAutoPullEnabled) {
        logSync(
          "AUTO-PULL",
          `Skipped webhook pull — GITHUB_AUTO_PULL_ENABLED not set to 'true'`,
        );
        res.json({ ok: true, message: "Auto-pull disabled" });
        return;
      }

      const { autoPullNonConflicting } = await import("./github");
      const result = await autoPullNonConflicting(marketingFiles, commitSha);

      if (result.pulled.length > 0) {
        logSync(
          "AUTO-PULL",
          `Webhook: pulled ${result.pulled.length} files from ${commitSha?.slice(0, 7)}: ${result.pulled.map((f) => f.replace("marketing-content/", "")).join(", ")}`,
        );
      }
      if (result.conflicted.length > 0) {
        logSync(
          "CONFLICT",
          `Webhook: ${result.conflicted.length} files have local edits: ${result.conflicted.map((f) => f.replace("marketing-content/", "")).join(", ")}`,
        );
      }
      if (result.errors.length > 0) {
        logSync("ERROR", `Webhook pull errors: ${result.errors.join("; ")}`);
      }

      res.json({
        ok: true,
        pulled: result.pulled.length,
        conflicted: result.conflicted.length,
        errors: result.errors.length,
      });
    } catch (error) {
      const { logSync } = await import("./sync-log");
      logSync(
        "ERROR",
        `Webhook handler error: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.error("[Webhook] Error handling webhook:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get the full sync log text
  app.get("/api/github/sync-log", async (_req, res) => {
    try {
      const { getSyncLogEntries } = await import("./sync-log");
      const entries = getSyncLogEntries();
      res.json({ entries });
      return;
    } catch (error) {
      res.status(500).json({ error: "Error reading sync log" });
    }
  });

  app.get("/api/github/sync-log-text", async (_req, res) => {
    try {
      const { getSyncLogText } = await import("./sync-log");
      const text = getSyncLogText();
      res.type("text/plain").send(text);
    } catch (error) {
      res.status(500).send("Error reading sync log");
    }
  });

  app.delete("/api/github/sync-log", async (req, res) => {
    try {
      const mode = req.query.mode as string | undefined;
      if (mode === "2days") {
        const { clearSyncLogOlderThan } = await import("./sync-log");
        await clearSyncLogOlderThan(Date.now() - 2 * 24 * 60 * 60 * 1000);
      } else {
        const { clearSyncLog } = await import("./sync-log");
        await clearSyncLog();
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error clearing sync log" });
    }
  });

  app.get("/api/git/file-history", (req, res) => {
    try {
      const exec = _execSync;
      const filePath = req.query.file as string;
      const limit = Math.min(parseInt(String(req.query.limit || "20"), 10) || 20, 50);
      if (!filePath || typeof filePath !== "string") {
        res.status(400).json({ error: "file query param required" });
        return;
      }
      if (/[;&|`$<>]/.test(filePath)) {
        res.status(400).json({ error: "Invalid file path" });
        return;
      }
      let raw: string;
      try {
        raw = exec(
          `git log --follow --pretty=format:"%H|%aI|%an|%s" -n ${limit} -- "${filePath}"`,
          { encoding: "utf-8", cwd: process.cwd() }
        ) as string;
      } catch {
        res.json({ entries: [] });
        return;
      }
      const entries = raw
        .split("\n")
        .filter(l => l.trim())
        .map(line => {
          const idx1 = line.indexOf("|");
          const idx2 = line.indexOf("|", idx1 + 1);
          const idx3 = line.indexOf("|", idx2 + 1);
          return {
            sha: line.slice(0, idx1),
            date: line.slice(idx1 + 1, idx2),
            author: line.slice(idx2 + 1, idx3),
            subject: line.slice(idx3 + 1),
          };
        });
      res.json({ entries });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/git/file-at", (req, res) => {
    try {
      const exec = _execSync;
      const filePath = req.query.file as string;
      const sha = req.query.sha as string;
      if (!filePath || !sha) {
        res.status(400).json({ error: "file and sha query params required" });
        return;
      }
      if (!/^[a-f0-9]{7,40}$/.test(sha)) {
        res.status(400).json({ error: "Invalid SHA format" });
        return;
      }
      if (/[;&|`$<>]/.test(filePath)) {
        res.status(400).json({ error: "Invalid file path" });
        return;
      }
      let content: string;
      try {
        content = exec(`git show "${sha}:${filePath}"`, {
          encoding: "utf-8",
          cwd: process.cwd(),
        }) as string;
      } catch {
        res.status(404).json({ error: "File not found at that revision" });
        return;
      }
      res.type("text/plain").send(content);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/git/folder-history", (req, res) => {
    try {
      const exec = _execSync;
      const folder = req.query.folder as string;
      const limit = Math.min(parseInt(String(req.query.limit || "30"), 10) || 30, 50);
      if (!folder || typeof folder !== "string") {
        res.status(400).json({ error: "folder query param required" });
        return;
      }
      if (/[;&|`$<>]/.test(folder)) {
        res.status(400).json({ error: "Invalid folder path" });
        return;
      }
      let raw: string;
      try {
        raw = exec(
          `git log --pretty=format:"%H|%aI|%an|%s" -n ${limit} -- "${folder}"`,
          { encoding: "utf-8", cwd: process.cwd() }
        ) as string;
      } catch {
        res.json({ entries: [], repoUrl: null });
        return;
      }
      const entries = raw
        .split("\n")
        .filter(l => l.trim())
        .map(line => {
          const idx1 = line.indexOf("|");
          const idx2 = line.indexOf("|", idx1 + 1);
          const idx3 = line.indexOf("|", idx2 + 1);
          return {
            sha: line.slice(0, idx1),
            date: line.slice(idx1 + 1, idx2),
            author: line.slice(idx2 + 1, idx3),
            subject: line.slice(idx3 + 1),
          };
        });
      const repoUrl = (process.env.GITHUB_REPO_URL || "").replace(/\.git$/, "") || null;
      res.json({ entries, repoUrl });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/git/restore-folder", async (req, res) => {
    try {
      const exec = _execSync;
      const { folder, sha } = req.body;
      if (!folder || !sha) {
        res.status(400).json({ error: "folder and sha are required" });
        return;
      }
      if (!/^[a-f0-9]{7,40}$/.test(sha)) {
        res.status(400).json({ error: "Invalid SHA format" });
        return;
      }
      if (/[;&|`$<>]/.test(folder)) {
        res.status(400).json({ error: "Invalid folder path" });
        return;
      }
      const fs = await import("fs");
      const path = await import("path");

      // List files that existed in the folder at the given SHA
      let lsOutput: string;
      try {
        lsOutput = exec(
          `git ls-tree -r --name-only "${sha}" -- "${folder}"`,
          { encoding: "utf-8", cwd: process.cwd() }
        ) as string;
      } catch {
        res.status(400).json({ error: "Could not list files at that commit" });
        return;
      }
      const filesAtSha = lsOutput.split("\n").filter(l => l.trim());
      if (filesAtSha.length === 0) {
        res.status(400).json({ error: "No files found in folder at that commit" });
        return;
      }

      // Collect current files in the folder
      const getAllFiles = (dir: string, base: string): string[] => {
        const items: string[] = [];
        if (!fs.default.existsSync(dir)) return items;
        for (const entry of fs.default.readdirSync(dir)) {
          const full = path.default.join(dir, entry);
          const rel = path.default.join(base, entry).replace(/\\/g, "/");
          if (fs.default.statSync(full).isDirectory()) {
            items.push(...getAllFiles(full, rel));
          } else {
            items.push(rel);
          }
        }
        return items;
      };
      const currentFiles = getAllFiles(
        path.default.join(process.cwd(), folder),
        folder
      );

      // Write each file from the historical SHA
      for (const filePath of filesAtSha) {
        const content = exec(
          `git show "${sha}:${filePath}"`,
          { encoding: "buffer", cwd: process.cwd() }
        ) as Buffer;
        const absPath = path.default.join(process.cwd(), filePath);
        fs.default.mkdirSync(path.default.dirname(absPath), { recursive: true });
        fs.default.writeFileSync(absPath, content);
      }

      // Remove files that exist locally but were not present at that SHA
      const filesAtShaSet = new Set(filesAtSha);
      for (const currentFile of currentFiles) {
        if (!filesAtShaSet.has(currentFile)) {
          try { fs.default.unlinkSync(path.default.join(process.cwd(), currentFile)); } catch {}
        }
      }

      // Commit the restore
      const { commitAndPush } = await import("./github");
      const result = await commitAndPush(
        `Restore: ${folder} to ${sha.slice(0, 7)}`,
        { force: false }
      );
      if (!result.success) {
        res.status(500).json({ error: result.error || "Commit failed" });
        return;
      }
      res.json({ success: true, commitHash: result.commitHash });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Get structured sync info (webhook status, instance, recent log entries)
  app.get("/api/github/sync-info", async (_req, res) => {
    try {
      const {
        getRecentEntries,
        getInstanceId,
        getReplitCheckpoint,
        getGithubCommit,
      } = await import("./sync-log");
      const { getWebhookInfo } = await import("./sync-state");
      const webhookInfo = getWebhookInfo();

      const repoUrl = (process.env.GITHUB_REPO_URL || "").replace(/\.git$/, "");
      res.json({
        instanceId: getInstanceId(),
        replitCheckpoint: getReplitCheckpoint(),
        githubCommit: getGithubCommit(),
        repoUrl: repoUrl || null,
        env: process.env.NODE_ENV || "development",
        pid: process.pid,
        webhook: webhookInfo
          ? {
              active: true,
              id: webhookInfo.webhookId,
              url: webhookInfo.webhookUrl,
              createdAt: webhookInfo.createdAt,
            }
          : { active: false },
        recentLog: getRecentEntries(20),
      });
    } catch (error) {
      res.status(500).json({ error: "Error reading sync info" });
    }
  });

  app.post("/api/github/webhook/setup", async (_req, res) => {
    try {
      const { ensureWebhook } = await import("./github");
      await ensureWebhook();
      const { getWebhookInfo } = await import("./sync-state");
      const info = getWebhookInfo();
      if (info) {
        res.json({
          success: true,
          message: `Webhook #${info.webhookId} is active at ${info.webhookUrl}`,
        });
      } else {
        res
          .status(500)
          .json({
            success: false,
            message:
              "Webhook setup ran but no webhook was registered. Check that your GitHub token has the admin:repo_hook scope.",
          });
      }
    } catch (error: any) {
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Webhook setup failed",
        });
    }
  });

  app.delete("/api/github/webhook/duplicates", async (_req, res) => {
    try {
      const { getWebhookInfo } = await import("./sync-state");
      const info = getWebhookInfo();
      if (!info) {
        return res
          .status(400)
          .json({
            success: false,
            message: "No active webhook registered — nothing to clean up.",
          });
      }
      const { cleanupDuplicateWebhooks, getGitHubConfig } = await import(
        "./github"
      );
      const config = getGitHubConfig();
      if (!config) {
        return res
          .status(400)
          .json({ success: false, message: "GitHub not configured." });
      }
      const deleted = await cleanupDuplicateWebhooks(
        config,
        info.webhookId,
        info.webhookUrl,
      );
      res.json({ success: true, deleted: deleted.length, ids: deleted });
    } catch (error: any) {
      res
        .status(500)
        .json({ success: false, message: error.message || "Cleanup failed" });
    }
  });

  // Get all sync changes (local and incoming)
  app.get("/api/github/pending-changes", async (req, res) => {
    try {
      const { getAllSyncChanges } = await import("./github");
      const changes = await getAllSyncChanges();
      res.json({ changes, count: changes.length });
    } catch (error) {
      console.error("Error getting sync changes:", error);
      res.status(500).json({ error: "Failed to get sync changes" });
    }
  });

  // Commit and push pending changes to GitHub
  app.post("/api/github/commit", async (req, res) => {
    try {
      const { message, force, author, files, queue } = req.body;
      if (
        !message ||
        typeof message !== "string" ||
        message.trim().length === 0
      ) {
        res.status(400).json({ error: "Commit message is required" });
        return;
      }

      const authorName =
        author && typeof author === "string" && author.trim()
          ? author.trim()
          : undefined;

      // Queue mode: route through markFileAsModified → auto-commit queue.
      // Used by MCP commits so they respect sequencing, attribution, and conflict handling.
      if (queue === true) {
        const { markFileAsModified, detectPendingChanges } = await import(
          "./sync-state"
        );
        const { logSync } = await import("./sync-log");
        const { isAutoCommitEnabled } = await import("./auto-commit");

        if (!isAutoCommitEnabled()) {
          // Auto-commit disabled — fall through to direct commit below
          const finalMsg = authorName
            ? `[Author: ${authorName}] ${message.trim()}`
            : message.trim();
          const { commitAndPush } = await import("./github");
          const result = await commitAndPush(finalMsg, {
            force: !!force,
            files: Array.isArray(files) ? files : undefined,
          });
          if (result.success) {
            res.json({ success: true, commitHash: result.commitHash });
          } else {
            res.status(400).json({ success: false, error: result.error });
          }
          return;
        }

        // Determine which files to queue
        let filesToQueue: string[];
        if (Array.isArray(files) && files.length > 0) {
          filesToQueue = files as string[];
        } else {
          const pending = detectPendingChanges();
          filesToQueue = pending.map((c) => c.file);
        }

        if (filesToQueue.length === 0) {
          res
            .status(400)
            .json({ error: "No pending changes found to queue" });
          return;
        }

        const effectiveAuthor = authorName || "MCP";
        for (const filePath of filesToQueue) {
          markFileAsModified(filePath, effectiveAuthor);
          const shortPath = filePath.replace("marketing-content/", "");
          logSync("EDIT", `MCP queued edit: ${shortPath}`, effectiveAuthor);
        }

        res
          .status(202)
          .json({ queued: true, files: filesToQueue, author: effectiveAuthor });
        return;
      }

      // Direct-commit mode (existing path — used by DebugBubble / manual CMS commits)
      let finalMessage = message.trim();
      if (authorName) {
        finalMessage = `[Author: ${authorName}] ${finalMessage}`;
      }

      const { commitAndPush } = await import("./github");
      const result = await commitAndPush(finalMessage, {
        force: !!force,
        files: Array.isArray(files) ? files : undefined,
      });

      if (result.success) {
        res.json({ success: true, commitHash: result.commitHash });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error("Error committing to GitHub:", error);
      res.status(500).json({ error: "Failed to commit changes" });
    }
  });

  // Get conflict information (missed commits from remote)
  app.get("/api/github/conflict-info", async (req, res) => {
    try {
      const { getConflictInfo } = await import("./github");
      const conflictInfo = await getConflictInfo();
      res.json(conflictInfo);
    } catch (error) {
      console.error("Error getting conflict info:", error);
      res.status(500).json({ error: "Failed to get conflict info" });
    }
  });

  // Sync local state with remote (accept remote changes)
  app.post("/api/github/sync", async (req, res) => {
    try {
      const { syncWithRemote } = await import("./github");
      const result = await syncWithRemote();

      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error("Error syncing with remote:", error);
      res.status(500).json({ error: "Failed to sync with remote" });
    }
  });

  // Check for pull conflicts (files changed both locally and remotely)
  app.get("/api/github/pull-conflicts", async (req, res) => {
    try {
      const { checkPullConflicts } = await import("./github");
      const result = await checkPullConflicts();
      res.json(result);
    } catch (error) {
      console.error("Error checking pull conflicts:", error);
      res.status(500).json({ error: "Failed to check pull conflicts" });
    }
  });

  // Get status for a single file (local vs remote)
  app.get("/api/github/file-status", async (req, res) => {
    try {
      const filePath = req.query.file as string;
      if (!filePath) {
        res.status(400).json({ error: "Missing file parameter" });
        return;
      }
      const { getRemoteFileStatus } = await import("./github");
      const status = await getRemoteFileStatus(filePath);
      res.json(status);
    } catch (error) {
      console.error("Error getting file status:", error);
      res.status(500).json({ error: "Failed to get file status" });
    }
  });

  // Commit a single file to remote
  app.post("/api/github/commit-file", async (req, res) => {
    try {
      const { filePath, message, author } = req.body;
      if (!filePath || !message) {
        res.status(400).json({ error: "Missing filePath or message" });
        return;
      }
      const { commitSingleFile } = await import("./github");
      const result = await commitSingleFile({ filePath, message, author });

      if (result.success) {
        res.json({ success: true, commitSha: result.commitSha });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error("Error committing file:", error);
      res.status(500).json({ error: "Failed to commit file" });
    }
  });

  // Pull a single file from remote
  app.post("/api/github/pull-file", async (req, res) => {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        res.status(400).json({ error: "Missing filePath" });
        return;
      }
      const { pullSingleFile } = await import("./github");
      const result = await pullSingleFile(filePath);

      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error("Error pulling file:", error);
      res.status(500).json({ error: "Failed to pull file" });
    }
  });

  // Sync local state with remote (update lastSyncedCommit to current remote HEAD)
  app.post("/api/github/sync-with-remote", async (req, res) => {
    try {
      const { syncWithRemote } = await import("./github");
      const result = await syncWithRemote();

      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error("Error syncing with remote:", error);
      res.status(500).json({ error: "Failed to sync with remote" });
    }
  });

  app.get("/api/github/auto-commit/status", async (_req, res) => {
    try {
      const { getAutoCommitStatus } = await import("./auto-commit");
      res.json(getAutoCommitStatus());
    } catch (error) {
      console.error("Error getting auto-commit status:", error);
      res.status(500).json({ error: "Failed to get auto-commit status" });
    }
  });

  app.post("/api/github/auto-commit/flush", async (_req, res) => {
    try {
      const { flushPendingChanges } = await import("./auto-commit");
      const result = await flushPendingChanges();
      res.json(result);
    } catch (error) {
      console.error("Error flushing auto-commit:", error);
      res.status(500).json({ error: "Failed to flush pending changes" });
    }
  });

  app.post("/api/github/auto-commit/config", async (req, res) => {
    try {
      const { commitIntervalSeconds } = req.body;
      if (
        typeof commitIntervalSeconds === "number" &&
        commitIntervalSeconds >= 1
      ) {
        const { updateSyncConfig } = await import("./sync-state");
        updateSyncConfig({ commitIntervalSeconds });
        res.json({ success: true, commitIntervalSeconds });
      } else {
        res
          .status(400)
          .json({ error: "commitIntervalSeconds must be a number >= 1" });
      }
    } catch (error) {
      console.error("Error updating auto-commit config:", error);
      res.status(500).json({ error: "Failed to update auto-commit config" });
    }
  });

  app.get("/api/github/auto-commit/conflicts", async (_req, res) => {
    try {
      const { getConflictedFiles } = await import("./auto-commit");
      res.json({ conflicts: getConflictedFiles() });
    } catch (error) {
      console.error("Error getting conflicts:", error);
      res.status(500).json({ error: "Failed to get conflicts" });
    }
  });

  app.post("/api/github/auto-commit/clear-conflict", async (req, res) => {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        res.status(400).json({ error: "filePath is required" });
        return;
      }
      const { clearConflict } = await import("./auto-commit");
      const cleared = clearConflict(filePath);
      res.json({ success: cleared });
    } catch (error) {
      console.error("Error clearing conflict:", error);
      res.status(500).json({ error: "Failed to clear conflict" });
    }
  });

  // Get available variants for a content type and slug (reads versioning.yml)
  app.get("/api/variants/:contentType/:slug", (req, res) => {
    const { contentType, slug } = req.params;

    if (!isValidType(contentType)) {
      res
        .status(400)
        .json({ error: "Invalid content type", validTypes: getAllFolders() });
      return;
    }

    const versioningManager = getVersioningManager();
    const result = versioningManager.getAvailableVariants(contentType, slug);

    if (!result) {
      res.status(404).json({ error: "Content folder not found" });
      return;
    }

    res.json(result);
  });

  // Get versioning data for a specific content type and slug
  app.get("/api/versioning/:contentType/:contentSlug", (req, res) => {
    const { contentType, contentSlug } = req.params;

    if (!isValidType(contentType)) {
      res.status(400).json({
        error: "Invalid content type",
        validTypes: getAllFolders(),
      });
      return;
    }

    const versioningManager = getVersioningManager();
    const versioning = versioningManager.getVersioningForContent(contentType, contentSlug);
    const filePath = path.join(
      process.cwd(),
      "marketing-content",
      getFolder(contentType as ContentType) || contentType,
      contentSlug,
      "versioning.yml",
    );

    const availableLocales = getLocaleEntries().map((l: { code: string }) => l.code);

    if (!versioning) {
      res.json({
        versioning: null,
        hasVersioningFile: false,
        filePath,
        availableLocales,
      });
      return;
    }

    res.json({
      versioning,
      hasVersioningFile: true,
      filePath,
      availableLocales,
    });
  });

  // Update versioning allocations for a locale
  app.patch(
    "/api/versioning/:contentType/:contentSlug/:locale",
    (req, res) => {
      const { contentType, contentSlug, locale } = req.params;

      if (!isValidType(contentType)) {
        res
          .status(400)
          .json({ error: "Invalid content type", validTypes: getAllFolders() });
        return;
      }

      const parseResult = versioningUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: "Invalid update data",
          details: parseResult.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
        return;
      }

      const versioningManager = getVersioningManager();
      try {
        const existing = versioningManager.getVersioningForContent(contentType, contentSlug) || {};
        const updated = { ...existing, [locale]: { variants: parseResult.data.variants } };
        versioningManager.updateVersioning(contentType, contentSlug, updated);
        res.json({ success: true, contentType, contentSlug, locale });
      } catch (error) {
        res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to update versioning",
        });
      }
    },
  );

  // Create a new content variant (copies locale file + registers in versioning.yml at 0% allocation)
  app.post("/api/versioning/:contentType/:contentSlug", async (req, res) => {
    const { contentType, contentSlug } = req.params;

    if (!isValidType(contentType)) {
      res.status(400).json({ error: "Invalid content type", validTypes: getAllFolders() });
      return;
    }

    const auth = await requireCapability(req, res, "content_create_variant", contentType);
    if (!auth.authorized) return;

    const { variantSlug, locale } = req.body as { variantSlug?: string; locale?: string };

    if (!variantSlug || !locale) {
      res.status(400).json({ error: "variantSlug and locale are required" });
      return;
    }

    if (!/^[a-z0-9-]+$/.test(variantSlug)) {
      res.status(400).json({ error: "variantSlug must be lowercase letters, numbers, and hyphens only" });
      return;
    }

    const folder = getFolder(contentType as ContentType);
    const contentDir = path.join(process.cwd(), "marketing-content", folder, contentSlug);

    if (!fs.existsSync(contentDir)) {
      res.status(404).json({ error: "Content folder not found" });
      return;
    }

    const variantFilePath = path.join(contentDir, `${variantSlug}.${locale}.yml`);
    if (fs.existsSync(variantFilePath)) {
      res.status(409).json({ error: `Variant ${variantSlug}.${locale}.yml already exists` });
      return;
    }

    const sourceFilePath = path.join(contentDir, `${locale}.yml`);
    if (!fs.existsSync(sourceFilePath)) {
      res.status(404).json({ error: `Source file ${locale}.yml not found for this entry` });
      return;
    }

    try {
      const sourceContent = fs.readFileSync(sourceFilePath, "utf-8");
      fs.writeFileSync(variantFilePath, sourceContent, "utf-8");

      const versioningManager = getVersioningManager();
      const existing = versioningManager.getVersioningForContent(contentType, contentSlug) || {};
      const localeData = existing[locale]
        ? { variants: [...(existing[locale].variants || [])] }
        : { variants: [] };

      if (!localeData.variants.some((v) => v.slug === variantSlug)) {
        localeData.variants.push({ slug: variantSlug, allocation: 0 });
      }

      versioningManager.updateVersioning(contentType, contentSlug, { ...existing, [locale]: localeData });

      res.json({
        success: true,
        variantSlug,
        locale,
        filePath: `marketing-content/${folder}/${contentSlug}/${variantSlug}.${locale}.yml`,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Promote a variant: overwrite the default locale file, remove from versioning.yml, delete variant file
  app.post("/api/versioning/:contentType/:contentSlug/:locale/promote/:variantSlug", async (req, res) => {
    const { contentType, contentSlug, locale, variantSlug } = req.params;

    if (!isValidType(contentType)) {
      res.status(400).json({ error: "Invalid content type", validTypes: getAllFolders() });
      return;
    }

    const auth = await requireCapability(req, res, "content_edit_variant", contentType);
    if (!auth.authorized) return;

    if (!/^[a-z0-9-]+$/.test(variantSlug)) {
      res.status(400).json({ error: "variantSlug must be lowercase letters, numbers, and hyphens only" });
      return;
    }

    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(locale)) {
      res.status(400).json({ error: "locale must be a valid language code (e.g. en, es, pt-BR)" });
      return;
    }

    const folder = getFolder(contentType as ContentType);
    const contentDir = path.resolve(process.cwd(), "marketing-content", folder, contentSlug);

    if (!fs.existsSync(contentDir)) {
      res.status(404).json({ error: "Content folder not found" });
      return;
    }

    const variantFilePath = path.resolve(contentDir, `${variantSlug}.${locale}.yml`);
    const defaultFilePath = path.resolve(contentDir, `${locale}.yml`);

    // Path containment: both resolved paths must stay within contentDir
    if (!variantFilePath.startsWith(contentDir + path.sep) || !defaultFilePath.startsWith(contentDir + path.sep)) {
      res.status(400).json({ error: "Invalid file path" });
      return;
    }

    if (!fs.existsSync(variantFilePath)) {
      res.status(404).json({ error: `Variant file ${variantSlug}.${locale}.yml not found` });
      return;
    }

    try {
      const variantContent = fs.readFileSync(variantFilePath, "utf-8");
      fs.writeFileSync(defaultFilePath, variantContent, "utf-8");

      const versioningManager = getVersioningManager();
      const existing = versioningManager.getVersioningForContent(contentType, contentSlug) || {};
      const localeData = existing[locale];
      if (localeData) {
        const updatedVariants = (localeData.variants || []).filter((v) => v.slug !== variantSlug);
        versioningManager.updateVersioning(contentType, contentSlug, {
          ...existing,
          [locale]: { variants: updatedVariants },
        });
      }

      fs.unlinkSync(variantFilePath);

      contentIndex.invalidateCommonFields(contentType);
      clearSsrSchemaCache();
      const folder = getFolder(contentType as ContentType);
      markFileAsModified(`marketing-content/${folder}/${contentSlug}/${locale}.yml`, "api");

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Molecules Showcase API endpoint
  app.get("/api/molecules", (_req, res) => {
    const moleculesPath = path.join(
      process.cwd(),
      "marketing-content",
      "molecules.json",
    );
    try {
      const moleculesData = JSON.parse(fs.readFileSync(moleculesPath, "utf-8"));
      res.json(moleculesData);
    } catch (error) {
      res.status(500).json({
        error: "Failed to load molecules data",
        details: String(error),
      });
    }
  });

  // Component Registry API endpoints
  app.get("/api/component-registry", (req, res) => {
    const overview = getRegistryOverview();
    res.json(overview);
  });

  // Field editors endpoint - returns all field editor configs from component registry
  app.get("/api/component-registry/field-editors", (_req, res) => {
    const fieldEditors = loadAllFieldEditors();
    res.json(fieldEditors);
  });

  app.get("/api/component-registry/:componentType", (req, res) => {
    const { componentType } = req.params;
    const info = getComponentInfo(componentType);

    if (!info) {
      res.status(404).json({ error: "Component not found" });
      return;
    }

    res.json(info);
  });

  app.get("/api/component-registry/:componentType/validate", (req, res) => {
    const { componentType } = req.params;
    const version = req.query.version as string | undefined;

    // Dynamic import to avoid circular dependencies
    import("../scripts/utils/validateComponent")
      .then(({ validateComponent }) => {
        const result = validateComponent(componentType, version);
        res.json(result);
      })
      .catch((error) => {
        res.status(500).json({
          error: "Failed to load validation module",
          details: String(error),
        });
      });
  });

  app.get("/api/component-registry/:componentType/versions", (req, res) => {
    const { componentType } = req.params;
    const versions = listVersions(componentType);
    res.json({ versions });
  });

  app.get(
    "/api/component-registry/:componentType/:version/schema",
    (req, res) => {
      const { componentType, version } = req.params;
      const schema = loadSchema(componentType, version);

      if (!schema) {
        res.status(404).json({ error: "Schema not found" });
        return;
      }

      res.json(schema);
    },
  );

  app.get(
    "/api/component-registry/:componentType/:version/examples",
    (req, res) => {
      const { componentType, version } = req.params;
      const examples = loadExamples(componentType, version);
      res.json({ examples });
    },
  );

  app.get(
    "/api/component-registry/:componentType/:version/example-path",
    (req, res) => {
      const { componentType, version } = req.params;
      const filePath = getExampleFilePath(componentType, version);
      res.json({ path: filePath });
    },
  );

  app.post(
    "/api/component-registry/:componentType/create-version",
    (req, res) => {
      const { componentType } = req.params;
      const { baseVersion } = req.body;

      if (!baseVersion) {
        res.status(400).json({ error: "baseVersion required" });
        return;
      }

      const result = createNewVersion(componentType, baseVersion);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ success: true, newVersion: result.newVersion });
    },
  );

  app.post(
    "/api/component-registry/:componentType/:version/save-example",
    (req, res) => {
      const { componentType, version } = req.params;
      const { exampleName, yamlContent } = req.body;

      if (!exampleName || !yamlContent) {
        res.status(400).json({ error: "exampleName and yamlContent required" });
        return;
      }

      const result = saveExample(
        componentType,
        version,
        exampleName,
        yamlContent,
      );

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      if (result.filePath) {
        const relPath = path.relative(process.cwd(), result.filePath);
        markFileAsModified(relPath, undefined, new Set([relPath]));
      }

      res.json({ success: true });
    },
  );

  app.post(
    "/api/component-registry/:componentType/:version/examples",
    (req, res) => {
      const { componentType, version } = req.params;
      const { yamlContent, sectionId, name, description } = req.body as {
        yamlContent?: string;
        sectionId?: string;
        name?: string;
        description?: string;
      };

      if (!yamlContent) {
        res.status(400).json({ error: "yamlContent is required" });
        return;
      }

      const displayName = typeof name === "string" ? name : undefined;
      const desc = typeof description === "string" ? description : undefined;

      const result = createExample(componentType, version, yamlContent, sectionId, {
        displayName,
        description: desc,
      });

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      if (result.filePath) {
        const relPath = path.relative(process.cwd(), result.filePath);
        markFileAsModified(relPath, undefined, new Set([relPath]));
      }

      res.json({ success: true, filename: result.filename, exampleName: result.exampleName });
    }
  );

  app.get(
    "/api/component-registry/:componentType/variant-impact",
    (req, res) => {
      const { componentType } = req.params;
      const { version, exampleName } = req.query as { version?: string; exampleName?: string };

      if (!version || !exampleName) {
        res.status(400).json({ error: "version and exampleName are required" });
        return;
      }

      const variantName = getVariantByExample(componentType, version, exampleName);
      if (!variantName) {
        res.status(404).json({ error: `Could not determine variant for example "${exampleName}"` });
        return;
      }

      const toPascal = (s: string) =>
        s.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase()).replace(/^(.)/, (c: string) => c.toUpperCase());
      const componentName = `${toPascal(componentType)}${toPascal(variantName)}`;
      const tsxPath = `client/src/components/${componentType}/variants/${componentName}.tsx`;

      const examples = getVariantExamples(componentType, variantName).map((e) => e.name);

      const pagesRaw = contentIndex.removeAllVariantSectionsFromPages(componentType, variantName, true);
      const pagesMap = new Map<string, { count: number; sectionIds: string[] }>();
      for (const p of pagesRaw) {
        const key = `/${p.locale}/${p.slug}`;
        const existing = pagesMap.get(key);
        if (existing) {
          existing.count += p.removedCount;
          existing.sectionIds.push(...p.removedSectionIds);
        } else {
          pagesMap.set(key, { count: p.removedCount, sectionIds: p.removedSectionIds });
        }
      }
      const pages = Array.from(pagesMap.entries()).map(([path, data]) => ({
        path,
        count: data.count,
        sectionIds: data.sectionIds,
      }));

      res.json({ variantName, componentName, tsxPath, examples, pages });
    }
  );

  app.delete(
    "/api/component-registry/:componentType/versions/:version/examples/:exampleName",
    (req, res) => {
      const { componentType, version, exampleName } = req.params;
      const result = deleteExample(componentType, version, decodeURIComponent(exampleName));
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      if (result.filePath) {
        const relPath = path.relative(process.cwd(), result.filePath);
        markFileAsModified(relPath, undefined, new Set([relPath]));
      }
      res.json({ success: true });
    }
  );

  app.delete(
    "/api/component-registry/:componentType/variants/:variantName",
    (req, res) => {
      const { componentType, variantName } = req.params;

      const variantResult = deleteVariant(componentType, decodeURIComponent(variantName));
      if (!variantResult.success) {
        res.status(400).json({ error: variantResult.error });
        return;
      }

      const cwd = process.cwd();
      const allDeletedPaths = [
        variantResult.tsxPath,
        ...variantResult.deletedExamplePaths,
      ];
      const relPaths = allDeletedPaths.map((p) => path.relative(cwd, p));
      const exceptions = new Set(relPaths);
      for (const relPath of relPaths) {
        markFileAsModified(relPath, undefined, exceptions);
      }

      const pagesAffected = contentIndex.removeAllVariantSectionsFromPages(componentType, decodeURIComponent(variantName));

      res.json({
        success: true,
        deletedExamples: variantResult.deletedExamples,
        pagesAffected: pagesAffected.length,
      });
    }
  );

  app.get("/api/content/folder-files", (req, res) => {
    try {
      const folderPath = req.query.path as string;
      if (!folderPath) {
        res.status(400).json({ error: "Folder path is required" });
        return;
      }
      const normalizedPath = path.normalize(folderPath);
      if (
        !normalizedPath.startsWith("marketing-content/") ||
        normalizedPath.includes("..")
      ) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
      const entry = contentIndex.findByPath(normalizedPath);
      if (!entry) {
        res.status(404).json({ error: "Folder not found" });
        return;
      }
      res.json({ files: entry.files, directory: entry.directory });
    } catch (error) {
      console.error("Error listing folder:", error);
      res.status(500).json({ error: "Failed to list folder" });
    }
  });

  app.get("/api/content/resolve-folder", (req, res) => {
    try {
      const slug = req.query.slug as string;
      const type = req.query.type as string | undefined;
      if (!slug) {
        res.status(400).json({ error: "slug is required" });
        return;
      }
      const opts = type ? { contentType: type as any } : undefined;
      const matches = contentIndex.findBySlug(slug, opts);
      if (matches.length === 0) {
        res
          .status(404)
          .json({ error: "No content folder found for this slug" });
        return;
      }
      if (matches.length === 1) {
        const entry = matches[0];
        res.json({
          directory: entry.directory,
          contentType: entry.contentType,
          files: entry.files,
          title: entry.title,
        });
      } else {
        res.json({
          multiple: true,
          matches: matches.map((e) => ({
            directory: e.directory,
            contentType: e.contentType,
            files: e.files,
            title: e.title,
          })),
        });
      }
    } catch (error) {
      console.error("Error resolving folder:", error);
      res.status(500).json({ error: "Failed to resolve folder" });
    }
  });

  app.get("/api/content/index", (_req, res) => {
    try {
      const entries = contentIndex.listAll();
      const stats = contentIndex.getStats();
      res.json({ entries, stats });
    } catch (error) {
      console.error("Error listing content index:", error);
      res.status(500).json({ error: "Failed to list content index" });
    }
  });

  app.post("/api/content/index/refresh", (_req, res) => {
    try {
      contentIndex.refresh();
      const stats = contentIndex.getStats();
      res.json({ refreshed: true, stats });
    } catch (error) {
      console.error("Error refreshing content index:", error);
      res.status(500).json({ error: "Failed to refresh content index" });
    }
  });

  app.get("/api/content/file", (req, res) => {
    try {
      const filePath = req.query.path as string;

      if (!filePath) {
        res.status(400).json({ error: "File path is required" });
        return;
      }

      // Security: only allow files within marketing-content directory
      const normalizedPath = path.normalize(filePath);
      if (
        !normalizedPath.startsWith("marketing-content/") ||
        normalizedPath.includes("..")
      ) {
        res.status(403).json({
          error: "Access denied: Only marketing-content files allowed",
        });
        return;
      }

      const fullPath = path.join(process.cwd(), normalizedPath);

      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const content = fs.readFileSync(fullPath, "utf-8");
      res.type("text/yaml").send(content);
    } catch (error) {
      console.error("Error reading file:", error);
      res.status(500).json({ error: "Failed to read file" });
    }
  });

  app.get("/api/content/raw-file", (req, res) => {
    try {
      const contentType = req.query.contentType as string;
      const slug = req.query.slug as string;
      const locale = (req.query.locale as string) || getDefaultLocale();

      if (!contentType || !slug) {
        res.status(400).json({ error: "contentType and slug are required" });
        return;
      }

      if (!isValidType(contentType)) {
        res.status(400).json({ error: `Unknown content type: ${contentType}` });
        return;
      }
      const folder = getFolder(contentType);

      let resolvedSlug = slug;
      try {
        resolvedSlug = contentIndex.resolveBaseSlug(slug, folder);
      } catch {
        // keep original slug if resolution fails
      }

      const baseDir = path.join(process.cwd(), "marketing-content", folder);
      let contentDir = path.join(baseDir, resolvedSlug);

      if (!fs.existsSync(contentDir)) {
        const subdirs = fs.existsSync(baseDir)
          ? fs
              .readdirSync(baseDir, { withFileTypes: true })
              .filter((d) => d.isDirectory())
              .map((d) => d.name)
          : [];
        for (const dir of subdirs) {
          const candidateDir = path.join(baseDir, dir);
          const ymlFiles = fs
            .readdirSync(candidateDir)
            .filter((f) => f.endsWith(".yml") && f !== "_common.yml");
          for (const yf of ymlFiles) {
            try {
              const raw = fs.readFileSync(path.join(candidateDir, yf), "utf-8");
              const slugMatch = raw.match(/^slug:\s*(.+)$/m);
              if (slugMatch && slugMatch[1].trim() === slug) {
                resolvedSlug = dir;
                contentDir = candidateDir;
                break;
              }
            } catch {
              /* skip unreadable files */
            }
          }
          if (contentDir === candidateDir) break;
        }
      }

      const localePath = path.join(contentDir, `${locale}.yml`);
      const commonPath = path.join(contentDir, "_common.yml");

      const files: {
        locale?: { path: string; content: string };
        common?: { path: string; content: string };
      } = {};

      if (fs.existsSync(localePath)) {
        files.locale = {
          path: `marketing-content/${folder}/${resolvedSlug}/${locale}.yml`,
          content: fs.readFileSync(localePath, "utf-8"),
        };
      }
      if (fs.existsSync(commonPath)) {
        files.common = {
          path: `marketing-content/${folder}/${resolvedSlug}/_common.yml`,
          content: fs.readFileSync(commonPath, "utf-8"),
        };
      }

      if (!files.locale && !files.common) {
        res.status(404).json({ exists: false });
        return;
      }

      res.json({ exists: true, files, resolvedSlug });
    } catch (error) {
      console.error("Error reading raw content file:", error);
      res.status(500).json({ error: "Failed to read content file" });
    }
  });

  app.put("/api/content/raw-file", async (req, res) => {
    try {
      const rawFilePath: string = req.body.filePath || "";

      // Reject writes to internal data files that could be used for privilege escalation
      const PROTECTED_RAW_PATTERNS = [
        /\.users-state\.json$/,
        /\.users-state\.ya?ml$/,
        /image-registry\.json$/,
      ];
      if (PROTECTED_RAW_PATTERNS.some((p) => p.test(rawFilePath))) {
        res.status(403).json({ error: "Writing to this path is not permitted via raw-file" });
        return;
      }

      // Derive contentType from filePath (e.g. marketing-content/courses/... → "courses").
      // Reject when content type cannot be determined — unscoped writes are not allowed.
      const derivedContentType: string | undefined = (() => {
        const m = rawFilePath.match(/marketing-content\/([^/]+)\//);
        return m ? m[1] : undefined;
      })();
      if (!derivedContentType) {
        res.status(400).json({ error: "Cannot determine content type from filePath; path must be under marketing-content/<contentType>/" });
        return;
      }

      const auth = await requireCapability(req, res, "content_edit_default", derivedContentType);
      if (!auth.authorized) return;

      const {
        filePath,
        content,
        author: requestAuthor,
      } = req.body as {
        filePath: string;
        content: string;
        author?: string;
      };
      // Prefer server-resolved author (from Breathecode identity) over client-provided value
      const authorName = auth.author || (requestAuthor && typeof requestAuthor === "string" ? requestAuthor : undefined);

      if (!filePath || typeof content !== "string") {
        res.status(400).json({ error: "filePath and content are required" });
        return;
      }

      const normalizedPath = path.normalize(filePath);
      if (
        !normalizedPath.startsWith("marketing-content/") ||
        normalizedPath.includes("..")
      ) {
        res.status(403).json({
          error: "Access denied: Only marketing-content files allowed",
        });
        return;
      }

      const fullPath = path.join(process.cwd(), normalizedPath);
      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      fs.writeFileSync(fullPath, content, "utf-8");
      markFileAsModified(normalizedPath, authorName);
      clearSitemapCache();
      clearRedirectCache();
      contentIndex.refresh();

      // Derive content type from path (marketing-content/<folder>/...) for targeted invalidation
      const pathParts = normalizedPath.replace(/\\/g, "/").split("/");
      const folderSegment = pathParts[1]; // segment after "marketing-content"
      const resolvedType = folderSegment ? getType(folderSegment) : undefined;
      invalidateContentCaches(resolvedType);

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving raw content file:", error);
      res.status(500).json({ error: "Failed to save content file" });
    }
  });

  // Section Bindings API
  app.get("/api/bindings", (_req, res) => {
    try {
      const groups = bindingManager.getAll();
      const enrichedGroups = groups.map((g) => ({
        ...g,
        members: g.members.map((m) => ({
          ...m,
          localeSlug: contentIndex.getLocaleSlug(
            m.slug,
            m.contentType,
            g.locale,
          ),
          sectionIndex: bindingManager.resolveSectionIndex(
            m.contentType,
            m.slug,
            m.sectionId,
            g.locale,
          ),
        })),
      }));
      res.json({ groups: enrichedGroups });
    } catch (error) {
      console.error("Error fetching bindings:", error);
      res.status(500).json({ error: "Failed to fetch bindings" });
    }
  });

  app.get("/api/bindings/section", (req, res) => {
    try {
      const { contentType, slug, sectionIndex, locale } = req.query;
      if (!contentType || !slug || sectionIndex === undefined) {
        res
          .status(400)
          .json({ error: "Missing contentType, slug, or sectionIndex" });
        return;
      }
      const resolvedLocale = normalizeLocale((locale as string) || "en");
      const baseSlug = contentIndex.resolveBaseSlug(
        slug as string,
        contentType as string,
      );
      const group = bindingManager.findGroupForSectionByIndex(
        contentType as string,
        baseSlug,
        parseInt(sectionIndex as string, 10),
        resolvedLocale,
      );
      if (!group) {
        res.json({ group: null });
        return;
      }
      const enrichedGroup = {
        ...group,
        members: group.members.map((m) => ({
          ...m,
          localeSlug: contentIndex.getLocaleSlug(
            m.slug,
            m.contentType,
            group.locale,
          ),
          sectionIndex: bindingManager.resolveSectionIndex(
            m.contentType,
            m.slug,
            m.sectionId,
            group.locale,
          ),
        })),
      };
      res.json({ group: enrichedGroup });
    } catch (error) {
      console.error("Error finding binding for section:", error);
      res.status(500).json({ error: "Failed to find binding" });
    }
  });

  app.get("/api/bindings/candidates", (req, res) => {
    try {
      const { component, locale } = req.query;
      if (!component || !locale) {
        res.status(400).json({ error: "Missing component or locale" });
        return;
      }

      const normalizedLocale = normalizeLocale(locale as string);
      const allEntries = contentIndex.listAll();
      const candidates: Array<{
        contentType: string;
        slug: string;
        localeSlug: string;
        sectionIndex: number;
        sectionId?: string;
        title?: string;
        alreadyBound?: string;
        alreadyBoundGroupName?: string;
      }> = [];

      for (const entry of allEntries) {
        const entryContentType = entry.contentType.replace(/s$/, "");
        if (!entry.locales.includes(normalizedLocale))
          continue;

        try {
          const localeForLoad = normalizedLocale;
          const { data: merged } = contentIndex.loadMergedContent(
            entryContentType,
            entry.slug,
            localeForLoad,
          );
          if (!merged) continue;
          const sections = merged.sections as Record<string, unknown>[];
          if (!Array.isArray(sections)) continue;

          for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            if (section && section.type === component) {
              const existingGroup = bindingManager.findGroupForSectionByIndex(
                entryContentType,
                entry.slug,
                i,
                normalizedLocale,
              );
              const sameLocaleGroup = existingGroup;
              candidates.push({
                contentType: entryContentType,
                slug: entry.slug,
                localeSlug: contentIndex.getLocaleSlug(
                  entry.slug,
                  entryContentType,
                  normalizedLocale,
                ),
                sectionIndex: i,
                sectionId: (section as Record<string, unknown>).section_id as
                  | string
                  | undefined,
                title:
                  ((merged.meta as Record<string, unknown>)?.title as string) ||
                  entry.title ||
                  entry.slug,
                alreadyBound: sameLocaleGroup?.id,
                alreadyBoundGroupName: sameLocaleGroup?.name,
              });
            }
          }
        } catch {
          // skip entries that fail to parse
        }
      }

      res.json({ candidates });
    } catch (error) {
      console.error("Error finding binding candidates:", error);
      res.status(500).json({ error: "Failed to find candidates" });
    }
  });

  const requireEditAuth = (
    req: import("express").Request,
    res: import("express").Response,
  ): boolean => {
    const isDevelopment = process.env.NODE_ENV !== "production";
    if (isDevelopment) return true;
    const authHeader = req.headers.authorization;
    const debugToken = req.headers["x-debug-token"] as string | undefined;
    if (!authHeader?.startsWith("Token ") && !debugToken) {
      res.status(401).json({ error: "Authorization required" });
      return false;
    }
    return true;
  };

  app.post("/api/bindings", (req, res) => {
    try {
      if (!requireEditAuth(req, res)) return;
      const { component, locale, members, author: bindAuthor } = req.body;
      const bindAuthorName =
        bindAuthor && typeof bindAuthor === "string" ? bindAuthor : undefined;
      if (
        !component ||
        !locale ||
        !Array.isArray(members) ||
        members.length < 2
      ) {
        res.status(400).json({
          error: "Missing component, locale, or need at least 2 members",
        });
        return;
      }
      const normalizedLocale = normalizeLocale(locale);
      const resolvedMembers = members.map(
        (m: { contentType: string; slug: string; sectionIndex: number }) => {
          const memberBaseSlug = contentIndex.resolveBaseSlug(
            m.slug,
            m.contentType,
          );
          const sectionId = bindingManager.ensureSectionId(
            m.contentType,
            memberBaseSlug,
            m.sectionIndex,
            normalizedLocale,
            bindAuthorName,
          );
          return {
            contentType: m.contentType,
            slug: memberBaseSlug,
            sectionId,
          };
        },
      );
      const { name, sourceIndex } = req.body;
      const group = bindingManager.createGroup(
        component,
        normalizedLocale,
        resolvedMembers,
        {
          name,
          sourceIndex,
        },
        bindAuthorName,
      );
      const enrichedGroup = {
        ...group,
        members: group.members.map((m) => ({
          ...m,
          localeSlug: contentIndex.getLocaleSlug(
            m.slug,
            m.contentType,
            group.locale,
          ),
          sectionIndex: bindingManager.resolveSectionIndex(
            m.contentType,
            m.slug,
            m.sectionId,
            group.locale,
          ),
        })),
      };
      res.json({ group: enrichedGroup });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to create binding";
      console.error("Error creating binding:", error);
      res.status(400).json({ error: msg });
    }
  });

  app.patch("/api/bindings/:groupId", (req, res) => {
    try {
      if (!requireEditAuth(req, res)) return;
      const { groupId } = req.params;
      const { name, author: renameBindAuthor } = req.body;
      const renameBindAuthorName =
        renameBindAuthor && typeof renameBindAuthor === "string"
          ? renameBindAuthor
          : undefined;
      if (name === undefined) {
        res.status(400).json({ error: "Missing name field" });
        return;
      }
      const group = bindingManager.renameGroup(
        groupId,
        name,
        renameBindAuthorName,
      );
      res.json({ group });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to rename binding";
      console.error("Error renaming binding:", error);
      res.status(400).json({ error: msg });
    }
  });

  app.post("/api/bindings/:groupId/members", (req, res) => {
    try {
      if (!requireEditAuth(req, res)) return;
      const { groupId } = req.params;
      const {
        contentType,
        slug,
        sectionIndex,
        author: addMemberAuthor,
      } = req.body;
      const addMemberAuthorName =
        addMemberAuthor && typeof addMemberAuthor === "string"
          ? addMemberAuthor
          : undefined;
      if (!contentType || !slug || sectionIndex === undefined) {
        res
          .status(400)
          .json({ error: "Missing contentType, slug, or sectionIndex" });
        return;
      }
      const group = bindingManager.getGroupById(groupId);
      if (!group) {
        res.status(404).json({ error: "Binding group not found" });
        return;
      }
      const addBaseSlug = contentIndex.resolveBaseSlug(slug, contentType);
      const sectionId = bindingManager.ensureSectionId(
        contentType,
        addBaseSlug,
        parseInt(sectionIndex as string, 10),
        group.locale,
        addMemberAuthorName,
      );
      const updatedGroup = bindingManager.addMember(
        groupId,
        {
          contentType,
          slug: addBaseSlug,
          sectionId,
        },
        addMemberAuthorName,
      );
      const enrichedGroup = {
        ...updatedGroup,
        members: updatedGroup.members.map((m) => ({
          ...m,
          localeSlug: contentIndex.getLocaleSlug(
            m.slug,
            m.contentType,
            updatedGroup.locale,
          ),
          sectionIndex: bindingManager.resolveSectionIndex(
            m.contentType,
            m.slug,
            m.sectionId,
            updatedGroup.locale,
          ),
        })),
      };
      res.json({ group: enrichedGroup });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to add member";
      console.error("Error adding binding member:", error);
      res.status(400).json({ error: msg });
    }
  });

  app.delete("/api/bindings/:groupId/members", (req, res) => {
    try {
      if (!requireEditAuth(req, res)) return;
      const { groupId } = req.params;
      const {
        contentType,
        slug,
        sectionIndex,
        author: removeMemberAuthor,
      } = req.body;
      const removeMemberAuthorName =
        removeMemberAuthor && typeof removeMemberAuthor === "string"
          ? removeMemberAuthor
          : undefined;
      if (!contentType || !slug || sectionIndex === undefined) {
        res
          .status(400)
          .json({ error: "Missing contentType, slug, or sectionIndex" });
        return;
      }
      const group = bindingManager.getGroupById(groupId);
      if (!group) {
        res.status(404).json({ error: "Binding group not found" });
        return;
      }
      const removeBaseSlug = contentIndex.resolveBaseSlug(slug, contentType);
      const sectionId = bindingManager.getSectionIdAtIndex(
        contentType,
        removeBaseSlug,
        parseInt(sectionIndex as string, 10),
        group.locale,
      );
      if (!sectionId) {
        res
          .status(400)
          .json({
            error: `No section_id found at index ${sectionIndex} for ${contentType}/${removeBaseSlug}`,
          });
        return;
      }
      const result = bindingManager.removeMemberBySectionId(
        groupId,
        contentType,
        removeBaseSlug,
        sectionId,
        removeMemberAuthorName,
      );
      if (result) {
        const enrichedResult = {
          ...result,
          members: result.members.map((m) => ({
            ...m,
            localeSlug: contentIndex.getLocaleSlug(
              m.slug,
              m.contentType,
              result.locale,
            ),
            sectionIndex: bindingManager.resolveSectionIndex(
              m.contentType,
              m.slug,
              m.sectionId,
              result.locale,
            ),
          })),
        };
        res.json({ group: enrichedResult });
      } else {
        res.json({ group: null });
      }
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to remove member";
      console.error("Error removing binding member:", error);
      res.status(400).json({ error: msg });
    }
  });

  app.delete("/api/bindings/:groupId", (req, res) => {
    try {
      if (!requireEditAuth(req, res)) return;
      const { groupId } = req.params;
      const { author: deleteGroupAuthor } = req.body || {};
      const deleteGroupAuthorName =
        deleteGroupAuthor && typeof deleteGroupAuthor === "string"
          ? deleteGroupAuthor
          : undefined;
      bindingManager.deleteGroup(groupId, deleteGroupAuthorName);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting binding:", error);
      res.status(500).json({ error: "Failed to delete binding" });
    }
  });

  app.post("/api/bindings/cleanup", (req, res) => {
    try {
      if (!requireEditAuth(req, res)) return;
      const removed = bindingManager.cleanupStaleReferences();
      res.json({ removed });
    } catch (error) {
      console.error("Error cleaning up bindings:", error);
      res.status(500).json({ error: "Failed to cleanup bindings" });
    }
  });

  // Content editing API (sections only — writes to locale files)
  app.post("/api/content/edit-sections", async (req, res) => {
    try {
      // Support both formats:
      // 1. Original: { contentType, slug, locale, operations: [...] }
      // 2. Simplified: { contentType, slug, locale, operation, sectionIndex, sectionData, variant, version }
      const {
        contentType,
        slug,
        locale,
        operations,
        operation,
        sectionIndex,
        sectionData,
        variant,
        version,
        author: requestAuthor,
      } = req.body;

      // Resolve effective variant before capability selection
      const effectiveVariant =
        variant && variant !== "default" ? variant : undefined;

      // Determine required capability from the operation(s) in the payload.
      // Structural ops (add/remove/reorder/duplicate) require content_edit_structure.
      // update_section targeting a named variant requires content_edit_variant.
      // update_section targeting default content requires content_edit_default.
      const STRUCTURAL_ACTIONS = new Set([
        "add_section", "remove_section", "reorder_sections", "duplicate_section",
      ]);
      let requiredCap: CapabilityName;
      if (Array.isArray(operations) && operations.length > 0) {
        const hasStructural = operations.some((op: { action: string }) => STRUCTURAL_ACTIONS.has(op.action));
        const hasUpdate = operations.some((op: { action: string }) => op.action === "update_section");
        if (hasStructural) {
          requiredCap = "content_edit_structure";
        } else if (hasUpdate && effectiveVariant) {
          requiredCap = "content_edit_variant";
        } else {
          requiredCap = "content_edit_default";
        }
      } else if (operation === "update_section") {
        requiredCap = effectiveVariant ? "content_edit_variant" : "content_edit_default";
      } else {
        // add/remove/reorder or other structural single-ops
        requiredCap = "content_edit_structure";
      }

      const auth = await requireCapability(req, res, requiredCap, contentType || undefined);
      if (!auth.authorized) return;

      // Use server-resolved author from identity; fall back to client-provided value
      const authorName = auth.author || (requestAuthor && typeof requestAuthor === "string" ? requestAuthor : undefined);

      if (!contentType || !slug || !locale) {
        res.status(400).json({
          error: "Missing required fields: contentType, slug, locale",
        });
        return;
      }

      // Build operations array if using simplified format (only for update_section)
      let finalOperations = operations;
      if (!operations && operation === "update_section") {
        if (
          sectionIndex === undefined ||
          sectionData === undefined ||
          sectionData === null
        ) {
          res.status(400).json({
            error: "update_section requires sectionIndex and sectionData",
          });
          return;
        }
        finalOperations = [
          {
            action: "update_section",
            index: sectionIndex,
            section: sectionData,
          },
        ];
      }

      if (
        !finalOperations ||
        !Array.isArray(finalOperations) ||
        finalOperations.length === 0
      ) {
        res.status(400).json({ error: "Missing operations" });
        return;
      }

      const effectiveVersion =
        effectiveVariant && version !== undefined ? version : undefined;

      const result = await editContent({
        contentType,
        slug,
        locale,
        operations: finalOperations,
        variant: effectiveVariant,
        version: effectiveVersion,
        author: authorName,
      });

      if (result.success) {
        clearSitemapCache();
        clearRedirectCache();
        contentIndex.refresh();
        invalidateContentCaches(contentType);

        // Propagate to bound sections if this was a section update
        let bindingWarnings: string[] = [];
        const updateSectionOp = finalOperations.find(
          (op: { action: string }) => op.action === "update_section",
        );
        if (updateSectionOp && !effectiveVariant) {
          const sIdx = updateSectionOp.index as number;
          const updatedSections = result.updatedSections as
            | Record<string, unknown>[]
            | undefined;
          const updatedSection = updatedSections?.[sIdx];
          if (updatedSection) {
            const normalizedLocaleForBinding = normalizeLocale(locale);
            const baseSlugForBinding = contentIndex.resolveBaseSlug(slug, contentType);
            const propagation = bindingManager.propagateUpdate(
              contentType,
              baseSlugForBinding,
              sIdx,
              updatedSection,
              authorName,
              normalizedLocaleForBinding,
            );
            if (propagation.errors.length > 0) {
              bindingWarnings = propagation.errors;
            }
            if (propagation.updatedFiles.length > 0) {
              contentIndex.refresh();
            }

            // Audit log: EDIT entry with section context
            try {
              const { logSync: _logSyncEdit } = await import("./sync-log");
              const sectionType = (updatedSection as Record<string, unknown>).type as string || `section-${sIdx}`;
              const affectedCount = propagation.updatedFiles.length;
              const editMsg = `${sectionType} section updated on ${slug}/${locale}${affectedCount > 0 ? ` → propagated to ${affectedCount} bound page(s)` : ""}`;
              const editMeta: Record<string, unknown> = { contentType, slug, locale, sectionIndex: sIdx, sectionType };
              if (affectedCount > 0) {
                editMeta.affectedPages = propagation.updatedFiles.map(f => f.replace("marketing-content/", ""));
              }
              _logSyncEdit("EDIT", editMsg, authorName, editMeta);
            } catch { /* non-fatal */ }
          }
        }

        // Return success with updated sections for immediate UI update
        const response: {
          success: boolean;
          updatedSections?: unknown;
          warning?: string;
          boundUpdates?: string[];
        } = {
          success: true,
          updatedSections: result.updatedSections,
        };
        if (result.warning) {
          response.warning = result.warning;
        }
        if (bindingWarnings.length > 0) {
          response.warning =
            (response.warning ? response.warning + "\n" : "") +
            "Binding propagation warnings: " +
            bindingWarnings.join("; ");
        }
        res.json(response);
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error("Content edit error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/content/mark-modified", (req, res) => {
    try {
      const { path: filePath } = req.body as { path?: string };
      if (!filePath || typeof filePath !== "string") {
        res.status(400).json({ error: "path is required" });
        return;
      }
      markFileAsModified(filePath);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.post("/api/content/edit-common", async (req, res) => {
    try {
      const auth = await requireCapability(req, res, "content_edit_text", req.body.contentType || undefined);
      if (!auth.authorized) return;

      const { contentType, slug, operations, author: requestAuthor } = req.body;

      if (
        !contentType ||
        !slug ||
        !Array.isArray(operations) ||
        operations.length === 0
      ) {
        res
          .status(400)
          .json({
            error:
              "Missing required fields: contentType, slug, operations (array)",
          });
        return;
      }

      // Prefer server-resolved author (from Breathecode identity) over client-provided value
      const authorName = auth.author || (requestAuthor && typeof requestAuthor === "string" ? requestAuthor : undefined);

      const result = editCommonContent({
        contentType,
        slug,
        operations,
        author: authorName,
      });

      if (result.success) {
        clearSitemapCache();
        clearRedirectCache();
        contentIndex.refresh();
        invalidateContentCaches(contentType);
        res.json({ success: true });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error("Common content edit error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/content/rename-slug", async (req, res) => {
    try {
      const auth = await requireCapability(req, res, "content_edit_structure", req.body.contentType || undefined);
      if (!auth.authorized) return;

      const {
        contentType,
        folderSlug,
        locale,
        newSlug,
        createRedirect,
        author: renameAuthor,
      } = req.body;
      // Prefer server-resolved author (from Breathecode identity) over client-provided value
      const renameAuthorName = auth.author || (renameAuthor && typeof renameAuthor === "string" ? renameAuthor : undefined);

      if (!contentType || !folderSlug || !locale || !newSlug) {
        res.status(400).json({
          error:
            "Missing required fields: contentType, folderSlug, locale, newSlug",
        });
        return;
      }

      if (!isValidType(contentType)) {
        res.status(400).json({
          error: `Invalid type. Must be one of: ${getAllTypes().join(", ")}`,
        });
        return;
      }

      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(newSlug)) {
        res.status(400).json({
          error:
            "Invalid slug format. Use lowercase letters, numbers, and hyphens only.",
        });
        return;
      }

      const contentFolder = getFolder(contentType);
      const resolvedFolderSlug = contentIndex.resolveBaseSlug(
        folderSlug,
        contentFolder,
      );
      const folderPath = path.join(
        process.cwd(),
        "marketing-content",
        contentFolder,
        resolvedFolderSlug,
      );

      if (!fs.existsSync(folderPath)) {
        res.status(404).json({
          error: `Content folder not found: ${folderSlug} (resolved: ${resolvedFolderSlug})`,
        });
        return;
      }

      const effectiveLocale = contentType === "landing"
        ? ((contentIndex.loadCommonData("landing", resolvedFolderSlug)?.locale as string) || locale)
        : locale;
      const localeFile = [
        `${effectiveLocale}.yml`,
        `${effectiveLocale}.yaml`,
      ].find((f) => fs.existsSync(path.join(folderPath, f)));
      if (!localeFile) {
        res
          .status(404)
          .json({ error: `Locale file not found: ${effectiveLocale}` });
        return;
      }

      const localeFilePath = path.join(folderPath, localeFile);
      const raw = fs.readFileSync(localeFilePath, "utf-8");
      const parsed = safeYamlLoad(raw) as Record<string, unknown> | null;
      if (!parsed) {
        res.status(500).json({ error: "Failed to parse locale file" });
        return;
      }

      const currentSlug = (parsed.slug as string) || folderSlug;
      if (currentSlug === newSlug) {
        res.status(400).json({ error: "New slug is the same as current slug" });
        return;
      }

      const oldUrl = contentIndex.buildUrl(
        contentFolder,
        effectiveLocale,
        currentSlug,
      );
      const newUrl = contentIndex.buildUrl(
        contentFolder,
        effectiveLocale,
        newSlug,
      );

      parsed.slug = newSlug;

      if (createRedirect) {
        const meta = (parsed.meta || {}) as Record<string, unknown>;
        const redirects = Array.isArray(meta.redirects)
          ? [...meta.redirects]
          : [];
        if (!redirects.includes(oldUrl)) {
          redirects.push(oldUrl);
        }
        meta.redirects = redirects;
        parsed.meta = meta;
      }

      const updated = safeYamlDump(parsed, { lineWidth: -1, noRefs: true });
      fs.writeFileSync(localeFilePath, updated, "utf-8");
      markFileAsModified(
        `marketing-content/${contentFolder}/${resolvedFolderSlug}/${localeFile}`,
        renameAuthorName,
      );

      contentIndex.refresh();
      clearSitemapCache();
      clearRedirectCache();
      invalidateContentCaches(contentType);

      res.json({
        success: true,
        folderSlug: resolvedFolderSlug,
        oldSlug: currentSlug,
        newSlug,
        oldUrl,
        newUrl,
        locale: effectiveLocale,
        redirectCreated: !!createRedirect,
      });
    } catch (error) {
      console.error("[Content] Rename slug error:", error);
      res.status(500).json({ error: "Failed to rename slug" });
    }
  });

  // Check if a slug is available for a given content type
  app.get("/api/content/check-slug", (req, res) => {
    const { type, slug } = req.query;

    if (
      !type ||
      !slug ||
      typeof type !== "string" ||
      typeof slug !== "string"
    ) {
      res
        .status(400)
        .json({ error: "Missing required query params: type, slug" });
      return;
    }

    if (!isValidType(type)) {
      res.status(400).json({
        error: `Invalid type. Must be one of: ${getAllTypes().join(", ")}`,
      });
      return;
    }

    const folderPath = path.join(
      process.cwd(),
      "marketing-content",
      getFolder(type),
      slug,
    );

    if (slug.startsWith("_")) {
      res.json({ available: false, slug, type, reason: "Reserved prefix" });
      return;
    }

    const folderExists = fs.existsSync(folderPath);

    if (folderExists) {
      const hasCommon = fs.existsSync(path.join(folderPath, "_common.yml"));
      const hasLocaleFile = getSupportedLocales().some(loc =>
        fs.existsSync(path.join(folderPath, `${loc}.yml`))
      );
      if (hasCommon && hasLocaleFile) {
        res.json({ available: false, slug, type, reason: "slug_taken" });
        return;
      }
    }

    const locale =
      typeof req.query.locale === "string" ? req.query.locale : undefined;
    const urlsToCheck: string[] = [];
    const contentTypeMap: Record<string, string> = {
      location: "locations",
      page: "pages",
      program: "programs",
      landing: "landings",
    };
    const ctKey = contentTypeMap[type];
    if (type === "landing") {
      urlsToCheck.push(contentIndex.buildUrl(ctKey, "default", slug));
    } else if (locale) {
      urlsToCheck.push(contentIndex.buildUrl(ctKey, locale, slug));
    } else {
      for (const loc of getSupportedLocales()) {
        urlsToCheck.push(contentIndex.buildUrl(ctKey, loc, slug));
      }
    }

    const redirects = contentIndex.getRedirects();
    for (const url of urlsToCheck) {
      const conflict = redirects.find((r) => r.from === url);
      if (conflict) {
        const redirectTo =
          typeof conflict.to === "string"
            ? conflict.to
            : Object.values(conflict.to).join(", ");
        res.json({
          available: false,
          slug,
          type,
          reason: "redirect_conflict",
          conflictUrl: url,
          redirectTo,
        });
        return;
      }
    }

    res.json({ available: true, slug, type });
  });

  app.get("/api/content/check-origin", (req, res) => {
    const { path: originPath } = req.query;
    if (!originPath || typeof originPath !== "string") {
      res.status(400).json({ error: "Missing required query param: path" });
      return;
    }

    const normalized = originPath.startsWith("/")
      ? originPath
      : `/${originPath}`;

    const redirects = contentIndex.getRedirects();
    const existingRedirect = redirects.find((r) => r.from === normalized);
    if (existingRedirect) {
      const redirectTo =
        typeof existingRedirect.to === "string"
          ? existingRedirect.to
          : Object.values(existingRedirect.to).join(", ");
      res.json({
        taken: true,
        reason: "existing_redirect",
        details: `Already redirects to ${redirectTo}`,
      });
      return;
    }

    const entries = contentIndex.listAll();
    const contentTypeMap: Record<string, string> = {
      locations: "locations",
      pages: "pages",
      programs: "programs",
      landings: "landings",
    };
    for (const entry of entries) {
      const ctKey = contentTypeMap[entry.contentType] || entry.contentType;
      for (const locale of entry.locales) {
        if (locale.startsWith("_") || locale.includes(".")) continue;
        const url = contentIndex.buildUrl(ctKey, locale, entry.slug);
        if (url === normalized) {
          res.json({
            taken: true,
            reason: "existing_page",
            details: `This is the "${entry.title || entry.slug}" ${entry.contentType} page (${locale})`,
          });
          return;
        }
      }
    }

    res.json({ taken: false });
  });

  function formatValidationError(type: string, raw: string): string {
    try {
      const match = raw.match(/(\[[\s\S]*\])/);
      if (match) {
        const issues = JSON.parse(match[1]) as Array<{ path: string[]; message: string }>;
        const fieldErrors = issues.map(i => `"${i.path.join(".")}" ${i.message}`).join("; ");
        return `Cannot save ${type}: ${fieldErrors}`;
      }
    } catch {}
    return `Cannot save ${type}: ${raw}`;
  }

  // Create new content (location/page/program)
  app.post("/api/content/create", async (req, res) => {
    try {
      const auth = await requireCapability(req, res, "content_create_entry", req.body.type || undefined);
      if (!auth.authorized) return;

      const {
        type,
        slugEn,
        slugEs,
        title,
        sourceUrl,
        changeContentType,
        author: createAuthor,
        skipLocales: rawSkipLocales,
        uniqueFieldValues: rawUniqueFieldValues,
        localeTitles: rawLocaleTitles,
      } = req.body;
      // Prefer server-resolved author (from Breathecode identity) over client-provided value
      const createAuthorName = auth.author || (createAuthor && typeof createAuthor === "string" ? createAuthor : undefined);
      const skipLocales: string[] = Array.isArray(rawSkipLocales)
        ? rawSkipLocales.filter((l: unknown) => typeof l === "string")
        : [];
      const uniqueFieldValues: Record<string, string | boolean> =
        rawUniqueFieldValues && typeof rawUniqueFieldValues === "object"
          ? Object.fromEntries(
              Object.entries(rawUniqueFieldValues).filter(
                ([, v]) => typeof v === "string" || typeof v === "boolean",
              ),
            )
          : {};
      const localeTitles: Record<string, string> =
        rawLocaleTitles && typeof rawLocaleTitles === "object"
          ? Object.fromEntries(
              Object.entries(rawLocaleTitles).filter(
                ([, v]) => typeof v === "string",
              ),
            )
          : {};

      // Support both old format (slug) and new format (slugEn/slugEs)
      const skipEn = skipLocales.includes("en");
      const skipEs = skipLocales.includes("es");
      const enSlug = skipEn ? null : slugEn || req.body.slug;
      const esSlug = skipEs ? null : slugEs || req.body.slug;

      if (!type || !title) {
        res.status(400).json({ error: "Missing required fields: type, title" });
        return;
      }

      if (!enSlug && !esSlug) {
        res
          .status(400)
          .json({ error: "At least one locale slug must be provided" });
        return;
      }

      if (!isValidType(type)) {
        res.status(400).json({
          error: `Invalid type. Must be one of: ${getAllTypes().join(", ")}`,
        });
        return;
      }

      // Validate slug format for provided slugs
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (enSlug && !slugRegex.test(enSlug)) {
        res.status(400).json({
          error:
            "Invalid English slug format. Use lowercase letters, numbers, and hyphens only.",
        });
        return;
      }
      if (esSlug && !slugRegex.test(esSlug)) {
        res.status(400).json({
          error:
            "Invalid Spanish slug format. Use lowercase letters, numbers, and hyphens only.",
        });
        return;
      }

      // Use English slug for folder name (primary identifier), fall back to Spanish if EN is skipped
      const folderSlug = enSlug || esSlug;

      const existingTypeSlugs = contentIndex.listContentSlugs(type);
      if (existingTypeSlugs.includes(folderSlug!)) {
        res
          .status(409)
          .json({
            error: `A ${type} with slug "${folderSlug}" already exists`,
          });
        return;
      }

      const folderPath = path.join(
        process.cwd(),
        "marketing-content",
        getFolder(type),
        folderSlug!,
      );

      if (fs.existsSync(folderPath)) {
        res
          .status(409)
          .json({
            error: `A ${type} with slug "${folderSlug}" already exists`,
          });
        return;
      }

      // Create folder
      fs.mkdirSync(folderPath, { recursive: true });

      // If duplicating from source, copy content from source page
      if (sourceUrl) {
        try {
          const sourceUrlObj = new URL(sourceUrl);
          const sourcePath = sourceUrlObj.pathname;
          const pathParts = sourcePath.split("/").filter(Boolean);
          const sourceLocale = pathParts[0] === "es" ? "es" : "en";

          const resolved = contentIndex.resolveUrl(sourcePath);
          const foundSourceFolder = resolved
            ? path.join(process.cwd(), resolved.entry.directory)
            : "";

          if (foundSourceFolder) {
            if (changeContentType && resolved && resolved.contentType !== type) {
              const result = contentIndex.duplicateWithTypeChange({
                sourceDir: foundSourceFolder,
                sourceType: resolved.contentType,
                targetType: type,
                targetDir: folderPath,
                newSlugs: { en: enSlug || undefined, es: esSlug || undefined },
                title: title || folderSlug!,
                skipLocales,
                localeTitles,
              });

              for (const file of result.copiedFiles) {
                markFileAsModified(
                  `marketing-content/${getFolder(type)}/${folderSlug}/${file}`,
                  createAuthorName,
                );
              }

              clearSitemapCache();
              contentIndex.refresh();
              invalidateContentCaches(type);

              const localesToValidate1 = getSupportedLocales().filter(l => !skipLocales.includes(l) && fs.existsSync(path.join(folderPath, `${l}.yml`)));
              for (const locale of localesToValidate1) {
                const { error: validationError } = contentIndex.loadMergedContent(type, folderSlug!, locale);
                if (validationError) {
                  fs.rmSync(folderPath, { recursive: true, force: true });
                  contentIndex.refresh();
                  res.status(400).json({ error: formatValidationError(type, validationError) });
                  return;
                }
              }

              res.json({
                success: true,
                slugEn: enSlug,
                slugEs: esSlug,
                type,
                directory: `marketing-content/${getFolder(type)}/${folderSlug}`,
                duplicatedFrom: sourceUrl,
                typeChanged: true,
                conversion: {
                  from: resolved.contentType,
                  to: type,
                  copiedFiles: result.copiedFiles,
                  strippedFields: result.strippedFields,
                  replacedVars: result.replacedVars,
                },
              });
              return;
            }

            // Same-type duplication: parse all files first, regenerate section IDs, then write
            const sourceFiles = fs.readdirSync(foundSourceFolder);
            const parsedDupFiles: Array<{ file: string; parsed: Record<string, unknown> }> = [];

            // Track which locale files are present in the source
            const sourceLocaleFiles = new Set(
              sourceFiles.filter(f => f.endsWith(".yml") || f.endsWith(".yaml")).map(f => f.replace(/\.ya?ml$/, ""))
            );

            for (const file of sourceFiles) {
              const fileLocale = file.replace(/\.yml$/, "");
              if (
                fileLocale !== "_common" &&
                skipLocales.includes(fileLocale)
              ) {
                continue;
              }
              if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;

              const raw = fs.readFileSync(
                path.join(foundSourceFolder, file),
                "utf8",
              );

              const parsed = safeYamlLoad(raw) as Record<string, unknown> | null;
              if (!parsed) {
                fs.writeFileSync(path.join(folderPath, file), raw);
                markFileAsModified(
                  `marketing-content/${getFolder(type)}/${folderSlug}/${file}`,
                  createAuthorName,
                );
                continue;
              }

              delete parsed.redirects;
              if (parsed.meta && typeof parsed.meta === "object") {
                delete (parsed.meta as Record<string, unknown>).redirects;
              }

              const newSlug =
                file === "es.yml"
                  ? esSlug || folderSlug!
                  : enSlug || folderSlug!;
              parsed.slug = newSlug;

              if (file === "_common.yml") {
                parsed.title = title;
                for (const [fieldName, newValue] of Object.entries(uniqueFieldValues)) {
                  if (fieldName === "slug" || fieldName === "title") continue;
                  parsed[fieldName] = coerceToOriginalType(newValue, parsed[fieldName]);
                }
              } else if (file === "en.yml" || file === "es.yml") {
                const locTitle = localeTitles[fileLocale] || title;
                parsed.title = locTitle;
                if (locTitle) {
                  if (!parsed.meta || typeof parsed.meta !== "object") parsed.meta = {};
                  (parsed.meta as Record<string, unknown>).page_title = locTitle;
                }
              }

              parsedDupFiles.push({ file, parsed });
            }

            // For any requested locale not present in the source, synthesize from an existing locale file
            const supportedLocs = getSupportedLocales();
            const existingSourceLocale = supportedLocs.find(l => sourceLocaleFiles.has(l));
            if (existingSourceLocale) {
              for (const loc of supportedLocs) {
                if (skipLocales.includes(loc)) continue;
                if (sourceLocaleFiles.has(loc)) continue; // already handled above
                // Clone from existing source locale file
                const srcRaw = fs.readFileSync(
                  path.join(foundSourceFolder, `${existingSourceLocale}.yml`),
                  "utf8",
                );
                const cloned = safeYamlLoad(srcRaw) as Record<string, unknown> | null;
                if (!cloned) continue;
                delete cloned.redirects;
                if (cloned.meta && typeof cloned.meta === "object") {
                  delete (cloned.meta as Record<string, unknown>).redirects;
                }
                cloned.slug = loc === "es" ? (esSlug || folderSlug!) : (enSlug || folderSlug!);
                cloned.locale = loc;
                const clonedTitle = localeTitles[loc] || title;
                cloned.title = clonedTitle;
                if (clonedTitle) {
                  if (!cloned.meta || typeof cloned.meta !== "object") cloned.meta = {};
                  (cloned.meta as Record<string, unknown>).page_title = clonedTitle;
                }
                parsedDupFiles.push({ file: `${loc}.yml`, parsed: cloned });
              }
            }

            const allParsedDup = parsedDupFiles.map(f => f.parsed);
            const { objs: regeneratedDup } = regenerateSectionIds(allParsedDup);
            for (let i = 0; i < parsedDupFiles.length; i++) {
              const { file } = parsedDupFiles[i];
              const content = safeYamlDump(regeneratedDup[i], { lineWidth: 120, noRefs: true, sortKeys: false });
              fs.writeFileSync(path.join(folderPath, file), content);
              markFileAsModified(
                `marketing-content/${getFolder(type)}/${folderSlug}/${file}`,
                createAuthorName,
              );
            }


            clearSitemapCache();
            contentIndex.refresh();
            invalidateContentCaches(type);

            const localesToValidate2 = getSupportedLocales().filter(l => !skipLocales.includes(l) && fs.existsSync(path.join(folderPath, `${l}.yml`)));
            for (const locale of localesToValidate2) {
              const { error: validationError } = contentIndex.loadMergedContent(type, folderSlug!, locale);
              if (validationError) {
                fs.rmSync(folderPath, { recursive: true, force: true });
                contentIndex.refresh();
                res.status(400).json({ error: formatValidationError(type, validationError) });
                return;
              }
            }

            res.json({
              success: true,
              slugEn: enSlug,
              slugEs: esSlug,
              type,
              directory: `marketing-content/${getFolder(type)}/${folderSlug}`,
              duplicatedFrom: sourceUrl,
            });
            return;
          }
        } catch (dupError) {
          console.error("Error duplicating content:", dupError);
          // Fall through to create new content if duplication fails
        }
      }

      // Build starter YAML files from field_mapping (no hardcoded per-type templates)
      const typeConfig = getContentTypeConfig(type);
      const fieldMappingRaw = typeConfig?.field_mapping ?? {};
      const fieldKeys = Object.keys(fieldMappingRaw).filter(
        (k) => !k.startsWith("_"),
      );

      // Active locale for types that carry a locale field (e.g. landing)
      const activeLocale =
        getSupportedLocales().find((l) => !skipLocales.includes(l)) ??
        getDefaultLocale();

      // _common.yml: build object from field_mapping, then serialize
      const commonObj: Record<string, unknown> = {};
      for (const key of fieldKeys) {
        if (key === "slug") {
          commonObj.slug = folderSlug;
        } else if (key === "title") {
          commonObj.title = title;
        } else if (key === "locale") {
          commonObj.locale = activeLocale;
        } else if (uniqueFieldValues[key] !== undefined) {
          const ufv = uniqueFieldValues[key];
          commonObj[key] = typeof ufv === "boolean" ? ufv : coerceStringValue(ufv);
        } else {
          commonObj[key] = "";
        }
      }
      const commonYml = yaml.dump(commonObj, { lineWidth: 120, noRefs: true, sortKeys: false });

      // Locale files: minimal starter — _common.single.yml provides meta/schema defaults
      const makeLocaleObj = (slug: string, loc: string) => {
        const obj: Record<string, unknown> = { slug, sections: [] };
        const localeTitle = localeTitles[loc];
        const effectiveTitle = localeTitle || title;
        if (localeTitle) obj.title = localeTitle;
        if (effectiveTitle) obj.meta = { page_title: effectiveTitle };
        return obj;
      };
      const enYml = yaml.dump(makeLocaleObj(enSlug || folderSlug!, "en"), { lineWidth: 120, noRefs: true, sortKeys: false });
      const esYml = yaml.dump(makeLocaleObj(esSlug || folderSlug!, "es"), { lineWidth: 120, noRefs: true, sortKeys: false });

      // Write only missing files (preserve existing content from partial creation)
      const createdFiles: string[] = [];
      const relFolder = `marketing-content/${getFolder(type)}/${folderSlug}`;
      if (!fs.existsSync(path.join(folderPath, "_common.yml"))) {
        fs.writeFileSync(path.join(folderPath, "_common.yml"), commonYml);
        createdFiles.push("_common.yml");
        markFileAsModified(`${relFolder}/_common.yml`, createAuthorName);
      }
      if (!skipEn && !fs.existsSync(path.join(folderPath, "en.yml"))) {
        fs.writeFileSync(path.join(folderPath, "en.yml"), enYml);
        createdFiles.push("en.yml");
        markFileAsModified(`${relFolder}/en.yml`, createAuthorName);
      }
      if (!skipEs && !fs.existsSync(path.join(folderPath, "es.yml"))) {
        fs.writeFileSync(path.join(folderPath, "es.yml"), esYml);
        createdFiles.push("es.yml");
        markFileAsModified(`${relFolder}/es.yml`, createAuthorName);
      }

      // Clear sitemap cache so the new content appears
      clearSitemapCache();

      contentIndex.refresh();
      invalidateContentCaches(type);

      const localesToValidate3 = getSupportedLocales().filter(l => !skipLocales.includes(l));
      for (const locale of localesToValidate3) {
        const { error: validationError } = contentIndex.loadMergedContent(type, folderSlug!, locale);
        if (validationError) {
          fs.rmSync(folderPath, { recursive: true, force: true });
          contentIndex.refresh();
          res.status(400).json({ error: formatValidationError(type, validationError) });
          return;
        }
      }

      res.json({
        success: true,
        slugEn: enSlug,
        slugEs: esSlug,
        type,
        directory: `marketing-content/${getFolder(type)}/${folderSlug}`,
        files: createdFiles,
        skippedLocales: skipLocales.length > 0 ? skipLocales : undefined,
      });
    } catch (error) {
      console.error("Content create error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/content/delete", async (req, res) => {
    try {
      const auth = await requireCapability(req, res, "content_delete_entry", req.body.type || undefined);
      if (!auth.authorized) return;

      const {
        type,
        slug,
        confirmSlug,
        author: rawAuthor,
        localesToDelete: rawLocalesToDelete,
      } = req.body;
      // Prefer server-resolved author (from Breathecode identity) over client-provided value
      const author = auth.author || (typeof rawAuthor === "string" ? rawAuthor : undefined);
      const localesToDelete: string[] = Array.isArray(rawLocalesToDelete)
        ? rawLocalesToDelete.filter((l: unknown) => typeof l === "string")
        : [];

      if (!type || !slug || !confirmSlug) {
        res
          .status(400)
          .json({ error: "Missing required fields: type, slug, confirmSlug" });
        return;
      }

      if (slug !== confirmSlug) {
        res.status(400).json({
          error: "Confirmation slug does not match. Deletion cancelled.",
        });
        return;
      }

      if (!isValidType(type)) {
        res.status(400).json({
          error: `Invalid type. Must be one of: ${getAllTypes().join(", ")}`,
        });
        return;
      }

      if (!slug || /[\/\\]|\.\./.test(slug) || slug.startsWith(".")) {
        res.status(400).json({ error: "Invalid slug format" });
        return;
      }

      const typeFolder = getFolder(type);
      const resolvedSlug = contentIndex.resolveBaseSlug(slug, typeFolder);

      const folderPath = path.join(
        process.cwd(),
        "marketing-content",
        typeFolder,
        resolvedSlug,
      );

      if (!fs.existsSync(folderPath)) {
        res
          .status(404)
          .json({ error: `Content "${slug}" of type "${type}" not found` });
        return;
      }

      const realPath = fs.realpathSync(path.resolve(folderPath));
      const allowedBase = fs.realpathSync(
        path.join(process.cwd(), "marketing-content", typeFolder),
      );
      if (!realPath.startsWith(allowedBase + path.sep)) {
        res.status(400).json({ error: "Invalid path" });
        return;
      }

      if (localesToDelete.length > 0) {
        const deletedFiles: string[] = [];
        for (const locale of localesToDelete) {
          const localeFile = path.join(folderPath, `${locale}.yml`);
          if (fs.existsSync(localeFile)) {
            fs.unlinkSync(localeFile);
            deletedFiles.push(`${locale}.yml`);
            markFileAsModified(`marketing-content/${typeFolder}/${resolvedSlug}/${locale}.yml`, author);
          }
        }

        const remainingFiles = fs
          .readdirSync(folderPath)
          .filter(
            (f) =>
              f.endsWith(".yml") &&
              !f.startsWith("_")
          );

        if (remainingFiles.length === 0) {
          const allFiles = fs.existsSync(folderPath) ? fs.readdirSync(folderPath) : [];
          for (const file of allFiles) {
            markFileAsModified(`marketing-content/${typeFolder}/${resolvedSlug}/${file}`, author);
          }
          fs.rmSync(folderPath, { recursive: true, force: true });
          console.log(
            `[Content] Deleted ${type}/${slug} (all locales removed, folder cleaned up)`,
          );
        } else {
          console.log(
            `[Content] Deleted ${deletedFiles.join(", ")} from ${type}/${slug} (${remainingFiles.length} locale(s) remaining)`,
          );
        }

        clearSitemapCache();
        contentIndex.refresh();
        invalidateContentCaches(type);

        res.json({
          success: true,
          message:
            remainingFiles.length === 0
              ? `Successfully deleted ${type}/${slug}`
              : `Deleted ${deletedFiles.join(", ")} from ${type}/${slug}`,
          deletedFiles,
          folderRemoved: remainingFiles.length === 0,
        });
      } else {
        const allFiles = fs.readdirSync(folderPath);
        for (const file of allFiles) {
          markFileAsModified(`marketing-content/${typeFolder}/${resolvedSlug}/${file}`, author);
        }
        fs.rmSync(folderPath, { recursive: true, force: true });

        console.log(`[Content] Deleted ${type}/${slug}`);
        clearSitemapCache();
        contentIndex.refresh();
        invalidateContentCaches(type);

        res.json({
          success: true,
          message: `Successfully deleted ${type}/${slug}`,
        });
      }
    } catch (error) {
      console.error("Content delete error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create new landing page
  app.post("/api/content/create-landing", async (req, res) => {
    try {
      const auth = await requireCapability(req, res, "content_create_entry", "landing");
      if (!auth.authorized) return;

      const {
        slug,
        locale,
        title,
        sourceUrl,
        author: landingAuthor,
      } = req.body;
      const landingAuthorName =
        landingAuthor && typeof landingAuthor === "string"
          ? landingAuthor
          : undefined;

      if (!slug || !title) {
        res.status(400).json({ error: "Missing required fields: slug, title" });
        return;
      }

      const supportedLocales = getSupportedLocales();
      const landingLocale =
        locale && supportedLocales.includes(locale)
          ? locale
          : getDefaultLocale();

      // Validate slug format
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(slug)) {
        res.status(400).json({
          error:
            "Invalid slug format. Use lowercase letters, numbers, and hyphens only.",
        });
        return;
      }

      // Don't allow reserved prefixes
      if (slug.startsWith("_")) {
        res
          .status(400)
          .json({ error: "Slug cannot start with underscore (reserved)" });
        return;
      }

      const existingSlugs = contentIndex.listContentSlugs("landing");
      if (existingSlugs.includes(slug)) {
        res
          .status(409)
          .json({ error: `A landing with slug "${slug}" already exists` });
        return;
      }

      const folderPath = path.join(
        process.cwd(),
        "marketing-content",
        "landings",
        slug,
      );

      if (fs.existsSync(folderPath)) {
        res
          .status(409)
          .json({ error: `A landing with slug "${slug}" already exists` });
        return;
      }

      // Create folder
      fs.mkdirSync(folderPath, { recursive: true });

      // If duplicating from source, copy content from source landing
      if (sourceUrl) {
        try {
          const sourceUrlObj = new URL(sourceUrl);
          const sourcePath = sourceUrlObj.pathname;

          const resolved = contentIndex.resolveUrl(sourcePath);
          const sourceSlug = resolved?.slug || "";
          const sourceFolderPath = resolved
            ? path.join(process.cwd(), resolved.entry.directory)
            : "";

          if (
            sourceSlug &&
            sourceFolderPath &&
            fs.existsSync(sourceFolderPath)
          ) {
            const sourceFiles = fs.readdirSync(sourceFolderPath);
            for (const file of sourceFiles) {
              let content = fs.readFileSync(
                path.join(sourceFolderPath, file),
                "utf8",
              );

              content = content.replace(
                /^(\s*)redirects:.*$(\n\1\s+-.*$)*/gm,
                "",
              );

              content = content.replace(
                new RegExp(`slug:\\s*["']?${sourceSlug}["']?`, "g"),
                `slug: "${slug}"`,
              );

              if (file === "_common.yml") {
                content = content.replace(
                  /title:\s*["']?.*["']?$/m,
                  `title: "${title}"`,
                );
              }

              fs.writeFileSync(path.join(folderPath, file), content);
              markFileAsModified(
                `marketing-content/landings/${slug}/${file}`,
                landingAuthorName,
              );
            }

            clearSitemapCache();
            contentIndex.refresh();
            invalidateContentCaches("landing");

            res.json({
              success: true,
              slug,
              locale: landingLocale,
              directory: `marketing-content/landings/${slug}`,
              duplicatedFrom: sourceUrl,
            });
            return;
          }
        } catch (dupError) {
          console.error("Error duplicating landing:", dupError);
          // Fall through to create new content if duplication fails
        }
      }

      // Create starter YAML files for landings (_common.yml and {locale}.yml)
      const commonYml = `slug: "${slug}"
locale: "${landingLocale}"
title: "${title}"

meta:
  page_title: "${title} | 4Geeks Academy"
  description: "${title} - Learn more at 4Geeks Academy."
  robots: "index, follow"
  og_image: "/images/landing-og.jpg"
  priority: 0.9
  change_frequency: "weekly"

schema:
  include:
    - "organization"
    - "website"
`;

      const localeYml = `# Landing page content
sections: []
`;

      // Write files
      fs.writeFileSync(path.join(folderPath, "_common.yml"), commonYml);
      markFileAsModified(
        `marketing-content/landings/${slug}/_common.yml`,
        landingAuthorName,
      );
      fs.writeFileSync(path.join(folderPath, `${landingLocale}.yml`), localeYml);
      markFileAsModified(
        `marketing-content/landings/${slug}/${landingLocale}.yml`,
        landingAuthorName,
      );

      clearSitemapCache();
      contentIndex.refresh();
      invalidateContentCaches("landing");

      res.json({
        success: true,
        slug,
        locale: landingLocale,
        directory: `marketing-content/landings/${slug}`,
        files: ["_common.yml", `${landingLocale}.yml`],
      });
    } catch (error) {
      console.error("Landing create error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/content/:contentType/:slug", (req, res) => {
    const { contentType, slug } = req.params;
    const locale = normalizeLocale(req.query.locale as string);

    if (!isValidType(contentType)) {
      res.status(400).json({ error: "Invalid content type" });
      return;
    }

    const result = getContentForEdit(
      contentType as string,
      slug,
      locale,
    );

    if (result.content) {
      res.json(result.content);
    } else {
      res.status(404).json({ error: result.error });
    }
  });

  // Lead Form API endpoints

  // Get form options (programs and locations for dropdowns)
  app.get(["/api/form-options", "/api/form-options/:locale"], (req, res) => {
    const locale = normalizeLocale(
      (req.params as { locale?: string }).locale ||
        (req.query.locale as string),
    );

    // Get all programs for dropdown
    const programs = listCareerPrograms(locale).map((p) => ({
      slug: p.slug,
      bc_slug: p.bc_slug,
      title: p.title,
    }));

    // Get all visible locations grouped by region
    const locationsPath = path.join(
      process.cwd(),
      "marketing-content",
      getFolder("location"),
    );
    const locationsList: Array<{
      slug: string;
      name: string;
      city: string;
      country: string;
      region: string;
    }> = [];

    try {
      if (fs.existsSync(locationsPath)) {
        const dirs = fs.readdirSync(locationsPath);
        for (const dir of dirs) {
          const commonPath = path.join(locationsPath, dir, "_common.yml");
          if (fs.existsSync(commonPath)) {
            const campusData = safeYamlLoad(
              fs.readFileSync(commonPath, "utf8"),
            ) as {
              slug: string;
              name: string;
              city: string;
              country: string;
              country_code?: string;
              region?: string;
              visibility?: string;
            };
            if (campusData && campusData.visibility !== "unlisted") {
              locationsList.push({
                slug: campusData.slug,
                name: campusData.name,
                city: campusData.city,
                country: campusData.country,
                region: campusData.region || "other",
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading locations:", error);
    }

    // Group locations by region
    const regions = [
      {
        slug: "usa-canada",
        label: locale === "es" ? "EE.UU. y Canadá" : "USA & Canada",
      },
      {
        slug: "latam",
        label: locale === "es" ? "Latinoamérica" : "Latin America",
      },
      { slug: "europe", label: locale === "es" ? "Europa" : "Europe" },
      { slug: "online", label: "Online" },
    ];

    res.json({
      programs,
      locations: locationsList,
      regions,
    });
  });

  // Submit lead form
  app.post("/api/leads", async (req, res) => {
    try {
      const leadData = req.body;

      // Validate required fields
      if (!leadData.email) {
        res.status(400).json({ error: "Email is required" });
        return;
      }

      // Build the payload for Breathecode API
      const payload = {
        first_name: leadData.first_name || null,
        last_name: leadData.last_name || null,
        phone: leadData.phone || null,
        email: leadData.email,
        location: leadData.location || null,
        course: leadData.program || null,
        consent: leadData.consent_whatsapp || false,
        sms_consent: leadData.sms_consent || false,
        consent_email: leadData.consent_email || false,
        comment: leadData.comment || null,
        client_comments: leadData.client_comments || null,
        // Session/tracking data
        utm_url: leadData.utm_url || null,
        utm_source: leadData.utm_source || null,
        utm_medium: leadData.utm_medium || null,
        utm_campaign: leadData.utm_campaign || null,
        utm_content: leadData.utm_content || null,
        utm_term: leadData.utm_term || null,
        utm_placement: leadData.utm_placement || null,
        utm_plan: leadData.utm_plan || null,
        // Ad platform click IDs
        gclid: leadData.gclid || null,
        fbclid: leadData.fbclid || null,
        msclkid: leadData.msclkid || null,
        ttclid: leadData.ttclid || null,
        // Referral
        referral: leadData.referral || leadData.ref || null,
        coupon: leadData.coupon || null,
        // Geo data
        latitude: leadData.latitude || null,
        longitude: leadData.longitude || null,
        city: leadData.city || null,
        country: leadData.country || null,
        // Language
        language: leadData.language || "en",
        utm_language: leadData.language || "en",
        browser_lang: leadData.browser_lang || null,
        // Tags and automation
        tags: leadData.tags || "website-lead",
        automations: leadData.automations || "strong",
        action: "submit",
        // Turnstile token for bot protection
        token: leadData.token || null,
      };

      // Remove null, undefined, and empty string values from payload
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(
          ([_, value]) => value !== null && value !== undefined && value !== "",
        ),
      );

      // Post to Breathecode API
      const response = await fetch(`${BREATHECODE_HOST}/v2/marketing/lead`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Breathecode API error:", response.status, errorText);
        res.status(response.status).json({
          error: "Failed to submit lead",
          details: errorText,
        });
        return;
      }

      const result = await response.json();
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Lead submission error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Image Registry API endpoints (delegated to MediaGallery singleton)
  app.get("/api/image-registry/stats", (req, res) => {
    const tag = req.query.tag as string | undefined;
    const registry = mediaGallery.getRegistry();
    if (!registry) {
      res.status(500).json({ error: "Failed to load image registry" });
      return;
    }
    let cached = 0;
    let failed = 0;
    for (const entry of Object.values(registry.images)) {
      if (!entry.source_url) continue;
      if (tag && !(entry.tags ?? []).includes(tag)) continue;
      if (entry.failed_at) {
        failed++;
      } else {
        cached++;
      }
    }
    res.json({ cached, failed });
  });

  app.get("/api/image-registry/failed", (req, res) => {
    const tag = req.query.tag as string | undefined;
    const entries = getFailedEntries(tag);
    res.json({ entries });
  });

  app.post("/api/image-registry/retry-failed", (req, res) => {
    const { tag } = req.body as { tag?: string };
    const count = retryFailedImages(tag);
    if (count > 0) mediaGallery.persistRegistry();
    res.json({ retried: count });
  });

  app.post("/api/image-registry/enqueue-external", (req, res) => {
    const { url, tag } = req.body as { url?: string; tag?: string };
    if (!url || !/^https?:\/\//.test(url)) {
      res.status(400).json({ error: "A valid http/https url is required" });
      return;
    }
    const dbName = tag || "manual";
    const id = enqueueExternalImage(url, dbName);
    if (id) {
      mediaGallery.persistRegistry();
    }
    res.json({ queued: !!id, id: id ?? null });
  });

  app.get("/api/image-registry", (_req, res) => {
    const registry = mediaGallery.getRegistry();
    if (!registry) {
      res.status(500).json({ error: "Failed to load image registry" });
      return;
    }
    res.json(registry);
  });

  app.get("/api/image-registry/family-usage", (req, res) => {
    const raw = req.query.ids;
    const ids: string[] = Array.isArray(raw)
      ? (raw as string[]).filter(Boolean)
      : typeof raw === "string" && raw
        ? [raw]
        : [];
    if (!ids.length) {
      res.json([]);
      return;
    }
    try {
      const results = mediaGallery.getFamilyUsage(ids);
      const enriched = results.map(r => ({
        ...r,
        hasBinding: r.sectionId
          ? !!bindingManager.findGroupForSection(r.contentType, r.slug, r.sectionId, r.locale)
          : r.sectionIndex >= 0
            ? !!bindingManager.findGroupForSectionByIndex(r.contentType, r.slug, r.sectionIndex, r.locale)
            : false,
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to get family usage" });
    }
  });

  app.post("/api/image-registry/clear-ref-cache", (_req, res) => {
    mediaGallery.clearImageRefCache();
    res.json({ ok: true });
  });

  app.post("/api/image-registry/bulk-replace-usage", (req, res) => {
    const { fileReplacements } = req.body as {
      fileReplacements?: Array<{ filePath: string; fromId: string; fromSrc: string; toId: string; toSrc: string }>;
    };
    if (!Array.isArray(fileReplacements) || fileReplacements.length === 0) {
      res.status(400).json({ error: "Missing or empty 'fileReplacements' array" });
      return;
    }
    try {
      const result = mediaGallery.bulkReplaceUsage(fileReplacements);
      mediaGallery.clearImageRefCache();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Bulk replace failed" });
    }
  });

  app.delete("/api/image-registry/:id", async (req, res) => {
    try {
      const result = await mediaGallery.unregister(req.params.id);
      if (!result.success) {
        const status = result.usedIn ? 409 : 404;
        res.status(status).json({
          error: result.usedIn ? "Image is in use" : result.error,
          message: result.error,
          ...(result.usedIn ? { usedIn: result.usedIn } : {}),
        });
        return;
      }
      res.json({
        success: true,
        message: `Deleted "${req.params.id}" from registry`,
        ...(result.cleanupErrors ? { cleanupErrors: result.cleanupErrors } : {}),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Delete failed" });
    }
  });

  app.post("/api/image-registry/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body as { ids?: string[] };
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: "Missing or empty 'ids' array" });
        return;
      }
      const { results, deletedCount } = await mediaGallery.bulkUnregister(ids);
      res.json({ results, deletedCount, totalRequested: ids.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Bulk delete failed" });
    }
  });

  app.get("/api/media/status", (_req, res) => {
    try {
      res.json(media.getStatus());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Image Registry Scanner Endpoints (delegated to MediaGallery singleton)
  app.post("/api/image-registry/scan", async (_req, res) => {
    try {
      const result = await mediaGallery.scan();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Scan failed" });
    }
  });

  app.post("/api/image-registry/apply", async (req, res) => {
    try {
      const action = req.query.action as string | undefined;
      const scanResult = await mediaGallery.scan();
      const filtered = {
        ...scanResult,
        newImages: action === "update" ? [] : scanResult.newImages,
        updatedImages: action === "add" ? [] : scanResult.updatedImages,
      };
      if (
        filtered.newImages.length === 0 &&
        filtered.updatedImages.length === 0
      ) {
        res.json({ message: "Nothing to apply", added: 0, updated: 0 });
        return;
      }
      const applied = mediaGallery.applyChanges(filtered);
      const yamlMsg =
        applied.yamlFilesUpdated.length > 0
          ? `. Updated paths in ${applied.yamlFilesUpdated.length} YAML file(s)`
          : "";
      res.json({
        message: `Applied ${applied.added} new, ${applied.updated} updated${yamlMsg}`,
        ...applied,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Apply failed" });
    }
  });

  app.post("/api/image-registry/deduplicate", async (req, res) => {
    try {
      const scanResult = await mediaGallery.scan();
      if (scanResult.duplicates.length === 0) {
        res.json({
          message: "No duplicates found",
          removedCount: 0,
          results: [],
        });
        return;
      }
      const result = mediaGallery.removeDuplicates(scanResult.duplicates);
      const yamlMsg =
        result.yamlFilesUpdated.length > 0
          ? `. Updated references in ${result.yamlFilesUpdated.length} YAML file(s)`
          : "";
      res.json({
        message: `Removed ${result.removedCount} duplicate(s)${yamlMsg}`,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Deduplication failed" });
    }
  });

  app.get("/api/image-registry/redundant", (_req, res) => {
    try {
      const images = mediaGallery.findRedundantImages();
      res.json({ count: images.length, images });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to find redundant images" });
    }
  });

  app.post("/api/image-registry/redundant/resolve", async (req, res) => {
    try {
      const { action, ids } = req.body as { action?: string; ids?: string[] };
      if (action !== "delete-local" && action !== "delete-cloud") {
        res
          .status(400)
          .json({
            error: "Invalid action. Must be 'delete-local' or 'delete-cloud'",
          });
        return;
      }
      const result = await mediaGallery.resolveRedundancy(action, ids);
      res.json(result);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to resolve redundancy" });
    }
  });

  app.post("/api/image-registry/migrate", async (req, res) => {
    try {
      const { from, to, dryRun, prefix } = req.body as {
        from?: string;
        to?: string;
        dryRun?: boolean;
        prefix?: string;
      };
      if (!from || !to) {
        res
          .status(400)
          .json({ error: "Missing 'from' and/or 'to' provider name" });
        return;
      }
      const results = await mediaGallery.migrate(from, to, { dryRun, prefix });
      const migrated = results.filter((r) => r.status === "migrated").length;
      res.json({
        message: dryRun
          ? `Dry run: ${results.length} image(s) would be migrated from ${from} to ${to}`
          : `Migrated ${migrated} of ${results.length} image(s) from ${from} to ${to}`,
        results,
        totalProcessed: results.length,
        migratedCount: migrated,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Migration failed" });
    }
  });

  app.post("/api/image-registry/scripts/remove-unused", async (req, res) => {
    try {
      const { dryRun } = req.body as { dryRun?: boolean };
      const { removeUnusedImages } = await import("../scripts/admin/remove-unused-images");
      const result = await removeUnusedImages({ dryRun: dryRun ?? false });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Remove unused images failed" });
    }
  });

  app.post("/api/image-registry/scripts/remove-unused/stream", async (req, res) => {
    const BATCH_SIZE = 20;

    try {
      const registry = mediaGallery.getRegistry();
      if (!registry) {
        res.status(500).json({ error: "Failed to load image registry" });
        return;
      }

      const { imageIds } = mediaGallery.collectImageReferences();
      const srcToId = buildRegistrySrcToIdMap(registry.images);
      const resolvedReferencedIds = new Set<string>();
      imageIds.forEach((ref) => {
        const resolved = resolveRegistryReference(ref, registry.images, srcToId);
        if (resolved !== null) resolvedReferencedIds.add(resolved);
      });

      const allImageIds = Object.keys(registry.images);
      const unusedItems: Array<{ id: string; src: string }> = [];
      let externalSkipped = 0;
      for (const [id, entry] of Object.entries(registry.images)) {
        if (entry.source_url || entry.source_item) {
          externalSkipped++;
          continue;
        }
        if (entry.protected) {
          continue;
        }
        const srcsetUrls = Array.isArray(entry.srcset) ? entry.srcset.map((s) => s.url) : [];
        const usage = mediaGallery.getUsage(id, entry.src, srcsetUrls);
        const isUsed = usage.length > 0 || resolvedReferencedIds.has(id);
        if (!isUsed) {
          unusedItems.push({ id, src: entry.src });
        }
      }

      const total = unusedItems.length;

      if (total === 0) {
        res.json({ done: true, processed: 0, total: 0, summary: { removed: 0, skipped: 0, failed: 0 } });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });

      let processed = 0;
      let removed = 0;
      let skipped = 0;
      let failed = 0;
      let cleanupWarnings = 0;

      try {
        for (let i = 0; i < total; i += BATCH_SIZE) {
          const batchItems = unusedItems.slice(i, i + BATCH_SIZE);
          const batchResults: Array<{ id: string; src: string; status: string; reason?: string }> = [];

          for (const item of batchItems) {
            try {
              const result = await mediaGallery.unregister(item.id);
              if (result.success) {
                if (result.cleanupErrors && result.cleanupErrors.length > 0) {
                  batchResults.push({
                    id: item.id,
                    src: item.src,
                    status: "removed-with-cleanup-errors",
                    reason: result.cleanupErrors.join("; "),
                  });
                  cleanupWarnings++;
                } else {
                  batchResults.push({ id: item.id, src: item.src, status: "removed" });
                }
                removed++;
              } else {
                batchResults.push({ id: item.id, src: item.src, status: "skipped", reason: result.error || "unknown" });
                skipped++;
              }
            } catch (err: any) {
              batchResults.push({ id: item.id, src: item.src, status: "error", reason: err.message || "unknown" });
              failed++;
            }
          }

          processed += batchItems.length;
          const event = { total, processed, batch: batchResults };
          res.write(JSON.stringify(event) + "\n");
        }

        const doneEvent = {
          done: true,
          processed,
          total,
          summary: {
            removed,
            skipped,
            failed,
            cleanupWarnings,
            externalSkipped,
          },
        };
        res.write(JSON.stringify(doneEvent) + "\n");
        res.end();
      } catch (fatalErr: any) {
        const fatalEvent = { fatalError: true, message: fatalErr.message || "Unknown error", processed, total };
        res.write(JSON.stringify(fatalEvent) + "\n");
        res.end();
      }
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || "Remove unused images failed" });
      }
    }
  });

  const mediaUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowedImages = [
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".svg",
        ".avif",
        ".gif",
      ];
      const allowedVideos = [".mp4", ".webm", ".mov", ".ogg", ".m4v"];
      const ext = path.extname(file.originalname).toLowerCase();
      if ([...allowedImages, ...allowedVideos].includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${ext}`));
      }
    },
  });

  app.post(
    "/api/image-registry/upload",
    mediaUpload.single("file"),
    async (req, res) => {
      try {
        const file = (req as any).file;
        if (!file) {
          res.status(400).json({ error: "No file provided" });
          return;
        }
        const alt = (req.body?.alt as string) || undefined;
        const tags = req.body?.tags ? JSON.parse(req.body.tags) : undefined;
        const result = await mediaGallery.uploadAndRegister(
          file.originalname,
          file.buffer,
          file.mimetype,
          { alt, tags },
        );
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message || "Upload failed" });
      }
    },
  );

  // ============================================
  // Crop/Resize Endpoint
  // ============================================

  app.post("/api/media/crop-resize", async (req, res) => {
    if (process.env.DEBUG_CROP_RESIZE) {
      console.log("[CropResize] Handler reached — body keys:", Object.keys(req.body || {}));
    }
    try {
      const bodySchema = z.object({
        imageId: z.string().min(1),
        crop: z.object({
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          width: z.number().min(0).max(1),
          height: z.number().min(0).max(1),
        }),
        targetWidth: z.number().int().positive().max(8000),
        targetHeight: z.number().int().positive().max(8000),
        quality: z.number().int().min(50).max(100).default(85),
      });

      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
        return;
      }

      const { imageId, crop, targetWidth, targetHeight, quality } = parsed.data;

      const registry = mediaGallery.getRegistry();
      if (!registry) {
        res.status(500).json({ error: "Failed to load image registry" });
        return;
      }

      const entry = registry.images[imageId];
      if (!entry) {
        res.status(404).json({ error: `Image "${imageId}" not found in registry` });
        return;
      }

      const src = entry.src;
      const ext = (() => {
        try { return path.extname(new URL(src).pathname).toLowerCase(); }
        catch { return path.extname(src).toLowerCase(); }
      })();

      if (ext === ".svg") {
        res.status(422).json({ error: "SVG images cannot be raster-processed. Please select a different format." });
        return;
      }
      if (ext === ".gif") {
        res.status(422).json({ error: "Animated GIF images cannot be crop-processed. Please select a different format." });
        return;
      }

      const { downloadImage } = await import("./image-optimizer");
      const buffer = await downloadImage(src);
      if (!buffer) {
        res.status(422).json({ error: "Could not read source image. Make sure the file exists." });
        return;
      }

      const sharp = (await import("sharp")).default;
      const metadata = await sharp(buffer).metadata();
      const imgW = metadata.width || 0;
      const imgH = metadata.height || 0;

      if (!imgW || !imgH) {
        res.status(422).json({ error: "Could not determine image dimensions." });
        return;
      }

      const cropLeft = Math.round(crop.x * imgW);
      const cropTop = Math.round(crop.y * imgH);
      const cropWidth = Math.round(crop.width * imgW);
      const cropHeight = Math.round(crop.height * imgH);

      const safeLeft = Math.max(0, Math.min(cropLeft, imgW - 1));
      const safeTop = Math.max(0, Math.min(cropTop, imgH - 1));
      const safeWidth = Math.max(1, Math.min(cropWidth, imgW - safeLeft));
      const safeHeight = Math.max(1, Math.min(cropHeight, imgH - safeTop));

      const processedBuffer = await sharp(buffer)
        .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight })
        .resize({ width: targetWidth, height: targetHeight, fit: "fill" })
        .webp({ quality })
        .toBuffer();

      const rootId = entry.parentId ?? imageId;

      const parentTags = entry.tags || [];

      const registryPresets = registry.presets as Record<string, { quality?: number }>;
      const parentPresets = (entry.preset || []) as string[];
      const presetDefaultQuality = parentPresets.length > 0
        ? Math.max(...parentPresets.map((p) => registryPresets[p]?.quality ?? 85))
        : 85;
      const qualityToSave = quality !== presetDefaultQuality ? quality : undefined;
      const qualitySuffix = qualityToSave !== undefined ? `-q${quality}` : "";
      const baseId = `${rootId}-${targetWidth}x${targetHeight}${qualitySuffix}`;

      const existingEntry = registry.images[baseId];
      if (existingEntry) {
        return res.json({ id: baseId, src: existingEntry.src, width: targetWidth, height: targetHeight });
      }

      const uniqueId = baseId;
      const derivedFilename = `${uniqueId}.webp`;
      const defaultProvider = media.getDefaultProvider();
      let newSrc: string;

      if (defaultProvider.name === "local") {
        const MARKETING_IMAGES_DIR = path.join(process.cwd(), "marketing-content", "images");
        if (!fs.existsSync(MARKETING_IMAGES_DIR)) {
          fs.mkdirSync(MARKETING_IMAGES_DIR, { recursive: true });
        }
        const destPath = path.join(MARKETING_IMAGES_DIR, derivedFilename);
        fs.writeFileSync(destPath, processedBuffer);
        newSrc = `/marketing-content/images/${derivedFilename}`;
      } else {
        newSrc = await defaultProvider.upload(derivedFilename, processedBuffer, "image/webp");
      }

      mediaGallery.register(uniqueId, {
        src: newSrc,
        alt: entry.alt,
        tags: parentTags,
        width: targetWidth,
        height: targetHeight,
        format: "webp",
        parentId: rootId,
        quality_override: qualityToSave,
      });

      console.log(`[CropResize] Created "${uniqueId}" (${targetWidth}x${targetHeight}) from "${rootId}"`);

      (async () => {
        try {
          const { processImageFromSrc } = await import("./image-optimizer");
          const registry2 = mediaGallery.getRegistry();
          if (!registry2) return;
          const newEntry = registry2.images[uniqueId];
          if (!newEntry) return;
          const tagDefs = registry2.tagDefinitions as Record<string, { presets?: string[] }> | undefined;
          const result = await processImageFromSrc(uniqueId, newEntry, registry2.presets as Record<string, import("./image-optimizer").Preset>, false, newEntry.quality_override, tagDefs);
          if (result) {
            newEntry.preset = result.preset;
            newEntry.widths_generated = result.widths_generated;
            newEntry.srcset = result.srcset;
            mediaGallery.persistRegistry();
            console.log(`[CropResize] Optimization complete for "${uniqueId}"`);
          }
        } catch (err) {
          console.error(`[CropResize] Background optimization failed for "${uniqueId}":`, err);
        }
      })();

      res.json({ id: uniqueId, src: newSrc, width: targetWidth, height: targetHeight });
    } catch (error: any) {
      console.error("[CropResize] Error:", error);
      res.status(500).json({ error: error.message || "Crop/resize failed" });
    }
  });

  app.post("/api/image-registry/optimize-batch", async (req, res) => {
    try {
      const { ids } = req.body as { ids?: string[] };
      const registry = mediaGallery.getRegistry();
      if (!registry) {
        res.status(500).json({ error: "Failed to load image registry" });
        return;
      }

      const rasterExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);

      const getExt = (src: string): string => {
        try { return path.extname(new URL(src).pathname).toLowerCase(); }
        catch { return path.extname(src).toLowerCase(); }
      };

      let targetIds: string[];
      if (ids && Array.isArray(ids) && ids.length > 0) {
        targetIds = ids.filter(id => {
          const entry = registry.images[id];
          if (!entry) return false;
          return rasterExtensions.has(getExt(entry.src));
        });
      } else {
        targetIds = Object.entries(registry.images)
          .filter(([_id, entry]) => {
            if (!entry.src) return false;
            const ext = getExt(entry.src);
            if (!rasterExtensions.has(ext)) return false;
            const hasSrcset = Array.isArray(entry.srcset) && entry.srcset.length > 0;
            return !hasSrcset;
          })
          .map(([id]) => id);
      }

      if (targetIds.length === 0) {
        res.json({ queued: 0, message: "No images need optimization" });
        return;
      }

      for (const id of targetIds) {
        enqueueOptimization(id);
      }
      mediaGallery.persistRegistry();

      resetOptimizeSession(targetIds.length);
      if (workerRunNow) workerRunNow();

      console.log(`[OptimizeBatch] Enqueued ${targetIds.length} image(s) for background optimization`);
      res.json({ queued: targetIds.length, message: `Queued ${targetIds.length} image(s) for background optimization` });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Batch optimize failed" });
    }
  });

  app.get("/api/image-registry/optimize-status", (_req, res) => {
    const session = getOptimizeSession();
    const allState = getAllQueueState();

    const remainingEntries = getPendingOptimizations(10000);
    const remaining = remainingEntries.length;

    const failedEntries: Array<{ id: string; error: string }> = [];
    for (const [id, entry] of Object.entries(allState)) {
      if (entry.failed_at) {
        failedEntries.push({ id, error: entry.error ?? "Unknown error" });
        if (failedEntries.length >= 20) break;
      }
    }

    const active = remaining > 0 || (session.initial > 0 && session.processed < session.initial);

    res.json({
      active,
      initial: session.initial,
      processed: session.processed,
      failed: failedEntries.length,
      remaining,
      failedEntries,
    });
  });

  app.post("/api/media/classify/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const { context, persist } = req.body as {
        context?: { tagFilter?: string };
        persist?: boolean;
      };

      if (context && typeof context !== "object") {
        res.status(400).json({ error: "context must be an object" });
        return;
      }
      if (context?.tagFilter && typeof context.tagFilter !== "string") {
        res.status(400).json({ error: "context.tagFilter must be a string" });
        return;
      }
      if (context?.tagFilter && context.tagFilter.length > 100) {
        res.status(400).json({ error: "context.tagFilter is too long" });
        return;
      }

      const { classifyAndApply } = await import("./image-auto-tagger");
      const shouldPersist = persist !== false;
      const result = await classifyAndApply(imageId, context, shouldPersist);
      res.json(result);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found")) {
        res.status(404).json({ error: message });
      } else {
        console.error("[Classify] Error:", error);
        res.status(500).json({ error: "Classification failed", message });
      }
    }
  });

  // ============================================
  // Validation API Endpoints
  // ============================================

  // List available validators
  app.get("/api/validation/validators", (_req, res) => {
    const service = getValidationService();
    const validators = service.getAvailableValidators();
    res.json({
      validators,
      total: validators.length,
    });
  });

  // Run all or specific validators
  app.post("/api/validation/run", async (req, res) => {
    try {
      const { validators: validatorNames, includeArtifacts } = req.body;

      const service = getValidationService();

      // Clear previous context to get fresh data
      service.clearContext();
      await service.buildContext();

      const result = await service.runValidators({
        validators: validatorNames,
        includeArtifacts: includeArtifacts ?? false,
      });

      res.json(result);
    } catch (error) {
      console.error("Validation error:", error);
      res.status(500).json({
        error: "Validation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Explicit JSON format alias — same as /run but with a format extension
  app.post("/api/validation/run.json", async (req, res) => {
    try {
      const { validators: validatorNames, includeArtifacts } = req.body;
      const service = getValidationService();
      service.clearContext();
      await service.buildContext();
      const result = await service.runValidators({
        validators: validatorNames,
        includeArtifacts: includeArtifacts ?? false,
      });
      res.json(result);
    } catch (error) {
      console.error("Validation error:", error);
      res.status(500).json({
        error: "Validation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // LLM prompt format — runs validators and returns a copy-pasteable prompt
  app.post("/api/validation/run.prompt", async (req, res) => {
    try {
      const { validators: validatorNames, includeArtifacts } = req.body;
      const { formatAsLlmPrompt } = await import("../scripts/validation/reporting/llm-prompt");
      const service = getValidationService();
      service.clearContext();
      await service.buildContext();
      const result = await service.runValidators({
        validators: validatorNames,
        includeArtifacts: includeArtifacts ?? false,
      });
      const prompt = formatAsLlmPrompt(result);
      const issueCount = result.validators.reduce(
        (n, v) => n + v.errors.length + v.warnings.length,
        0,
      );
      res.json({
        prompt,
        validatorNames: result.validators.map((v) => v.name),
        issueCount,
      });
    } catch (error) {
      console.error("Validation prompt error:", error);
      res.status(500).json({
        error: "Validation prompt failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Generate a focused LLM prompt scoped to a specific promptTemplate key
  // Used when multiple validators share the same fix.promptTemplate and a combined prompt is more useful
  app.post("/api/validation/fix-prompt", async (req, res) => {
    try {
      const { promptTemplate, validators: validatorNames } = req.body as {
        promptTemplate?: string;
        validators?: string[];
      };
      const { formatAsLlmPrompt } = await import("../scripts/validation/reporting/llm-prompt");
      const service = getValidationService();
      service.clearContext();
      await service.buildContext();
      const result = await service.runValidators({
        validators: validatorNames,
        includeArtifacts: false,
      });
      if (promptTemplate) {
        for (const v of result.validators) {
          v.errors = v.errors.filter((i: any) => i.fix?.promptTemplate === promptTemplate);
          v.warnings = v.warnings.filter((i: any) => i.fix?.promptTemplate === promptTemplate);
        }
        result.validators = result.validators.filter(
          (v) => v.errors.length > 0 || v.warnings.length > 0
        );
      }
      const issueCount = result.validators.reduce(
        (n, v) => n + v.errors.length + v.warnings.length,
        0,
      );
      const prompt = formatAsLlmPrompt(result);
      res.json({
        prompt,
        promptTemplate: promptTemplate ?? null,
        validatorNames: result.validators.map((v) => v.name),
        issueCount,
      });
    } catch (error) {
      console.error("Fix-prompt error:", error);
      res.status(500).json({
        error: "Fix prompt failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Save a full JSON report to /tmp/validation-reports/
  app.post("/api/validation/save-report", async (_req, res) => {
    try {
      const { formatAsJson } = await import("../scripts/validation/reporting/json");
      const fs = await import("fs");
      const path = await import("path");

      const service = getValidationService();
      service.clearContext();
      await service.buildContext();

      const result = await service.runValidators({ includeArtifacts: true });

      const timestamp = new Date().toISOString();
      const fileName = `report-${timestamp.replace(/[:.]/g, "-")}.json`;
      const dir = "/tmp/validation-reports";
      const filePath = path.join(dir, fileName);

      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, formatAsJson(result, { pretty: true, includeTimestamp: true }), "utf-8");

      res.json({ ok: true, path: filePath, timestamp, summary: result.summary });
    } catch (error) {
      console.error("Save-report error:", error);
      res.status(500).json({
        error: "Failed to save report",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Run a single validator
  app.post("/api/validation/run/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const { includeArtifacts } = req.body;

      const service = getValidationService();

      // Clear previous context to get fresh data
      service.clearContext();
      await service.buildContext();

      const result = await service.runSingleValidator(
        name,
        includeArtifacts ?? false,
      );

      res.json(result);
    } catch (error) {
      console.error("Validation error:", error);
      res.status(500).json({
        error: "Validation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get validation context info (for debugging)
  app.get("/api/validation/context", async (_req, res) => {
    try {
      const service = getValidationService();
      let context = service.getContext();

      if (!context) {
        await service.buildContext();
        context = service.getContext();
      }

      if (!context) {
        res.status(500).json({ error: "Failed to build context" });
        return;
      }

      // contentFiles is a flat array - count by type
      const contentFiles = context.contentFiles;
      const typeCounts = {
        programs: contentFiles.filter((f) => f.type === "program").length,
        landings: contentFiles.filter((f) => f.type === "landing").length,
        locations: contentFiles.filter((f) => f.type === "location").length,
        pages: contentFiles.filter((f) => f.type === "page").length,
      };

      res.json({
        contentFiles: typeCounts,
        totalFiles: contentFiles.length,
        validUrls: context.validUrls.size,
        availableSchemas: context.availableSchemas.length,
        redirects: context.redirectMap.size,
      });
    } catch (error) {
      console.error("Context build error:", error);
      res.status(500).json({ error: "Failed to get context" });
    }
  });

  // Clear validation cache
  app.post("/api/validation/clear-cache", (_req, res) => {
    const service = getValidationService();
    service.clearContext();
    res.json({ success: true, message: "Validation cache cleared" });
  });

  // Run a named fixer
  app.post("/api/validation/fix/:fixerName", async (req, res) => {
    try {
      const { fixerName } = req.params;
      const { getFixer } = await import("../scripts/validation/fixers/index");
      if (!getFixer(fixerName)) {
        res.status(404).json({ error: `Fixer "${fixerName}" not found` });
        return;
      }
      const pipeline = resolveFixerPipeline(
        fixerName,
        (name) => getFixer(name) as { runAfter?: string[] } | undefined,
      );
      const createdRuns = pipeline.map((name) => createValidationFixRun(fixerName, name));
      let finalResult = {
        ok: true,
        message: `Completed ${pipeline.length} fixer(s)`,
      };

      for (let i = 0; i < pipeline.length; i++) {
        const currentFixerName = pipeline[i];
        const run = createdRuns[i];
        const currentFixer = getFixer(currentFixerName);
        if (!currentFixer) {
          run.running = false;
          run.completedAt = Date.now();
          run.message = `Fixer "${currentFixerName}" not found`;
          finalResult = { ok: false, message: run.message };
          break;
        }

        run.running = true;
        try {
          const result = await currentFixer.run({
            ...(req.body || {}),
            onProgress: (event: ProgressEvent) => applyFixerProgress(run, event),
          });
          run.running = false;
          run.completedAt = Date.now();
          run.message = result.message;
          finalResult = { ok: result.ok, message: result.message };
          if (!result.ok) {
            break;
          }
        } catch (error) {
          run.running = false;
          run.completedAt = Date.now();
          run.failed += 1;
          run.message = error instanceof Error ? error.message : "Unknown fixer error";
          finalResult = { ok: false, message: run.message };
          break;
        }
      }

      res.json({
        ...finalResult,
        runIds: createdRuns.map((run) => run.runId),
        pipeline,
      });
    } catch (error) {
      console.error("Fixer error:", error);
      res.status(500).json({
        error: "Fixer failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // List available fixers
  app.get("/api/validation/fixers", async (_req, res) => {
    try {
      const { listFixers } = await import("../scripts/validation/fixers/index");
      res.json(listFixers());
    } catch (error) {
      res.status(500).json({ error: "Failed to list fixers" });
    }
  });

  app.get("/api/validation/runs", (_req, res) => {
    const runs = validationRunOrder
      .map((runId) => validationRuns.get(runId))
      .filter((run): run is ValidationFixRunState => Boolean(run))
      .sort((a, b) => b.startedAt - a.startedAt);
    res.json(runs);
  });

  app.post("/api/validation/runs/clear", (_req, res) => {
    const cleared = validationRunOrder.length;
    validationRuns.clear();
    validationRunOrder.length = 0;
    res.json({ ok: true, cleared });
  });

  // ============================================
  // Diagnostics API
  // ============================================

  app.get("/api/diagnostics/pages", async (_req, res) => {
    try {
      const service = getValidationService();
      let context = service.getContext();
      if (!context) {
        context = await service.buildContext();
      }

      const pages = context.contentFiles.map((file) => {
        const url = getCanonicalUrl(file);
        return {
          url,
          title: file.title || file.slug,
          locale: file.locale,
          contentType: file.type,
          slug: file.slug,
          filePath: file.filePath,
          hasMeta: !!(file.meta?.page_title && file.meta?.description),
          hasSchema: !!(file.schema?.include && file.schema.include.length > 0),
        };
      });

      res.json({ pages, total: pages.length });
    } catch (error) {
      console.error("Diagnostics pages error:", error);
      res.status(500).json({ error: "Failed to load pages" });
    }
  });

  app.get("/api/diagnostics/page", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        res.status(400).json({ error: "Missing url query parameter" });
        return;
      }

      const service = getValidationService();
      let context = service.getContext();
      if (!context) {
        context = await service.buildContext();
      }

      const matchingFiles = context.contentFiles.filter(
        (f: any) => getCanonicalUrl(f) === url,
      );
      const urlLocale = url.startsWith("/es/")
        ? "es"
        : url.startsWith("/en/")
          ? "en"
          : null;
      const file =
        (urlLocale && matchingFiles.find((f: any) => f.locale === urlLocale)) ||
        matchingFiles.find((f: any) => f.locale !== "_common") ||
        matchingFiles[0] ||
        null;

      if (!file) {
        res.status(404).json({ error: `No content found for URL: ${url}` });
        return;
      }

      let rawData: Record<string, unknown> = {};
      try {
        const commonPath = path.join(
          path.dirname(file.filePath),
          "_common.yml",
        );
        if (fs.existsSync(commonPath)) {
          const commonData =
            (safeYamlLoad(fs.readFileSync(commonPath, "utf-8")) as Record<
              string,
              unknown
            >) || {};
          rawData = { ...commonData };
        }
        if (fs.existsSync(file.filePath)) {
          const localeData =
            (safeYamlLoad(fs.readFileSync(file.filePath, "utf-8")) as Record<
              string,
              unknown
            >) || {};
          rawData = { ...rawData, ...localeData };
        }
      } catch {}

      const schemaValidation: {
        valid: boolean;
        errors: Array<{
          path: string;
          code: string;
          message: string;
          expected?: string;
          received?: string;
        }>;
      } = { valid: true, errors: [] };
      try {
        const contentTypes = ["program", "landing", "location", "page"];
        if (contentTypes.includes(file.type)) {
          let inferredLocale = file.locale;
          if (!inferredLocale || inferredLocale === "_common") {
            inferredLocale =
              urlLocale || (url.startsWith("/es/") ? "es" : "en");
          }
          const folderSlug = path.basename(path.dirname(file.filePath));
          const result = contentIndex.loadContent({
            contentType: file.type,
            slug: folderSlug,
            localeOrVariant: inferredLocale,
          });
          if (!result.success) {
            schemaValidation.valid = false;
            schemaValidation.errors.push({
              path: "",
              code: "CONTENT_LOAD_FAILED",
              message: result.error,
            });
          } else {
            const data = result.data as Record<string, unknown>;
            const meta = data.meta as Record<string, unknown> | undefined;
            if (!meta?.page_title) {
              schemaValidation.errors.push({
                path: "meta.page_title",
                code: "MISSING_META",
                message: "Missing meta.page_title — a fallback will be used at render time",
              });
            }
            if (!meta?.description) {
              schemaValidation.errors.push({
                path: "meta.description",
                code: "MISSING_META",
                message: "Missing meta.description — an empty string fallback will be used",
              });
            }
          }
        }
      } catch (e) {
        schemaValidation.valid = false;
        schemaValidation.errors.push({
          path: "",
          code: "SCHEMA_CHECK_ERROR",
          message: String(e),
        });
      }

      const sections = (rawData.sections as any[]) || [];
      const sectionTypes = sections
        .filter((s: any) => s?.type)
        .map((s: any) => s.type);
      const hasFaq = sectionTypes.includes("faq");

      let schemaHtml = "";
      let parsedSchemas: any[] = [];
      try {
        schemaHtml = generateSsrSchemaHtml(url);
        const scriptRegex =
          /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
        let match: RegExpExecArray | null;
        while ((match = scriptRegex.exec(schemaHtml)) !== null) {
          try {
            parsedSchemas.push(JSON.parse(match[1]));
          } catch {}
        }
      } catch {}

      const imageIds = new Set<string>();
      function extractImageIds(obj: unknown): void {
        if (!obj || typeof obj !== "object") return;
        if (Array.isArray(obj)) {
          obj.forEach(extractImageIds);
          return;
        }
        const rec = obj as Record<string, unknown>;
        for (const [key, value] of Object.entries(rec)) {
          if (
            (key === "image_id" || key === "image") &&
            typeof value === "string"
          ) {
            imageIds.add(value);
          } else if (typeof value === "object" && value !== null) {
            extractImageIds(value);
          }
        }
      }
      extractImageIds(rawData);

      let registryImages: Record<string, any> = {};
      try {
        const reg = mediaGallery.getRegistry();
        if (reg) {
          registryImages = reg.images || {};
        }
      } catch {}

      const missingFromRegistry: string[] = [];
      const missingFromDisk: string[] = [];
      const srcToId = buildRegistrySrcToIdMap(registryImages);
      imageIds.forEach((ref) => {
        const resolved = resolveRegistryReference(ref, registryImages, srcToId);
        if (resolved === null) {
          missingFromRegistry.push(ref);
          return;
        }
        if (registryImages[resolved].src) {
          const src = String(registryImages[resolved].src);
          if (!isNonLocalFilesystemSrc(src)) {
            const srcPath = path.join(process.cwd(), src);
            if (!fs.existsSync(srcPath)) {
              missingFromDisk.push(resolved);
            }
          }
        }
      });

      const counterpartFile = context.contentFiles.find(
        (f: any) =>
          f.slug === file.slug &&
          f.type === file.type &&
          f.locale !== file.locale,
      );
      const counterpartUrl = counterpartFile
        ? getCanonicalUrl(counterpartFile)
        : null;

      const incomingRedirects: string[] = [];
      if (context.redirectMap && context.redirectMap.size > 0) {
        context.redirectMap.forEach((entry: any, from: string) => {
          if (entry.to === url) {
            incomingRedirects.push(from);
          }
        });
      }

      const issues: any[] = [];

      if (!schemaValidation.valid) {
        for (const err of schemaValidation.errors) {
          issues.push({
            type: "error",
            code: err.code,
            message: err.path ? `${err.path}: ${err.message}` : err.message,
            category: "schema-validation",
            details: {
              path: err.path,
              expected: err.expected,
              received: err.received,
            },
          });
        }
      }
      for (const err of schemaValidation.errors) {
        if (err.code === "MISSING_META") {
          issues.push({
            type: "warning",
            code: err.code,
            message: err.message,
            category: "meta",
            details: { path: err.path },
          });
        }
      }

      const schemaData = rawData.schema as
        | { include?: string[]; overrides?: Record<string, unknown> }
        | undefined;
      if (schemaData?.include) {
        const availableKeys = getAvailableSchemaKeys();
        const availableSet = new Set(availableKeys);
        for (const ref of schemaData.include) {
          if (!availableSet.has(ref)) {
            issues.push({
              type: "error",
              code: "INVALID_SCHEMA_REF",
              message: `Invalid schema reference: "${ref}"`,
              category: "schema-org",
            });
          }
        }
        if (schemaData.overrides) {
          for (const key of Object.keys(schemaData.overrides)) {
            if (!availableSet.has(key)) {
              issues.push({
                type: "error",
                code: "INVALID_SCHEMA_OVERRIDE",
                message: `Invalid schema override key: "${key}"`,
                category: "schema-org",
              });
            }
          }
        }
      }

      const meta = file.meta || {};
      let seoScore = 0;
      let seoMax = 0;

      seoMax += 20;
      if (meta.page_title) {
        seoScore += 20;
      } else {
        issues.push({
          type: "warning",
          code: "MISSING_PAGE_TITLE",
          message: "Missing page_title",
        });
      }

      seoMax += 10;
      if (
        meta.page_title &&
        meta.page_title.length >= 30 &&
        meta.page_title.length <= 60
      ) {
        seoScore += 10;
      }

      seoMax += 20;
      if (meta.description) {
        seoScore += 20;
      } else {
        issues.push({
          type: "warning",
          code: "MISSING_DESCRIPTION",
          message: "Missing description",
        });
      }

      seoMax += 10;
      if (
        meta.description &&
        meta.description.length >= 70 &&
        meta.description.length <= 160
      ) {
        seoScore += 10;
      }

      seoMax += 10;
      if (meta.og_image) seoScore += 10;

      seoMax += 10;
      if (meta.canonical_url) seoScore += 10;

      let schemaScore = 0;
      let schemaMax = 0;

      schemaMax += 30;
      if (file.schema?.include && file.schema.include.length > 0) {
        schemaScore += 30;
      }

      schemaMax += 20;
      if (parsedSchemas.length > 0) {
        schemaScore += 20;
      }

      schemaMax += 15;
      if (parsedSchemas.some((s: any) => s.name)) {
        schemaScore += 15;
      }

      schemaMax += 15;
      if (parsedSchemas.some((s: any) => s.description)) {
        schemaScore += 15;
      }

      schemaMax += 10;
      const hasPlaceholders = parsedSchemas.some((s: any) =>
        JSON.stringify(s).match(/todo/i),
      );
      if (!hasPlaceholders) {
        schemaScore += 10;
      }

      schemaMax += 10;
      if (hasFaq) {
        if (parsedSchemas.some((s: any) => s["@type"] === "FAQPage")) {
          schemaScore += 10;
        }
      } else {
        schemaScore += 10;
      }

      let contentScore = 0;
      let contentMax = 0;

      contentMax += 25;
      if (sections.length > 0) {
        contentScore += 25;
      }

      contentMax += 20;
      const allTyped = sections.every((s: any) => s.type);
      if (sections.length > 0 && allTyped) {
        contentScore += 20;
      }

      contentMax += 20;
      if (counterpartFile) {
        contentScore += 20;
      }

      const emptyFields: string[] = [];
      function findEmptyFields(obj: unknown, path: string = ""): void {
        if (!obj || typeof obj !== "object") return;
        if (Array.isArray(obj)) {
          obj.forEach((item, i) => findEmptyFields(item, `${path}[${i}]`));
          return;
        }
        const rec = obj as Record<string, unknown>;
        const criticalKeys = new Set([
          "title",
          "heading",
          "description",
          "subtitle",
          "tagline",
        ]);
        for (const [key, value] of Object.entries(rec)) {
          const fieldPath = path ? `${path}.${key}` : key;
          if (
            criticalKeys.has(key) &&
            typeof value === "string" &&
            value.trim() === ""
          ) {
            emptyFields.push(fieldPath);
          } else if (typeof value === "object" && value !== null) {
            findEmptyFields(value, fieldPath);
          }
        }
      }
      findEmptyFields(rawData);

      contentMax += 20;
      if (missingFromRegistry.length === 0 && missingFromDisk.length === 0) {
        contentScore += 20;
      }

      const seoPercent = seoMax > 0 ? Math.round((seoScore / seoMax) * 100) : 0;
      const schemaPercent =
        schemaMax > 0 ? Math.round((schemaScore / schemaMax) * 100) : 0;
      const contentPercent =
        contentMax > 0 ? Math.round((contentScore / contentMax) * 100) : 0;
      const totalScore = Math.round(
        (seoPercent + schemaPercent + contentPercent) / 3,
      );

      res.json({
        url,
        contentType: file.type,
        slug: file.slug,
        locale: file.locale,
        filePath: file.filePath,
        title: file.title,

        schemaValidation,

        meta: {
          page_title: meta.page_title || null,
          titleLength: meta.page_title ? meta.page_title.length : 0,
          description: meta.description || null,
          descriptionLength: meta.description ? meta.description.length : 0,
          og_image: meta.og_image || null,
          canonical_url: meta.canonical_url || null,
          robots: meta.robots || null,
        },

        schema: {
          configured: !!(
            file.schema?.include && file.schema.include.length > 0
          ),
          includes: file.schema?.include || [],
          renderedJsonLd: parsedSchemas,
          htmlPreview: schemaHtml,
        },

        sections: {
          count: sections.length,
          types: sectionTypes,
          hasFaq,
        },

        images: {
          referencedIds: Array.from(imageIds),
          missingFromRegistry,
          missingFromDisk,
        },

        translations: {
          locale: file.locale,
          availableLocales: [
            file.locale,
            ...(counterpartFile ? [counterpartFile.locale] : []),
          ],
          counterpartUrl,
        },

        redirects: {
          incomingRedirects,
        },

        emptyFields,

        issues,

        score: {
          total: totalScore,
          seo: seoPercent,
          schema: schemaPercent,
          content: contentPercent,
        },
      });
    } catch (error) {
      console.error("Diagnostics page error:", error);
      res.status(500).json({ error: "Failed to generate page diagnostics" });
    }
  });

  // ============================================
  // Lighthouse / PageSpeed Insights API
  // ============================================

  app.get("/api/admin/lighthouse/config", (_req, res) => {
    res.json({
      hasSiteUrl: !!process.env.SITE_URL,
      hasApiKey: !!process.env.GOOGLE_PSI_API_KEY,
      gcsAvailable: gcs.available,
    });
  });

  app.get("/api/admin/lighthouse/pages", async (_req, res) => {
    const siteBaseUrl = process.env.SITE_URL?.replace(/\/$/, "");
    if (!siteBaseUrl) {
      res.status(400).json({ error: "SITE_URL is not set" });
      return;
    }
    try {
      const service = getValidationService();
      let context = service.getContext();
      if (!context) {
        context = await service.buildContext();
      }
      const seen = new Set<string>();
      const pages: { slug: string; url: string; title: string; priority: number; type: string }[] = [];
      for (const file of context.contentFiles) {
        if (file.locale !== "en") continue;
        const canonicalPath = getCanonicalUrl(file);
        if (canonicalPath.startsWith("/private")) continue;
        const fullUrl = file.meta?.canonical_url
          ? file.meta.canonical_url
          : `${siteBaseUrl}${canonicalPath}`;
        if (seen.has(fullUrl)) continue;
        seen.add(fullUrl);
        pages.push({
          slug: file.slug,
          url: fullUrl,
          title: file.title || file.slug,
          priority: file.meta?.priority ?? 0.5,
          type: file.type,
        });
      }
      pages.sort((a, b) => b.priority - a.priority);
      res.json(pages);
    } catch (err) {
      console.error("[Lighthouse] pages error:", err);
      res.status(500).json({ error: "Failed to load pages" });
    }
  });

  app.get("/api/admin/lighthouse/reports", async (_req, res) => {
    try {
      if (!gcs.available) {
        res.json({ runs: [], latestRun: null });
        return;
      }
      const keys: string[] = await gcs.list("reports/lighthouse/");
      const dateSet = new Set<string>();
      for (const key of keys) {
        const m = key.match(/^reports\/lighthouse\/(\d{4}-\d{2}-\d{2})\//);
        if (m) dateSet.add(m[1]);
      }
      const dates = Array.from(dateSet).sort().reverse().slice(0, 5);
      const runs: { date: string; pageCount: number; avgPerformanceScore: number; worstPage: { slug: string; score: number } | null }[] = [];
      for (const date of dates) {
        try {
          const buf: Buffer | null = await gcs.download(`reports/lighthouse/${date}/_summary.json`);
          if (!buf) continue;
          const pages = JSON.parse(buf.toString()) as { slug: string; performanceScore: number }[];
          if (!Array.isArray(pages) || pages.length === 0) continue;
          const avgPerformanceScore = Math.round(
            pages.reduce((s, p) => s + p.performanceScore, 0) / pages.length
          );
          const worstPage = pages[0] ? { slug: pages[0].slug, score: pages[0].performanceScore } : null;
          runs.push({ date, pageCount: pages.length, avgPerformanceScore, worstPage });
        } catch {
          /* skip bad runs */
        }
      }
      res.json({ runs, latestRun: runs[0]?.date ?? null });
    } catch (err) {
      console.error("[Lighthouse] reports error:", err);
      res.json({ runs: [], latestRun: null });
    }
  });

  app.get("/api/admin/lighthouse/reports/:date", async (req, res) => {
    try {
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: "Invalid date format" });
        return;
      }
      if (!gcs.available) {
        res.status(404).json({ error: "GCS not available" });
        return;
      }
      const buf: Buffer | null = await gcs.download(`reports/lighthouse/${date}/_summary.json`);
      if (!buf) {
        res.status(404).json({ error: "Report not found" });
        return;
      }
      const pages = JSON.parse(buf.toString());
      res.json(pages);
    } catch (err) {
      console.error("[Lighthouse] report date error:", err);
      res.status(500).json({ error: "Failed to load report" });
    }
  });

  app.post("/api/admin/lighthouse/run", async (req, res) => {
    req.setTimeout(180_000);
    try {
      const siteBaseUrl = process.env.SITE_URL?.replace(/\/$/, "");
      if (!siteBaseUrl) {
        res.status(400).json({ error: "SITE_URL is not set" });
        return;
      }
      const apiKey = process.env.GOOGLE_PSI_API_KEY;

      const rawUrls = req.body?.urls;
      if (rawUrls !== undefined && rawUrls !== null) {
        if (!Array.isArray(rawUrls) || rawUrls.some((u: unknown) => typeof u !== "string")) {
          res.status(400).json({ error: "urls must be an array of strings" });
          return;
        }
      }
      let urlList: string[] = Array.isArray(rawUrls) ? (rawUrls as string[]) : [];
      if (!gcs.available) {
        res.status(503).json({ error: "GCS is not configured — reports cannot be persisted" });
        return;
      }

      if (!urlList.length) {
        const service = getValidationService();
        let context = service.getContext();
        if (!context) context = await service.buildContext();
        const seen = new Set<string>();
        for (const file of context.contentFiles) {
          if (file.locale !== "en") continue;
          const canonicalPath = getCanonicalUrl(file);
          if (canonicalPath.startsWith("/private")) continue;
          const fullUrl = file.meta?.canonical_url
            ? file.meta.canonical_url
            : `${siteBaseUrl}${canonicalPath}`;
          if (seen.has(fullUrl)) continue;
          seen.add(fullUrl);
          urlList.push(fullUrl);
        }
      }

      const { auditUrl, buildPageReport, safeReportFilename } = await import(
        "../scripts/validation/validators/lighthouse"
      );
      type PageReport = Awaited<ReturnType<typeof buildPageReport>>;

      const d = new Date();
      const dateDir = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const gcsPrefix = `reports/lighthouse/${dateDir}`;

      function sleep(ms: number): Promise<void> {
        return new Promise((r) => setTimeout(r, ms));
      }

      const pages: PageReport[] = [];

      for (let i = 0; i < urlList.length; i++) {
        const url = urlList[i];
        if (i > 0) await sleep(500);

        try {
          const slug = url.replace(siteBaseUrl, "").replace(/^\//, "").replace(/\//g, "--") || "home";
          const data = await auditUrl(url, apiKey);
          const report = buildPageReport(url, slug, data);

          const filename = safeReportFilename(slug, url);
          await gcs.upload(
            `${gcsPrefix}/${filename}`,
            Buffer.from(JSON.stringify(report, null, 2)),
            "application/json",
            { cacheControl: "no-store" }
          );
          pages.push(report);
        } catch {
          /* non-fatal — skip this page */
        }
      }

      const sorted = [...pages].sort((a, b) => a.performanceScore - b.performanceScore);
      await gcs.upload(
        `${gcsPrefix}/_summary.json`,
        Buffer.from(JSON.stringify(sorted, null, 2)),
        "application/json",
        { cacheControl: "no-store" }
      );

      const avgPerformanceScore = pages.length
        ? Math.round(pages.reduce((s, p) => s + p.performanceScore, 0) / pages.length)
        : 0;

      res.json({ date: dateDir, pageCount: pages.length, avgPerformanceScore });
    } catch (err) {
      console.error("[Lighthouse] run error:", err);
      res.status(500).json({ error: "Audit failed", message: String(err) });
    }
  });

  // ============================================
  // AI Content Adaptation API
  // ============================================

  // Adapt content using AI with layered context
  app.post("/api/content/adapt-with-ai", async (req, res) => {
    try {
      const { getContentAdapter } = await import("./ai");

      const {
        contentType,
        contentSlug,
        targetComponent,
        targetVersion,
        targetVariant,
        sourceYaml,
        targetExampleYaml,
        targetStructure,
        userOverrides,
      } = req.body;

      // Validate required fields
      if (
        !contentType ||
        !contentSlug ||
        !targetComponent ||
        !targetVersion ||
        !sourceYaml
      ) {
        res.status(400).json({
          error: "Missing required fields",
          required: [
            "contentType",
            "contentSlug",
            "targetComponent",
            "targetVersion",
            "sourceYaml",
          ],
        });
        return;
      }

      // Validate content type
      if (!isValidType(contentType)) {
        res.status(400).json({
          error: "Invalid content type",
          validTypes: getAllFolders(),
        });
        return;
      }

      const adapter = getContentAdapter();
      // Use structured output for schema-enforced AI responses
      const result = await adapter.adaptStructured({
        contentType,
        contentSlug,
        targetComponent,
        targetVersion,
        targetVariant,
        sourceYaml,
        targetExampleYaml,
        targetStructure,
        userOverrides,
      });

      res.json(result);
    } catch (error) {
      console.error("AI adaptation error:", error);
      res.status(500).json({
        error: "AI adaptation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Clear AI context cache
  app.post("/api/content/clear-ai-cache", (_req, res) => {
    try {
      const { getContentAdapter } = require("./ai");
      const adapter = getContentAdapter();
      adapter.clearCache();
      res.json({ success: true, message: "AI context cache cleared" });
    } catch (error) {
      res.status(500).json({
        error: "Failed to clear cache",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/ai/analyze-data-payload", async (req, res) => {
    try {
      const { analyzeDataPayload } = await import(
        "./ai/generateTableFromPayload"
      );

      const { sampleData, availableKeys } = req.body;

      if (
        !sampleData ||
        !Array.isArray(sampleData) ||
        sampleData.length === 0
      ) {
        res.status(400).json({ error: "sampleData must be a non-empty array" });
        return;
      }
      if (
        !availableKeys ||
        !Array.isArray(availableKeys) ||
        availableKeys.length === 0
      ) {
        res
          .status(400)
          .json({ error: "availableKeys must be a non-empty array" });
        return;
      }

      const locale = req.body.locale || getDefaultLocale();
      const analysis = await analyzeDataPayload({
        sampleData,
        availableKeys,
        locale,
      });
      res.json(analysis);
    } catch (error: any) {
      console.error("Error analyzing data payload:", error?.message || error);
      const message = error?.message || "Failed to analyze data";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/ai/generate-table-from-payload", async (req, res) => {
    try {
      const { generateTableFromPayload } = await import(
        "./ai/generateTableFromPayload"
      );

      const { sampleData, availableKeys, userPrompt } = req.body;

      if (
        !sampleData ||
        !Array.isArray(sampleData) ||
        sampleData.length === 0
      ) {
        res.status(400).json({ error: "sampleData must be a non-empty array" });
        return;
      }
      if (
        !availableKeys ||
        !Array.isArray(availableKeys) ||
        availableKeys.length === 0
      ) {
        res
          .status(400)
          .json({ error: "availableKeys must be a non-empty array" });
        return;
      }
      if (!userPrompt || typeof userPrompt !== "string") {
        res
          .status(400)
          .json({ error: "userPrompt must be a non-empty string" });
        return;
      }

      const locale = req.body.locale || getDefaultLocale();
      const config = await generateTableFromPayload({
        sampleData,
        availableKeys,
        userPrompt,
        locale,
      });
      res.json(config);
    } catch (error: any) {
      console.error("Error generating table config:", error?.message || error);
      const message =
        error?.message || "Failed to generate table configuration";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/ai/refine-table-config", async (req, res) => {
    try {
      const { refineTableConfig } = await import(
        "./ai/generateTableFromPayload"
      );

      const { currentConfig, sampleData, availableKeys, userFeedback, locale } =
        req.body;

      if (!currentConfig || !currentConfig.columns) {
        res
          .status(400)
          .json({ error: "currentConfig with columns is required" });
        return;
      }
      if (
        !sampleData ||
        !Array.isArray(sampleData) ||
        sampleData.length === 0
      ) {
        res.status(400).json({ error: "sampleData must be a non-empty array" });
        return;
      }
      if (!userFeedback || typeof userFeedback !== "string") {
        res
          .status(400)
          .json({ error: "userFeedback must be a non-empty string" });
        return;
      }

      const config = await refineTableConfig({
        currentConfig,
        sampleData,
        availableKeys: availableKeys || [],
        userFeedback,
        locale: locale || "en",
      });
      res.json(config);
    } catch (error: any) {
      console.error("Error refining table config:", error?.message || error);
      const message = error?.message || "Failed to refine table configuration";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/ai/generate-global-filter", async (req, res) => {
    try {
      const { generateGlobalFilter } = await import(
        "./ai/generateTableFromPayload"
      );

      const {
        sampleData,
        availableKeys,
        userPrompt,
        currentFilter,
        locale,
        sessionContext,
      } = req.body;

      if (
        !sampleData ||
        !Array.isArray(sampleData) ||
        sampleData.length === 0
      ) {
        res.status(400).json({ error: "sampleData must be a non-empty array" });
        return;
      }
      if (!userPrompt || typeof userPrompt !== "string") {
        res
          .status(400)
          .json({ error: "userPrompt must be a non-empty string" });
        return;
      }

      const result = await generateGlobalFilter({
        sampleData,
        availableKeys: availableKeys || [],
        userPrompt,
        currentFilter: currentFilter || undefined,
        locale: locale || "en",
        sessionContext: sessionContext || undefined,
      });
      res.json(result);
    } catch (error: any) {
      console.error("Error generating global filter:", error?.message || error);
      const message = error?.message || "Failed to generate global filter";
      res.status(500).json({ error: message });
    }
  });

  // ============================================
  // Centralized FAQs API
  // ============================================

  // Get centralized FAQs from YAML file
  app.get("/api/testimonials/:locale", (req, res) => {
    const { locale } = req.params;
    const normalizedLocale = normalizeLocale(locale);

    const testimonialsPath = path.join(
      process.cwd(),
      "marketing-content",
      "testimonials",
      `${normalizedLocale}.yml`,
    );

    if (!fs.existsSync(testimonialsPath)) {
      res.status(404).json({ error: "Testimonials not found for locale" });
      return;
    }

    try {
      const content = fs.readFileSync(testimonialsPath, "utf8");
      const data = safeYamlLoad(content) as unknown[];
      res.json({ testimonials: data || [] });
    } catch (error) {
      console.error("Error loading testimonials:", error);
      res.status(500).json({ error: "Failed to load testimonials" });
    }
  });

  app.get("/api/faqs/:locale", (req, res) => {
    const { locale } = req.params;
    const normalizedLocale = normalizeLocale(locale);

    const faqsPath = path.join(
      process.cwd(),
      "marketing-content",
      "faqs",
      `${normalizedLocale}.yml`,
    );

    if (!fs.existsSync(faqsPath)) {
      res.status(404).json({ error: "FAQs not found for locale" });
      return;
    }

    try {
      const content = fs.readFileSync(faqsPath, "utf8");
      const data = safeYamlLoad(content) as { faqs: unknown[] };
      res.json(data);
    } catch (error) {
      console.error("Error loading FAQs:", error);
      res.status(500).json({ error: "Failed to load FAQs" });
    }
  });

  // Save centralized FAQs to YAML file (edit mode only)
  app.post("/api/faqs/:locale", async (req, res) => {
    try {
      const { locale } = req.params;
      const normalizedLocale = normalizeLocale(locale);

      const auth = await requireCapability(req, res, "content_edit_text", "faq");
      if (!auth.authorized) return;

      const { faqs } = req.body;

      if (!faqs || !Array.isArray(faqs)) {
        res.status(400).json({ error: "Missing required field: faqs (array)" });
        return;
      }

      const faqsPath = path.join(
        process.cwd(),
        "marketing-content",
        "faqs",
        `${normalizedLocale}.yml`,
      );

      // Generate YAML with comment header
      const header = `# Centralized FAQ Data - ${normalizedLocale === "en" ? "English" : "Spanish"}
# All FAQs should be stored here and referenced by pages via related_features filter
# No HTML tags - plain text only

`;
      const yamlContent =
        header +
        safeYamlDump(
          { faqs },
          {
            lineWidth: -1,
            quotingType: '"',
            forceQuotes: false,
            flowLevel: -1,
          },
        );

      fs.writeFileSync(faqsPath, yamlContent, "utf8");

      // Clear relevant caches
      clearSitemapCache();
      invalidateContentCaches();

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving FAQs:", error);
      res.status(500).json({ error: "Failed to save FAQs" });
    }
  });

  // ============================================
  // AI Chat Widget Routes (public)
  // ============================================

  interface ParsedLLMConfig {
    provider?: { api_key_env?: string; base_url_env?: string };
    model?: string | { default: string; chat?: string };
    temperature?: number;
    max_tokens?: number;
    question_tags?: string[];
    agent_tools?: Array<{ name: string; description: string; enabled: boolean }>;
    chat_bubble?: { enabled?: boolean; page_patterns?: string[]; content_types?: string[]; agent_name?: string; agent_icon?: string };
    prompt_role?: string;
    prompt_personality?: string;
    prompt_instructions?: string;
    prompt_fallback?: string;
    empty_conversation_grace_minutes?: number;
  }

  function loadLLMConfig(): ParsedLLMConfig {
    const llmPath = path.resolve("marketing-content/llm.yml");
    if (!fs.existsSync(llmPath)) return {};
    const raw = yaml.load(fs.readFileSync(llmPath, "utf-8"));
    if (!raw || typeof raw !== "object") return {};
    return raw as ParsedLLMConfig;
  }

  function loadFeatureTags(): string[] {
    const settingsPath = path.resolve("marketing-content/settings.yml");
    if (!fs.existsSync(settingsPath)) return [];
    const raw = yaml.load(fs.readFileSync(settingsPath, "utf-8"));
    if (!raw || typeof raw !== "object") return [];
    const settings = raw as Record<string, unknown>;
    return Array.isArray(settings.feature_tags) ? settings.feature_tags : [];
  }

  function deriveFeatureTags(
    contentType: string | null,
    pageUrl: string | null,
    allTags: string[]
  ): string[] {
    const tags: string[] = [];
    if (contentType && allTags.includes(contentType)) {
      tags.push(contentType);
    }
    if (pageUrl) {
      for (const tag of allTags) {
        if (!tags.includes(tag) && pageUrl.toLowerCase().includes(tag.toLowerCase())) {
          tags.push(tag);
        }
      }
      if (pageUrl.match(/pricing|cost|tuition|financ/i)) {
        if (allTags.includes("pricing") && !tags.includes("pricing")) tags.push("pricing");
        if (allTags.includes("financial-aid") && !tags.includes("financial-aid")) tags.push("financial-aid");
      }
      if (pageUrl.match(/enroll|apply|admission/i)) {
        if (allTags.includes("enrollment") && !tags.includes("enrollment")) tags.push("enrollment");
        if (allTags.includes("admissions") && !tags.includes("admissions")) tags.push("admissions");
      }
      if (pageUrl.match(/career|job|employ/i)) {
        if (allTags.includes("career-services") && !tags.includes("career-services")) tags.push("career-services");
      }
      if (pageUrl.match(/curriculum|syllabus|program/i)) {
        if (allTags.includes("curriculum") && !tags.includes("curriculum")) tags.push("curriculum");
      }
    }
    return tags;
  }

  async function requireAdminAuth(
    req: Request,
    res: Response
  ): Promise<{ authorized: boolean; token?: string }> {
    const result = await requireCapability(req, res, "users_manage");
    return { authorized: result.authorized, token: result.token ?? undefined };
  }

  // ─── Admin: Roles API ────────────────────────────────────────────────────────

  app.get("/api/admin/roles", async (req, res) => {
    const auth = await requireCapability(req, res, "users_manage");
    if (!auth.authorized) return;
    res.json(userStore.getAllRoles());
  });

  function validateRoleCapabilities(capabilities: unknown): { ok: boolean; error?: string; valid?: import("./user-store").CapabilityGrant[] } {
    if (!Array.isArray(capabilities)) {
      return { ok: false, error: "capabilities must be an array" };
    }
    const knownContentTypes = contentIndex.getContentTypes();
    const valid: import("./user-store").CapabilityGrant[] = [];
    for (const cap of capabilities) {
      if (!cap || typeof cap.name !== "string") {
        return { ok: false, error: "Each capability must have a 'name' string field" };
      }
      if (!userStore.ALL_CAPABILITIES.includes(cap.name as import("./user-store").CapabilityName)) {
        return { ok: false, error: `Unknown capability: ${cap.name}` };
      }
      // Validate contentTypes if provided (must be "*", undefined, or an array of known content type IDs)
      const ct = cap.contentTypes;
      if (ct !== undefined && ct !== "*") {
        if (!Array.isArray(ct)) {
          return { ok: false, error: `contentTypes for '${cap.name}' must be "*" or an array of content type IDs` };
        }
        if (knownContentTypes.length > 0) {
          const unknownTypes = ct.filter((t: unknown) => typeof t === "string" && !knownContentTypes.includes(t));
          if (unknownTypes.length > 0) {
            return { ok: false, error: `Unknown content type(s) in '${cap.name}': ${unknownTypes.join(", ")}` };
          }
        }
      }
      valid.push({ name: cap.name as import("./user-store").CapabilityName, contentTypes: ct ?? undefined });
    }
    return { ok: true, valid };
  }

  app.post("/api/admin/roles", async (req, res) => {
    const auth = await requireCapability(req, res, "users_manage");
    if (!auth.authorized) return;
    const { id, label, description, capabilities } = req.body;
    if (!id || !label || !Array.isArray(capabilities)) {
      res.status(400).json({ error: "Missing required fields: id, label, capabilities" });
      return;
    }
    if (!/^[a-z][a-z0-9_-]*$/.test(id)) {
      res.status(400).json({ error: "Role id must be lowercase letters, numbers, hyphens, or underscores" });
      return;
    }
    const capCheck = validateRoleCapabilities(capabilities);
    if (!capCheck.ok) {
      res.status(400).json({ error: capCheck.error });
      return;
    }
    userStore.setRole(id, { label, description: description || undefined, capabilities: capCheck.valid! });
    res.json({ ok: true });
  });

  app.put("/api/admin/roles/:roleId", async (req, res) => {
    const auth = await requireCapability(req, res, "users_manage");
    if (!auth.authorized) return;
    const { roleId } = req.params;
    const { label, description, capabilities } = req.body;
    if (!label || !Array.isArray(capabilities)) {
      res.status(400).json({ error: "Missing required fields: label, capabilities" });
      return;
    }
    const capCheck = validateRoleCapabilities(capabilities);
    if (!capCheck.ok) {
      res.status(400).json({ error: capCheck.error });
      return;
    }
    // create-or-update semantics: PUT creates if not exists, updates if exists
    userStore.setRole(roleId, { label, description: description || undefined, capabilities: capCheck.valid! });
    res.json({ ok: true });
  });

  app.delete("/api/admin/roles/:roleId", async (req, res) => {
    const auth = await requireCapability(req, res, "users_manage");
    if (!auth.authorized) return;
    const result = userStore.deleteRole(req.params.roleId);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  // ─── Admin: Users API ────────────────────────────────────────────────────────

  app.get("/api/admin/users", async (req, res) => {
    const auth = await requireCapability(req, res, "users_manage");
    if (!auth.authorized) return;
    res.json(userStore.getAllUsers());
  });

  app.put("/api/admin/users/:username/roles", async (req, res) => {
    const auth = await requireCapability(req, res, "users_manage");
    if (!auth.authorized) return;
    const { username } = req.params;
    const { roles } = req.body;
    if (!Array.isArray(roles)) {
      res.status(400).json({ error: "roles must be an array of role ids" });
      return;
    }
    const allRoles = userStore.getAllRoles();
    const invalid = roles.filter((r: string) => !allRoles[r]);
    if (invalid.length > 0) {
      res.status(400).json({ error: `Unknown role(s): ${invalid.join(", ")}` });
      return;
    }
    userStore.assignRoles(username, roles);
    res.json({ ok: true });
  });

  app.delete("/api/admin/users/:username", async (req, res) => {
    const auth = await requireCapability(req, res, "users_manage");
    if (!auth.authorized) return;
    const result = userStore.deleteUser(req.params.username);
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  app.get("/api/chat/config", (_req, res) => {
    try {
      const cfg = loadLLMConfig();
      const bubble = cfg.chat_bubble || {};
      res.json({
        enabled: bubble.enabled !== false,
        page_patterns: bubble.page_patterns || [],
        content_types: bubble.content_types || [],
        agent_name: bubble.agent_name || null,
        agent_icon: bubble.agent_icon || null,
      });
    } catch (err) {
      console.error("[Chat Config] Error:", err);
      res.json({ enabled: false, page_patterns: [], content_types: [] });
    }
  });

  app.post("/api/chat/start", async (req, res) => {
    try {
      const { conversationStore } = await import("./ai/ConversationStore");
      const { page_url, content_type, content_slug, locale, user_id } = req.body || {};

      const allFeatureTags = loadFeatureTags();
      const derivedTags = deriveFeatureTags(content_type || null, page_url || null, allFeatureTags);

      const conv = await conversationStore.createConversation({
        page_url: page_url || null,
        content_type: content_type || null,
        content_slug: content_slug || null,
        locale: locale || "en",
        feature_tags: derivedTags,
        user_id: user_id || null,
      });

      res.json({ conversation_id: conv.id });
    } catch (err) {
      console.error("[Chat Start] Error:", err);
      res.status(500).json({ error: "Failed to start conversation" });
    }
  });

  app.post("/api/chat/message", async (req, res) => {
    try {
      const { getAgentService } = await import("./ai/AgentService");
      const { conversationStore } = await import("./ai/ConversationStore");

      const { conversation_id, message, content_type, content_slug, locale } = req.body || {};

      if (!conversation_id || !message) {
        return res.status(400).json({ error: "conversation_id and message are required" });
      }

      await conversationStore.addMessage({
        conversation_id,
        role: "user",
        content: message,
      });

      const { contentCompiler } = await import("./ai/ContentCompiler");
      const agent = getAgentService();
      const result = await agent.processMessage(
        conversation_id,
        message,
        content_type || null,
        content_slug || null,
        locale || "en"
      );

      const assistantMsg = await conversationStore.addMessage({
        conversation_id,
        role: "assistant",
        content: result.content,
        question_tag: result.questionTag,
      });

      const compiled = contentCompiler.compile(content_type || null, content_slug || null, locale || "en");
      conversationStore.saveContextSnapshot(conversation_id, {
        pageContext: compiled.pageContext,
        globalSummary: compiled.globalSummary,
        contentType: content_type || null,
        contentSlug: content_slug || null,
        locale: locale || "en",
      }).catch(() => {});

      res.json({
        id: assistantMsg.id,
        content: result.content,
        question_tag: result.questionTag,
        trace: result.trace,
      });
    } catch (err) {
      console.error("[Chat Message] Error:", err);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  app.get("/api/admin/ai/tool-definitions", async (req, res) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth.authorized) return;

      const { TOOL_DEFINITIONS } = await import("./ai/tools/index");
      const definitions = TOOL_DEFINITIONS.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      }));
      res.json({ tools: definitions });
    } catch (err) {
      console.error("[AI Tool Definitions] Error:", err);
      res.status(500).json({ error: "Failed to load tool definitions" });
    }
  });

  app.get("/api/admin/ai/question-tags", async (req, res) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth.authorized) return;

      const llmConfig = loadLLMConfig();
      res.json({ question_tags: llmConfig.question_tags || [] });
    } catch (err) {
      console.error("[AI Question Tags] Error:", err);
      res.status(500).json({ error: "Failed to load question tags" });
    }
  });

  // ============================================
  // AI Admin Routes (webmaster capability required)
  // ============================================
  app.get("/api/admin/ai/knowledge", async (req, res) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth.authorized) return;

      const { conversationStore } = await import("./ai/ConversationStore");
      const knowledge = await conversationStore.getAllKnowledge();

      const llmConfig = loadLLMConfig();

      const modelDefault = typeof llmConfig.model === "object" ? llmConfig.model?.default || "" : llmConfig.model || "";
      const modelChat = typeof llmConfig.model === "object" ? llmConfig.model?.chat || "" : "";

      res.json({
        system_prompt: knowledge.system_prompt || null,
        prompt_role: knowledge.prompt_role || llmConfig.prompt_role || "",
        prompt_personality: knowledge.prompt_personality || llmConfig.prompt_personality || "",
        prompt_instructions: knowledge.prompt_instructions || llmConfig.prompt_instructions || "",
        prompt_fallback: knowledge.prompt_fallback || llmConfig.prompt_fallback || "",
        custom_knowledge: knowledge.custom_knowledge || [],
        pinned_qa: knowledge.pinned_qa || [],
        agent_tools: llmConfig.agent_tools || [],
        chat_bubble: llmConfig.chat_bubble || {},
        question_tags: llmConfig.question_tags || [],
        empty_conversation_grace_minutes: llmConfig.empty_conversation_grace_minutes ?? 15,
        model_default: modelDefault,
        model_chat: modelChat,
      });
    } catch (err) {
      console.error("[AI Knowledge GET] Error:", err);
      res.status(500).json({ error: "Failed to load knowledge" });
    }
  });

  app.post("/api/admin/ai/knowledge", async (req, res) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth.authorized) return;

      const { conversationStore } = await import("./ai/ConversationStore");
      const { key, value, updated_by } = req.body || {};

      if (!key || value === undefined) {
        return res.status(400).json({ error: "key and value are required" });
      }

      await conversationStore.setKnowledge(key, value, updated_by);
      res.json({ success: true });
    } catch (err) {
      console.error("[AI Knowledge POST] Error:", err);
      res.status(500).json({ error: "Failed to save knowledge" });
    }
  });

  app.patch("/api/admin/ai/knowledge", async (req, res) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth.authorized) return;

      const { conversationStore } = await import("./ai/ConversationStore");
      const updates = req.body || {};

      for (const [key, value] of Object.entries(updates)) {
        if (key === "updated_by" || key === "empty_conversation_grace_minutes" || key === "model_default" || key === "model_chat") continue;
        await conversationStore.setKnowledge(key, value, updates.updated_by);
      }

      if (updates.empty_conversation_grace_minutes !== undefined) {
        const raw = Number(updates.empty_conversation_grace_minutes);
        if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw < 1) {
          return res.status(400).json({ error: "empty_conversation_grace_minutes must be a positive integer" });
        }
        updates.empty_conversation_grace_minutes = raw;
      }

      const hasLlmUpdates = updates.agent_tools || updates.chat_bubble || updates.empty_conversation_grace_minutes !== undefined || updates.model_default !== undefined || updates.model_chat !== undefined;
      if (hasLlmUpdates) {
        const llmPath = path.resolve("marketing-content/llm.yml");
        if (fs.existsSync(llmPath)) {
          const llmConfig = loadLLMConfig();
          const mutableConfig: Record<string, unknown> = { ...llmConfig };
          if (updates.agent_tools) mutableConfig.agent_tools = updates.agent_tools;
          if (updates.chat_bubble) mutableConfig.chat_bubble = updates.chat_bubble;
          if (updates.empty_conversation_grace_minutes !== undefined) mutableConfig.empty_conversation_grace_minutes = updates.empty_conversation_grace_minutes;
          if (updates.model_default !== undefined || updates.model_chat !== undefined) {
            const existing = typeof mutableConfig.model === "object" && mutableConfig.model !== null
              ? mutableConfig.model as Record<string, string>
              : { default: typeof mutableConfig.model === "string" ? mutableConfig.model : "" };
            const modelObj: Record<string, string> = { ...existing };
            if (updates.model_default !== undefined) modelObj.default = updates.model_default;
            if (updates.model_chat !== undefined) modelObj.chat = updates.model_chat;
            if (!modelObj.chat) delete modelObj.chat;
            mutableConfig.model = modelObj;
          }
          fs.writeFileSync(llmPath, yaml.dump(mutableConfig, { lineWidth: -1 }), "utf-8");
        }

        const { getAgentService } = await import("./ai/AgentService");
        getAgentService().reload();
      }

      res.json({ success: true });
    } catch (err) {
      console.error("[AI Knowledge PATCH] Error:", err);
      res.status(500).json({ error: "Failed to update knowledge" });
    }
  });

  app.get("/api/admin/ai/conversations", async (req, res) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth.authorized) return;

      const { conversationStore } = await import("./ai/ConversationStore");
      const filters = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        pageUrl: req.query.pageUrl as string | undefined,
        featureTag: req.query.featureTag as string | undefined,
        questionTag: req.query.questionTag as string | undefined,
        rating: req.query.rating as string | undefined,
      };

      const result = await conversationStore.listConversations(filters);
      res.json(result);
    } catch (err) {
      console.error("[AI Conversations GET] Error:", err);
      res.status(500).json({ error: "Failed to load conversations" });
    }
  });

  app.patch("/api/admin/ai/conversations/:id/messages/:msgId", async (req, res) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth.authorized) return;

      let raterName = "admin";
      if (auth.token) {
        try {
          const meResponse = await fetch(
            `${BREATHECODE_HOST}/v1/auth/user/me`,
            { method: "GET", headers: { Authorization: `Token ${auth.token}` } }
          );
          if (meResponse.ok) {
            const meData = await meResponse.json() as Record<string, string>;
            raterName = meData.first_name || meData.email || "admin";
          }
        } catch {}
      }

      const { conversationStore } = await import("./ai/ConversationStore");
      const { rating, override_content } = req.body || {};

      let msg = null;
      if (rating) {
        msg = await conversationStore.rateMessage(req.params.msgId, rating, raterName);
      }
      if (override_content !== undefined) {
        msg = await conversationStore.overrideMessage(req.params.msgId, override_content, raterName);
      }

      if (!msg) {
        return res.status(404).json({ error: "Message not found" });
      }

      res.json(msg);
    } catch (err) {
      console.error("[AI Message PATCH] Error:", err);
      res.status(500).json({ error: "Failed to update message" });
    }
  });

  app.post("/api/admin/ai/conversations/cluster", async (req, res) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth.authorized) return;

      const { getAgentService } = await import("./ai/AgentService");
      const { conversationStore } = await import("./ai/ConversationStore");

      const recentMessages = await conversationStore.getRecentUserMessages(200);

      const llmConfig = loadLLMConfig();
      const tags = llmConfig.question_tags || [];

      const agent = getAgentService();
      const clusters = await agent.clusterQuestions(recentMessages, tags);

      res.json({ clusters, total_questions: recentMessages.length });
    } catch (err) {
      console.error("[AI Cluster] Error:", err);
      res.status(500).json({ error: "Failed to cluster questions" });
    }
  });

  app.post("/api/admin/ai/knowledge/preview", async (req, res) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth.authorized) return;

      const { getAgentService } = await import("./ai/AgentService");
      const { contentCompiler } = await import("./ai/ContentCompiler");

      const { question, url, content_type, content_slug, locale } = req.body || {};

      if (!question) {
        return res.status(400).json({ error: "question is required" });
      }

      let derivedContentType = content_type || null;
      let derivedContentSlug = content_slug || null;
      let derivedLocale = locale || "en";

      if (url && !content_type && !content_slug) {
        const programEnMatch = (url as string).match(/\/en\/career-programs\/([^/?#]+)/);
        const programEsMatch = (url as string).match(/\/es\/programas-de-carrera\/([^/?#]+)/);
        const locationEnMatch = (url as string).match(/\/en\/location\/([^/?#]+)/);
        const locationEsMatch = (url as string).match(/\/es\/ubicacion\/([^/?#]+)/);
        const localeMatch = (url as string).match(/\/(en|es)\//);

        if (programEnMatch) { derivedContentType = "program"; derivedContentSlug = programEnMatch[1]; derivedLocale = "en"; }
        else if (programEsMatch) { derivedContentType = "program"; derivedContentSlug = programEsMatch[1]; derivedLocale = "es"; }
        else if (locationEnMatch) { derivedContentType = "location"; derivedContentSlug = locationEnMatch[1]; derivedLocale = "en"; }
        else if (locationEsMatch) { derivedContentType = "location"; derivedContentSlug = locationEsMatch[1]; derivedLocale = "es"; }
        else if (localeMatch) { derivedLocale = localeMatch[1]; }
      }

      const compiled = contentCompiler.compile(derivedContentType, derivedContentSlug, derivedLocale);

      const agent = getAgentService();
      const response = await agent.processMessage(
        "preview-" + Date.now(),
        question,
        derivedContentType,
        derivedContentSlug,
        derivedLocale
      );

      res.json({
        context: compiled,
        response: response.content,
        question_tag: response.questionTag,
      });
    } catch (err) {
      console.error("[AI Preview] Error:", err);
      res.status(500).json({ error: "Failed to generate preview" });
    }
  });

  // ============================================================
  // Component Co-occurrence & Ordering Insights
  // ============================================================
  app.post("/api/private/component-insights/rebuild", (_req, res) => {
    try {
      const data = runComponentInsightsScan();
      res.json(data);
    } catch (err) {
      console.error("[ComponentInsights] Rebuild failed:", err);
      res.status(500).json({ error: "Rebuild failed", details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/private/component-insights", (_req, res) => {
    try {
      const data = readInsightsFile();
      if (!data) {
        return res.status(404).json({ error: "Insights not yet generated. POST /api/private/component-insights/rebuild to generate." });
      }
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Failed to read insights", details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/private/component-insights/suggest", (req, res) => {
    try {
      const after = typeof req.query.after === "string" ? req.query.after : "";
      const intent = typeof req.query.intent === "string" && req.query.intent !== "__global__" ? req.query.intent : undefined;
      const rankBy = req.query.rankBy === "pmi" ? "pmi" : "frequency";
      if (!after) {
        return res.status(400).json({ error: "after query param required" });
      }
      const suggestions = suggestNextComponent(after, intent, rankBy);
      res.json(suggestions);
    } catch (err) {
      res.status(500).json({ error: "Failed to get suggestions", details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.use(async (req, res, next) => {
    const url = req.originalUrl || req.url;
    if (
      url.startsWith("/api/") ||
      url.startsWith("/attached_assets/") ||
      url.startsWith("/marketing-content/") ||
      /\.\w+$/.test(url)
    ) {
      return next();
    }

    let schemaHtml = "";

    const cleanUrl = url.split("?")[0].split("#")[0];
    const resolved = contentIndex.resolveUrl(cleanUrl);
    const isDatabaseRoute = resolved && resolved.fromDatabase;
    const listingResolved = !isDatabaseRoute
      ? contentIndex.resolveListingUrl(cleanUrl)
      : null;
    const isListingRoute = !!listingResolved;

    if (isDatabaseRoute && resolved) {
      try {
        const posts = await databaseManager.fetchMappedItems(
          resolved.contentType,
        );
        const localeKey = getLocaleKey(resolved.contentType) || "lang";
        const locale =
          resolved.patternLocale && resolved.patternLocale !== "default"
            ? resolved.patternLocale
            : getDefaultLocale();
        const post =
          posts.find(
            (p) => p.slug === resolved.slug && (p as any)[localeKey] === locale,
          ) || posts.find((p) => p.slug === resolved.slug);
        if (post) {
          schemaHtml = generateDatabaseSsrHtml(
            resolved.contentType,
            post,
            locale,
          );
        }
      } catch (err) {
        console.error("[SSR-DB] Error generating schema for", url, err);
      }
    } else if (isListingRoute && listingResolved) {
      schemaHtml = generateListingSsrHtml(
        listingResolved.contentType,
        listingResolved.locale,
      );
    } else {
      schemaHtml = generateSsrSchemaHtml(url);
    }

    const isBlogRoute = isDatabaseRoute || isListingRoute;
    if (!schemaHtml && !isBlogRoute) {
      return next();
    }

    if (schemaHtml) {
      req.ssrSchemaHtml = schemaHtml;
    }

    if (isBlogRoute) {
      const originalEnd = res.end.bind(res);
      res.end = function (chunk?: any, ...args: any[]) {
        const contentType = res.getHeader("content-type");
        if (
          contentType &&
          typeof contentType === "string" &&
          contentType.includes("text/html") &&
          res.statusCode === 404
        ) {
          res.statusCode = 200;
        }
        return originalEnd(chunk, ...args);
      } as typeof res.end;
    }

    next();
  });

  const httpServer = createServer(app);

  // Start the background image queue worker
  import("./image-queue-worker").then(({ start, runNow }) => {
    workerRunNow = runNow;
    start();
  }).catch((err) => {
    console.error("[ImageQueueWorker] Failed to start:", err);
  });

  return httpServer;
}

/**
 * Fire-and-forget GitHub sync reconciliation intended to be called from the
 * server.listen() callback — AFTER the server is ready to accept requests.
 * Keeping this out of registerRoutes() ensures startup latency is not affected
 * by GitHub API calls that compare file hashes across 128+ files.
 */
export async function startBackgroundSync(): Promise<void> {
  const { logSync } = await import("./sync-log");
  const { loadSyncStateFromBucket } = await import("./sync-state");

  console.log("[GitHub] Reconciling sync state in background (non-blocking)...");
  loadSyncStateFromBucket()
    .then(async () => {
      const {
        reconcileSyncStateOnStartup,
        autoPullNonConflicting,
        ensureWebhook,
      } = await import("./github");
      await reconcileSyncStateOnStartup();
      const isAutoPullEnabled =
        process.env.GITHUB_SYNC_ENABLED === "true" &&
        process.env.GITHUB_AUTO_PULL_ENABLED === "true";
      if (isAutoPullEnabled) {
        const result = await autoPullNonConflicting();
        if (result.pulled.length > 0) {
          logSync(
            "AUTO-PULL",
            `Startup: pulled ${result.pulled.length} incoming files: ${result.pulled.map((f) => f.replace("marketing-content/", "")).join(", ")}`,
          );
        }
        if (result.conflicted.length > 0) {
          logSync(
            "CONFLICT",
            `Startup: ${result.conflicted.length} files have local conflicts, awaiting manual resolution`,
          );
        }
        if (result.errors.length > 0) {
          logSync(
            "ERROR",
            `Startup: ${result.errors.length} file(s) failed to pull — retrying in 10s: ${result.errors.join("; ")}`,
          );
          setTimeout(async () => {
            try {
              const retry = await autoPullNonConflicting();
              if (retry.pulled.length > 0) {
                logSync(
                  "AUTO-PULL",
                  `Retry: pulled ${retry.pulled.length} file(s): ${retry.pulled.map((f) => f.replace("marketing-content/", "")).join(", ")}`,
                );
              }
              if (retry.errors.length > 0) {
                logSync(
                  "ERROR",
                  `Retry: ${retry.errors.length} file(s) still failed: ${retry.errors.join("; ")}`,
                );
              }
            } catch (e) {
              logSync(
                "ERROR",
                `Retry failed: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }, 10000);
        }
      } else {
        logSync(
          "AUTO-PULL",
          "Skipped startup pull — GITHUB_AUTO_PULL_ENABLED not set to 'true'",
        );
      }
      await ensureWebhook();
    })
    .catch((err) => {
      logSync(
        "ERROR",
        `Failed to load/reconcile on startup: ${err instanceof Error ? err.message : String(err)}`,
      );
      console.error("[SyncState] Failed to load/reconcile on startup:", err);
    });
}
