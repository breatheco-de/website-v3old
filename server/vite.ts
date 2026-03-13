import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { contentIndex } from "./content-index";
import { resolveInitialData, resolvePreloadHints } from "./initial-data-middleware";

function buildPreloadTags(urls: string[]): string {
  if (urls.length === 0) return "";
  return urls
    .map((url) => `<link rel="preload" as="image" fetchpriority="high" href="${url.replace(/"/g, "&quot;")}">`)
    .join("\n");
}

function injectPreloadTags(html: string, preloadTags: string): string {
  if (!preloadTags) return html;
  return html.replace("</head>", preloadTags + "\n</head>");
}

const viteLogger = createLogger();

const STATIC_ROUTES = new Set([
  "/",
  "/en",
  "/en/",
  "/es",
  "/es/",
  "/en/apply",
  "/es/aplica",
  "/terms-conditions",
  "/terminos-condiciones",
  "/privacy-policy",
  "/politica-privacidad",
  "/preview-frame",
]);

const STATIC_PREFIXES = ["/private/", "/api/"];

function isKnownRoute(url: string): boolean {
  const cleanUrl = url.split("?")[0].split("#")[0];
  if (STATIC_ROUTES.has(cleanUrl)) return true;
  for (const prefix of STATIC_PREFIXES) {
    if (cleanUrl.startsWith(prefix)) return true;
  }
  try {
    if (contentIndex.isKnownUrl(cleanUrl)) return true;
  } catch {}
  return false;
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  // vite.config.ts exports an async factory (defineConfig with isSsrBuild flag).
  // We must call it to get the resolved config object before spreading.
  const resolvedViteConfig = typeof viteConfig === "function"
    ? await (viteConfig as Function)({ mode: "development", command: "serve", isSsrBuild: false })
    : viteConfig;

  const vite = await createViteServer({
    ...resolvedViteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // Only crash on genuine build/plugin errors, not on SSR pre-transform misses
        if (options?.error && !msg.includes("Pre-transform error")) {
          process.exit(1);
        }
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(url, template);

      const initialDataPayload = await resolveInitialData(url).catch(() => null);

      let appHtml = "";
      try {
        const entryServerAbs = path.resolve(
          import.meta.dirname,
          "..",
          "client",
          "src",
          "entry-server.tsx",
        );
        const { render } = await vite.ssrLoadModule(entryServerAbs);
        appHtml = await render(url, initialDataPayload);
      } catch (ssrErr) {
        console.warn("[SSR] render failed, falling back to client-only:", (ssrErr as Error).stack ?? ssrErr);
      }

      let html = appHtml
        ? page.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
        : page;

      const preloadUrls = resolvePreloadHints(initialDataPayload);
      const preloadTags = buildPreloadTags(preloadUrls);
      html = injectPreloadTags(html, preloadTags);

      if (initialDataPayload) {
        const scriptTag = `<script id="__INITIAL_DATA__" type="application/json">${JSON.stringify(initialDataPayload).replace(/</g, "\\u003c")}</script>`;
        html = html.replace("</body>", scriptTag + "</body>");
      }

      const status = isKnownRoute(url) ? 200 : 404;
      res.status(status).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

let ssrRenderFn: ((url: string, payload: unknown) => Promise<string>) | null = null;
let ssrModuleLoaded = false;

async function getSsrRender() {
  if (ssrModuleLoaded) return ssrRenderFn;
  ssrModuleLoaded = true;
  try {
    const ssrBundlePath = path.resolve(import.meta.dirname, "server", "entry-server.js");
    if (fs.existsSync(ssrBundlePath)) {
      const mod = await import(ssrBundlePath);
      ssrRenderFn = mod.render;
    }
  } catch (e) {
    console.warn("[SSR] Could not load SSR bundle:", (e as Error).stack ?? e);
  }
  return ssrRenderFn;
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { index: false }));

  const indexHtmlPath = path.resolve(distPath, "index.html");

  app.use("*", async (_req, res) => {
    const url = _req.originalUrl;
    const status = isKnownRoute(url) ? 200 : 404;

    try {
      const render = await getSsrRender();
      if (render) {
        const indexHtml = await fs.promises.readFile(indexHtmlPath, "utf-8");
        const initialDataPayload = await resolveInitialData(url).catch(() => null);
        const appHtml = await render(url, initialDataPayload);

        let html = indexHtml.replace(
          '<div id="root"></div>',
          `<div id="root">${appHtml}</div>`,
        );

        const preloadUrls = resolvePreloadHints(initialDataPayload);
        const preloadTags = buildPreloadTags(preloadUrls);
        html = injectPreloadTags(html, preloadTags);

        if (initialDataPayload) {
          const scriptTag = `<script id="__INITIAL_DATA__" type="application/json">${JSON.stringify(initialDataPayload).replace(/</g, "\\u003c")}</script>`;
          html = html.replace("</body>", scriptTag + "</body>");
        }

        res.status(status).set({ "Content-Type": "text/html" }).send(html);
        return;
      }
    } catch (e) {
      console.warn("[SSR] Production render failed, falling back:", (e as Error).stack ?? e);
    }

    res.status(status).sendFile(indexHtmlPath);
  });
}
