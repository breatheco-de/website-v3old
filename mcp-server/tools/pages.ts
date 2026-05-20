import fs from "fs";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  MARKETING_CONTENT_PATH,
  getDirectory,
  loadContentTypes,
  isDbBacked,
  resolveContentType,
  scanPages,
  loadPage,
  safeLoad,
  safeDump,
  setValueAtPath,
} from "../lib/content.js";
import { assertSafeSegment, assertSafeLocale, assertWithinBase } from "../lib/sanitize.js";

const MAIN_SERVER_PORT = process.env.PORT || "5000";

/**
 * Notify the main server that a file has been modified so it is enqueued
 * in the auto-commit debounce queue (same path as UI edits).
 */
async function notifyMarkModified(relativePath: string): Promise<void> {
  try {
    const url = `http://localhost:${MAIN_SERVER_PORT}/api/content/mark-modified`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: relativePath }),
    });
  } catch {
    // Non-fatal: auto-commit won't pick it up, but the file is still written.
  }
}

/**
 * Check whether a file has a remote conflict before writing it.
 * Returns conflict info (including remote content) if a conflict is detected,
 * or null if it's safe to proceed.
 */
async function checkRemoteConflict(
  filePath: string
): Promise<{ conflict: true; remoteContent: string } | { conflict: false }> {
  try {
    const url = `http://localhost:${MAIN_SERVER_PORT}/api/github/file-status?file=${encodeURIComponent(filePath)}`;
    const res = await fetch(url);
    if (!res.ok) return { conflict: false };
    const data = await res.json() as {
      hasConflict?: boolean;
      remoteContent?: string;
    };
    if (data.hasConflict && typeof data.remoteContent === "string") {
      return { conflict: true, remoteContent: data.remoteContent };
    }
    return { conflict: false };
  } catch {
    return { conflict: false };
  }
}

/** Build a structured conflict error including both remote and intended content. */
function conflictError(opts: {
  relativePath: string;
  remoteContent: string;
  intendedContent: string;
  intendedChange?: Record<string, unknown>;
}) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        error: "conflict",
        message:
          `Remote conflict detected on ${opts.relativePath}. ` +
          "The remote has been modified since the last pull. " +
          "Merge remoteContent with intendedContent and retry.",
        conflictedFile: opts.relativePath,
        remoteContent: opts.remoteContent,
        intendedContent: opts.intendedContent,
        ...(opts.intendedChange ? { intendedChange: opts.intendedChange } : {}),
      }, null, 2),
    }],
    isError: true,
  };
}

