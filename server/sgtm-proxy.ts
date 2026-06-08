import type { Express, Request, Response } from "express";
import http from "http";
import https from "https";
import { URL } from "url";
import { getOptimizationSettings } from "./settings";
import { child } from "./logger";
const log = child({ module: "sgtm-proxy" });

let cachedAgentKey: string | null = null;
let proxyAgent: http.Agent | https.Agent | null = null;

function getAgent(targetBase: string): http.Agent | https.Agent {
  // Key by full target base URL so a protocol/host change always recreates the agent
  const agentKey = targetBase;
  if (proxyAgent && cachedAgentKey === agentKey) {
    return proxyAgent;
  }
  if (proxyAgent) {
    (proxyAgent as http.Agent).destroy?.();
  }
  const isHttps = targetBase.startsWith("https://");
  proxyAgent = isHttps
    ? new https.Agent({ keepAlive: true, maxSockets: 50 })
    : new http.Agent({ keepAlive: true, maxSockets: 50 });
  cachedAgentKey = agentKey;
  return proxyAgent;
}

/**
 * Normalize the configured proxy path to always end with '/'.
 * This lets users type '/sgtm' or '/sgtm/' and have both work identically.
 */
function normalizeProxyPath(rawPath: string): string {
  const p = rawPath || "/sgtm/";
  return p.endsWith("/") ? p : p + "/";
}

/**
 * Determine whether req.path falls under the proxy mount point.
 * Matches both the bare path (e.g. '/sgtm') and any sub-path (e.g. '/sgtm/collect').
 */
function pathMatches(reqPath: string, mountPath: string): boolean {
  // mountPath always ends with '/' here (normalized)
  return reqPath === mountPath.slice(0, -1) || reqPath.startsWith(mountPath);
}

/**
 * Build the sub-path to append to the sGTM server base URL.
 * Always returns a string beginning with '/'.
 */
function buildSubPath(reqPath: string, mountPath: string): string {
  // mountPath always ends with '/' here (normalized)
  if (reqPath === mountPath.slice(0, -1)) {
    return "/";
  }
  return "/" + reqPath.slice(mountPath.length);
}

export function registerSgtmProxy(app: Express): void {
  app.use((req: Request, res: Response, next) => {
    const settings = getOptimizationSettings();
    const mountPath = normalizeProxyPath(settings.tagmanager.sgtm_proxy_path);

    // If the request path does not match the proxy mount point, skip entirely
    if (!pathMatches(req.path, mountPath)) {
      return next();
    }

    // The proxy path matches — it's "claimed" by this middleware.
    // When disabled or unconfigured, return 404 explicitly instead of falling
    // through to the SPA catch-all.
    const tm = settings.tagmanager;
    if (!tm.sgtm_enabled || !tm.sgtm_server_url) {
      return res.status(404).json({ error: "Not found" });
    }

    const targetBase = tm.sgtm_server_url.replace(/\/$/, "");
    const subPath = buildSubPath(req.path, mountPath);
    const targetUrl = `${targetBase}${subPath}`;

    let parsedTarget: URL;
    try {
      parsedTarget = new URL(targetUrl);
    } catch {
      log.warn({ targetUrl }, '[sGTM Proxy] Invalid target URL');
      return res.status(502).json({ error: "Invalid sGTM server URL" });
    }

    const agent = getAgent(targetBase);

    const qs = req.originalUrl.includes("?")
      ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
      : "";
    const targetPath = parsedTarget.pathname + qs;

    const headers: http.OutgoingHttpHeaders = {
      ...req.headers,
      host: parsedTarget.host,
      "x-forwarded-for": req.ip || req.socket?.remoteAddress || "",
      "x-forwarded-proto": "https",
      "x-forwarded-host": req.hostname,
    };
    delete headers["transfer-encoding"];
    delete headers["connection"];

    const protocol = parsedTarget.protocol === "https:" ? https : http;
    const options: http.RequestOptions = {
      agent,
      hostname: parsedTarget.hostname,
      port: parsedTarget.port || (parsedTarget.protocol === "https:" ? 443 : 80),
      path: targetPath,
      method: req.method,
      headers,
    };

    const proxyReq = protocol.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on("error", (err) => {
      log.error({ err, targetUrl }, '[sGTM Proxy] Error proxying');
      if (!res.headersSent) {
        res.status(502).json({ error: "sGTM server unavailable" });
      }
    });

    const raw = (req as any).rawBody;
    if (Buffer.isBuffer(raw) && raw.length > 0) {
      proxyReq.end(raw);
    } else if (req.body && ["POST", "PUT", "PATCH"].includes(req.method)) {
      const body = Buffer.from(JSON.stringify(req.body));
      proxyReq.end(body);
    } else {
      req.pipe(proxyReq, { end: true });
    }
  });

  log.info('[sGTM Proxy] Proxy middleware registered (dynamic — reads config per request)');
}
