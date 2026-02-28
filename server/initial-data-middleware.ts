import type { Request, Response, NextFunction } from "express";
import { contentIndex } from "./content-index";
import {
  templatePageSchema,
  landingPageSchema,
  careerProgramSchema,
  locationPageSchema,
} from "@shared/schema";

interface InitialDataPayload {
  queryKey: unknown[];
  data: unknown;
}

const API_PATH_MAP: Record<string, string> = {
  page: "/api/pages",
  landing: "/api/landings",
  program: "/api/career-programs",
  location: "/api/locations",
};

const SCHEMA_MAP: Record<string, typeof templatePageSchema> = {
  page: templatePageSchema,
  landing: landingPageSchema,
  program: careerProgramSchema,
  location: locationPageSchema,
};

function resolveInitialData(url: string): InitialDataPayload | null {
  const cleanUrl = url.split("?")[0].split("#")[0];

  if (cleanUrl === "/" || cleanUrl === "/en" || cleanUrl === "/en/" || cleanUrl === "/es" || cleanUrl === "/es/") {
    const locale = cleanUrl.startsWith("/es") ? "es" : "en";
    const slug = "home";
    const schema = SCHEMA_MAP["page"];
    const result = contentIndex.loadContent({
      contentType: "page",
      slug,
      schema,
      localeOrVariant: locale,
    });
    if (result.success) {
      return {
        queryKey: ["/api/pages", slug, locale],
        data: result.data,
      };
    }
    return null;
  }

  try {
    const resolved = contentIndex.resolveUrl(cleanUrl);
    if (!resolved) return null;

    const { contentType, slug, fromDatabase } = resolved;

    if (fromDatabase) {
      return null;
    }

    const apiPath = API_PATH_MAP[contentType];
    const schema = SCHEMA_MAP[contentType];
    if (!apiPath || !schema) return null;

    const locale = cleanUrl.match(/^\/(es)\b/) ? "es" : "en";
    const localeOrVariant = contentType === "landing" ? "promoted" : locale;

    const result = contentIndex.loadContent({
      contentType,
      slug,
      schema,
      localeOrVariant,
    });

    if (!result.success) return null;

    return {
      queryKey: [apiPath, slug, locale],
      data: result.data,
    };
  } catch {
    return null;
  }
}

export function initialDataMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith("/api/") || req.path.startsWith("/private/")) {
    return next();
  }

  const ext = req.path.split(".").pop();
  if (ext && ["js", "ts", "tsx", "css", "map", "woff2", "woff", "ttf", "png", "jpg", "jpeg", "webp", "svg", "ico", "json"].includes(ext)) {
    return next();
  }

  const originalEnd = res.end;
  res.end = function (this: Response, chunk?: any, ...args: any[]) {
    const contentType = res.getHeader("content-type");
    if (contentType && String(contentType).includes("text/html") && chunk) {
      try {
        const payload = resolveInitialData(req.originalUrl);
        if (payload) {
          const html = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
          const scriptTag = `<script id="__INITIAL_DATA__" type="application/json">${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>`;
          const injected = html.replace("</body>", scriptTag + "</body>");

          const newLength = Buffer.byteLength(injected, "utf-8");
          res.setHeader("content-length", newLength);

          return originalEnd.call(this, injected, ...args);
        }
      } catch {}
    }
    return originalEnd.call(this, chunk, ...args);
  } as any;

  next();
}
