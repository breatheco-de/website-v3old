import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "../storage";
import { geoGet, geoSet } from "../geo-cache";
import { getQueueStats, enqueueOptimization, getPendingOptimizations, getFailedEntries, retryFailedImages, resetOptimizeSession, getOptimizeSession, enqueueExternalImage } from "../image-registry";
import { getAllQueueState } from "../image-queue-state";


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
  invalidateSitemapEntry,
  invalidateSitemapEntriesByContentKey,
  refreshSitemapEntry,
  refreshSitemapEntriesForContentKey,
} from "../sitemap";
import { markFileAsModified } from "../sync-state";
import { deepMerge } from "../utils/deepMerge";
import { regenerateSectionIds } from "../utils/regenerateSectionIds";
import { databaseManager } from "../database";
import {
  redirectMiddleware,
  getRedirects,
  clearRedirectCache,
  testRedirect,
} from "../redirects";
import {
  getSchema,
  getMergedSchemas,
  getAvailableSchemaKeys,
  clearSchemaCache,
  getOrganizationTwitterHandle,
  getOrganizationSameAsUrl,
  getWebsiteDefaultSocialImage,
  updateWebsiteDefaultSocialImage,
  updateOrganizationTwitterHandle,
  updateOrganizationSameAsUrl,
} from "../schema-org";
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
} from "../component-registry";
import {
  editContent,
  editCommonContent,
  getContentForEdit,
  createContentEntry,
  deleteContentEntry,
  renameContentSlug,
} from "../content-editor";
import { bindingManager } from "../bindings";
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
} from "../versioning";
import { mediaGallery } from "../media-gallery";
import { media } from "../media";
import multer from "multer";
import { contentIndex, type ContentType } from "../content-index";
import { runScan as runComponentInsightsScan, readInsightsFile, suggestNext as suggestNextComponent } from "../component-insights";
import { validateFieldSource, validateFieldMapping, extractByDotPath } from "../../scripts/validation/shared/fieldMappingValidator";
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
} from "../content-types";
import { resolveFieldValue, applyTransformIfNeeded } from "../transform";
import { resolveSingleVars } from "../single-resolver";
import {
  normalizeLocale,
  getSupportedLocales,
  getDefaultLocale,
  getLocaleEntries,
  updateLocaleSettings,
  getHomePage,
  getOptimizationSettings,
  updateOptimizationSettings,
} from "../settings";
import { variableManager } from "../variable-manager";
import { getValidationService } from "../../scripts/validation/service";
import { getCanonicalUrl, normalizeUrl } from "../../scripts/validation/shared/canonicalUrls";
import {
  isNonLocalFilesystemSrc,
  buildRegistrySrcToIdMap,
  resolveRegistryReference,
} from "../../scripts/validation/shared/imageRegistrySrc";
import type { ProgressEvent } from "../../scripts/validation/fixers/types";
import { gcs } from "../gcs";
import { z } from "zod";
import {
  generateSsrSchemaHtml,
  generateDatabaseSsrHtml,
  generateListingSsrHtml,
  clearSsrSchemaCache,
  loadRawYaml,
  resolveFaqItems,
  buildFaqPageSchema,
  resolvePageRobots,
  type FaqSection,
} from "../ssr-schema";
import {
  fetchMarkdownContent,
  clearMarkdownCache,
  clearMarkdownCacheByUrl,
} from "../markdown";
import { resolveDynamicEntries } from "../dynamic-entries";
import { loadDatabaseSinglePage, mergeSingleTemplate } from "../database-single-loader";
import { getBaseUrl } from "../hreflang";
import * as userManager from "../user-manager";
import * as userStore from "../user-store";
import type { CapabilityName } from "../user-store";


