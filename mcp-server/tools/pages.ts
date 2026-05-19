import fs from "fs";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  MARKETING_CONTENT_PATH,
  getDirectory,
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
    "List all YAML-driven content pages. Returns slug, contentType, locales, and title for each page.",
    {},
    async () => {
      const pages = scanPages();
      return { content: [{ type: "text", text: JSON.stringify(pages, null, 2) }] };
    }
  );

  // get_page
  mcp.tool(
    "get_page",
    "Get the full merged content of a page (sections, meta, title). Merges _common.yml with the locale file. contentType is optional — omit it and the server will auto-detect it from the slug.",
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
      return { content: [{ type: "text", text: JSON.stringify({ contentType: resolved.contentType, slug, locale, ...result.data }, null, 2) }] };
    }
  );

  // update_field
  mcp.tool(
    "update_field",
    "Update a single field in a page's locale YAML file using dot-notation field_path. E.g. field_path='meta.page_title', value='New Title'. contentType is optional — omit it and the server will auto-detect from slug.",
    {
      slug: z.string().describe("Page slug"),
      locale: z.string().default("en").describe("Locale code"),
      field_path: z.string().describe("Dot-notation field path, e.g. 'meta.page_title' or 'sections.0.title'"),
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
      setValueAtPath(localeData, fieldPath, value);
      fs.writeFileSync(localePath, safeDump(localeData), "utf-8");
      return { content: [{ type: "text", text: `Updated '${fieldPath}' in ${resolved.contentType}/${slug}/${locale}.yml` }] };
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
