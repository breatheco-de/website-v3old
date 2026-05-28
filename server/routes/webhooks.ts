import type { Express, Request } from "express";
import * as crypto from "crypto";
import { getWebhookSecret } from "../utils/webhookSecret";
import { requireCapability } from "./_helpers";
import { getDatabaseName, getAllTypes } from "../content-types";
import { databaseManager } from "../database";
import { clearMarkdownCache } from "../markdown";
import { invalidateContentCaches } from "./_helpers";

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

export function registerWebhooksRoutes(app: Express): void {
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