export function registerPageTools(mcp: McpServer, _mcpAuthor?: string): void {
  // list_pages
  mcp.tool(
    "list_pages",
    "List YAML-driven content pages. Returns slug, contentType, locales, title, and urls (a per-locale map of resolved paths, e.g. { en: '/en/career-programs/ai-engineering' }) for each page. " +
    "Optional filters (all combinable, AND logic): " +
    "contentType — restrict to one type (e.g. 'program', 'landing', 'page'); " +
    "locale — only pages that have this locale available (e.g. 'en'); " +
    "slugs — restrict to a specific list of slugs; " +
    "search — case-insensitive substring match against slug and title. " +
    "With no filters the full list is returned.",
    {
      contentType: z.string().optional().describe("Restrict to one content type, e.g. 'program' or 'landing'"),
      locale: z.string().optional().describe("Only return pages that have this locale available, e.g. 'en' or 'es'"),
      slugs: z.array(z.string()).optional().describe("Restrict to a specific list of slugs"),
      search: z.string().optional().describe("Case-insensitive substring match against slug and title"),
    },
    async ({ contentType, locale, slugs, search }) => {
      let pages = scanPages();
      if (contentType) {
        pages = pages.filter(p => p.contentType === contentType);
      }
      if (locale) {
        pages = pages.filter(p => p.locales.includes(locale));
      }
      if (slugs && slugs.length > 0) {
        const slugSet = new Set(slugs);
        pages = pages.filter(p => slugSet.has(p.slug));
      }
      if (search) {
        const q = search.toLowerCase();
        pages = pages.filter(p =>
          p.slug.toLowerCase().includes(q) ||
          (p.title ?? "").toLowerCase().includes(q)
        );
      }
      return { content: [{ type: "text", text: JSON.stringify(pages, null, 2) }] };
    }
  );

  // get_page
  mcp.tool(
    "get_page",
    "Get the full merged content of a page (sections, meta, title). Also returns locales (all available locale codes for this page) and urls (per-locale resolved paths). Merges _common.yml with the locale file. contentType is optional — omit it and the server will auto-detect it from the slug.",
    {
      slug: z.string().describe("Page slug (folder name), e.g. 'home' or 'full-stack-developer'"),
      locale: z.string().default("en").describe("Locale code, e.g. 'en' or 'es'"),
      contentType: z.string().optional().describe("Content type hint (e.g. 'page', 'program'). Omit to auto-detect from slug."),
    },
    async ({ slug, locale, contentType }) => {
      try {
        assertSafeSegment(slug, "slug");
        assertSafeLocale(locale);
        if (contentType) assertSafeSegment(contentType, "contentType");
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const resolved = resolveContentType(slug, contentType);
      if (!resolved) {
        return { content: [{ type: "text", text: `Page not found for slug '${slug}'${contentType ? ` (contentType: ${contentType})` : ""}` }], isError: true };
      }
      const result = loadPage(resolved.contentType, slug, locale);
      if (!result) {
        return { content: [{ type: "text", text: `Locale '${locale}' not found for page '${slug}' (contentType: ${resolved.contentType})` }], isError: true };
      }

      const pageDir = path.join(MARKETING_CONTENT_PATH, getDirectory(resolved.contentType, resolved.config), slug);
      const dirFiles = fs.existsSync(pageDir) ? fs.readdirSync(pageDir) : [];
      const locales = dirFiles
        .map((f: string) => f.replace(/\.(yml|yaml)$/, ""))
        .filter((n: string) => /^[a-z]{2}(-[a-z]{2})?$/.test(n));

      const urlPattern = resolved.config.url_pattern;
      let urls: Record<string, string> | undefined;
      if (urlPattern) {
        const resolvedUrls: Record<string, string> = {};
        if (urlPattern["default"]) {
          const p = urlPattern["default"].replace(":slug", slug);
          for (const l of locales) resolvedUrls[l] = p;
        } else {
          for (const l of locales) {
            if (urlPattern[l]) resolvedUrls[l] = urlPattern[l].replace(":slug", slug);
          }
        }
        if (Object.keys(resolvedUrls).length > 0) urls = resolvedUrls;
      }

      return { content: [{ type: "text", text: JSON.stringify({ contentType: resolved.contentType, slug, locale, locales, ...(urls ? { urls } : {}), ...result.data }, null, 2) }] };
    }
  );

  // ── Shared helpers for the new split tools ──────────────────────────────────

  const SAFE_TOP_LEVEL_FIELDS = new Set(["title", "slug"]);

  const META_COMMON_FIELDS = new Set(["robots", "priority", "change_frequency"]);
  const META_LOCALE_FIELDS = new Set([
    "page_title", "description", "og_image", "og_type",
    "og_url", "og_locale", "canonical_url",
  ]);
  const ALL_KNOWN_META_FIELDS = new Set([...META_COMMON_FIELDS, ...META_LOCALE_FIELDS]);

  /**
   * Write `fields` (already prefixed with `meta.`) into a single YAML file,
   * performing conflict check, write, and mark-modified.
   */
  async function writeFieldsToFile(
    filePath: string,
    relativePath: string,
    fieldEntries: Array<[string, unknown]>,
    intendedChangeLabel: Record<string, unknown>
  ): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    const currentData = (fs.existsSync(filePath) ? safeLoad(fs.readFileSync(filePath, "utf-8")) : null) || {};
    for (const [fp, val] of fieldEntries) {
      setValueAtPath(currentData, fp, val);
    }
    const intendedContent = safeDump(currentData);

    const conflictCheck = await checkRemoteConflict(relativePath);
    if (conflictCheck.conflict) {
      return conflictError({
        relativePath,
        remoteContent: conflictCheck.remoteContent,
        intendedContent,
        intendedChange: intendedChangeLabel,
      });
    }

    fs.writeFileSync(filePath, intendedContent, "utf-8");
    await notifyMarkModified(relativePath);
    return { content: [{ type: "text", text: `ok:${relativePath}` }] };
  }

  // update_section_field
  mcp.tool(
    "update_section_field",
    "Update a single section field (or safe top-level page field) in a page's locale YAML file. " +
    "Use this for all content/section edits — field_path must start with 'sections.' or be one of the safe " +
    "top-level fields ('title', 'slug'). " +
    "Do NOT use this for SEO/meta fields — use update_meta_field instead. " +
    "contentType is optional — omit it and the server will auto-detect from slug.",
    {
      slug: z.string().describe("Page slug"),
      locale: z.string().default("en").describe("Locale code, e.g. 'en' or 'es'"),
      field_path: z.string().describe(
        "Dot-notation path targeting section content. Must start with 'sections.' (e.g. 'sections.0.title') " +
        "or be a safe top-level field: 'title' or 'slug'. " +
        "Paths starting with 'meta.' are rejected — use update_meta_field instead."
      ),
      value: z.unknown().describe("New value for the field"),
      contentType: z.string().optional().describe("Content type hint. Omit to auto-detect from slug."),
    },
    async ({ slug, locale, field_path: fieldPath, value, contentType }) => {
      try {
        assertSafeSegment(slug, "slug");
        assertSafeLocale(locale);
        if (contentType) assertSafeSegment(contentType, "contentType");
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }

      if (fieldPath.startsWith("meta.")) {
        return {
          content: [{ type: "text", text: `field_path '${fieldPath}' targets a meta field. Use update_meta_field instead.` }],
          isError: true,
        };
      }
      if (!fieldPath.startsWith("sections.") && !SAFE_TOP_LEVEL_FIELDS.has(fieldPath)) {
        return {
          content: [{ type: "text", text: `field_path '${fieldPath}' is not allowed. Must start with 'sections.' or be one of: ${[...SAFE_TOP_LEVEL_FIELDS].join(", ")}.` }],
          isError: true,
        };
      }

      const resolved = resolveContentType(slug, contentType);
      if (!resolved) {
        return { content: [{ type: "text", text: `Page not found for slug '${slug}'${contentType ? ` (contentType: ${contentType})` : ""}` }], isError: true };
      }
      const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(resolved.contentType, resolved.config), slug);
      const fileName = `${locale}.yml`;
      const filePath = path.join(dir, fileName);
      try { assertWithinBase(filePath, MARKETING_CONTENT_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      if (!fs.existsSync(filePath)) {
        return { content: [{ type: "text", text: `Locale file not found: ${resolved.contentType}/${slug}/${fileName}` }], isError: true };
      }

      const relativePath = `marketing-content/${getDirectory(resolved.contentType, resolved.config)}/${slug}/${fileName}`;
      const result = await writeFieldsToFile(filePath, relativePath, [[fieldPath, value]], { fieldPath, value });
      if (result.isError) return result;
      return { content: [{ type: "text", text: `Updated '${fieldPath}' in ${resolved.contentType}/${slug}/${fileName}` }] };
    }
  );

  // update_section_fields (bulk)
  mcp.tool(
    "update_section_fields",
    "Update multiple section fields (or safe top-level page fields) in a single write to a page's locale YAML file. " +
    "Use this for all content/section edits — every key in 'fields' must start with 'sections.' or be one of " +
    "the safe top-level fields ('title', 'slug'). " +
    "Do NOT use this for SEO/meta fields — use update_meta_fields instead. " +
    "contentType is optional — omit it and the server will auto-detect from slug.",
    {
      slug: z.string().describe("Page slug"),
      locale: z.string().default("en").describe("Locale code, e.g. 'en' or 'es'"),
      fields: z.record(z.unknown()).describe(
        "Map of dot-notation field paths to new values. Keys must start with 'sections.' or be 'title'/'slug'. " +
        "E.g. { 'sections.0.title': 'New Title', 'sections.0.subtitle': 'Sub' }"
      ),
      contentType: z.string().optional().describe("Content type hint. Omit to auto-detect from slug."),
    },
    async ({ slug, locale, fields, contentType }) => {
      try {
        assertSafeSegment(slug, "slug");
        assertSafeLocale(locale);
        if (contentType) assertSafeSegment(contentType, "contentType");
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }

      const metaPaths = Object.keys(fields).filter(fp => fp.startsWith("meta."));
      if (metaPaths.length > 0) {
        return {
          content: [{ type: "text", text: `field_path(s) target meta fields: ${metaPaths.join(", ")}. Use update_meta_fields instead.` }],
          isError: true,
        };
      }
      const badPaths = Object.keys(fields).filter(fp => !fp.startsWith("sections.") && !SAFE_TOP_LEVEL_FIELDS.has(fp));
      if (badPaths.length > 0) {
        return {
          content: [{ type: "text", text: `Disallowed field_path(s): ${badPaths.join(", ")}. Must start with 'sections.' or be one of: ${[...SAFE_TOP_LEVEL_FIELDS].join(", ")}.` }],
          isError: true,
        };
      }

      const resolved = resolveContentType(slug, contentType);
      if (!resolved) {
        return { content: [{ type: "text", text: `Page not found for slug '${slug}'${contentType ? ` (contentType: ${contentType})` : ""}` }], isError: true };
      }
      const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(resolved.contentType, resolved.config), slug);
      const fileName = `${locale}.yml`;
      const filePath = path.join(dir, fileName);
      try { assertWithinBase(filePath, MARKETING_CONTENT_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      if (!fs.existsSync(filePath)) {
        return { content: [{ type: "text", text: `Locale file not found: ${resolved.contentType}/${slug}/${fileName}` }], isError: true };
      }

      const relativePath = `marketing-content/${getDirectory(resolved.contentType, resolved.config)}/${slug}/${fileName}`;
      const result = await writeFieldsToFile(filePath, relativePath, Object.entries(fields), { fields });
      if (result.isError) return result;
      const count = Object.keys(fields).length;
      return { content: [{ type: "text", text: `Updated ${count} field${count !== 1 ? "s" : ""} in ${resolved.contentType}/${slug}/${fileName}` }] };
    }
  );

  // update_meta_field
  mcp.tool(
    "update_meta_field",
    "Update a single SEO/meta field on a page. Always writes nested under meta.<field> in the correct file. " +
    "Known fields are auto-routed: robots/priority/change_frequency → _common.yml; " +
    "page_title/description/og_image/og_type/og_url/og_locale/canonical_url → {locale}.yml. " +
    "Use 'custom_fields' + 'target' for non-standard meta fields not in the known list — target must be explicit ('locale' or 'common'). " +
    "Do NOT use this for section/content edits — use update_section_field instead.",
    {
      slug: z.string().describe("Page slug"),
      contentType: z.string().optional().describe("Content type hint. Omit to auto-detect from slug."),
      field: z.enum([
        "page_title", "description", "og_image", "og_type", "og_url", "og_locale", "canonical_url",
        "robots", "priority", "change_frequency",
      ]).optional().describe(
        "Known meta field to update. Auto-routed to the correct file. " +
        "Locale fields (page_title, description, og_image, og_type, og_url, og_locale, canonical_url) → {locale}.yml. " +
        "Common fields (robots, priority, change_frequency) → _common.yml."
      ),
      value: z.unknown().optional().describe("New value for the known 'field'. Required when 'field' is provided."),
      locale: z.string().default("en").describe("Locale code used when writing to a locale file, e.g. 'en' or 'es'"),
      custom_fields: z.record(z.unknown()).optional().describe(
        "Map of non-standard meta field names to values. Cannot contain known field names (use 'field' for those). " +
        "Requires 'target' to be explicitly set."
      ),
      target: z.enum(["locale", "common"]).optional().describe(
        "Required when 'custom_fields' is provided. 'locale' writes to {locale}.yml, 'common' writes to _common.yml."
      ),
    },
    async ({ slug, contentType, field, value, locale, custom_fields, target }) => {
      try {
        assertSafeSegment(slug, "slug");
        assertSafeLocale(locale);
        if (contentType) assertSafeSegment(contentType, "contentType");
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }

      if (!field && !custom_fields) {
        return { content: [{ type: "text", text: "Provide either 'field' + 'value' for a known meta field, or 'custom_fields' + 'target' for non-standard fields." }], isError: true };
      }
      if (custom_fields && !target) {
        return { content: [{ type: "text", text: "'target' is required when providing 'custom_fields'. Set target to 'locale' or 'common'." }], isError: true };
      }
      if (custom_fields) {
        const knownInCustom = Object.keys(custom_fields).filter(k => ALL_KNOWN_META_FIELDS.has(k));
        if (knownInCustom.length > 0) {
          return { content: [{ type: "text", text: `'custom_fields' contains known meta field(s): ${knownInCustom.join(", ")}. Use 'field' parameter instead for auto-routing.` }], isError: true };
        }
      }

      const resolved = resolveContentType(slug, contentType);
      if (!resolved) {
        return { content: [{ type: "text", text: `Page not found for slug '${slug}'${contentType ? ` (contentType: ${contentType})` : ""}` }], isError: true };
      }
      const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(resolved.contentType, resolved.config), slug);
      const ctDir = getDirectory(resolved.contentType, resolved.config);
      const results: string[] = [];

      if (field) {
        if (value === undefined) {
          return { content: [{ type: "text", text: "'value' is required when 'field' is provided." }], isError: true };
        }
        const isCommon = META_COMMON_FIELDS.has(field);
        const fileName = isCommon ? "_common.yml" : `${locale}.yml`;
        const filePath = path.join(dir, fileName);
        try { assertWithinBase(filePath, MARKETING_CONTENT_PATH); } catch (e) {
          return { content: [{ type: "text", text: (e as Error).message }], isError: true };
        }
        if (!isCommon && !fs.existsSync(filePath)) {
          return { content: [{ type: "text", text: `Locale file not found: ${resolved.contentType}/${slug}/${fileName}` }], isError: true };
        }
        const relativePath = `marketing-content/${ctDir}/${slug}/${fileName}`;
        const r = await writeFieldsToFile(filePath, relativePath, [[`meta.${field}`, value]], { field, value });
        if (r.isError) return r;
        results.push(`meta.${field} → ${fileName}`);
      }

      if (custom_fields && target) {
        const fileName = target === "common" ? "_common.yml" : `${locale}.yml`;
        const filePath = path.join(dir, fileName);
        try { assertWithinBase(filePath, MARKETING_CONTENT_PATH); } catch (e) {
          return { content: [{ type: "text", text: (e as Error).message }], isError: true };
        }
        if (target === "locale" && !fs.existsSync(filePath)) {
          return { content: [{ type: "text", text: `Locale file not found: ${resolved.contentType}/${slug}/${fileName}` }], isError: true };
        }
        const entries: Array<[string, unknown]> = Object.entries(custom_fields).map(([k, v]) => [`meta.${k}`, v]);
        const relativePath = `marketing-content/${ctDir}/${slug}/${fileName}`;
        const r = await writeFieldsToFile(filePath, relativePath, entries, { custom_fields, target });
        if (r.isError) return r;
        results.push(`${Object.keys(custom_fields).map(k => `meta.${k}`).join(", ")} → ${fileName}`);
      }

      return { content: [{ type: "text", text: `Updated ${results.join("; ")} in ${resolved.contentType}/${slug}` }] };
    }
  );

  // update_meta_fields (bulk)
  mcp.tool(
    "update_meta_fields",
    "Update multiple SEO/meta fields on a page in a single call. Auto-routes each known field to the correct file " +
    "(may write to both _common.yml and a locale file in one call if the fields span both). " +
    "Known fields: robots/priority/change_frequency → _common.yml; " +
    "page_title/description/og_image/og_type/og_url/og_locale/canonical_url → {locale}.yml. " +
    "Use 'custom_fields' + 'target' for non-standard meta fields. " +
    "Do NOT use this for section/content edits — use update_section_fields instead.",
    {
      slug: z.string().describe("Page slug"),
      contentType: z.string().optional().describe("Content type hint. Omit to auto-detect from slug."),
      fields: z.record(z.unknown()).optional().describe(
        "Map of known meta field names to values. Auto-routed per field. " +
        "E.g. { page_title: 'New Title', robots: 'index, follow' }"
      ),
      locale: z.string().default("en").describe("Locale code used when writing to a locale file, e.g. 'en' or 'es'"),
      custom_fields: z.record(z.unknown()).optional().describe(
        "Map of non-standard meta field names to values. Cannot contain known field names. Requires 'target'."
      ),
      target: z.enum(["locale", "common"]).optional().describe(
        "Required when 'custom_fields' is provided. 'locale' writes to {locale}.yml, 'common' writes to _common.yml."
      ),
    },
    async ({ slug, contentType, fields, locale, custom_fields, target }) => {
      try {
        assertSafeSegment(slug, "slug");
        assertSafeLocale(locale);
        if (contentType) assertSafeSegment(contentType, "contentType");
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }

      if (!fields && !custom_fields) {
        return { content: [{ type: "text", text: "Provide 'fields' for known meta fields, or 'custom_fields' + 'target' for non-standard fields, or both." }], isError: true };
      }
      if (custom_fields && !target) {
        return { content: [{ type: "text", text: "'target' is required when providing 'custom_fields'. Set target to 'locale' or 'common'." }], isError: true };
      }
      if (fields) {
        const unknownFields = Object.keys(fields).filter(k => !ALL_KNOWN_META_FIELDS.has(k));
        if (unknownFields.length > 0) {
          return { content: [{ type: "text", text: `Unknown meta field(s) in 'fields': ${unknownFields.join(", ")}. Use 'custom_fields' + 'target' for non-standard fields.` }], isError: true };
        }
      }
      if (custom_fields) {
        const knownInCustom = Object.keys(custom_fields).filter(k => ALL_KNOWN_META_FIELDS.has(k));
        if (knownInCustom.length > 0) {
          return { content: [{ type: "text", text: `'custom_fields' contains known meta field(s): ${knownInCustom.join(", ")}. Use 'fields' instead for auto-routing.` }], isError: true };
        }
      }

      const resolved = resolveContentType(slug, contentType);
      if (!resolved) {
        return { content: [{ type: "text", text: `Page not found for slug '${slug}'${contentType ? ` (contentType: ${contentType})` : ""}` }], isError: true };
      }
      const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(resolved.contentType, resolved.config), slug);
      const ctDir = getDirectory(resolved.contentType, resolved.config);
      const results: string[] = [];

      if (fields && Object.keys(fields).length > 0) {
        const commonEntries: Array<[string, unknown]> = [];
        const localeEntries: Array<[string, unknown]> = [];

        for (const [k, v] of Object.entries(fields)) {
          if (META_COMMON_FIELDS.has(k)) {
            commonEntries.push([`meta.${k}`, v]);
          } else {
            localeEntries.push([`meta.${k}`, v]);
          }
        }

        if (commonEntries.length > 0) {
          const filePath = path.join(dir, "_common.yml");
          try { assertWithinBase(filePath, MARKETING_CONTENT_PATH); } catch (e) {
            return { content: [{ type: "text", text: (e as Error).message }], isError: true };
          }
          const relativePath = `marketing-content/${ctDir}/${slug}/_common.yml`;
          const r = await writeFieldsToFile(filePath, relativePath, commonEntries, { fields: Object.fromEntries(commonEntries) });
          if (r.isError) return r;
          results.push(`${commonEntries.map(([k]) => k).join(", ")} → _common.yml`);
        }

        if (localeEntries.length > 0) {
          const fileName = `${locale}.yml`;
          const filePath = path.join(dir, fileName);
          try { assertWithinBase(filePath, MARKETING_CONTENT_PATH); } catch (e) {
            return { content: [{ type: "text", text: (e as Error).message }], isError: true };
          }
          if (!fs.existsSync(filePath)) {
            return { content: [{ type: "text", text: `Locale file not found: ${resolved.contentType}/${slug}/${fileName}` }], isError: true };
          }
          const relativePath = `marketing-content/${ctDir}/${slug}/${fileName}`;
          const r = await writeFieldsToFile(filePath, relativePath, localeEntries, { fields: Object.fromEntries(localeEntries) });
          if (r.isError) return r;
          results.push(`${localeEntries.map(([k]) => k).join(", ")} → ${fileName}`);
        }
      }

      if (custom_fields && target) {
        const fileName = target === "common" ? "_common.yml" : `${locale}.yml`;
        const filePath = path.join(dir, fileName);
        try { assertWithinBase(filePath, MARKETING_CONTENT_PATH); } catch (e) {
          return { content: [{ type: "text", text: (e as Error).message }], isError: true };
        }
        if (target === "locale" && !fs.existsSync(filePath)) {
          return { content: [{ type: "text", text: `Locale file not found: ${resolved.contentType}/${slug}/${fileName}` }], isError: true };
        }
        const entries: Array<[string, unknown]> = Object.entries(custom_fields).map(([k, v]) => [`meta.${k}`, v]);
        const relativePath = `marketing-content/${ctDir}/${slug}/${fileName}`;
        const r = await writeFieldsToFile(filePath, relativePath, entries, { custom_fields, target });
        if (r.isError) return r;
        results.push(`${Object.keys(custom_fields).map(k => `meta.${k}`).join(", ")} → ${fileName}`);
      }

      return { content: [{ type: "text", text: `Updated ${results.join("; ")} in ${resolved.contentType}/${slug}` }] };
    }
  );

  // create_page
  mcp.tool(
    "create_page",
    "Create a new YAML-driven page. IMPORTANT: Before calling this tool, ask the user for the page title, SEO meta title (page_title), meta description, and robots value. Do not call this tool without those values. Creates the page directory, writes the initial locale file, and seeds _common.yml. Returns the new page entry with slug, contentType, locales, and urls.",
    {
      slug: z.string().describe("URL-safe slug for the new page, e.g. 'machine-learning-bootcamp'"),
      contentType: z.string().describe("Content type, e.g. 'program', 'page', 'landing', 'location'. Must match a non-DB-backed entry in content-types.yml."),
      locale: z.string().default("en").describe("Initial locale to create, e.g. 'en'"),
      title: z.string().describe("Page title (visible heading, used as the H1)"),
      page_title: z.string().describe("SEO meta title shown in browser tab and search results, e.g. 'Machine Learning Bootcamp | 4Geeks'"),
      meta_description: z.string().describe("SEO meta description (150-160 characters) summarising the page for search engines"),
      robots: z.string().describe("Robots directive, e.g. 'index, follow' or 'noindex, nofollow'. Must be supplied explicitly; typical value is 'index, follow'."),
      meta: z.record(z.unknown()).optional().describe("Optional extra meta fields, e.g. { priority: 0.8, change_frequency: 'weekly', og_image: '...' }. The page_title, meta_description, and robots top-level parameters take precedence over any matching keys here."),
      common: z.record(z.unknown()).optional().describe("Optional extra fields for _common.yml (locale-independent data, e.g. bc_slug, job_role)"),
    },
    async ({ slug, contentType, locale, title, page_title, meta_description, robots, meta, common }) => {
      try {
        assertSafeSegment(slug, "slug");
        assertSafeSegment(contentType, "contentType");
        assertSafeLocale(locale);
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }

      const configs = loadContentTypes();
      const config = configs[contentType];
      if (!config) {
        const known = Object.keys(configs).filter(k => !isDbBacked(configs[k])).join(", ");
        return { content: [{ type: "text", text: `Unknown contentType '${contentType}'. Known non-DB types: ${known}` }], isError: true };
      }
      if (isDbBacked(config)) {
        return { content: [{ type: "text", text: `Content type '${contentType}' is database-backed and cannot be created via this tool.` }], isError: true };
      }

      const pageDir = path.join(MARKETING_CONTENT_PATH, getDirectory(contentType, config), slug);
      try { assertWithinBase(pageDir, MARKETING_CONTENT_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      if (fs.existsSync(pageDir)) {
        return { content: [{ type: "text", text: `Page '${slug}' already exists for contentType '${contentType}'.` }], isError: true };
      }

      fs.mkdirSync(pageDir, { recursive: true });

      const mergedMeta: Record<string, unknown> = {
        ...(meta || {}),
        page_title,
        description: meta_description,
        robots,
      };
      const localeData: Record<string, unknown> = { slug, title, meta: mergedMeta };
      const localeFilePath = path.join(pageDir, `${locale}.yml`);
      fs.writeFileSync(localeFilePath, safeDump(localeData), "utf-8");
      const localeRelPath = `marketing-content/${getDirectory(contentType, config)}/${slug}/${locale}.yml`;
      await notifyMarkModified(localeRelPath);

      const commonData: Record<string, unknown> = { slug, ...(common || {}) };
      fs.writeFileSync(path.join(pageDir, "_common.yml"), safeDump(commonData), "utf-8");
      const commonRelPath = `marketing-content/${getDirectory(contentType, config)}/${slug}/_common.yml`;
      await notifyMarkModified(commonRelPath);

      const urlPattern = config.url_pattern;
      let urls: Record<string, string> | undefined;
      if (urlPattern) {
        const resolvedUrls: Record<string, string> = {};
        if (urlPattern["default"]) {
          resolvedUrls[locale] = urlPattern["default"].replace(":slug", slug);
        } else if (urlPattern[locale]) {
          resolvedUrls[locale] = urlPattern[locale].replace(":slug", slug);
        }
        if (Object.keys(resolvedUrls).length > 0) urls = resolvedUrls;
      }

      const entry = {
        slug,
        contentType,
        directory: `marketing-content/${getDirectory(contentType, config)}/${slug}`,
        locales: [locale],
        title,
        ...(urls ? { urls } : {}),
      };
      return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] };
    }
  );

  // add_section
  mcp.tool(
    "add_section",
    "Add a new section to a page. Inserts at the given index (or appends if omitted). Section must include a 'type' field matching a component type. contentType is optional — omit it and the server will auto-detect it from the slug.",
    {
      slug: z.string().describe("Page slug"),
      locale: z.string().default("en").describe("Locale code"),
      section: z.record(z.unknown()).describe("Section object with at minimum a 'type' field"),
      index: z.number().int().optional().describe("Position to insert (0-based). Omit to append."),
      contentType: z.string().optional().describe("Content type hint (e.g. 'page', 'program'). Omit to auto-detect from slug."),
    },
    async ({ contentType, slug, locale, section, index }) => {
      try {
        assertSafeSegment(slug, "slug");
        assertSafeLocale(locale);
        if (contentType) assertSafeSegment(contentType, "contentType");
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const resolved = resolveContentType(slug, contentType);
      if (!resolved) {
        return { content: [{ type: "text", text: `Page not found for slug '${slug}'${contentType ? ` (contentType: ${contentType})` : ""}` }], isError: true };
      }

      const operation: Record<string, unknown> = {
        action: "add_item",
        path: "sections",
        item: section,
      };
      if (index !== undefined) {
        operation.index = index;
      }

      try {
        const url = `http://localhost:${MAIN_SERVER_PORT}/api/content/edit-sections`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType: resolved.contentType,
            slug,
            locale,
            operations: [operation],
          }),
        });
        const data = await res.json() as Record<string, unknown>;
        if (!res.ok) {
          return { content: [{ type: "text", text: (data.error as string) || `Server error: ${res.status}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Section of type '${section.type as string}' added to ${resolved.contentType}/${slug}/${locale}.yml` }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Failed to call edit-sections API: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  // remove_section
  mcp.tool(
    "remove_section",
    "Remove a section from a page by its index. contentType is optional — omit it and the server will auto-detect it from the slug.",
    {
      slug: z.string().describe("Page slug"),
      locale: z.string().default("en").describe("Locale code"),
      index: z.number().int().describe("0-based index of the section to remove"),
      contentType: z.string().optional().describe("Content type hint (e.g. 'page', 'program'). Omit to auto-detect from slug."),
    },
    async ({ contentType, slug, locale, index }) => {
      try {
        assertSafeSegment(slug, "slug");
        assertSafeLocale(locale);
        if (contentType) assertSafeSegment(contentType, "contentType");
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const resolved = resolveContentType(slug, contentType);
      if (!resolved) {
        return { content: [{ type: "text", text: `Page not found for slug '${slug}'${contentType ? ` (contentType: ${contentType})` : ""}` }], isError: true };
      }
      const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(resolved.contentType, resolved.config), slug);
      const localePath = path.join(dir, `${locale}.yml`);
      try { assertWithinBase(localePath, MARKETING_CONTENT_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      if (!fs.existsSync(localePath)) {
        return { content: [{ type: "text", text: `Locale file not found: ${resolved.contentType}/${slug}/${locale}.yml` }], isError: true };
      }

      // Build intended content before the conflict check.
      const localeData = safeLoad(fs.readFileSync(localePath, "utf-8")) || {};
      if (!Array.isArray(localeData.sections)) {
        return { content: [{ type: "text", text: "Page has no sections array." }], isError: true };
      }
      const sections = localeData.sections as unknown[];
      if (index < 0 || index >= sections.length) {
        return { content: [{ type: "text", text: `Index ${index} out of range (0–${sections.length - 1}).` }], isError: true };
      }
      const removed = sections.splice(index, 1)[0] as Record<string, unknown>;
      const intendedContent = safeDump(localeData);

      const relativePath = `marketing-content/${getDirectory(resolved.contentType, resolved.config)}/${slug}/${locale}.yml`;
      const conflictCheck = await checkRemoteConflict(relativePath);
      if (conflictCheck.conflict) {
        return conflictError({
          relativePath,
          remoteContent: conflictCheck.remoteContent,
          intendedContent,
          intendedChange: { action: "remove_section", index, removedType: removed?.type ?? "unknown" },
        });
      }

      fs.writeFileSync(localePath, intendedContent, "utf-8");
      await notifyMarkModified(relativePath);
      return { content: [{ type: "text", text: `Removed section at index ${index} (type: ${removed?.type ?? "unknown"}) from ${resolved.contentType}/${slug}/${locale}.yml` }] };
    }
  );

  // reorder_sections
  mcp.tool(
    "reorder_sections",
    "Reorder sections by supplying a new order as an array of current indices. E.g. [2, 0, 1] moves the third section to the front. contentType is optional — omit it and the server will auto-detect it from the slug.",
    {
      slug: z.string().describe("Page slug"),
      locale: z.string().default("en").describe("Locale code"),
      order: z.array(z.number().int()).describe("Array of current section indices in desired order — must be a permutation with no repeats"),
      contentType: z.string().optional().describe("Content type hint (e.g. 'page', 'program'). Omit to auto-detect from slug."),
    },
    async ({ contentType, slug, locale, order }) => {
      try {
        assertSafeSegment(slug, "slug");
        assertSafeLocale(locale);
        if (contentType) assertSafeSegment(contentType, "contentType");
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const resolved = resolveContentType(slug, contentType);
      if (!resolved) {
        return { content: [{ type: "text", text: `Page not found for slug '${slug}'${contentType ? ` (contentType: ${contentType})` : ""}` }], isError: true };
      }
      const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(resolved.contentType, resolved.config), slug);
      const localePath = path.join(dir, `${locale}.yml`);
      try { assertWithinBase(localePath, MARKETING_CONTENT_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      if (!fs.existsSync(localePath)) {
        return { content: [{ type: "text", text: `Locale file not found: ${resolved.contentType}/${slug}/${locale}.yml` }], isError: true };
      }

      // Validate permutation and build intended content before the conflict check.
      const localeData = safeLoad(fs.readFileSync(localePath, "utf-8")) || {};
      if (!Array.isArray(localeData.sections)) {
        return { content: [{ type: "text", text: "Page has no sections array." }], isError: true };
      }
      const sections = localeData.sections as unknown[];
      const n = sections.length;
      const seen = new Set<number>();
      const isPermutation = order.length === n && order.every(i => {
        if (i < 0 || i >= n || seen.has(i)) return false;
        seen.add(i);
        return true;
      });
      if (!isPermutation) {
        return { content: [{ type: "text", text: `Order must be a permutation of [0..${n - 1}] with no repeats. Got: [${order.join(", ")}]` }], isError: true };
      }
      localeData.sections = order.map(i => sections[i]);
      const intendedContent = safeDump(localeData);

      const relativePath = `marketing-content/${getDirectory(resolved.contentType, resolved.config)}/${slug}/${locale}.yml`;
      const conflictCheck = await checkRemoteConflict(relativePath);
      if (conflictCheck.conflict) {
        return conflictError({
          relativePath,
          remoteContent: conflictCheck.remoteContent,
          intendedContent,
          intendedChange: { action: "reorder_sections", order },
        });
      }

      fs.writeFileSync(localePath, intendedContent, "utf-8");
      await notifyMarkModified(relativePath);
      return { content: [{ type: "text", text: `Sections reordered in ${resolved.contentType}/${slug}/${locale}.yml` }] };
    }
  );

  // list_seo
  mcp.tool(
    "list_seo",
    "Return SEO-relevant fields (meta, title, schema, url) for all pages — both YAML-driven (pages, programs, landings, etc.) and DB-backed (blog, etc.). " +
    "For DB-backed types, template variables like {{ single.title }} are fully resolved against each entry's data via the main server. " +
    "Sections and full content are never returned. " +
    "Optional filters: contentType (e.g. 'blog'), locale (e.g. 'en'), slugs (specific list).",
    {
      contentType: z.string().optional().describe("Restrict to one content type, e.g. 'blog' or 'program'"),
      locale: z.string().optional().describe("Restrict to one locale, e.g. 'en' or 'es'"),
      slugs: z.array(z.string()).optional().describe("Restrict to specific slugs"),
    },
    async ({ contentType, locale, slugs }) => {
      try {
        const configs = loadContentTypes();
        const results: unknown[] = [];

        // Route all content types through the main server's seo-entries endpoint,
        // which handles both YAML (global variable resolution) and DB-backed
        // (single.* template resolution + overrides) in one place.
        const typesToQuery = contentType
          ? (configs[contentType] ? [contentType] : [])
          : Object.keys(configs);

        await Promise.all(typesToQuery.map(async (ct) => {
          try {
            const params = new URLSearchParams();
            if (locale) params.set("locale", locale);
            const url = `http://localhost:${MAIN_SERVER_PORT}/api/content-types/${encodeURIComponent(ct)}/seo-entries?${params}`;
            const res = await fetch(url);
            if (!res.ok) {
              results.push({ contentType: ct, error: `seo-entries returned ${res.status}` });
              return;
            }
            const body = await res.json() as {
              source: string;
              cache_missing?: boolean;
              cache_age_hours: number | null;
              entries: Array<{
                slug: unknown; contentType: string; locale: string;
                url: string | null; title: unknown;
                meta: Record<string, unknown>; schema: unknown;
              }>;
            };
            if (body.cache_missing) {
              results.push({ contentType: ct, cache_missing: true });
              return;
            }
            for (const entry of body.entries) {
              if (slugs && !slugs.includes(String(entry.slug))) continue;
              results.push({
                ...entry,
                ...(body.source === "db" ? { cache_age_hours: body.cache_age_hours } : {}),
              });
            }
          } catch (err) {
            results.push({ contentType: ct, error: `Failed to reach seo-entries: ${err}` });
          }
        }));

        // Sort: contentType → slug → locale
        (results as Array<Record<string, unknown>>).sort((a, b) => {
          const ct = String(a.contentType ?? "").localeCompare(String(b.contentType ?? ""));
          if (ct !== 0) return ct;
          const sl = String(a.slug ?? "").localeCompare(String(b.slug ?? ""));
          if (sl !== 0) return sl;
          return String(a.locale ?? "").localeCompare(String(b.locale ?? ""));
        });

        return { content: [{ type: "text", text: JSON.stringify({ count: results.length, entries: results }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: String(err) }], isError: true };
      }
    }
  );
}