import {
  BREATHECODE_HOST,
  extractToken,
  requireCapability,
  safeYamlLoad,
  safeYamlDump,
  resolveVariantAssignment,
  invalidateContentCaches,
  createValidationFixRun,
  appendValidationRunLog,
  applyFixerProgress,
  resolveFixerPipeline,
  validationRuns,
  validationRunOrder,
  MAX_VALIDATION_RUNS,
  MAX_RUN_LOG_ENTRIES,
  careerProgramsListingSchema,
  loadCareerProgramsListing,
  applyMetaFallback,
  injectCanonicalIfMissing,
  loadCareerProgram,
  listCareerPrograms,
  loadLandingPage,
  listLandingPages,
  loadLocationPage,
  listLocationPages,
  loadTemplatePage,
  buildSingleEntryFromContent,
  listTemplatePages,
  detectLanguageFromRequest,
  ValidationFixRunState,
  ValidationFixRunLogEntry,
  FixerItemStatus,
} from "./_helpers";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/check-capability", async (req, res) => {
    const { cap, contentType, username } = req.query as Record<string, string>;

    if (!cap) {
      res.status(400).json({ error: "cap query parameter is required" });
      return;
    }

    const isDevelopment = process.env.NODE_ENV !== "production";
    if (isDevelopment) {
      res.json({ allowed: true });
      return;
    }

    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!bearerToken) {
      res.status(401).json({ error: "Authorization required" });
      return;
    }

    let resolvedUsername: string | null = username || null;

    // Support both MCP_SERVER_SECRET (new name) and MCP_API_KEY (legacy alias)
    const mcpApiKey = process.env.MCP_SERVER_SECRET || process.env.MCP_API_KEY;
    if (mcpApiKey && bearerToken === mcpApiKey) {
      // Trusted internal call from the MCP server — username must be supplied explicitly
      if (!resolvedUsername) {
        res.status(400).json({ error: "username query parameter required when authenticating with the API key" });
        return;
      }
    } else {
      // Treat bearer as a Breathecode token and validate it
      const profile = await userManager.validateToken(bearerToken);
      if (!profile.valid || !profile.username) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }
      resolvedUsername = profile.username;
    }

    const allowed = userStore.hasCapability(resolvedUsername, cap as CapabilityName, contentType || undefined);
    if (!allowed) {
      const scopeMsg = contentType ? ` for content type '${contentType}'` : "";
      res.status(403).json({ error: `Forbidden: capability '${cap}' required${scopeMsg}`, allowed: false });
      return;
    }

    res.json({ allowed: true });
  });

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

      // Auto-register user; grant webmaster if no one currently holds the role
      const noWebmasterExists = userStore.isFirstUser();
      userStore.upsertUser({
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
      });
      if (noWebmasterExists) {
        userStore.assignRoles(profile.username, ["webmaster"]);
        console.log(`[UserStore] Bootstrap: no webmaster existed — "${profile.username}" auto-assigned webmaster role`);
      }

      // Claim any pending pre-registration that matches this user's email
      if (profile.email) {
        const pendingRole = userStore.claimPendingUser(profile.email);
        if (pendingRole) {
          const existingUser = userStore.getUser(profile.username);
          const currentRoles = existingUser?.roles ?? [];
          if (!currentRoles.includes(pendingRole)) {
            userStore.assignRoles(profile.username, [...currentRoles, pendingRole]);
          }
          console.log(`[UserStore] Claimed pending role "${pendingRole}" for user "${profile.username}" via email match`);
        }
      }

      const capabilities = userStore.getEffectiveCapabilities(profile.username);
      const userName = profile.username;

      res.json({ valid: true, capabilities, userName, username: profile.username, expiresAt: profile.expiresAt ?? null });
    } catch (error) {
      console.error("Token validation error:", error);
      res.json({ valid: false, capabilities: [] });
    }
  });

  // Internal loopback: return identity + roles + capabilities for an authenticated MCP caller.
  // Accepts the same trusted-internal auth pattern as /api/auth/check-capability.
  app.get("/api/auth/user-info", async (req, res) => {
    const { username } = req.query as Record<string, string>;

    const isDevelopment = process.env.NODE_ENV !== "production";
    if (isDevelopment) {
      const devUser = username || "dev.user";
      const devRecord = userStore.getUser(devUser);
      res.json({
        username: devUser,
        firstName: devRecord?.firstName ?? "Dev",
        lastName: devRecord?.lastName ?? "User",
        email: devRecord?.email ?? "dev@localhost",
        roles: devRecord?.roles ?? ["webmaster"],
        capabilities: userStore.getEffectiveCapabilities(devUser),
      });
      return;
    }

    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!bearerToken) {
      res.status(401).json({ error: "Authorization required" });
      return;
    }

    let resolvedUsername: string | null = username || null;

    const mcpApiKey = process.env.MCP_SERVER_SECRET || process.env.MCP_API_KEY;
    if (mcpApiKey && bearerToken === mcpApiKey) {
      if (!resolvedUsername) {
        res.status(400).json({ error: "username query parameter required when authenticating with the API key" });
        return;
      }
    } else {
      const profile = await userManager.validateToken(bearerToken);
      if (!profile.valid || !profile.username) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }
      resolvedUsername = profile.username;
    }

    const record = userStore.getUser(resolvedUsername);
    if (!record) {
      res.status(404).json({ error: `User '${resolvedUsername}' not found` });
      return;
    }

    res.json({
      username: record.username,
      firstName: record.firstName ?? "",
      lastName: record.lastName ?? "",
      email: record.email ?? "",
      roles: record.roles,
      capabilities: userStore.getEffectiveCapabilities(resolvedUsername),
    });
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
}
