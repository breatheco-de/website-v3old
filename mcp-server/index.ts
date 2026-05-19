import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const MARKETING_CONTENT_PATH = path.join(process.cwd(), "marketing-content");
const COMPONENT_REGISTRY_PATH = path.join(MARKETING_CONTENT_PATH, "component-registry");
const CONTENT_TYPES_PATH = path.join(MARKETING_CONTENT_PATH, "content-types.yml");
const PORT = parseInt(process.env.MCP_PORT || "3001", 10);
const API_KEY = process.env.MCP_API_KEY || "";

if (!API_KEY) {
  console.error("[MCP] FATAL: MCP_API_KEY environment variable is not set. Set it before starting the server.");
  process.exit(1);
}

// ─── Input sanitization ───────────────────────────────────────────────────────

const SAFE_SEGMENT_RE = /^[a-zA-Z0-9_\-]+$/;
const SAFE_LOCALE_RE = /^[a-z]{2}(-[a-z]{2})?$/;

function assertSafeSegment(value: string, label: string): void {
  if (!SAFE_SEGMENT_RE.test(value)) {
    throw new Error(`Invalid ${label}: '${value}'. Only alphanumerics, hyphens, and underscores are allowed.`);
  }
}

function assertSafeLocale(value: string): void {
  if (!SAFE_LOCALE_RE.test(value)) {
    throw new Error(`Invalid locale: '${value}'. Expected a BCP-47 code like 'en' or 'es'.`);
  }
}

