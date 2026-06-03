import type { Express, Request } from "express";
import * as crypto from "crypto";
import { getWebhookSecret } from "../utils/webhookSecret";
import { requireCapability } from "./_helpers";
import { getDatabaseName, getAllTypes } from "../content-types";
import { databaseManager } from "../database";
import { clearMarkdownCache } from "../markdown";
import { invalidateContentCaches } from "./_helpers";
import { z } from "zod";

function buildBaseUrlFromRequest(req: Request): string {
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost:5000";
  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  return `${proto}://${host}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

const conversionWebhookBodySchema = z.object({
  url: z.string().url(),
  method: z.enum(["POST", "GET"]).default("POST"),
  payload: z.record(z.unknown()),
});

/**
 * Reject URLs that point to private/internal network destinations to prevent SSRF.
 * Blocks: localhost, loopback, RFC-1918 private ranges, link-local, IPv6 loopback,
 * and the AWS/GCP/Azure instance metadata endpoints.
 */
function isPrivateDestination(urlStr: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return true; // unparsable → block
  }

  // Only allow http and https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;

  const host = parsed.hostname.toLowerCase();

  // IPv6 loopback / link-local
  if (host === "::1" || host === "[::1]") return true;
  if (host.startsWith("fe80")) return true;

  // Metadata service hostnames used by cloud providers
  const blockedHostnames = [
    "metadata.google.internal",
    "metadata.internal",
    "169.254.169.254", // AWS/GCP/Azure IMDS
  ];
  if (blockedHostnames.includes(host)) return true;

  // Reject numeric IPv4 addresses that are private/loopback
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [, a, b, c] = ipv4.map(Number);
    if (
      a === 127 || // loopback 127.x.x.x
      a === 10 || // RFC-1918 10.x.x.x
      (a === 172 && b >= 16 && b <= 31) || // RFC-1918 172.16-31.x.x
      (a === 192 && b === 168) || // RFC-1918 192.168.x.x
      (a === 169 && b === 254) || // link-local 169.254.x.x
      (a === 100 && b >= 64 && b <= 127) // CGNAT 100.64-127.x.x
    ) {
      return true;
    }
  }

  // Block bare "localhost" hostname variants
  if (host === "localhost" || host.endsWith(".localhost")) return true;

  return false;
}

export function registerWebhooksRoutes(app: Express): void {
  /**
   * POST /api/conversion-webhook
   * Server-side proxy that fires a conversion webhook to avoid CORS issues with
   * third-party destinations (Zapier, Make, CRMs, etc.).
   * Body: { url, method, payload }
   * Returns 200 on upstream success, 502 on upstream failure or network error.
   * Callers should treat failures as non-blocking — the form success flow must
   * not depend on this endpoint.
   */
  app.post("/api/conversion-webhook", async (req, res) => {
    const parsed = conversionWebhookBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      return;
    }

    const { url, method, payload } = parsed.data;

    // SSRF protection: block private/internal network destinations
    if (isPrivateDestination(url)) {
      console.warn(`[ConversionWebhook] Blocked private/internal destination: ${url}`);
      res.status(400).json({ error: "Webhook destination is not allowed (private or internal address)" });
      return;
    }

    try {
      let fetchUrl = url;
      const fetchOptions: RequestInit = { method };

      if (method === "POST") {
        fetchOptions.headers = { "Content-Type": "application/json" };
        fetchOptions.body = JSON.stringify(payload);
      } else {
        // GET: serialize payload as query params so conversion fields are delivered
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(payload)) {
          if (value !== undefined && value !== null) {
            params.set(key, String(value));
          }
        }
        const sep = url.includes("?") ? "&" : "?";
        fetchUrl = `${url}${sep}${params.toString()}`;
      }

      const response = await fetch(fetchUrl, fetchOptions);
      console.log(`[ConversionWebhook] Delivered to ${url} — status ${response.status}`);

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.warn(`[ConversionWebhook] Upstream returned ${response.status}: ${body.slice(0, 200)}`);
        res.status(502).json({
          error: "Upstream webhook returned a non-2xx response",
          upstream_status: response.status,
          upstream_body: body.slice(0, 500),
        });
        return;
      }

      res.json({ success: true, status: response.status });
    } catch (err) {
      console.error("[ConversionWebhook] Failed to deliver webhook:", err);
      res.status(502).json({ error: "Failed to deliver webhook", details: String(err) });
    }
  });
  app.post("/api/webhooks/clear-cache", async (req, res) => {
    try {
      const secret = getWebhookSecret();
      if (!secret) {
        res.status(503).json({ error: "WEBHOOK_SECRET is not configured on this server." });
        return;
      }

      const token = req.query.token as string | undefined;
      if (!token || !timingSafeEqual(token, secret)) {
        res.status(401).json({ error: "Invalid or missing token." });
        return;
      }

      const type = req.query.type as string | undefined;

      if (type && type !== "blog") {
        const dbName = getDatabaseName(type);
        if (dbName && databaseManager.exists(dbName)) {
          await databaseManager.fetchItems(dbName, true).catch(() => {});
        }
        invalidateContentCaches(type);
        clearMarkdownCache();
        res.json({ success: true, message: `Cache cleared for content type "${type}".` });
        return;
      }

      if (type === "blog") {
        const dbName = getDatabaseName("blog");
        if (dbName && databaseManager.exists(dbName)) {
          await databaseManager.fetchItems(dbName, true).catch(() => {});
        }
        clearMarkdownCache();
        res.json({ success: true, message: "Blog cache cleared." });
        return;
      }

      const allTypes = getAllTypes();
      await Promise.all(
        allTypes.map(async (t) => {
          const dbName = getDatabaseName(t);
          if (dbName && databaseManager.exists(dbName)) {
            await databaseManager.fetchItems(dbName, true).catch(() => {});
          }
        })
      );
      invalidateContentCaches();
      clearMarkdownCache();
      res.json({ success: true, message: "All content caches cleared." });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/webhooks/clear-cache/url", async (req, res) => {
    try {
      const auth = await requireCapability(req, res, "content_edit");
      if (!auth.authorized) return;

      const secret = getWebhookSecret();
      if (!secret) {
        res.json({ configured: false });
        return;
      }

      const base = buildBaseUrlFromRequest(req);
      const url = `${base}/api/webhooks/clear-cache?token=${encodeURIComponent(secret)}`;
      res.json({ configured: true, url });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}
