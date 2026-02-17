import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import {
  careerProgramSchema,
  landingPageSchema,
  locationPageSchema,
  templatePageSchema,
  experimentUpdateSchema,
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
import { contentIndex } from "./content-index";
import {
  redirectMiddleware,
  getRedirects,
  clearRedirectCache,
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
  loadAllFieldEditors,
} from "./component-registry";
import { editContent, getContentForEdit } from "./content-editor";
import { escapeTemplateVars, unescapeObjectVars, unescapeYamlDump } from "@shared/templateVars";
import {
  getExperimentManager,
  getOrCreateSessionId,
  getExperimentCookie,
  setExperimentCookie,
  buildVisitorContext,
} from "./experiments";
import { mediaGallery } from "./media-gallery";
import { media } from "./media";
import multer from "multer";
import {
  loadContent,
  listContentSlugs,
  loadCommonData,
  type ContentType,
} from "./utils/contentLoader";
import { normalizeLocale } from "@shared/locale";
import { variableManager } from "./variable-manager";
import { getValidationService } from "../scripts/validation/service";
import { getCanonicalUrl } from "../scripts/validation/shared/canonicalUrls";
import { z } from "zod";
import { generateSsrSchemaHtml, clearSsrSchemaCache, loadRawYaml, resolveFaqItems, buildFaqPageSchema, type FaqSection } from "./ssr-schema";
import { getBlogPosts, getBlogPostsByLocale, findBlogPostBySlug, clearBlogCache, getBlogCacheStatus, parseBlogRoute, generateBlogSsrHtml, generateBlogListingSsrHtml } from "./blog";

const BREATHECODE_HOST =
  process.env.VITE_BREATHECODE_HOST || "https://breathecode.herokuapp.com";

function safeYamlLoad(yamlStr: string): unknown {
  const { escaped, map } = escapeTemplateVars(yamlStr);
  const parsed = yaml.load(escaped);
  return unescapeObjectVars(parsed, map);
}

function safeYamlDump(obj: unknown, opts?: yaml.DumpOptions): string {
  const serialized = JSON.stringify(obj);
  const { escaped: escapedJson, map } = escapeTemplateVars(serialized);
  const escapedObj = JSON.parse(escapedJson);
  const dumped = yaml.dump(escapedObj, opts);
  return unescapeYamlDump(dumped, map);
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
  courses: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    duration: z.string(),
    difficulty: z.string(),
    lessons: z.number(),
    link: z.string().optional(),
  })),
});