function assertWithinBase(resolvedPath: string, basePath: string): void {
  const rel = path.relative(basePath, resolvedPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path traversal detected: '${resolvedPath}' is outside '${basePath}'.`);
  }
}

// ─── YAML helpers ────────────────────────────────────────────────────────────

function safeLoad(raw: string): Record<string, unknown> | null {
  try {
    return (yaml.load(raw) as Record<string, unknown>) || null;
  } catch {
    return null;
  }
}

function safeDump(obj: unknown): string {
  return yaml.dump(obj, { lineWidth: -1, noRefs: true, quotingType: '"', forceQuotes: false });
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v) && typeof result[k] === "object" && result[k] !== null && !Array.isArray(result[k])) {
      result[k] = deepMerge(result[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ─── Content type helpers ─────────────────────────────────────────────────────

interface ContentTypeConfig {
  directory?: string;
  url_pattern?: Record<string, string>;
  database?: { slug: string };
  field_mapping?: Record<string, unknown>;
  layout?: unknown;
}

function loadContentTypes(): Record<string, ContentTypeConfig> {
  if (!fs.existsSync(CONTENT_TYPES_PATH)) return {};
  const raw = fs.readFileSync(CONTENT_TYPES_PATH, "utf-8");
  return (safeLoad(raw) as Record<string, ContentTypeConfig>) || {};
}

function isDbBacked(config: ContentTypeConfig): boolean {
  return !!config?.database?.slug;
}

function getDirectory(contentType: string, config: ContentTypeConfig): string {
  return config.directory || contentType;
}

function resolveContentType(slug: string, hintContentType?: string): { contentType: string; config: ContentTypeConfig } | null {
  const configs = loadContentTypes();
  if (hintContentType) {
    const config = configs[hintContentType];
    if (!config || isDbBacked(config)) return null;
    const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(hintContentType, config), slug);
    if (fs.existsSync(dir)) return { contentType: hintContentType, config };
    return null;
  }
  for (const [ct, config] of Object.entries(configs)) {
    if (isDbBacked(config)) continue;
    const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(ct, config), slug);
    if (fs.existsSync(dir)) return { contentType: ct, config };
  }
  return null;
}

// ─── Page helpers ─────────────────────────────────────────────────────────────

interface PageEntry {
  slug: string;
  contentType: string;
  directory: string;
  locales: string[];
  title?: string;
}

function scanPages(): PageEntry[] {
  const configs = loadContentTypes();
  const pages: PageEntry[] = [];

  for (const [contentType, config] of Object.entries(configs)) {
    if (isDbBacked(config)) continue;

    const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(contentType, config));
    if (!fs.existsSync(dir)) continue;

    const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      const files = fs.readdirSync(entryPath).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
      if (files.length === 0) continue;

      const locales = files
        .map(f => f.replace(/\.(yml|yaml)$/, ""))
        .filter(n => /^[a-z]{2}(-[a-z]{2})?$/.test(n));

      let title: string | undefined;
      for (const candidate of ["_common.yml", "_common.yaml", "en.yml", "en.yaml"]) {
        if (files.includes(candidate)) {
          try {
            const parsed = safeLoad(fs.readFileSync(path.join(entryPath, candidate), "utf-8"));
            if (parsed?.title && typeof parsed.title === "string") { title = parsed.title; break; }
            if (parsed?.name && typeof parsed.name === "string") { title = parsed.name; break; }
          } catch {}
        }
      }

      pages.push({
        slug: entry.name,
        contentType,
        directory: `marketing-content/${getDirectory(contentType, config)}/${entry.name}`,
        locales,
        title,
      });
    }
  }
  return pages;
}

function loadPage(contentType: string, slug: string, locale: string): { data: Record<string, unknown>; filePath: string } | null {
  const configs = loadContentTypes();
  const config = configs[contentType];
  if (!config || isDbBacked(config)) return null;

  const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(contentType, config), slug);
  if (!fs.existsSync(dir)) return null;

  const commonPath = path.join(dir, "_common.yml");
  const localePath = path.join(dir, `${locale}.yml`);

  let commonData: Record<string, unknown> = {};
  if (fs.existsSync(commonPath)) {
    commonData = safeLoad(fs.readFileSync(commonPath, "utf-8")) || {};
  }

  if (!fs.existsSync(localePath)) return null;
  const localeData = safeLoad(fs.readFileSync(localePath, "utf-8")) || {};

  return {
    data: deepMerge(commonData, localeData),
    filePath: localePath,
  };
}

function getValueAtPath(obj: Record<string, unknown>, pathStr: string): unknown {
  const parts = pathStr.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setValueAtPath(obj: Record<string, unknown>, pathStr: string, value: unknown): void {
  const parts = pathStr.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || typeof current[part] !== "object") {
      current[part] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

// ─── Component registry helpers ───────────────────────────────────────────────

interface ComponentInfo {
  type: string;
  version: string;
  name?: string;
  description?: string;
  variants?: string[];
}

function listComponents(): ComponentInfo[] {
  if (!fs.existsSync(COMPONENT_REGISTRY_PATH)) return [];
  const components: ComponentInfo[] = [];

  const entries = fs.readdirSync(COMPONENT_REGISTRY_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith("_"));

  for (const entry of entries) {
    const componentPath = path.join(COMPONENT_REGISTRY_PATH, entry.name);
    const versionDirs = fs.readdirSync(componentPath, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^v\d/.test(d.name));

    for (const vDir of versionDirs) {
      const schemaYml = path.join(componentPath, vDir.name, "schema.yml");
      let name: string | undefined;
      let description: string | undefined;
      let variants: string[] | undefined;

      if (fs.existsSync(schemaYml)) {
        const parsed = safeLoad(fs.readFileSync(schemaYml, "utf-8"));
        if (parsed) {
          name = typeof parsed.name === "string" ? parsed.name : undefined;
          description = typeof parsed.description === "string" ? parsed.description : undefined;
          if (parsed.variants && typeof parsed.variants === "object" && !Array.isArray(parsed.variants)) {
            variants = Object.keys(parsed.variants as Record<string, unknown>);
          } else if (Array.isArray(parsed.variants)) {
            variants = (parsed.variants as unknown[]).map(String);
          }
        }
      }

      components.push({ type: entry.name, version: vDir.name, name, description, variants });
    }
  }

  return components.sort((a, b) => a.type.localeCompare(b.type));
}

function getComponentSchema(componentType: string): { schema: Record<string, unknown> | null; examples: Record<string, string> } {
  const componentPath = path.join(COMPONENT_REGISTRY_PATH, componentType);
  if (!fs.existsSync(componentPath)) return { schema: null, examples: {} };

  const versionDirs = fs.readdirSync(componentPath, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^v\d/.test(d.name))
    .sort((a, b) => b.name.localeCompare(a.name));

  if (versionDirs.length === 0) return { schema: null, examples: {} };

  const latestVersion = versionDirs[0].name;
  const versionPath = path.join(componentPath, latestVersion);

  let schema: Record<string, unknown> | null = null;
  const schemaYml = path.join(versionPath, "schema.yml");
  if (fs.existsSync(schemaYml)) {
    schema = safeLoad(fs.readFileSync(schemaYml, "utf-8"));
  }

  const examples: Record<string, string> = {};
  const examplesPath = path.join(versionPath, "examples");
  if (fs.existsSync(examplesPath)) {
    const exampleFiles = fs.readdirSync(examplesPath).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
    for (const exFile of exampleFiles) {
      try {
        const raw = fs.readFileSync(path.join(examplesPath, exFile), "utf-8");
        const parsed = safeLoad(raw);
        const exampleName = exFile.replace(/\.(yml|yaml)$/, "");
        if (parsed?.yaml && typeof parsed.yaml === "string") {
          examples[exampleName] = parsed.yaml;
        } else {
          examples[exampleName] = raw;
        }
      } catch {}
    }
  }

  return { schema, examples };
}

// ─── Build MCP server ─────────────────────────────────────────────────────────

function createMcpServer(): McpServer {
  const mcp = new McpServer({
    name: "content-pages",
    version: "1.0.0",
  });

  // list_pages
  mcp.tool(
    "list_pages",
    "List all YAML-driven content pages. Returns slug, contentType, locales, and title for each page.",
    {},
    async () => {
      const pages = scanPages();
      return {
        content: [{ type: "text", text: JSON.stringify(pages, null, 2) }],
      };
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
    "Add a new section to a page. Inserts at the given index (or appends if omitted). Section must include a 'type' field matching a component type.",
    {
      contentType: z.string().describe("Content type"),
      slug: z.string().describe("Page slug"),
      locale: z.string().default("en").describe("Locale code"),
      section: z.record(z.unknown()).describe("Section object with at minimum a 'type' field"),
      index: z.number().int().optional().describe("Position to insert (0-based). Omit to append."),
    },
    async ({ contentType, slug, locale, section, index }) => {
      try {
        assertSafeSegment(contentType, "contentType");
        assertSafeSegment(slug, "slug");
        assertSafeLocale(locale);
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const configs = loadContentTypes();
      const config = configs[contentType];
      if (!config || isDbBacked(config)) {
        return { content: [{ type: "text", text: `Content type '${contentType}' not found or is database-backed.` }], isError: true };
      }
      const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(contentType, config), slug);
      const localePath = path.join(dir, `${locale}.yml`);
      try { assertWithinBase(localePath, MARKETING_CONTENT_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      if (!fs.existsSync(localePath)) {
        return { content: [{ type: "text", text: `Locale file not found: ${contentType}/${slug}/${locale}.yml` }], isError: true };
      }
      const localeData = safeLoad(fs.readFileSync(localePath, "utf-8")) || {};
      if (!Array.isArray(localeData.sections)) localeData.sections = [];
      const sections = localeData.sections as Record<string, unknown>[];
      const insertAt = (index !== undefined && index >= 0 && index <= sections.length) ? index : sections.length;
      sections.splice(insertAt, 0, section as Record<string, unknown>);
      fs.writeFileSync(localePath, safeDump(localeData), "utf-8");
      return { content: [{ type: "text", text: `Section of type '${section.type}' added at index ${insertAt} in ${contentType}/${slug}/${locale}.yml` }] };
    }
  );

  // remove_section
  mcp.tool(
    "remove_section",
    "Remove a section from a page by its index.",
    {
      contentType: z.string().describe("Content type"),
      slug: z.string().describe("Page slug"),
      locale: z.string().default("en").describe("Locale code"),
      index: z.number().int().describe("0-based index of the section to remove"),
    },
    async ({ contentType, slug, locale, index }) => {
      try {
        assertSafeSegment(contentType, "contentType");
        assertSafeSegment(slug, "slug");
        assertSafeLocale(locale);
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const configs = loadContentTypes();
      const config = configs[contentType];
      if (!config || isDbBacked(config)) {
        return { content: [{ type: "text", text: `Content type '${contentType}' not found or is database-backed.` }], isError: true };
      }
      const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(contentType, config), slug);
      const localePath = path.join(dir, `${locale}.yml`);
      try { assertWithinBase(localePath, MARKETING_CONTENT_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      if (!fs.existsSync(localePath)) {
        return { content: [{ type: "text", text: `Locale file not found: ${contentType}/${slug}/${locale}.yml` }], isError: true };
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
      return { content: [{ type: "text", text: `Removed section at index ${index} (type: ${removed?.type ?? "unknown"}) from ${contentType}/${slug}/${locale}.yml` }] };
    }
  );

  // reorder_sections
  mcp.tool(
    "reorder_sections",
    "Reorder sections by supplying a new order as an array of current indices. E.g. [2, 0, 1] moves the third section to the front.",
    {
      contentType: z.string().describe("Content type"),
      slug: z.string().describe("Page slug"),
      locale: z.string().default("en").describe("Locale code"),
      order: z.array(z.number().int()).describe("Array of current section indices in desired order — must be a permutation with no repeats"),
    },
    async ({ contentType, slug, locale, order }) => {
      try {
        assertSafeSegment(contentType, "contentType");
        assertSafeSegment(slug, "slug");
        assertSafeLocale(locale);
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const configs = loadContentTypes();
      const config = configs[contentType];
      if (!config || isDbBacked(config)) {
        return { content: [{ type: "text", text: `Content type '${contentType}' not found or is database-backed.` }], isError: true };
      }
      const dir = path.join(MARKETING_CONTENT_PATH, getDirectory(contentType, config), slug);
      const localePath = path.join(dir, `${locale}.yml`);
      try { assertWithinBase(localePath, MARKETING_CONTENT_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      if (!fs.existsSync(localePath)) {
        return { content: [{ type: "text", text: `Locale file not found: ${contentType}/${slug}/${locale}.yml` }], isError: true };
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
      return { content: [{ type: "text", text: `Sections reordered in ${contentType}/${slug}/${locale}.yml` }] };
    }
  );

  // list_components
  mcp.tool(
    "list_components",
    "List all available section component types from the component registry, with version and variant options.",
    {},
    async () => {
      const components = listComponents();
      return { content: [{ type: "text", text: JSON.stringify(components, null, 2) }] };
    }
  );

  // get_component_schema
  mcp.tool(
    "get_component_schema",
    "Get the full field schema and worked YAML examples for a specific component type. Use this before adding a section to understand required and optional fields.",
    {
      componentType: z.string().describe("Component type name, e.g. 'faq', 'hero', 'two_column'"),
    },
    async ({ componentType }) => {
      try {
        assertSafeSegment(componentType, "componentType");
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const componentPath = path.join(COMPONENT_REGISTRY_PATH, componentType);
      try { assertWithinBase(componentPath, COMPONENT_REGISTRY_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const { schema, examples } = getComponentSchema(componentType);
      if (!schema) {
        return { content: [{ type: "text", text: `Component '${componentType}' not found in registry.` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify({ componentType, schema, examples }, null, 2) }] };
    }
  );

  return mcp;
}

// ─── Express server ───────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const header = req.headers["x-api-key"] || req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (header !== API_KEY) {
    res.status(401).json({ error: "Unauthorized. Provide MCP_API_KEY via X-Api-Key header or Bearer token." });
    return;
  }
  next();
}

// Health check (no auth required)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "content-pages-mcp", version: "1.0.0" });
});

// Stateless MCP endpoint — each request gets its own transport instance
app.all("/mcp", authMiddleware, async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const mcp = createMcpServer();
  try {
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("finish", () => mcp.close());
  } catch (err) {
    console.error("[MCP] Request error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[MCP] Content-pages MCP server running on port ${PORT}`);
  console.log(`[MCP] Endpoint: http://0.0.0.0:${PORT}/mcp`);
  console.log(`[MCP] Auth: ${API_KEY ? "API key required (X-Api-Key header)" : "No auth (set MCP_API_KEY to enable)"}`);
  console.log(`[MCP] Health: http://0.0.0.0:${PORT}/health`);
});
