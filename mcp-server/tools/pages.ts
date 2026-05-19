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

export function registerPageTools(mcp: McpServer): void {
  // list_pages
  mcp.tool(
    "list_pages",
    "List all YAML-driven content pages. Returns slug, contentType, locales, title, and urls (a per-locale map of resolved paths, e.g. { en: '/en/career-programs/ai-engineering' }) for each page.",
    {},
    async () => {
      const pages = scanPages();
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

      // Collect available locales from the page directory
      const pageDir = path.join(MARKETING_CONTENT_PATH, getDirectory(resolved.contentType, resolved.config), slug);
      const dirFiles = fs.existsSync(pageDir) ? fs.readdirSync(pageDir) : [];
      const locales = dirFiles
        .map((f: string) => f.replace(/\.(yml|yaml)$/, ""))
        .filter((n: string) => /^[a-z]{2}(-[a-z]{2})?$/.test(n));

      // Resolve per-locale URLs from url_pattern
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

  // update_field
  mcp.tool(
    "update_field",
    "Update a single field in a page's YAML file using dot-notation field_path. E.g. field_path='meta.page_title', value='New Title'. Use locale='_common' to write to _common.yml (locale-independent fields). contentType is optional — omit it and the server will auto-detect from slug.",
    {
      slug: z.string().describe("Page slug"),
      locale: z.string().default("en").describe("Locale code (e.g. 'en', 'es'), or '_common' to target _common.yml"),
      field_path: z.string().describe("Dot-notation field path, e.g. 'meta.page_title' or 'sections.0.title'"),
      value: z.unknown().describe("New value for the field"),
      contentType: z.string().optional().describe("Content type hint. Omit to auto-detect from slug."),
    },
    async ({ slug, locale, field_path: fieldPath, value, contentType }) => {
      try {
        assertSafeSegment(slug, "slug");
        if (locale !== "_common") assertSafeLocale(locale);
        if (contentType) assertSafeSegment(contentType, "contentType");
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const resolved = resolveContentType(slug, contentType);
      if (!resolved) {
        return { content: [{ type: "text", text: `Page not found for slug '${slug}'${contentType ? ` (contentType: ${contentType})` : ""}` }], isError: true };
      }
      const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(resolved.contentType, resolved.config), slug);
      const fileName = locale === "_common" ? "_common.yml" : `${locale}.yml`;
      const filePath = path.join(dir, fileName);
      try { assertWithinBase(filePath, MARKETING_CONTENT_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      if (locale !== "_common" && !fs.existsSync(filePath)) {
        return { content: [{ type: "text", text: `Locale file not found: ${resolved.contentType}/${slug}/${fileName}` }], isError: true };
      }
      const data = (fs.existsSync(filePath) ? safeLoad(fs.readFileSync(filePath, "utf-8")) : null) || {};
      setValueAtPath(data, fieldPath, value);
      fs.writeFileSync(filePath, safeDump(data), "utf-8");
      return { content: [{ type: "text", text: `Updated '${fieldPath}' in ${resolved.contentType}/${slug}/${fileName}` }] };
    }
  );

  // update_fields
  mcp.tool(
    "update_fields",
    "Update multiple fields in a page's YAML file in a single write. Accepts a 'fields' map of dot-notation paths to values. Use locale='_common' to target _common.yml. contentType is optional.",
    {
      slug: z.string().describe("Page slug"),
      locale: z.string().default("en").describe("Locale code (e.g. 'en', 'es'), or '_common' to target _common.yml"),
      fields: z.record(z.unknown()).describe("Map of dot-notation field paths to new values, e.g. { 'meta.page_title': 'New Title', 'meta.description': '...' }"),
      contentType: z.string().optional().describe("Content type hint. Omit to auto-detect from slug."),
    },
    async ({ slug, locale, fields, contentType }) => {
      try {
        assertSafeSegment(slug, "slug");
        if (locale !== "_common") assertSafeLocale(locale);
        if (contentType) assertSafeSegment(contentType, "contentType");
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const resolved = resolveContentType(slug, contentType);
      if (!resolved) {
        return { content: [{ type: "text", text: `Page not found for slug '${slug}'${contentType ? ` (contentType: ${contentType})` : ""}` }], isError: true };
      }
      const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(resolved.contentType, resolved.config), slug);
      const fileName = locale === "_common" ? "_common.yml" : `${locale}.yml`;
      const filePath = path.join(dir, fileName);
      try { assertWithinBase(filePath, MARKETING_CONTENT_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      if (locale !== "_common" && !fs.existsSync(filePath)) {
        return { content: [{ type: "text", text: `Locale file not found: ${resolved.contentType}/${slug}/${fileName}` }], isError: true };
      }
      const data = (fs.existsSync(filePath) ? safeLoad(fs.readFileSync(filePath, "utf-8")) : null) || {};
      for (const [fieldPath, value] of Object.entries(fields)) {
        setValueAtPath(data, fieldPath, value);
      }
      fs.writeFileSync(filePath, safeDump(data), "utf-8");
      const count = Object.keys(fields).length;
      return { content: [{ type: "text", text: `Updated ${count} field${count !== 1 ? "s" : ""} in ${resolved.contentType}/${slug}/${fileName}` }] };
    }
  );

  // create_page
  mcp.tool(
    "create_page",
    "Create a new YAML-driven page. Creates the page directory, writes the initial locale file, and seeds _common.yml. Returns the new page entry with slug, contentType, locales, and urls.",
    {
      slug: z.string().describe("URL-safe slug for the new page, e.g. 'machine-learning-bootcamp'"),
      contentType: z.string().describe("Content type, e.g. 'program', 'page', 'landing', 'location'. Must match a non-DB-backed entry in content-types.yml."),
      locale: z.string().default("en").describe("Initial locale to create, e.g. 'en'"),
      title: z.string().describe("Page title"),
      meta: z.record(z.unknown()).optional().describe("Optional meta fields, e.g. { page_title: '...', description: '...' }"),
      common: z.record(z.unknown()).optional().describe("Optional extra fields for _common.yml (locale-independent data, e.g. bc_slug, job_role)"),
    },
    async ({ slug, contentType, locale, title, meta, common }) => {
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

      // Write locale file
      const localeData: Record<string, unknown> = { slug, title };
      if (meta) localeData.meta = meta;
      const localeFilePath = path.join(pageDir, `${locale}.yml`);
      fs.writeFileSync(localeFilePath, safeDump(localeData), "utf-8");

      // Seed _common.yml (always at least { slug })
      const commonData: Record<string, unknown> = { slug, ...(common || {}) };
      fs.writeFileSync(path.join(pageDir, "_common.yml"), safeDump(commonData), "utf-8");

      // Resolve URLs
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
      const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(resolved.contentType, resolved.config), slug);
      const localePath = path.join(dir, `${locale}.yml`);
      try { assertWithinBase(localePath, MARKETING_CONTENT_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      if (!fs.existsSync(localePath)) {
        return { content: [{ type: "text", text: `Locale file not found: ${resolved.contentType}/${slug}/${locale}.yml` }], isError: true };
      }
      const localeData = safeLoad(fs.readFileSync(localePath, "utf-8")) || {};
      if (!Array.isArray(localeData.sections)) localeData.sections = [];
      const sections = localeData.sections as Record<string, unknown>[];
      const insertAt = (index !== undefined && index >= 0 && index <= sections.length) ? index : sections.length;
      sections.splice(insertAt, 0, section as Record<string, unknown>);
      fs.writeFileSync(localePath, safeDump(localeData), "utf-8");
      return { content: [{ type: "text", text: `Section of type '${section.type}' added at index ${insertAt} in ${resolved.contentType}/${slug}/${locale}.yml` }] };
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
      const localeData = safeLoad(fs.readFileSync(localePath, "utf-8")) || {};
      if (!Array.isArray(localeData.sections)) {
        return { content: [{ type: "text", text: "Page has no sections array." }], isError: true };
      }
      const sections = localeData.sections as unknown[];
      if (index < 0 || index >= sections.length) {
        return { content: [{ type: "text", text: `Index ${index} out of range (0–${sections.length - 1}).` }], isError: true };
      }
      const removed = sections.splice(index, 1)[0] as Record<string, unknown>;
      fs.writeFileSync(localePath, safeDump(localeData), "utf-8");
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
      fs.writeFileSync(localePath, safeDump(localeData), "utf-8");
      return { content: [{ type: "text", text: `Sections reordered in ${resolved.contentType}/${slug}/${locale}.yml` }] };
    }
  );
}