function loadCareerProgramsListing(locale: string) {
  const result = loadContent({
    contentType: "pages",
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

function loadCareerProgram(slug: string, locale: string): CareerProgram | null {
  const result = loadContent({
    contentType: "programs",
    slug,
    schema: careerProgramSchema,
    localeOrVariant: locale,
  });

  if (!result.success) {
    console.error(result.error);
    return null;
  }

  return result.data;
}

function listCareerPrograms(
  locale: string,
): Array<{ slug: string; title: string }> {
  const slugs = listContentSlugs("programs");
  const programs: Array<{ slug: string; title: string }> = [];

  for (const slug of slugs) {
    const program = loadCareerProgram(slug, locale);
    if (program) {
      programs.push({ slug: program.slug, title: program.title });
    }
  }

  return programs;
}

function loadLandingPage(slug: string): LandingPage | null {
  const result = loadContent({
    contentType: "landings",
    slug,
    schema: landingPageSchema,
    localeOrVariant: "promoted",
  });

  if (!result.success) {
    console.error(result.error);
    return null;
  }

  return result.data;
}

function listLandingPages(): Array<{
  slug: string;
  title: string;
  locale: string;
}> {
  const slugs = listContentSlugs("landings");
  const landings: Array<{ slug: string; title: string; locale: string }> = [];

  for (const slug of slugs) {
    const landing = loadLandingPage(slug);
    if (landing) {
      const commonData = loadCommonData("landings", slug);
      const locale = (commonData?.locale as string) || "en";
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
  const result = loadContent({
    contentType: "locations",
    slug,
    schema: locationPageSchema,
    localeOrVariant: locale,
  });

  if (!result.success) {
    console.error(result.error);
    return null;
  }

  return result.data;
}

function listLocationPages(
  locale: string,
): Array<{
  slug: string;
  name: string;
  city: string;
  country: string;
  region: string;
}> {
  const slugs = listContentSlugs("locations");
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
  const result = loadContent({
    contentType: "pages",
    slug,
    schema: templatePageSchema,
    localeOrVariant: locale,
  });

  if (!result.success) {
    console.error(result.error);
    return null;
  }

  return result.data;
}

function listTemplatePages(
  locale: string,
): Array<{ slug: string; template: string; title: string }> {
  const slugs = listContentSlugs("pages");
  const pages: Array<{ slug: string; template: string; title: string }> = [];

  for (const slug of slugs) {
    const page = loadTemplatePage(slug, locale);
    if (page) {
      pages.push({
        slug: page.slug,
        template: page.template,
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
  mediaGallery.setContentIndex(contentIndex);

  app.get("/apply", (req, res) => {
    const lang = detectLanguageFromRequest(req);
    const target = lang === "es" ? "/es/aplica" : "/en/apply";
    const qs = Object.keys(req.query).length
      ? "?" + new URLSearchParams(req.query as Record<string, string>).toString()
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

      // Get token info including expiration from Breathecode
      let expiresAt: string | null = null;
      try {
        const tokenInfoResponse = await fetch(
          `${BREATHECODE_HOST}/v1/auth/token/${token}`,
          { method: "GET" },
        );
        if (tokenInfoResponse.ok) {
          const tokenInfo = await tokenInfoResponse.json() as { expires_at?: string };
          expiresAt = tokenInfo.expires_at || null;
        }
      } catch {
        // Token info fetch failed - token may be invalid
      }

      // Check webmaster capability
      const webmasterResponse = await fetch(
        `${BREATHECODE_HOST}/v1/auth/user/me/capability/webmaster`,
        {
          method: "GET",
          headers: {
            Authorization: `Token ${token}`,
            Academy: "4",
          },
        },
      );

      const hasWebmaster = webmasterResponse.status === 200;

      // Fetch user info for author name
      let userName = "";
      try {
        const userResponse = await fetch(
          `${BREATHECODE_HOST}/v1/auth/user/me`,
          {
            method: "GET",
            headers: {
              Authorization: `Token ${token}`,
            },
          },
        );
        if (userResponse.ok) {
          const userData = await userResponse.json() as { first_name?: string; last_name?: string };
          const firstName = userData.first_name || "";
          const lastName = userData.last_name || "";
          userName = `${firstName} ${lastName}`.trim();
        }
      } catch {
        // Ignore user fetch errors - just use empty name
      }

      // If has webmaster, they get all capabilities
      // In future, we could check for more granular capabilities from the API
      const capabilities = {
        webmaster: hasWebmaster,
        content_read: hasWebmaster,
        content_edit_text: hasWebmaster,
        content_edit_structure: hasWebmaster,
        content_edit_media: hasWebmaster,
        content_publish: hasWebmaster,
      };

      if (hasWebmaster) {
        res.json({ valid: true, capabilities, userName, expiresAt });
      } else {
        res.json({ valid: false, capabilities, userName, expiresAt });
      }
    } catch (error) {
      console.error("Token validation error:", error);
      res.json({ valid: false, capabilities: {} });
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
        res.json({ valid: false, networkError: true, error: "Network error checking token" });
        return;
      }

      if (!tokenInfoResponse.ok) {
        // Token is invalid or expired (401/404 etc)
        res.json({ valid: false, expired: true });
        return;
      }

      const tokenInfo = await tokenInfoResponse.json() as { 
        token?: string;
        token_type?: string;
        expires_at?: string;
        user_id?: number;
      };

      // Check if token is expired
      if (tokenInfo.expires_at) {
        const expiresAt = new Date(tokenInfo.expires_at);
        if (expiresAt <= new Date()) {
          res.json({ valid: false, expired: true, expiresAt: tokenInfo.expires_at });
          return;
        }
      }

      res.json({ 
        valid: true, 
        expired: false, 
        expiresAt: tokenInfo.expires_at || null 
      });
    } catch (error) {
      console.error("Session check error:", error);
      // Unknown error - don't invalidate session
      res.json({ valid: false, networkError: true, error: "Failed to check session" });
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
        res
          .status(500)
          .json({
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
        "theme.json"
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

  app.get("/api/variables", (_req, res) => {
    res.json(variableManager.getDefinitions());
  });

  app.put("/api/variables/:name", (req, res) => {
    try {
      const { name } = req.params;
      const { level, key, value } = req.body as {
        level: string;
        key?: string;
        value: string;
      };

      const VALID_LEVELS = ["default", "by_locale", "by_region", "by_location"];
      if (!level || value === undefined) {
        return res.status(400).json({ error: "level and value are required" });
      }
      if (!VALID_LEVELS.includes(level)) {
        return res.status(400).json({ error: `Invalid level. Must be one of: ${VALID_LEVELS.join(", ")}` });
      }
      if (level !== "default" && !key) {
        return res.status(400).json({ error: "key is required for non-default levels" });
      }

      variableManager.updateVariable(name, level, key, value);
      res.json({ success: true, definitions: variableManager.getDefinitions() });
    } catch (err) {
      res.status(500).json({ error: "Failed to update variable" });
    }
  });

  app.delete("/api/variables/:name", (req, res) => {
    try {
      const { name } = req.params;
      const { level, key } = req.body as { level: string; key?: string };

      const VALID_LEVELS = ["default", "by_locale", "by_region", "by_location"];
      if (!level) {
        return res.status(400).json({ error: "level is required" });
      }
      if (!VALID_LEVELS.includes(level)) {
        return res.status(400).json({ error: `Invalid level. Must be one of: ${VALID_LEVELS.join(", ")}` });
      }
      if (level !== "default" && !key) {
        return res.status(400).json({ error: "key is required for non-default levels" });
      }

      const result = variableManager.deleteVariableEntry(name, level, key);
      if (!result) {
        return res.status(404).json({ error: "Variable not found" });
      }
      res.json({ success: true, definitions: variableManager.getDefinitions() });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete variable entry" });
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
    let experimentInfo: {
      experiment: string;
      variant: string;
      version: number;
    } | null = null;

    // If force_variant is provided, load that variant directly (for preview)
    if (forceVariant && forceVersion !== undefined) {
      const experimentManager = getExperimentManager();
      const forcedContent = experimentManager.getVariantContent(
        slug,
        {
          experiment_slug: "preview",
          variant_slug: forceVariant,
          variant_version: forceVersion,
          assigned_at: Date.now(),
        },
        locale,
      );
      if (forcedContent) {
        program = forcedContent as unknown as CareerProgram;
        experimentInfo = {
          experiment: "preview",
          variant: forceVariant,
          version: forceVersion,
        };
      }
    }

    // Normal experiment flow if not forcing a variant
    if (!program) {
      // Get or create session for experiment tracking
      const sessionId = getOrCreateSessionId(req, res);
      const experimentCookie = getExperimentCookie(req);
      const existingAssignments = experimentCookie?.assignments || [];

      // Check for active experiments
      const experimentManager = getExperimentManager();
      const visitorContext = buildVisitorContext(req, sessionId);
      const assignment = experimentManager.getAssignment(
        slug,
        visitorContext,
        existingAssignments,
      );

      if (assignment) {
        // Try to load variant content
        const variantContent = experimentManager.getVariantContent(
          slug,
          assignment,
          locale,
        );
        if (variantContent) {
          program = variantContent as unknown as CareerProgram;
          experimentInfo = {
            experiment: assignment.experiment_slug,
            variant: assignment.variant_slug,
            version: assignment.variant_version,
          };

          // Update cookie with new assignment
          const updatedAssignments = [
            ...existingAssignments.filter(
              (a) => a.experiment_slug !== assignment.experiment_slug,
            ),
            assignment,
          ];
          setExperimentCookie(res, sessionId, updatedAssignments);
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

    res.json({
      ...program,
      _experiment: experimentInfo,
    });
  });

  // Landing pages API
  app.get("/api/landings", (_req, res) => {
    const landings = listLandingPages();
    res.json(landings);
  });

  app.get("/api/landings/:slug", (req, res) => {
    const { slug } = req.params;
    const forceVariant = req.query.force_variant as string | undefined;
    const forceVersion = req.query.force_version
      ? parseInt(req.query.force_version as string, 10)
      : undefined;

    // Get locale from _common.yml
    const commonData = loadCommonData("landings", slug);
    const locale = (commonData?.locale as string) || "en";

    let landing: LandingPage | null = null;
    let experimentInfo: {
      experiment: string;
      variant: string;
      version: number;
    } | null = null;

    // If force_variant is provided, load that variant directly (for preview)
    if (forceVariant && forceVersion !== undefined) {
      const experimentManager = getExperimentManager();
      const forcedContent = experimentManager.getVariantContent(
        slug,
        {
          experiment_slug: "preview",
          variant_slug: forceVariant,
          variant_version: forceVersion,
          assigned_at: Date.now(),
        },
        locale,
        "landings",
      );
      if (forcedContent) {
        landing = forcedContent as LandingPage;
        experimentInfo = {
          experiment: "preview",
          variant: forceVariant,
          version: forceVersion,
        };
      }
    }

    // Fall back to default content
    if (!landing) {
      landing = loadLandingPage(slug);
    }

    if (!landing) {
      res.status(404).json({ error: "Landing page not found" });
      return;
    }

    const landingLocations = (commonData?.locations as string[] | undefined) || undefined;
    res.json({ ...landing, locale, landing_locations: landingLocations, _experiment: experimentInfo });
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

  app.get("/api/locations/:slug", (req, res) => {
    const { slug } = req.params;
    const locale = normalizeLocale(req.query.locale as string);

    const location = loadLocationPage(slug, locale);

    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    res.json(location);
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
    
    res.json(page);
  });

  // Special handler for apply page (includes programs and locations from _common.yml)
  app.get("/api/pages/apply", (req, res) => {
    const locale = normalizeLocale(req.query.locale as string);
    
    const page = loadTemplatePage("apply", locale);
    
    if (!page) {
      res.status(404).json({ error: "Apply page not found" });
      return;
    }
    
    // Load common data for programs and locations
    const commonData = loadCommonData("pages", "apply");
    
    res.json({
      ...page,
      programs: commonData?.programs || [],
      locations: commonData?.locations || [],
    });
  });

  // Apply form submission endpoint
  app.post("/api/apply", (req, res) => {
    try {
      const { program, location, firstName, lastName, email, phone, consentMarketing, consentSms, locale } = req.body;
      
      // Validate required fields
      if (!program || !location || !firstName || !lastName || !email || !phone) {
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

  app.get("/api/pages/:slug", (req, res) => {
    const { slug } = req.params;
    const locale = normalizeLocale(req.query.locale as string);

    const page = loadTemplatePage(slug, locale);

    if (!page) {
      res.status(404).json({ error: "Template page not found" });
      return;
    }

    res.json(page);
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
        const isNeutral = !langPrefixes.some((prefix) => path.startsWith(prefix));
        return matchesLocale || isNeutral;
      });
      res.json(filteredUrls);
    } else {
      res.json(urls);
    }
  });

  // ============================================================================
  // Blog API routes
  // ============================================================================
  app.get("/api/blog/posts", async (req, res) => {
    try {
      const locale = req.query.locale as string | undefined;
      const posts = await getBlogPosts();
      const filtered = locale ? getBlogPostsByLocale(posts, normalizeLocale(locale)) : posts;
      res.json({
        count: filtered.length,
        results: filtered,
      });
    } catch (error) {
      console.error("[Blog] Error fetching posts:", error);
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/blog/posts/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const posts = await getBlogPosts();
      const post = findBlogPostBySlug(posts, slug);

      if (!post) {
        res.status(404).json({ error: "Blog post not found" });
        return;
      }

      res.json(post);
    } catch (error) {
      console.error("[Blog] Error fetching post:", error);
      res.status(500).json({ error: "Failed to fetch blog post" });
    }
  });

  app.get("/api/blog/cache-status", (_req, res) => {
    res.json(getBlogCacheStatus());
  });

  app.post("/api/debug/clear-blog-cache", (_req, res) => {
    const result = clearBlogCache();
    res.json(result);
  });

  // Clear sitemap cache (requires token validation)
  app.post("/api/debug/clear-sitemap-cache", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Token ", "");

      // In development mode, allow without token
      const isDevelopment = process.env.NODE_ENV !== "production";

      if (!isDevelopment && !token) {
        res.status(401).json({ error: "Authorization required" });
        return;
      }

      // Validate token in production
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

      const result = clearSitemapCache();
      res.json(result);
    } catch (error) {
      console.error("Error clearing sitemap cache:", error);
      res.status(500).json({ error: "Failed to clear cache" });
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

      let contentType: "programs" | "landings" | "pages" | "locations" | null = null;
      let slug: string | null = null;

      const previewMatch = url.match(/^\/private\/preview\/(programs|pages|landings|locations)\/([^/?]+)/);
      const programEn = url.match(/^\/en\/career-programs\/([^/]+)/);
      const programEs = url.match(/^\/es\/programas-de-carrera\/([^/]+)/);
      const locationEn = url.match(/^\/en\/location\/([^/]+)/);
      const locationEs = url.match(/^\/es\/ubicacion\/([^/]+)/);
      const landingMatch = url.match(/^\/(?:en\/|es\/)?landing\/([^/]+)/);
      const pageEn = url.match(/^\/en\/([^/]+)$/);
      const pageEs = url.match(/^\/es\/([^/]+)$/);

      if (previewMatch) { contentType = previewMatch[1] as typeof contentType; slug = previewMatch[2]; }
      else if (programEn) { contentType = "programs"; slug = programEn[1]; }
      else if (programEs) { contentType = "programs"; slug = programEs[1]; }
      else if (locationEn) { contentType = "locations"; slug = locationEn[1]; }
      else if (locationEs) { contentType = "locations"; slug = locationEs[1]; }
      else if (landingMatch) { contentType = "landings"; slug = landingMatch[1]; }
      else if (pageEn) { contentType = "pages"; slug = pageEn[1]; }
      else if (pageEs) { contentType = "pages"; slug = pageEs[1]; }

      if (!contentType || !slug) {
        res.status(400).json({ error: "Could not determine content type from URL" });
        return;
      }

      const baseSlug = contentIndex.resolveBaseSlug(slug, contentType);
      const urls = contentIndex.getLocaleUrls(baseSlug, contentType);
      res.json({ urls, contentType, slug: baseSlug });
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

      let contentType: "programs" | "landings" | "pages" | "locations" | null = null;
      let slug: string | null = null;

      const programEn = url.match(/^\/(?:en\/)?career-programs\/([^/]+)/);
      const programEs = url.match(/^\/(?:es\/)?programas-de-carrera\/([^/]+)/);
      const locationEn = url.match(/^\/(?:en\/)?locations\/([^/]+)/);
      const locationEs = url.match(/^\/(?:es\/)?ubicaciones\/([^/]+)/);
      const landingMatch = url.match(/^\/landing\/([^/]+)/);
      const pageEn = url.match(/^\/en\/([^/]+)/);
      const pageEs = url.match(/^\/es\/([^/]+)/);

      if (programEn) { contentType = "programs"; slug = programEn[1]; }
      else if (programEs) { contentType = "programs"; slug = programEs[1]; }
      else if (locationEn) { contentType = "locations"; slug = locationEn[1]; }
      else if (locationEs) { contentType = "locations"; slug = locationEs[1]; }
      else if (landingMatch) { contentType = "landings"; slug = landingMatch[1]; }
      else if (pageEn) { contentType = "pages"; slug = pageEn[1]; }
      else if (pageEs) { contentType = "pages"; slug = pageEs[1]; }

      if (!contentType || !slug) {
        res.status(400).json({ error: "Could not determine content type from URL" });
        return;
      }

      const baseSlug = contentIndex.resolveBaseSlug(slug, contentType);
      const urls = contentIndex.getLocaleUrls(baseSlug, contentType);
      res.json({ urls, contentType, slug: baseSlug });
    } catch (err) {
      console.error("[Debug] Failed to resolve locale URLs:", err);
      res.status(500).json({ error: "Failed to resolve locale URLs" });
    }
  });

  // Add a new redirect (for debug tools)
  app.post("/api/debug/redirects", (req, res) => {
    try {
      const { from, to, allLanguages, status: redirectStatus, isCustomDestination } = req.body;
      const statusCode = redirectStatus && [301, 302].includes(redirectStatus) ? redirectStatus : 301;

      if (!from || !to) {
        res.status(400).json({ error: "Both 'from' and 'to' fields are required" });
        return;
      }

      let normalizedFrom = (from as string).startsWith("/") ? (from as string) : `/${from}`;
      normalizedFrom = normalizedFrom.toLowerCase();
      if (normalizedFrom.length > 1 && normalizedFrom.endsWith("/")) {
        normalizedFrom = normalizedFrom.slice(0, -1);
      }

      const destUrl = to as string;

      if (isCustomDestination) {
        const customFilePath = path.join(process.cwd(), "marketing-content", "custom-redirects.yml");

        let parsed: { redirects: Array<{ from: string; to: string; status?: number }> } = { redirects: [] };
        if (fs.existsSync(customFilePath)) {
          const raw = fs.readFileSync(customFilePath, "utf-8");
          const loaded = safeYamlLoad(raw) as { redirects?: unknown[] } | null;
          if (loaded && Array.isArray(loaded.redirects)) {
            parsed.redirects = loaded.redirects as Array<{ from: string; to: string; status?: number }>;
          }
        }

        if (parsed.redirects.some(r => r.from?.toLowerCase() === normalizedFrom)) {
          res.status(409).json({ error: `Redirect "${normalizedFrom}" already exists in custom-redirects.yml` });
          return;
        }

        const newEntry: { from: string; to: string; status?: number } = { from: normalizedFrom, to: destUrl };
        if (statusCode !== 301) {
          newEntry.status = statusCode;
        }
        parsed.redirects.push(newEntry);

        const yamlContent = safeYamlDump(parsed, { lineWidth: -1, noRefs: true });
        fs.writeFileSync(customFilePath, yamlContent, "utf-8");

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
      let contentType: "programs" | "landings" | "pages" | "locations" | null = null;
      let slug: string | null = null;
      let locale: string = "en";

      const programEnMatch = destUrl.match(/^\/en\/career-programs\/([^/]+)/);
      const programEsMatch = destUrl.match(/^\/es\/programas-de-carrera\/([^/]+)/);
      const programStrippedMatch = destUrl.match(/^\/career-programs\/([^/]+)/);
      const programStrippedEsMatch = destUrl.match(/^\/programas-de-carrera\/([^/]+)/);
      const landingMatch = destUrl.match(/^\/landing\/([^/]+)/);
      const pageEnMatch = destUrl.match(/^\/en\/([^/]+)/);
      const pageEsMatch = destUrl.match(/^\/es\/([^/]+)/);
      const locationEnMatch = destUrl.match(/^\/en\/locations\/([^/]+)/);
      const locationEsMatch = destUrl.match(/^\/es\/ubicaciones\/([^/]+)/);
      const locationStrippedMatch = destUrl.match(/^\/locations\/([^/]+)/);
      const locationStrippedEsMatch = destUrl.match(/^\/ubicaciones\/([^/]+)/);

      if (programEnMatch) {
        contentType = "programs";
        slug = programEnMatch[1];
        locale = "en";
      } else if (programEsMatch) {
        contentType = "programs";
        slug = programEsMatch[1];
        locale = "es";
      } else if (programStrippedMatch) {
        contentType = "programs";
        slug = programStrippedMatch[1];
        locale = "en";
      } else if (programStrippedEsMatch) {
        contentType = "programs";
        slug = programStrippedEsMatch[1];
        locale = "es";
      } else if (landingMatch) {
        contentType = "landings";
        slug = landingMatch[1];
        locale = "en";
      } else if (locationEnMatch) {
        contentType = "locations";
        slug = locationEnMatch[1];
        locale = "en";
      } else if (locationEsMatch) {
        contentType = "locations";
        slug = locationEsMatch[1];
        locale = "es";
      } else if (locationStrippedMatch) {
        contentType = "locations";
        slug = locationStrippedMatch[1];
        locale = "en";
      } else if (locationStrippedEsMatch) {
        contentType = "locations";
        slug = locationStrippedEsMatch[1];
        locale = "es";
      } else if (pageEnMatch) {
        contentType = "pages";
        slug = pageEnMatch[1];
        locale = "en";
      } else if (pageEsMatch) {
        contentType = "pages";
        slug = pageEsMatch[1];
        locale = "es";
      } else if (!destUrl.startsWith("/en/") && !destUrl.startsWith("/es/") && !destUrl.startsWith("/landing/")) {
        const pageStrippedMatch = destUrl.match(/^\/([^/]+)/);
        if (pageStrippedMatch) {
          contentType = "pages";
          slug = pageStrippedMatch[1];
          locale = "en";
        }
      }

      if (!contentType || !slug) {
        res.status(400).json({ error: "Could not determine content type from destination URL" });
        return;
      }

      const resolvedSlug = contentIndex.resolveBaseSlug(slug, contentType);
      const entries = contentIndex.findBySlug(resolvedSlug, { contentType });
      if (entries.length === 0) {
        res.status(404).json({ error: `No content found for slug "${slug}" in ${contentType}` });
        return;
      }

      const entry = entries[0];
      const basePath = path.join(process.cwd(), entry.folder);

      let targetFile: string;
      if (contentType === "landings" || allLanguages) {
        targetFile = "_common.yml";
      } else {
        targetFile = `${locale}.yml`;
      }

      const filePath = path.join(basePath, targetFile);

      let parsed: Record<string, unknown> = {};
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        parsed = (safeYamlLoad(raw) as Record<string, unknown>) || {};
      }

      if (!parsed.meta || typeof parsed.meta !== "object") {
        parsed.meta = {};
      }
      const meta = parsed.meta as Record<string, unknown>;
      if (!Array.isArray(meta.redirects)) {
        meta.redirects = [];
      }
      const redirects = meta.redirects as unknown[];

      const existingPath = (r: unknown) => {
        if (typeof r === "string") return r.toLowerCase();
        if (typeof r === "object" && r !== null && "path" in r) return ((r as { path: string }).path).toLowerCase();
        return "";
      };

      if (redirects.some(r => existingPath(r) === normalizedFrom)) {
        res.status(409).json({ error: `Redirect "${normalizedFrom}" already exists in ${targetFile}` });
        return;
      }

      if (statusCode !== 301) {
        redirects.push({ path: normalizedFrom, status: statusCode });
      } else {
        redirects.push(normalizedFrom);
      }

      const yamlContent = safeYamlDump(parsed, { lineWidth: -1, noRefs: true });
      fs.writeFileSync(filePath, yamlContent, "utf-8");

      contentIndex.scan();
      clearRedirectCache();

      res.json({
        success: true,
        message: `Redirect added: ${normalizedFrom} -> ${destUrl}`,
        file: `${entry.folder}/${targetFile}`,
      });
    } catch (err) {
      console.error("[Debug] Failed to add redirect:", err);
      res.status(500).json({ error: "Failed to add redirect" });
    }
  });

  // Delete a redirect (for debug tools)
  app.delete("/api/debug/redirects", (req, res) => {
    try {
      const { from, source } = req.body;

      if (!from || !source) {
        res.status(400).json({ error: "Both 'from' and 'source' fields are required" });
        return;
      }

      let normalizedFrom = (from as string).startsWith("/") ? (from as string) : `/${from}`;
      normalizedFrom = normalizedFrom.toLowerCase();
      if (normalizedFrom.length > 1 && normalizedFrom.endsWith("/")) {
        normalizedFrom = normalizedFrom.slice(0, -1);
      }

      const sourceFile = source as string;

      const resolvedSource = path.resolve(process.cwd(), sourceFile);
      const marketingDir = path.resolve(process.cwd(), "marketing-content");
      if (!resolvedSource.startsWith(marketingDir + path.sep) && resolvedSource !== marketingDir) {
        res.status(400).json({ error: "Invalid source file path" });
        return;
      }
      if (!sourceFile.endsWith(".yml") && !sourceFile.endsWith(".yaml")) {
        res.status(400).json({ error: "Invalid source file type" });
        return;
      }

      if (sourceFile === "marketing-content/custom-redirects.yml") {
        const customFilePath = path.join(process.cwd(), "marketing-content", "custom-redirects.yml");

        if (!fs.existsSync(customFilePath)) {
          res.status(404).json({ error: "Custom redirects file not found" });
          return;
        }

        const raw = fs.readFileSync(customFilePath, "utf-8");
        const loaded = safeYamlLoad(raw) as { redirects?: Array<{ from: string; to: string; status?: number }> } | null;

        if (!loaded || !Array.isArray(loaded.redirects)) {
          res.status(404).json({ error: "No redirects found in custom redirects file" });
          return;
        }

        const originalLength = loaded.redirects.length;
        loaded.redirects = loaded.redirects.filter(r => {
          let rFrom = r.from?.startsWith("/") ? r.from : `/${r.from}`;
          rFrom = rFrom.toLowerCase();
          if (rFrom.length > 1 && rFrom.endsWith("/")) rFrom = rFrom.slice(0, -1);
          return rFrom !== normalizedFrom;
        });

        if (loaded.redirects.length === originalLength) {
          res.status(404).json({ error: `Redirect "${normalizedFrom}" not found in custom-redirects.yml` });
          return;
        }

        const yamlContent = safeYamlDump(loaded, { lineWidth: -1, noRefs: true });
        fs.writeFileSync(customFilePath, yamlContent, "utf-8");

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
        res.status(404).json({ error: `Source file "${sourceFile}" not found` });
        return;
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = (safeYamlLoad(raw) as Record<string, unknown>) || {};

      const meta = parsed.meta as Record<string, unknown> | undefined;
      if (!meta || !Array.isArray(meta.redirects)) {
        res.status(404).json({ error: `No redirects found in "${sourceFile}"` });
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
          let p = ((r as { path: string }).path);
          p = p.startsWith("/") ? p : `/${p}`;
          p = p.toLowerCase();
          if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
          return p;
        }
        return "";
      };

      meta.redirects = redirects.filter(r => getRedirectPath(r) !== normalizedFrom);

      if ((meta.redirects as unknown[]).length === originalLength) {
        res.status(404).json({ error: `Redirect "${normalizedFrom}" not found in "${sourceFile}"` });
        return;
      }

      const yamlContent = safeYamlDump(parsed, { lineWidth: -1, noRefs: true });
      fs.writeFileSync(filePath, yamlContent, "utf-8");

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

  // Menus API - list all menu files (excludes translation files like .es.yml)
  app.get("/api/menus", (_req, res) => {
    const menusDir = path.join(process.cwd(), "marketing-content", "menus");
    
    if (!fs.existsSync(menusDir)) {
      res.json({ menus: [] });
      return;
    }
    
    // Filter for .yml/.yaml files, excluding translation files (e.g., main-navbar.es.yml)
    const translationPattern = /\.[a-z]{2}\.(yml|yaml)$/;
    const files = fs.readdirSync(menusDir)
      .filter(f => (f.endsWith(".yml") || f.endsWith(".yaml")) && !translationPattern.test(f));
    
    const menus = files.map(file => {
      const name = file.replace(/\.(yml|yaml)$/, "");
      return { name, file };
    });
    
    res.json({ menus });
  });

  // Menus API - get a specific menu file (with optional locale)
  app.get("/api/menus/:name", (req, res) => {
    const { name } = req.params;
    const locale = req.query.locale as string | undefined;
    const menusDir = path.join(process.cwd(), "marketing-content", "menus");
    
    // Build filename based on locale (e.g., main-navbar.es.yml for Spanish)
    const fileBaseName = locale && locale !== "en" ? `${name}.${locale}` : name;
    
    // Try both .yml and .yaml extensions
    let filePath = path.join(menusDir, `${fileBaseName}.yml`);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(menusDir, `${fileBaseName}.yaml`);
    }
    
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Menu not found" });
      return;
    }
    
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = safeYamlLoad(content);
      res.json({ name, locale: locale || "en", data });
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
      error: "This endpoint is deprecated. Use the separated endpoints instead.",
      alternatives: {
        structure: "PUT /api/menus/:name/structure - For structural changes (English only, propagates to translations)",
        translations: "PUT /api/menus/:name/translations?locale=xx - For text-only changes"
      }
    });
  });
  
  // Helper function to sync menu structure from English (master) to translation
  function syncMenuStructure(master: any, translation: any, previousMaster?: any): any {
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
  
  function syncFooterStructure(master: any, translation: any, previousMaster?: any): any {
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
        prevItemsByIndex.set(i, new Set((prevColumns[i].items || []).map((it: any) => it.label)));
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
          const newItems = (masterCol.items || []).filter((item: any) => !prevItems.has(item.label));

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
      const prevSocialIcons = new Set((pf.socials || []).map((s: any) => s.icon));
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
      const prevLegalLabels = new Set((pf.legal_links || []).map((l: any) => l.label));
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
      result.subscribe_text = tf.subscribe_text || `[TRANSLATE] ${mf.subscribe_text}`;
    }
    if (mf.copyright_text !== undefined) {
      result.copyright_text = tf.copyright_text || `[TRANSLATE] ${mf.copyright_text}`;
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
      result.dropdown = syncDropdown(master.dropdown, translation.dropdown || {});
    }
    
    return result;
  }
  
  function syncDropdown(master: any, translation: any): any {
    const result: any = {
      type: master.type,
      title: translation.title || `[TRANSLATE] ${master.title}`,
      description: translation.description || `[TRANSLATE] ${master.description}`,
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
        linkText: translation.footer?.linkText || `[TRANSLATE] ${master.footer.linkText}`,
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
      result.description = translation.description || `[TRANSLATE] ${master.description}`;
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
    const { data } = req.body;
    
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
      
      const syncResults: Record<string, string> = {};
      const translationLocales = ["es", "fr", "de", "pt", "it"];
      
      for (const targetLocale of translationLocales) {
        const translationFileName = `${name}.${targetLocale}.yml`;
        const translationFilePath = path.join(menusDir, translationFileName);
        
        if (fs.existsSync(translationFilePath)) {
          try {
            const translationContent = fs.readFileSync(translationFilePath, "utf-8");
            const translationData = safeYamlLoad(translationContent) as any;
            
            const syncedData = syncMenuStructure(data, translationData, previousData);
            
            const syncedYaml = safeYamlDump(syncedData, {
              indent: 2,
              lineWidth: -1,
              noRefs: true,
              sortKeys: false,
            });
            fs.writeFileSync(translationFilePath, syncedYaml, "utf-8");
            syncResults[targetLocale] = "synced";
          } catch (syncError) {
            console.error(`Error syncing structure to ${targetLocale}:`, syncError);
            syncResults[targetLocale] = "error";
          }
        }
      }
      
      res.json({ 
        success: true, 
        name, 
        endpoint: "structure",
        syncResults,
        message: "Structure updated in English and synced to all translations"
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
    const { data } = req.body;
    
    if (!data) {
      res.status(400).json({ error: "Missing data in request body" });
      return;
    }
    
    if (!locale) {
      res.status(400).json({ error: "Locale query parameter is required" });
      return;
    }
    
    const menusDir = path.join(process.cwd(), "marketing-content", "menus");
    const isEnglish = locale === "en";
    
    // Build filename based on locale
    const fileBaseName = isEnglish ? name : `${name}.${locale}`;
    
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
      res.status(400).json({ error: "English master file not found. Cannot update translations." });
      return;
    }
    
    let dataToSave = data;
    
    const isFooterMenu = data?.footer && !data?.navbar;
    
    if (isFooterMenu && !isEnglish) {
      dataToSave = data;
    } else {
      try {
        const masterContent = fs.readFileSync(masterFilePath, "utf-8");
        const masterData = safeYamlLoad(masterContent) as any;
        
        dataToSave = mergeTextOnlyFromTranslation(masterData, data);
      } catch (e) {
        console.error("Error syncing translation to master structure:", e);
        res.status(500).json({ error: "Failed to sync translation with master structure" });
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
      
      res.json({ 
        success: true, 
        name, 
        locale,
        endpoint: "translations",
        message: isEnglish ? "English text updated" : `${locale} translations updated`
      });
    } catch (error) {
      console.error(`Error saving menu translations ${name}:`, error);
      res.status(500).json({ error: "Failed to save menu translations" });
    }
  });

  // STRICT text-only merge: Deep-clone master, overlay ONLY translatable fields from translation
  // Translatable fields: label, title, description, cta, text, linkText, href
  // ALL other fields preserved from master (including unknown/extra keys)
  const TEXT_FIELDS = new Set(['label', 'title', 'description', 'cta', 'text', 'linkText', 'href']);
  
  function mergeTextOnlyFromTranslation(master: any, translation: any): any {
    if (!master?.navbar?.items && !master?.footer) {
      throw new Error("Master file is missing navbar.items or footer structure");
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
    
    return result;
  }
  
  function overlayTextFieldsOnItems(masterItems: any[], translationItems: any[]): void {
    for (let i = 0; i < masterItems.length && i < translationItems.length; i++) {
      overlayTextFieldsOnObject(masterItems[i], translationItems[i]);
    }
  }
  
  function overlayTextFieldsOnObject(master: any, translation: any): void {
    if (!master || !translation || typeof master !== 'object' || typeof translation !== 'object') {
      return;
    }
    
    // Overlay text fields from translation onto master
    for (const key of Object.keys(master)) {
      if (TEXT_FIELDS.has(key) && translation[key] !== undefined) {
        // This is a text field - take value from translation
        master[key] = translation[key];
      } else if (Array.isArray(master[key]) && Array.isArray(translation[key])) {
        // Recursively process arrays (items, columns, groups, etc.)
        for (let i = 0; i < master[key].length && i < translation[key].length; i++) {
          overlayTextFieldsOnObject(master[key][i], translation[key][i]);
        }
      } else if (typeof master[key] === 'object' && master[key] !== null && translation[key]) {
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

  app.get("/api/seo-preview/:contentType/:slug", (req, res) => {
    try {
      const { contentType, slug } = req.params;
      const locale = normalizeLocale((req.query.locale as string) || "en");

      const validTypes = ["programs", "pages", "landings", "locations"];
      if (!validTypes.includes(contentType)) {
        res.status(400).json({ error: `Invalid content type. Must be one of: ${validTypes.join(", ")}` });
        return;
      }

      const pageData = loadRawYaml(contentType, slug, locale);
      if (!pageData) {
        res.status(404).json({ error: "Content not found" });
        return;
      }

      const meta = (pageData.meta as Record<string, unknown>) || {};
      const schema = pageData.schema as { include?: string[]; overrides?: Record<string, Record<string, unknown>> } | undefined;

      let faqSchema: Record<string, unknown> | null = null;
      const sections = pageData.sections as Array<Record<string, unknown>> | undefined;
      if (sections) {
        // Extract location slug if we're on a location page
        const locationSlug = contentType === "locations" ? slug : undefined;
        // Extract program slug if we're on a program page
        const programSlug = contentType === "programs" ? slug : undefined;
        
        const allFaqItems: Array<{ question: string; answer: string }> = [];
        for (const section of sections) {
          if (section.type === "faq") {
            const items = resolveFaqItems(section as unknown as FaqSection, locale, locationSlug, programSlug);
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
      const schemaOverrides = (schema?.overrides as Record<string, Record<string, unknown>>) || {};

      const responseData: Record<string, unknown> = {
        meta,
        faqSchema,
        schemaOrg,
        schemaInclude,
        schemaOverrides,
        title: pageData.title || "",
        slug: pageData.slug || slug,
      };

      if (contentType === "landings") {
        const commonData = loadCommonData("landings", slug);
        responseData.locations = (commonData?.locations as string[]) || [];
        responseData.availableLocations = listLocationPages(locale).map(loc => ({
          slug: loc.slug,
          name: loc.name,
          city: loc.city,
          country: loc.country,
        }));
      }

      res.json(responseData);
    } catch (error) {
      console.error("[SEO Preview] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/content/update-locations", async (req, res) => {
    try {
      const isDevelopment = process.env.NODE_ENV !== "production";
      const debugToken = req.headers["x-debug-token"] as string | undefined;
      const authHeader = req.headers.authorization;

      let token: string | null = null;
      if (authHeader?.startsWith("Token ")) {
        token = authHeader.slice(6);
      } else if (debugToken) {
        token = debugToken;
      }

      if (!isDevelopment) {
        if (!token) {
          res.status(401).json({ error: "Authorization required" });
          return;
        }
        const capResponse = await fetch(
          `${BREATHECODE_HOST}/v1/auth/user/me/capability/webmaster`,
          { method: "GET", headers: { Authorization: `Token ${token}`, Academy: "4" } },
        );
        if (capResponse.status === 401) {
          res.status(401).json({ error: "Your session has expired. Please log in again." });
          return;
        }
        if (capResponse.status !== 200) {
          res.status(403).json({ error: "You need webmaster capability to edit content" });
          return;
        }
      }

      const { contentType, slug, locations, author } = req.body;
      if (!contentType || !slug || !Array.isArray(locations)) {
        res.status(400).json({ error: "Missing required fields: contentType, slug, locations (array)" });
        return;
      }
      if (contentType !== "landings") {
        res.status(400).json({ error: "Locations can only be updated for landings" });
        return;
      }

      const commonPath = path.join(process.cwd(), "marketing-content", contentType, slug, "_common.yml");
      if (!fs.existsSync(commonPath)) {
        res.status(404).json({ error: "_common.yml not found for this landing" });
        return;
      }

      const commonContent = fs.readFileSync(commonPath, "utf-8");
      const commonData = safeYamlLoad(commonContent) as Record<string, unknown>;

      if (locations.length === 0) {
        delete commonData.locations;
      } else {
        commonData.locations = locations;
      }

      const updatedYaml = safeYamlDump(commonData, {
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false,
      });
      fs.writeFileSync(commonPath, updatedYaml, "utf-8");

      markFileAsModified(commonPath, author && typeof author === "string" ? author : undefined);

      const landingDir = path.dirname(commonPath);
      const variantFiles = fs.readdirSync(landingDir).filter(
        (f) => f.endsWith(".yml") && f !== "_common.yml"
      );
      const strippedVariants: string[] = [];
      for (const variantFile of variantFiles) {
        const variantPath = path.join(landingDir, variantFile);
        try {
          const variantContent = fs.readFileSync(variantPath, "utf-8");
          const variantData = safeYamlLoad(variantContent) as Record<string, unknown>;
          if (variantData && "locations" in variantData) {
            delete variantData.locations;
            const variantYaml = safeYamlDump(variantData, {
              lineWidth: -1,
              noRefs: true,
              quotingType: '"',
              forceQuotes: false,
            });
            fs.writeFileSync(variantPath, variantYaml, "utf-8");
            markFileAsModified(variantPath, author && typeof author === "string" ? author : undefined);
            strippedVariants.push(variantFile);
          }
        } catch (e) {
          console.warn(`[Update Locations] Could not process variant ${variantFile}:`, e);
        }
      }
      if (strippedVariants.length > 0) {
        console.log(`[Update Locations] Removed locations from variants: ${strippedVariants.join(", ")}`);
      }

      contentIndex.refresh();

      res.json({ success: true, locations: commonData.locations || [], strippedVariants });
    } catch (error) {
      console.error("[Update Locations] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Experiments API endpoints
  app.get("/api/debug/experiments", (req, res) => {
    const experimentManager = getExperimentManager();
    const extendedStats = experimentManager.getExtendedStats();
    res.json({
      stats: extendedStats.experiments,
      totalExperiments: Object.keys(extendedStats.experiments).length,
    });
  });

  app.post("/api/debug/clear-experiment-cache", (req, res) => {
    const experimentManager = getExperimentManager();
    experimentManager.clearCache();
    res.json({ success: true, message: "Experiment cache cleared" });
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
      const { message, force, author } = req.body;
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({ error: "Commit message is required" });
        return;
      }

      // Prepend author to commit message if provided
      let finalMessage = message.trim();
      if (author && typeof author === 'string' && author.trim()) {
        finalMessage = `[Author: ${author.trim()}] ${finalMessage}`;
      }

      const { commitAndPush } = await import("./github");
      const result = await commitAndPush(finalMessage, { force: !!force });
      
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

  // Get available variants for a content type and slug
  app.get("/api/variants/:contentType/:slug", (req, res) => {
    const { contentType, slug } = req.params;

    const validTypes = ["programs", "pages", "landings", "locations"];
    if (!validTypes.includes(contentType)) {
      res.status(400).json({ error: "Invalid content type", validTypes });
      return;
    }

    const experimentManager = getExperimentManager();
    const result = experimentManager.getAvailableVariants(
      contentType as "programs" | "pages" | "landings" | "locations",
      slug,
    );

    if (!result) {
      res.status(404).json({ error: "Content folder not found" });
      return;
    }

    res.json(result);
  });

  // Get experiments for a specific content type and slug
  app.get("/api/experiments/:contentType/:slug", (req, res) => {
    const { contentType, slug } = req.params;

    // Validate content type
    const validTypes = ["programs", "pages", "landings", "locations"];
    if (!validTypes.includes(contentType)) {
      res.status(400).json({
        error: "Invalid content type",
        validTypes,
      });
      return;
    }

    const experimentManager = getExperimentManager();
    const experiments = experimentManager.getExperimentsForContent(
      contentType as "programs" | "pages" | "landings" | "locations",
      slug,
    );

    if (!experiments) {
      res.json({
        experiments: [],
        hasExperimentsFile: false,
        filePath: experimentManager.getExperimentsFilePath(
          contentType as "programs" | "pages" | "landings" | "locations",
          slug,
        ),
      });
      return;
    }

    // Get stats for each experiment (including unique visitors)
    const extendedStats = experimentManager.getExtendedStats();
    const experimentsWithStats = experiments.experiments.map((exp) => ({
      ...exp,
      stats: extendedStats.experiments[exp.slug]?.variant_counts || {},
      unique_visitors:
        extendedStats.experiments[exp.slug]?.unique_visitors || 0,
    }));

    res.json({
      experiments: experimentsWithStats,
      hasExperimentsFile: true,
      filePath: experimentManager.getExperimentsFilePath(
        contentType as "programs" | "pages" | "landings" | "locations",
        slug,
      ),
    });
  });

  // Get single experiment details
  app.get(
    "/api/experiments/:contentType/:contentSlug/:experimentSlug",
    (req, res) => {
      const { contentType, contentSlug, experimentSlug } = req.params;

      const validTypes = ["programs", "pages", "landings", "locations"];
      if (!validTypes.includes(contentType)) {
        res.status(400).json({ error: "Invalid content type", validTypes });
        return;
      }

      const experimentManager = getExperimentManager();
      const experiments = experimentManager.getExperimentsForContent(
        contentType as "programs" | "pages" | "landings" | "locations",
        contentSlug,
      );

      if (!experiments) {
        res.status(404).json({ error: "Experiments file not found" });
        return;
      }

      const experiment = experiments.experiments.find(
        (exp) => exp.slug === experimentSlug,
      );
      if (!experiment) {
        res.status(404).json({ error: "Experiment not found" });
        return;
      }

      const extendedStats = experimentManager.getExtendedStats();
      const expStats = extendedStats.experiments[experimentSlug];
      const experimentWithStats = {
        ...experiment,
        stats: expStats?.variant_counts || {},
        unique_visitors: expStats?.unique_visitors || 0,
      };

      res.json({
        experiment: experimentWithStats,
        contentType,
        contentSlug,
        filePath: experimentManager.getExperimentsFilePath(
          contentType as "programs" | "pages" | "landings" | "locations",
          contentSlug,
        ),
      });
    },
  );

  // Update experiment settings
  app.patch(
    "/api/experiments/:contentType/:contentSlug/:experimentSlug",
    (req, res) => {
      const { contentType, contentSlug, experimentSlug } = req.params;

      const validTypes = ["programs", "pages", "landings", "locations"];
      if (!validTypes.includes(contentType)) {
        res.status(400).json({ error: "Invalid content type", validTypes });
        return;
      }

      // Validate request body against schema
      const parseResult = experimentUpdateSchema.safeParse(req.body);
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

      const validatedUpdates = parseResult.data;

      const experimentManager = getExperimentManager();
      try {
        const result = experimentManager.updateExperiment(
          contentType as "programs" | "pages" | "landings" | "locations",
          contentSlug,
          experimentSlug,
          validatedUpdates,
        );
        res.json(result);
      } catch (error) {
        res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to update experiment",
        });
      }
    },
  );

  // Create new experiment
  app.post("/api/experiments/:contentType/:slug/create", (req, res) => {
    const { contentType, slug } = req.params;

    const validTypes = ["programs", "pages", "landings", "locations"];
    if (!validTypes.includes(contentType)) {
      res.status(400).json({ error: "Invalid content type", validTypes });
      return;
    }

    const {
      experimentName,
      experimentSlug,
      variantA,
      variantB,
      newVariant,
      allocationA,
      maxVisitors,
      targeting,
    } = req.body;

    // Basic validation
    if (!experimentName || !experimentSlug || !variantA) {
      res.status(400).json({
        error:
          "Missing required fields: experimentName, experimentSlug, variantA",
      });
      return;
    }

    if (!variantB && !newVariant) {
      res.status(400).json({
        error: "Either variantB or newVariant must be provided",
      });
      return;
    }

    const experimentManager = getExperimentManager();
    try {
      const result = experimentManager.createExperiment(
        contentType as "programs" | "pages" | "landings" | "locations",
        slug,
        {
          experimentName,
          experimentSlug,
          variantA,
          variantB: variantB || null,
          newVariant: newVariant || null,
          allocationA: allocationA ?? 50,
          maxVisitors: maxVisitors ?? 1000,
          targeting: targeting || {},
        },
      );

      res.json({
        ...result,
        redirectPath: `/private/${contentType}/${slug}/experiment/${experimentSlug}`,
      });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to create experiment",
      });
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
        res
          .status(500)
          .json({
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

      res.json({ success: true });
    },
  );

  app.get("/api/content/folder-files", (req, res) => {
    try {
      const folderPath = req.query.path as string;
      if (!folderPath) {
        res.status(400).json({ error: "Folder path is required" });
        return;
      }
      const normalizedPath = path.normalize(folderPath);
      if (!normalizedPath.startsWith("marketing-content/") || normalizedPath.includes("..")) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
      const entry = contentIndex.findByPath(normalizedPath);
      if (!entry) {
        res.status(404).json({ error: "Folder not found" });
        return;
      }
      res.json({ files: entry.files, folder: entry.folder });
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
        res.status(404).json({ error: "No content folder found for this slug" });
        return;
      }
      if (matches.length === 1) {
        const entry = matches[0];
        res.json({ folder: entry.folder, contentType: entry.contentType, files: entry.files, title: entry.title });
      } else {
        res.json({
          multiple: true,
          matches: matches.map(e => ({ folder: e.folder, contentType: e.contentType, files: e.files, title: e.title })),
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
      if (!normalizedPath.startsWith("marketing-content/") || normalizedPath.includes("..")) {
        res.status(403).json({ error: "Access denied: Only marketing-content files allowed" });
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

  // Content editing API
  app.post("/api/content/edit", async (req, res) => {
    try {
      // In development mode, allow without token (using X-Debug-Token or no auth)
      const isDevelopment = process.env.NODE_ENV !== "production";
      const authHeader = req.headers.authorization;
      const debugToken = req.headers["x-debug-token"] as string | undefined;

      // Get token from Authorization header or X-Debug-Token
      let token: string | null = null;
      if (authHeader?.startsWith("Token ")) {
        token = authHeader.slice(6);
      } else if (debugToken) {
        token = debugToken;
      }

      // In production, require valid token
      if (!isDevelopment) {
        if (!token) {
          res.status(401).json({ error: "Authorization required" });
          return;
        }

        // Verify token has edit capabilities
        const capResponse = await fetch(
          `${BREATHECODE_HOST}/v1/auth/user/me/capability/webmaster`,
          {
            method: "GET",
            headers: {
              Authorization: `Token ${token}`,
              Academy: "4",
            },
          },
        );

        if (capResponse.status === 401) {
          res.status(401).json({ error: "Your session has expired. Please log in again." });
          return;
        }
        
        if (capResponse.status !== 200) {
          res.status(403).json({ error: "You need webmaster capability to edit content" });
          return;
        }
      }

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

      // Use author from request body (sent by client from session context)
      const authorName = requestAuthor && typeof requestAuthor === 'string' ? requestAuthor : undefined;

      if (!contentType || !slug || !locale) {
        res
          .status(400)
          .json({
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
          res
            .status(400)
            .json({
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

      // Only pass variant/version if both are meaningful (not "default" or undefined)
      const effectiveVariant =
        variant && variant !== "default" ? variant : undefined;
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

        // Return success with updated sections for immediate UI update
        // Include warning if GitHub sync failed
        const response: { success: boolean; updatedSections?: unknown; warning?: string } = { 
          success: true, 
          updatedSections: result.updatedSections 
        };
        if (result.warning) {
          response.warning = result.warning;
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

  app.post("/api/content/rename-slug", async (req, res) => {
    try {
      const isDevelopment = process.env.NODE_ENV !== "production";
      const authHeader = req.headers.authorization;
      const debugToken = req.headers["x-debug-token"] as string | undefined;
      let token: string | null = null;
      if (authHeader?.startsWith("Token ")) {
        token = authHeader.slice(6);
      } else if (debugToken) {
        token = debugToken;
      }
      if (!isDevelopment) {
        if (!token) {
          res.status(401).json({ error: "Authorization required" });
          return;
        }
        const capResponse = await fetch(
          `${BREATHECODE_HOST}/v1/auth/user/me/capability/webmaster`,
          { method: "GET", headers: { Authorization: `Token ${token}`, Academy: "4" } },
        );
        if (capResponse.status === 401) {
          res.status(401).json({ error: "Your session has expired. Please log in again." });
          return;
        }
        if (capResponse.status !== 200) {
          res.status(403).json({ error: "You need webmaster capability to rename content" });
          return;
        }
      }

      const { contentType, folderSlug, locale, newSlug, createRedirect } = req.body;

      if (!contentType || !folderSlug || !locale || !newSlug) {
        res.status(400).json({ error: "Missing required fields: contentType, folderSlug, locale, newSlug" });
        return;
      }

      const validTypes = ["location", "page", "program", "landing"];
      if (!validTypes.includes(contentType)) {
        res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
        return;
      }

      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(newSlug)) {
        res.status(400).json({ error: "Invalid slug format. Use lowercase letters, numbers, and hyphens only." });
        return;
      }

      const folderMap: Record<string, string> = {
        location: "locations",
        page: "pages",
        program: "programs",
        landing: "landings",
      };
      const contentFolder = folderMap[contentType];
      const resolvedFolderSlug = contentIndex.resolveBaseSlug(folderSlug, contentFolder);
      const folderPath = path.join(process.cwd(), "marketing-content", contentFolder, resolvedFolderSlug);

      if (!fs.existsSync(folderPath)) {
        res.status(404).json({ error: `Content folder not found: ${folderSlug} (resolved: ${resolvedFolderSlug})` });
        return;
      }

      const effectiveLocale = contentType === "landing" ? "promoted" : locale;
      const localeFile = [`${effectiveLocale}.yml`, `${effectiveLocale}.yaml`].find(f => 
        fs.existsSync(path.join(folderPath, f))
      );
      if (!localeFile) {
        res.status(404).json({ error: `Locale file not found: ${effectiveLocale}` });
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

      const oldUrl = contentIndex.buildUrl(contentFolder, effectiveLocale, currentSlug);
      const newUrl = contentIndex.buildUrl(contentFolder, effectiveLocale, newSlug);

      parsed.slug = newSlug;

      if (createRedirect) {
        const meta = (parsed.meta || {}) as Record<string, unknown>;
        const redirects = Array.isArray(meta.redirects) ? [...meta.redirects] : [];
        if (!redirects.includes(oldUrl)) {
          redirects.push(oldUrl);
        }
        meta.redirects = redirects;
        parsed.meta = meta;
      }

      const updated = safeYamlDump(parsed, { lineWidth: -1, noRefs: true });
      fs.writeFileSync(localeFilePath, updated, "utf-8");
      markFileAsModified(`marketing-content/${contentFolder}/${resolvedFolderSlug}/${localeFile}`);

      contentIndex.refresh();
      clearSitemapCache();
      clearRedirectCache();

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
    
    if (!type || !slug || typeof type !== 'string' || typeof slug !== 'string') {
      res.status(400).json({ error: "Missing required query params: type, slug" });
      return;
    }
    
    const validTypes = ['location', 'page', 'program', 'landing'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      return;
    }
    
    // Map type to folder name
    const folderMap: Record<string, string> = {
      location: 'locations',
      page: 'pages',
      program: 'programs',
      landing: 'landings',
    };
    
    const folderPath = path.join(process.cwd(), 'marketing-content', folderMap[type], slug);
    
    // For landings, also check that it's not a reserved name (starts with _)
    if (type === 'landing' && slug.startsWith('_')) {
      res.json({ available: false, slug, type, reason: "Reserved prefix" });
      return;
    }
    
    const folderExists = fs.existsSync(folderPath);
    
    if (folderExists && type !== 'landing') {
      const hasCommon = fs.existsSync(path.join(folderPath, '_common.yml'));
      const hasEn = fs.existsSync(path.join(folderPath, 'en.yml'));
      const hasEs = fs.existsSync(path.join(folderPath, 'es.yml'));
      const isComplete = hasCommon && hasEn && hasEs;
      if (isComplete) {
        res.json({ available: false, slug, type, reason: "slug_taken" });
        return;
      }
    } else if (folderExists) {
      res.json({ available: false, slug, type, reason: "slug_taken" });
      return;
    }

    const locale = typeof req.query.locale === 'string' ? req.query.locale : undefined;
    const urlsToCheck: string[] = [];
    const contentTypeMap: Record<string, string> = {
      location: 'locations',
      page: 'pages',
      program: 'programs',
      landing: 'landings',
    };
    const ctKey = contentTypeMap[type];
    if (type === 'landing') {
      urlsToCheck.push(contentIndex.buildUrl(ctKey, 'default', slug));
    } else if (locale) {
      urlsToCheck.push(contentIndex.buildUrl(ctKey, locale, slug));
    } else {
      urlsToCheck.push(contentIndex.buildUrl(ctKey, 'en', slug));
      urlsToCheck.push(contentIndex.buildUrl(ctKey, 'es', slug));
    }

    const redirects = contentIndex.getRedirects();
    for (const url of urlsToCheck) {
      const conflict = redirects.find(r => r.from === url);
      if (conflict) {
        const redirectTo = typeof conflict.to === 'string' ? conflict.to : Object.values(conflict.to).join(', ');
        res.json({ available: false, slug, type, reason: "redirect_conflict", conflictUrl: url, redirectTo });
        return;
      }
    }

    res.json({ available: true, slug, type });
  });

  app.get("/api/content/check-origin", (req, res) => {
    const { path: originPath } = req.query;
    if (!originPath || typeof originPath !== 'string') {
      res.status(400).json({ error: "Missing required query param: path" });
      return;
    }

    const normalized = originPath.startsWith("/") ? originPath : `/${originPath}`;

    const redirects = contentIndex.getRedirects();
    const existingRedirect = redirects.find(r => r.from === normalized);
    if (existingRedirect) {
      const redirectTo = typeof existingRedirect.to === 'string' ? existingRedirect.to : Object.values(existingRedirect.to).join(', ');
      res.json({ taken: true, reason: "existing_redirect", details: `Already redirects to ${redirectTo}` });
      return;
    }

    const entries = contentIndex.listAll();
    const contentTypeMap: Record<string, string> = {
      locations: 'locations',
      pages: 'pages',
      programs: 'programs',
      landings: 'landings',
    };
    for (const entry of entries) {
      const ctKey = contentTypeMap[entry.contentType] || entry.contentType;
      for (const locale of entry.locales) {
        if (locale.startsWith("_") || locale.includes(".")) continue;
        const url = contentIndex.buildUrl(ctKey, locale, entry.slug);
        if (url === normalized) {
          res.json({ taken: true, reason: "existing_page", details: `This is the "${entry.title || entry.slug}" ${entry.contentType} page (${locale})` });
          return;
        }
      }
    }

    res.json({ taken: false });
  });

  // Create new content (location/page/program)
  app.post("/api/content/create", async (req, res) => {
    try {
      // Same auth check as content edit
      const isDevelopment = process.env.NODE_ENV !== "production";
      const authHeader = req.headers.authorization;
      const debugToken = req.headers["x-debug-token"] as string | undefined;

      let token: string | null = null;
      if (authHeader?.startsWith("Token ")) {
        token = authHeader.slice(6);
      } else if (debugToken) {
        token = debugToken;
      }

      if (!isDevelopment) {
        if (!token) {
          res.status(401).json({ error: "Authorization required" });
          return;
        }

        const capResponse = await fetch(
          `${BREATHECODE_HOST}/v1/auth/user/me/capability/webmaster`,
          {
            method: "GET",
            headers: {
              Authorization: `Token ${token}`,
              Academy: "4",
            },
          },
        );

        if (capResponse.status === 401) {
          res.status(401).json({ error: "Your session has expired. Please log in again." });
          return;
        }
        
        if (capResponse.status !== 200) {
          res.status(403).json({ error: "You need webmaster capability to create content" });
          return;
        }
      }

      const { type, slugEn, slugEs, title, sourceUrl } = req.body;
      
      // Support both old format (slug) and new format (slugEn/slugEs)
      const enSlug = slugEn || req.body.slug;
      const esSlug = slugEs || req.body.slug;
      
      if (!type || !enSlug || !esSlug || !title) {
        res.status(400).json({ error: "Missing required fields: type, slugEn, slugEs, title" });
        return;
      }

      const validTypes = ['location', 'page', 'program'];
      if (!validTypes.includes(type)) {
        res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
        return;
      }

      // Validate slug format for both
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(enSlug)) {
        res.status(400).json({ error: "Invalid English slug format. Use lowercase letters, numbers, and hyphens only." });
        return;
      }
      if (!slugRegex.test(esSlug)) {
        res.status(400).json({ error: "Invalid Spanish slug format. Use lowercase letters, numbers, and hyphens only." });
        return;
      }

      // Map type to folder name
      const folderMap: Record<string, string> = {
        location: 'locations',
        page: 'pages',
        program: 'programs',
      };

      // Use English slug for folder name (primary identifier)
      const folderPath = path.join(process.cwd(), 'marketing-content', folderMap[type], enSlug);
      
      // Check if folder already exists
      if (fs.existsSync(folderPath)) {
        const hasCommon = fs.existsSync(path.join(folderPath, '_common.yml'));
        const hasEn = fs.existsSync(path.join(folderPath, 'en.yml'));
        const hasEs = fs.existsSync(path.join(folderPath, 'es.yml'));
        
        if (hasCommon && hasEn && hasEs) {
          res.status(409).json({ error: `A ${type} with slug "${enSlug}" already exists` });
          return;
        }
      }

      // Create folder
      fs.mkdirSync(folderPath, { recursive: true });

      // If duplicating from source, copy content from source page
      if (sourceUrl) {
        try {
          // Parse source URL to get content info
          const sourceUrlObj = new URL(sourceUrl);
          const sourcePath = sourceUrlObj.pathname;
          const pathParts = sourcePath.split('/').filter(Boolean);
          
          // Detect source locale and slug from path
          const sourceLocale = pathParts[0] === 'es' ? 'es' : 'en';
          let sourceSlug = '';
          let sourceFolder = '';
          
          // Determine source folder and slug based on type
          if (type === 'page') {
            sourceSlug = pathParts.slice(1).join('-') || pathParts[pathParts.length - 1];
            sourceFolder = path.join(process.cwd(), 'marketing-content', 'pages');
          } else if (type === 'program') {
            // Programs are under /bootcamp/ or /course/
            sourceSlug = pathParts[pathParts.length - 1];
            sourceFolder = path.join(process.cwd(), 'marketing-content', 'programs');
          } else if (type === 'location') {
            // Locations are under /coding-campus/
            sourceSlug = pathParts[pathParts.length - 1];
            sourceFolder = path.join(process.cwd(), 'marketing-content', 'locations');
          }
          
          // Find the source folder by checking which folder contains matching content
          const possibleFolders = fs.readdirSync(sourceFolder);
          let foundSourceFolder = '';
          
          for (const folder of possibleFolders) {
            const testPath = path.join(sourceFolder, folder);
            if (fs.statSync(testPath).isDirectory()) {
              // Check if en.yml or es.yml contains matching slug
              const enFile = path.join(testPath, 'en.yml');
              const esFile = path.join(testPath, 'es.yml');
              
              if (fs.existsSync(enFile)) {
                const content = fs.readFileSync(enFile, 'utf8');
                if (content.includes(`slug: ${sourceSlug}`) || content.includes(`slug: "${sourceSlug}"`)) {
                  foundSourceFolder = testPath;
                  break;
                }
              }
              if (!foundSourceFolder && fs.existsSync(esFile)) {
                const content = fs.readFileSync(esFile, 'utf8');
                if (content.includes(`slug: ${sourceSlug}`) || content.includes(`slug: "${sourceSlug}"`)) {
                  foundSourceFolder = testPath;
                  break;
                }
              }
            }
          }
          
          if (foundSourceFolder) {
            // Copy all files from source folder
            const sourceFiles = fs.readdirSync(foundSourceFolder);
            for (const file of sourceFiles) {
              let content = fs.readFileSync(path.join(foundSourceFolder, file), 'utf8');
              
              // Replace slug in content
              const oldSlug = path.basename(foundSourceFolder);
              content = content.replace(new RegExp(`slug:\\s*["']?${oldSlug}["']?`, 'g'), `slug: ${file === 'es.yml' ? esSlug : enSlug}`);
              content = content.replace(new RegExp(`slug:\\s*["']?${sourceSlug}["']?`, 'g'), `slug: ${file === 'es.yml' ? esSlug : enSlug}`);
              
              // Replace title if it's a locale file
              if (file === 'en.yml' || file === 'es.yml') {
                content = content.replace(/title:\s*.*$/m, `title: ${title}`);
              }
              
              fs.writeFileSync(path.join(folderPath, file), content);
              markFileAsModified(`marketing-content/${folderMap[type]}/${enSlug}/${file}`);
            }
            
            clearSitemapCache();
            contentIndex.refresh();
            
            res.json({ 
              success: true, 
              slugEn: enSlug,
              slugEs: esSlug,
              type,
              folder: `marketing-content/${folderMap[type]}/${enSlug}`,
              duplicatedFrom: sourceUrl,
            });
            return;
          }
        } catch (dupError) {
          console.error("Error duplicating content:", dupError);
          // Fall through to create new content if duplication fails
        }
      }

      // Create starter YAML files based on type
      let commonYml: string;
      let enYml: string;
      let esYml: string;

      if (type === 'page') {
        commonYml = `# Common properties shared across all language variants
slug: "${enSlug}"
template: "default"
title: "${title}"

meta:
  robots: "index, follow"
  priority: 0.8
  change_frequency: "weekly"

schema:
  include:
    - "organization"
    - "website"
`;

        enYml = `slug: ${enSlug}
template: default
title: ${title}
meta:
  page_title: ${title} | 4Geeks Academy
  description: ${title} - Learn more about this topic at 4Geeks Academy.
  redirects:
    - /${enSlug}
sections: []
`;

        esYml = `slug: ${esSlug}
template: default
title: ${title}
meta:
  page_title: ${title} | 4Geeks Academy
  description: ${title} - Aprende más sobre este tema en 4Geeks Academy.
  redirects:
    - /${esSlug}
sections: []
`;
      } else if (type === 'program') {
        commonYml = `# Common properties shared across all variants
slug: ${enSlug}
title: ${title}

meta:
  robots: index, follow
  priority: 0.9
  change_frequency: weekly

schema:
  include:
    - organization
    - website
`;

        enYml = `slug: ${enSlug}
title: ${title}
meta:
  page_title: ${title} | 4Geeks Academy
  description: Learn ${title} at 4Geeks Academy. Become job-ready with our intensive program.
  redirects:
    - /${enSlug}
sections: []
`;

        esYml = `slug: ${esSlug}
title: ${title}
meta:
  page_title: ${title} | 4Geeks Academy
  description: Aprende ${title} en 4Geeks Academy. Prepárate para el trabajo con nuestro programa intensivo.
  redirects:
    - /${esSlug}
sections: []
`;
      } else {
        // location
        commonYml = `slug: ${enSlug}
name: ${title}
city: ${title}
country: Unknown
country_code: XX
latitude: 0
longitude: 0
region: online
default_language: en
timezone: UTC
visibility: listed
phone: ""
address: ""
available_programs:
  - "full-stack"

schema:
  include:
    - organization
    - website
`;

        enYml = `slug: ${enSlug}
meta:
  page_title: ${title} Coding Bootcamp | 4Geeks Academy
  description: Join 4Geeks Academy in ${title}. Learn to code with our immersive bootcamp programs.
sections: []
`;

        esYml = `slug: ${esSlug}
meta:
  page_title: Bootcamp de Programación en ${title} | 4Geeks Academy
  description: Únete a 4Geeks Academy en ${title}. Aprende a programar con nuestros programas de bootcamp.
sections: []
`;
      }

      // Write only missing files (preserve existing content from partial creation)
      const createdFiles: string[] = [];
      const relFolder = `marketing-content/${folderMap[type]}/${enSlug}`;
      if (!fs.existsSync(path.join(folderPath, '_common.yml'))) {
        fs.writeFileSync(path.join(folderPath, '_common.yml'), commonYml);
        createdFiles.push('_common.yml');
        markFileAsModified(`${relFolder}/_common.yml`);
      }
      if (!fs.existsSync(path.join(folderPath, 'en.yml'))) {
        fs.writeFileSync(path.join(folderPath, 'en.yml'), enYml);
        createdFiles.push('en.yml');
        markFileAsModified(`${relFolder}/en.yml`);
      }
      if (!fs.existsSync(path.join(folderPath, 'es.yml'))) {
        fs.writeFileSync(path.join(folderPath, 'es.yml'), esYml);
        createdFiles.push('es.yml');
        markFileAsModified(`${relFolder}/es.yml`);
      }

      // Clear sitemap cache so the new content appears
      clearSitemapCache();

      contentIndex.refresh();
      res.json({ 
        success: true, 
        slugEn: enSlug,
        slugEs: esSlug,
        type,
        folder: `marketing-content/${folderMap[type]}/${enSlug}`,
        files: createdFiles.length > 0 ? createdFiles : ['_common.yml', 'en.yml', 'es.yml'],
        recovered: createdFiles.length > 0 && createdFiles.length < 3,
      });
    } catch (error) {
      console.error("Content create error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/content/delete", async (req, res) => {
    try {
      const isDevelopment = process.env.NODE_ENV !== "production";
      const authHeader = req.headers.authorization;
      const debugToken = req.headers["x-debug-token"] as string | undefined;

      let token: string | null = null;
      if (authHeader?.startsWith("Token ")) {
        token = authHeader.slice(6);
      } else if (debugToken) {
        token = debugToken;
      }

      if (!isDevelopment) {
        if (!token) {
          res.status(401).json({ error: "Authorization required" });
          return;
        }

        const capResponse = await fetch(
          `${BREATHECODE_HOST}/v1/auth/user/me/capability/webmaster`,
          {
            method: "GET",
            headers: {
              Authorization: `Token ${token}`,
              Academy: "4",
            },
          },
        );

        if (capResponse.status === 401) {
          res.status(401).json({ error: "Your session has expired. Please log in again." });
          return;
        }

        if (capResponse.status !== 200) {
          res.status(403).json({ error: "You need webmaster capability to delete content" });
          return;
        }
      }

      const { type, slug, confirmSlug } = req.body;

      if (!type || !slug || !confirmSlug) {
        res.status(400).json({ error: "Missing required fields: type, slug, confirmSlug" });
        return;
      }

      if (slug !== confirmSlug) {
        res.status(400).json({ error: "Confirmation slug does not match. Deletion cancelled." });
        return;
      }

      const folderMap: Record<string, string> = {
        location: 'locations',
        page: 'pages',
        program: 'programs',
        landing: 'landings',
      };

      if (!folderMap[type]) {
        res.status(400).json({ error: `Invalid type. Must be one of: ${Object.keys(folderMap).join(', ')}` });
        return;
      }

      if (!slug || /[\/\\]|\.\./.test(slug) || slug.startsWith('.')) {
        res.status(400).json({ error: "Invalid slug format" });
        return;
      }

      const typeFolder = { program: 'programs', page: 'pages', location: 'locations', landing: 'landings' }[type] || type;
      const resolvedSlug = contentIndex.resolveBaseSlug(slug, typeFolder);

      const folderPath = path.join(process.cwd(), 'marketing-content', folderMap[type], resolvedSlug);

      if (!fs.existsSync(folderPath)) {
        res.status(404).json({ error: `Content "${slug}" of type "${type}" not found` });
        return;
      }

      const realPath = fs.realpathSync(path.resolve(folderPath));
      const allowedBase = fs.realpathSync(path.join(process.cwd(), 'marketing-content', folderMap[type]));
      if (!realPath.startsWith(allowedBase + path.sep)) {
        res.status(400).json({ error: "Invalid path" });
        return;
      }

      fs.rmSync(folderPath, { recursive: true, force: true });

      console.log(`[Content] Deleted ${type}/${slug}`);
      contentIndex.refresh();

      res.json({ success: true, message: `Successfully deleted ${type}/${slug}` });
    } catch (error) {
      console.error("Content delete error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create new landing page
  app.post("/api/content/create-landing", async (req, res) => {
    try {
      // Same auth check as content edit
      const isDevelopment = process.env.NODE_ENV !== "production";
      const authHeader = req.headers.authorization;
      const debugToken = req.headers["x-debug-token"] as string | undefined;

      let token: string | null = null;
      if (authHeader?.startsWith("Token ")) {
        token = authHeader.slice(6);
      } else if (debugToken) {
        token = debugToken;
      }

      if (!isDevelopment) {
        if (!token) {
          res.status(401).json({ error: "Authorization required" });
          return;
        }

        const capResponse = await fetch(
          `${BREATHECODE_HOST}/v1/auth/user/me/capability/webmaster`,
          {
            method: "GET",
            headers: {
              Authorization: `Token ${token}`,
              Academy: "4",
            },
          },
        );

        if (capResponse.status === 401) {
          res.status(401).json({ error: "Your session has expired. Please log in again." });
          return;
        }
        
        if (capResponse.status !== 200) {
          res.status(403).json({ error: "You need webmaster capability to create content" });
          return;
        }
      }

      const { slug, locale, title, sourceUrl } = req.body;
      
      if (!slug || !title) {
        res.status(400).json({ error: "Missing required fields: slug, title" });
        return;
      }

      const validLocales = ['en', 'es'];
      const landingLocale = locale && validLocales.includes(locale) ? locale : 'en';

      // Validate slug format
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(slug)) {
        res.status(400).json({ error: "Invalid slug format. Use lowercase letters, numbers, and hyphens only." });
        return;
      }

      // Don't allow reserved prefixes
      if (slug.startsWith('_')) {
        res.status(400).json({ error: "Slug cannot start with underscore (reserved)" });
        return;
      }

      const folderPath = path.join(process.cwd(), 'marketing-content', 'landings', slug);
      
      // Check if folder already exists
      if (fs.existsSync(folderPath)) {
        res.status(409).json({ error: `A landing with slug "${slug}" already exists` });
        return;
      }

      // Create folder
      fs.mkdirSync(folderPath, { recursive: true });

      // If duplicating from source, copy content from source landing
      if (sourceUrl) {
        try {
          // Parse source URL to get landing slug
          const sourceUrlObj = new URL(sourceUrl);
          const sourcePath = sourceUrlObj.pathname;
          const pathParts = sourcePath.split('/').filter(Boolean);
          
          // Landing URLs are like /landing/example-landing or /us/landing/example-landing
          let sourceSlug = '';
          const landingIndex = pathParts.indexOf('landing');
          if (landingIndex !== -1 && pathParts.length > landingIndex + 1) {
            sourceSlug = pathParts[landingIndex + 1];
          }
          
          if (sourceSlug) {
            const sourceFolderPath = path.join(process.cwd(), 'marketing-content', 'landings', sourceSlug);
            
            if (fs.existsSync(sourceFolderPath)) {
              // Copy all files from source folder
              const sourceFiles = fs.readdirSync(sourceFolderPath);
              for (const file of sourceFiles) {
                let content = fs.readFileSync(path.join(sourceFolderPath, file), 'utf8');
                
                // Replace slug in content
                content = content.replace(new RegExp(`slug:\\s*["']?${sourceSlug}["']?`, 'g'), `slug: "${slug}"`);
                
                // Replace title if it's _common.yml
                if (file === '_common.yml') {
                  content = content.replace(/title:\s*["']?.*["']?$/m, `title: "${title}"`);
                }
                
                fs.writeFileSync(path.join(folderPath, file), content);
                markFileAsModified(`marketing-content/landings/${slug}/${file}`);
              }
              
              clearSitemapCache();
              contentIndex.refresh();
              
              res.json({ 
                success: true, 
                slug,
                locale: landingLocale,
                folder: `marketing-content/landings/${slug}`,
                duplicatedFrom: sourceUrl,
              });
              return;
            }
          }
        } catch (dupError) {
          console.error("Error duplicating landing:", dupError);
          // Fall through to create new content if duplication fails
        }
      }

      // Create starter YAML files for landings (_common.yml and promoted.yml)
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

      const promotedYml = `# Promoted variant - customize for marketing campaigns
sections: []
`;

      // Write files
      fs.writeFileSync(path.join(folderPath, '_common.yml'), commonYml);
      markFileAsModified(`marketing-content/landings/${slug}/_common.yml`);
      fs.writeFileSync(path.join(folderPath, 'promoted.yml'), promotedYml);
      markFileAsModified(`marketing-content/landings/${slug}/promoted.yml`);

      clearSitemapCache();
      contentIndex.refresh();

      res.json({ 
        success: true, 
        slug,
        locale: landingLocale,
        folder: `marketing-content/landings/${slug}`,
        files: ['_common.yml', 'promoted.yml'],
      });
    } catch (error) {
      console.error("Landing create error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/content/:contentType/:slug", (req, res) => {
    const { contentType, slug } = req.params;
    const locale = normalizeLocale(req.query.locale as string);

    if (!["program", "landing", "location"].includes(contentType)) {
      res.status(400).json({ error: "Invalid content type" });
      return;
    }

    const result = getContentForEdit(
      contentType as "program" | "landing" | "location",
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
    const locale = normalizeLocale((req.params as { locale?: string }).locale || req.query.locale as string);

    // Get all programs for dropdown
    const programs = listCareerPrograms(locale).map((p) => ({
      slug: p.slug,
      title: p.title,
    }));

    // Get all visible locations grouped by region
    const locationsPath = path.join(
      process.cwd(),
      "marketing-content",
      "locations",
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
        // Experiment tracking
        experiment_slug: leadData.experiment_slug || null,
        experiment_variant: leadData.experiment_variant || null,
        experiment_version: leadData.experiment_version || null,
        // Turnstile token for bot protection
        token: leadData.token || null,
      };

      // Remove null, undefined, and empty string values from payload
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([_, value]) => value !== null && value !== undefined && value !== "")
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
  app.get("/api/image-registry", (_req, res) => {
    const registry = mediaGallery.getRegistry();
    if (!registry) {
      res.status(500).json({ error: "Failed to load image registry" });
      return;
    }
    res.json(registry);
  });

  app.delete("/api/image-registry/:id", (req, res) => {
    try {
      const result = mediaGallery.unregister(req.params.id);
      if (!result.success) {
        const status = result.usedIn ? 409 : 404;
        res.status(status).json({
          error: result.usedIn ? "Image is in use" : result.error,
          message: result.error,
          ...(result.usedIn ? { usedIn: result.usedIn } : {}),
        });
        return;
      }
      res.json({ success: true, message: `Deleted "${req.params.id}" from registry` });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Delete failed" });
    }
  });

  app.post("/api/image-registry/bulk-delete", (req, res) => {
    try {
      const { ids } = req.body as { ids?: string[] };
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: "Missing or empty 'ids' array" });
        return;
      }
      const { results, deletedCount } = mediaGallery.bulkUnregister(ids);
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
      if (filtered.newImages.length === 0 && filtered.updatedImages.length === 0) {
        res.json({ message: "Nothing to apply", added: 0, updated: 0 });
        return;
      }
      const applied = mediaGallery.applyChanges(filtered);
      const yamlMsg = applied.yamlFilesUpdated.length > 0
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
        res.json({ message: "No duplicates found", removedCount: 0, results: [] });
        return;
      }
      const result = mediaGallery.removeDuplicates(scanResult.duplicates);
      const yamlMsg = result.yamlFilesUpdated.length > 0
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

  app.post("/api/image-registry/migrate", async (req, res) => {
    try {
      const { from, to, dryRun, prefix } = req.body as {
        from?: string; to?: string; dryRun?: boolean; prefix?: string;
      };
      if (!from || !to) {
        res.status(400).json({ error: "Missing 'from' and/or 'to' provider name" });
        return;
      }
      const results = await mediaGallery.migrate(from, to, { dryRun, prefix });
      const migrated = results.filter(r => r.status === "migrated").length;
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

  const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".avif", ".gif"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${ext}`));
      }
    },
  });

  app.post("/api/image-registry/upload", imageUpload.single("file"), async (req, res) => {
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
        { alt, tags }
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Upload failed" });
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
        (f: any) => getCanonicalUrl(f) === url
      );
      const urlLocale = url.startsWith("/es/") ? "es" : url.startsWith("/en/") ? "en" : null;
      const file = (urlLocale && matchingFiles.find((f: any) => f.locale === urlLocale))
        || matchingFiles.find((f: any) => f.locale !== "_common")
        || matchingFiles[0]
        || null;

      if (!file) {
        res.status(404).json({ error: `No content found for URL: ${url}` });
        return;
      }

      let rawData: Record<string, unknown> = {};
      try {
        if (fs.existsSync(file.filePath)) {
          rawData = safeYamlLoad(fs.readFileSync(file.filePath, "utf-8")) as Record<string, unknown> || {};
        }
      } catch {}

      const schemaValidation: { valid: boolean; errors: Array<{ path: string; code: string; message: string; expected?: string; received?: string }> } = { valid: true, errors: [] };
      try {
        const typeToContentType: Record<string, ContentType> = {
          program: "programs",
          landing: "landings",
          location: "locations",
          page: "pages",
        };
        const typeToSchema: Record<string, any> = {
          program: careerProgramSchema,
          landing: landingPageSchema,
          location: locationPageSchema,
          page: templatePageSchema,
        };
        const ct = typeToContentType[file.type];
        const zodSchema = typeToSchema[file.type];
        if (ct && zodSchema) {
          let inferredLocale = file.locale;
          if (!inferredLocale || inferredLocale === "_common") {
            inferredLocale = urlLocale || (url.startsWith("/es/") ? "es" : "en");
          }
          const localeOrVariant = file.type === "landing" ? "promoted" : inferredLocale;
          const folderSlug = path.basename(path.dirname(file.filePath));
          const result = loadContent({
            contentType: ct,
            slug: folderSlug,
            schema: zodSchema,
            localeOrVariant,
          });
          if (!result.success) {
            schemaValidation.valid = false;
            const zodErrorMatch = result.error.match(/Invalid YAML structure[^:]*:\s*([\s\S]*)/);
            if (zodErrorMatch) {
              try {
                const parsed = JSON.parse(zodErrorMatch[1]);
                if (Array.isArray(parsed)) {
                  for (const issue of parsed) {
                    schemaValidation.errors.push({
                      path: Array.isArray(issue.path) ? issue.path.join(".") : String(issue.path || ""),
                      code: issue.code || "unknown",
                      message: issue.message || "Validation failed",
                      expected: issue.expected ? String(issue.expected) : undefined,
                      received: issue.received ? String(issue.received) : undefined,
                    });
                  }
                }
              } catch {
                schemaValidation.errors.push({
                  path: "",
                  code: "SCHEMA_VALIDATION_FAILED",
                  message: zodErrorMatch[1] || result.error,
                });
              }
            } else {
              schemaValidation.errors.push({
                path: "",
                code: "CONTENT_LOAD_FAILED",
                message: result.error,
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
      imageIds.forEach((id) => {
        if (!registryImages[id]) {
          missingFromRegistry.push(id);
        } else if (registryImages[id].src) {
          const srcPath = path.join(process.cwd(), registryImages[id].src);
          if (!fs.existsSync(srcPath)) {
            missingFromDisk.push(id);
          }
        }
      });

      const counterpartLocale = file.locale === "en" ? "es" : "en";
      const counterpartFile = context.contentFiles.find(
        (f: any) =>
          f.slug === file.slug &&
          f.type === file.type &&
          f.locale === counterpartLocale
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
        JSON.stringify(s).match(/todo/i)
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

      contentMax += 15;
      const emptyFields: string[] = [];
      function findEmptyFields(
        obj: unknown,
        path: string = ""
      ): void {
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
      if (emptyFields.length === 0) {
        contentScore += 15;
      }

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
        (seoPercent + schemaPercent + contentPercent) / 3
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
          hasEnglish: file.locale === "en" || !!counterpartFile,
          hasSpanish:
            file.locale === "es" ||
            (counterpartFile && counterpartFile.locale === "es"),
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
      const validTypes = ["programs", "pages", "landings", "locations"];
      if (!validTypes.includes(contentType)) {
        res.status(400).json({
          error: "Invalid content type",
          validTypes,
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
      const { analyzeDataPayload } = await import("./ai/generateTableFromPayload");

      const { sampleData, availableKeys } = req.body;

      if (!sampleData || !Array.isArray(sampleData) || sampleData.length === 0) {
        res.status(400).json({ error: "sampleData must be a non-empty array" });
        return;
      }
      if (!availableKeys || !Array.isArray(availableKeys) || availableKeys.length === 0) {
        res.status(400).json({ error: "availableKeys must be a non-empty array" });
        return;
      }

      const locale = req.body.locale || "en";
      const analysis = await analyzeDataPayload({ sampleData, availableKeys, locale });
      res.json(analysis);
    } catch (error: any) {
      console.error("Error analyzing data payload:", error?.message || error);
      const message = error?.message || "Failed to analyze data";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/ai/generate-table-from-payload", async (req, res) => {
    try {
      const { generateTableFromPayload } = await import("./ai/generateTableFromPayload");

      const { sampleData, availableKeys, userPrompt } = req.body;

      if (!sampleData || !Array.isArray(sampleData) || sampleData.length === 0) {
        res.status(400).json({ error: "sampleData must be a non-empty array" });
        return;
      }
      if (!availableKeys || !Array.isArray(availableKeys) || availableKeys.length === 0) {
        res.status(400).json({ error: "availableKeys must be a non-empty array" });
        return;
      }
      if (!userPrompt || typeof userPrompt !== "string") {
        res.status(400).json({ error: "userPrompt must be a non-empty string" });
        return;
      }

      const locale = req.body.locale || "en";
      const config = await generateTableFromPayload({ sampleData, availableKeys, userPrompt, locale });
      res.json(config);
    } catch (error: any) {
      console.error("Error generating table config:", error?.message || error);
      const message = error?.message || "Failed to generate table configuration";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/ai/refine-table-config", async (req, res) => {
    try {
      const { refineTableConfig } = await import("./ai/generateTableFromPayload");

      const { currentConfig, sampleData, availableKeys, userFeedback, locale } = req.body;

      if (!currentConfig || !currentConfig.columns) {
        res.status(400).json({ error: "currentConfig with columns is required" });
        return;
      }
      if (!sampleData || !Array.isArray(sampleData) || sampleData.length === 0) {
        res.status(400).json({ error: "sampleData must be a non-empty array" });
        return;
      }
      if (!userFeedback || typeof userFeedback !== "string") {
        res.status(400).json({ error: "userFeedback must be a non-empty string" });
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
      const { generateGlobalFilter } = await import("./ai/generateTableFromPayload");

      const { sampleData, availableKeys, userPrompt, currentFilter, locale, sessionContext } = req.body;

      if (!sampleData || !Array.isArray(sampleData) || sampleData.length === 0) {
        res.status(400).json({ error: "sampleData must be a non-empty array" });
        return;
      }
      if (!userPrompt || typeof userPrompt !== "string") {
        res.status(400).json({ error: "userPrompt must be a non-empty string" });
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
      `${normalizedLocale}.yml`
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
      `${normalizedLocale}.yml`
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
      
      // Auth check (same as content edit)
      const isDevelopment = process.env.NODE_ENV !== "production";
      const authHeader = req.headers.authorization;
      const debugToken = req.headers["x-debug-token"] as string | undefined;
      
      let token: string | null = null;
      if (authHeader?.startsWith("Token ")) {
        token = authHeader.slice(6);
      } else if (debugToken) {
        token = debugToken;
      }
      
      if (!isDevelopment) {
        if (!token) {
          res.status(401).json({ error: "Authorization required" });
          return;
        }
        
        const capResponse = await fetch(
          `${BREATHECODE_HOST}/v1/auth/user/me/capability/webmaster`,
          {
            method: "GET",
            headers: {
              Authorization: `Token ${token}`,
              Academy: "4",
            },
          }
        );
        
        if (capResponse.status === 401) {
          res.status(401).json({ error: "Your session has expired. Please log in again." });
          return;
        }
        
        if (capResponse.status !== 200) {
          res.status(403).json({ error: "You need webmaster capability to edit FAQs" });
          return;
        }
      }
      
      const { faqs } = req.body;
      
      if (!faqs || !Array.isArray(faqs)) {
        res.status(400).json({ error: "Missing required field: faqs (array)" });
        return;
      }
      
      const faqsPath = path.join(
        process.cwd(),
        "marketing-content",
        "faqs",
        `${normalizedLocale}.yml`
      );
      
      // Generate YAML with comment header
      const header = `# Centralized FAQ Data - ${normalizedLocale === 'en' ? 'English' : 'Spanish'}
# All FAQs should be stored here and referenced by pages via related_features filter
# No HTML tags - plain text only

`;
      const yamlContent = header + safeYamlDump({ faqs }, { 
        lineWidth: -1, 
        quotingType: '"',
        forceQuotes: false,
        flowLevel: -1
      });
      
      fs.writeFileSync(faqsPath, yamlContent, "utf8");
      
      // Clear relevant caches
      clearSitemapCache();
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving FAQs:", error);
      res.status(500).json({ error: "Failed to save FAQs" });
    }
  });

  app.use(async (req, res, next) => {
    const url = req.originalUrl || req.url;
    if (url.startsWith("/api/") || url.startsWith("/attached_assets/") || url.startsWith("/marketing-content/") || /\.\w+$/.test(url)) {
      return next();
    }

    let schemaHtml = "";

    const blogRoute = parseBlogRoute(url);
    if (blogRoute) {
      try {
        const posts = await getBlogPosts();
        const post = findBlogPostBySlug(posts, blogRoute.slug);
        if (post) {
          schemaHtml = generateBlogSsrHtml(post, blogRoute.locale);
        }
      } catch (err) {
        console.error("[SSR-Blog] Error generating blog schema for", url, err);
      }
    } else {
      const cleanUrl = url.split("?")[0].split("#")[0];
      const blogListingMatch = cleanUrl.match(/^\/(en|es)\/blog\/?$/);
      if (blogListingMatch) {
        schemaHtml = generateBlogListingSsrHtml(blogListingMatch[1]);
      } else {
        schemaHtml = generateSsrSchemaHtml(url);
      }
    }

    if (!schemaHtml) {
      return next();
    }

    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      const distPath = path.resolve(import.meta.dirname, "public");
      const indexPath = path.resolve(distPath, "index.html");
      try {
        let html = fs.readFileSync(indexPath, "utf-8");
        if (html.includes("</head>")) {
          html = html.replace("</head>", `${schemaHtml}\n</head>`);
        }
        res.status(200).set({ "Content-Type": "text/html" }).send(html);
        return;
      } catch {
        return next();
      }
    }

    const originalEnd = res.end.bind(res);
    res.end = function (chunk?: any, ...args: any[]) {
      const contentType = res.getHeader("content-type");
      if (contentType && typeof contentType === "string" && contentType.includes("text/html") && chunk) {
        let html = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : chunk;
        if (typeof html === "string" && html.includes("</head>")) {
          html = html.replace("</head>", `${schemaHtml}\n</head>`);
          return originalEnd(html, ...args);
        }
      }
      return originalEnd(chunk, ...args);
    } as typeof res.end;

    next();
  });

  const httpServer = createServer(app);

  return httpServer;
}
