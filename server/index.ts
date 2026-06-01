import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, startBackgroundSync } from "./routes/index";
import { setupVite, serveStatic, log } from "./vite";
import { fallbackRedirectMiddleware } from "./redirects";
import { initialDataMiddleware } from "./initial-data-middleware";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "path";
import { setAutoCommitCallback } from "./sync-state";
import { queueFileChange } from "./auto-commit";
import { databaseManager } from "./database";
import { contentIndex } from "./content-index";
import { scanEcommerceContent, startEcommerceWatcher } from "./ecommerce/ecommerce-index";
import { loadUsersStateFromBucket } from "./user-store";
import { loadFormStateFromBucket, updateFormStateForFile } from "./form-state";
import { addFileModifiedListener } from "./sync-state";
import { gcs } from "./gcs";
import { getVersioningManager } from "./versioning/VersioningManager";
import http from "http";
import { registerSgtmProxy } from "./sgtm-proxy";
import { getOptimizationSettings } from "./settings";
// Note: gcs.initFromEnv() is called by media.initFromEnv() in routes.ts,
// which happens before sync-state needs it.

const app = express();

app.use(cookieParser());

// Trailing slash 301 redirect — must run before route handlers so search engines
// never see duplicate content at both /path/ and /path.
app.use((req: Request, res: Response, next: NextFunction) => {
  const p = req.path;
  if (
    p.length > 1 &&
    p.endsWith('/') &&
    !p.startsWith('/api/') &&
    !p.startsWith('/attached_assets/') &&
    !p.startsWith('/marketing-content/') &&
    !p.startsWith('/@') &&
    !p.startsWith('/mcp') &&
    !p.startsWith('/oauth') &&
    !p.startsWith('/.well-known')
  ) {
    // Exempt the sGTM proxy path from trailing-slash redirect so the proxy
    // middleware receives the request with the trailing slash intact.
    const { sgtm_proxy_path } = getOptimizationSettings();
    if (sgtm_proxy_path && p.startsWith(sgtm_proxy_path)) {
      return next();
    }
    const url = req.originalUrl;
    const qIndex = url.indexOf('?');
    const qs = qIndex >= 0 ? url.slice(qIndex) : '';
    return res.redirect(301, p.slice(0, -1) + qs);
  }
  next();
});

app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets')));
app.use('/marketing-content/images', express.static(path.join(process.cwd(), 'marketing-content', 'images')));

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
}));

app.use((req, res, next) => {
  const ext = req.path.split('.').pop();
  if (['js', 'css', 'woff2', 'woff', 'ttf', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'ico'].includes(ext || '')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  }
  next();
});

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({
  extended: false,
  verify: (req, _res, buf) => {
    // Capture raw bytes for proxy forwarding (same pattern as express.json above)
    if (!req.rawBody) req.rawBody = buf;
  },
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  setAutoCommitCallback(queueFileChange);
  log('[AutoCommit] Auto-commit callback registered');

  // ─── MCP server proxy ────────────────────────────────────────────────────────
  // Port 3001 is firewalled. Proxy MCP and OAuth traffic through port 5000 so
  // the server is reachable without publishing. Set PUBLIC_URL to the base URL
  // of this server (no port suffix) so OAuth metadata advertises correct URLs.
  const MCP_PORT = process.env.MCP_PORT || "3001";

  function pipeToMcp(req: Request, res: Response) {
    // Express body-parser may have already consumed the stream, so we detect
    // that and re-serialize the parsed body rather than piping a dead stream.
    const bodyAlreadyParsed =
      req.body !== undefined &&
      ["POST", "PUT", "PATCH"].includes(req.method);

    // Forward the original raw body bytes so the MCP server's own parsers
    // receive exactly what the client sent (avoids re-encoding mismatches).
    let bodyBuf: Buffer | null = null;
    if (bodyAlreadyParsed) {
      const raw = req.rawBody;
      if (Buffer.isBuffer(raw) && raw.length > 0) {
        bodyBuf = raw;
      } else {
        // Fallback: re-encode the parsed body (JSON requests only reach here)
        bodyBuf = Buffer.from(JSON.stringify(req.body));
      }
    }

    const headers: http.OutgoingHttpHeaders = { ...req.headers, host: `127.0.0.1:${MCP_PORT}` };
    // Remove hop-by-hop headers that conflict with our re-serialized body
    delete headers["transfer-encoding"];
    delete headers["connection"];
    if (bodyBuf) {
      headers["content-length"] = bodyBuf.length;
      // Only set a content-type fallback if none was forwarded
      headers["content-type"] = (headers["content-type"] as string) ?? "application/json";
    }

    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: MCP_PORT,
      path: req.originalUrl,
      method: req.method,
      headers,
    };

    const proxy = http.request(options, (mcpRes) => {
      res.writeHead(mcpRes.statusCode ?? 502, mcpRes.headers);
      mcpRes.pipe(res, { end: true });
    });
    proxy.on("error", (err) => {
      log(`[MCP proxy] error: ${err.message}`);
      if (!res.headersSent) res.status(502).json({ error: "MCP server unavailable" });
    });

    if (bodyBuf) {
      proxy.end(bodyBuf);
    } else {
      req.pipe(proxy, { end: true });
    }
  }

  app.all("/mcp", pipeToMcp as any);
  app.all("/mcp/*", pipeToMcp as any);
  app.all("/oauth/*", pipeToMcp as any);
  app.all("/.well-known/oauth-authorization-server", pipeToMcp as any);
  // ─────────────────────────────────────────────────────────────────────────────

  // sGTM proxy — registered early so it fires before static file handlers
  registerSgtmProxy(app);

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Fallback redirects: only fire for URLs that would otherwise 404
  // Registered before Vite's catch-all so they can intercept unknown routes
  app.use(fallbackRedirectMiddleware);

  app.use(initialDataMiddleware);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Run the fast content-index scan synchronously before the server begins
  // listening so the first request is never blocked by the initial scan.
  // The slow phase (image/variable/redirect/SEO indexing) runs in the background.
  contentIndex.scanFast();

  // Scan ecommerce YAML files and start the file watcher so plan/product data is
  // always available at request time with zero filesystem I/O.
  scanEcommerceContent();
  startEcommerceWatcher();

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    // All deferred background tasks fire here — server is already ready to handle requests.
    contentIndex.startSlowScanAsync();
    databaseManager.warmup().catch((err) => {
      console.error("[DatabaseManager] Warmup error:", err);
    });
    startBackgroundSync().catch((err) => {
      console.error("[SyncState] Failed to start background sync:", err);
    });
    loadUsersStateFromBucket().catch((err) => {
      console.error("[UserStore] Failed to load users state:", err);
    });
    loadFormStateFromBucket().catch((err) => {
      console.error("[FormState] Failed to load form state:", err);
    });
    addFileModifiedListener((filePath) => {
      if (filePath.startsWith("marketing-content/") && (filePath.endsWith(".yml") || filePath.endsWith(".yaml"))) {
        updateFormStateForFile(filePath);
      }
    });
  });

  async function gracefulShutdown(signal: string): Promise<void> {
    log(`[Shutdown] Received ${signal}, flushing pending GCS uploads…`);
    try {
      await getVersioningManager().shutdown();
      await gcs.flushPending();
    } catch (err) {
      console.error("[Shutdown] Error during graceful shutdown:", err);
    }
    server.close(() => {
      log("[Shutdown] HTTP server closed.");
      process.exit(0);
    });
    // Force exit after 10 s if server.close() hangs
    setTimeout(() => {
      console.error("[Shutdown] Forced exit after timeout.");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
})();
