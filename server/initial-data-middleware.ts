import type { Request, Response, NextFunction } from "express";
import { contentIndex } from "./content-index";
import {
  templatePageSchema,
  landingPageSchema,
  careerProgramSchema,
  locationPageSchema,
} from "@shared/schema";
import { resolveDynamicEntries } from "./dynamic-entries";
import { resolveLayout } from "./content-types";
import { applyComponentSectionDefaults } from "./component-registry";

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

async function resolveInitialData(
  url: string,
): Promise<InitialDataPayload | null> {
  const cleanUrl = url.split("?")[0].split("#")[0];

  if (
    cleanUrl === "/" ||
    cleanUrl === "/en" ||
    cleanUrl === "/en/" ||
    cleanUrl === "/es" ||
    cleanUrl === "/es/"
  ) {
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
      const data = result.data as any;
      if (data.sections && Array.isArray(data.sections)) {
        applyComponentSectionDefaults(data.sections);
        data.sections = (await resolveDynamicEntries(
          data.sections,
          locale,
        )) as any;
      }
      const pageRaw = contentIndex.loadMergedContent("page", slug, locale);
      const layout = resolveLayout("page", pageRaw.data || {});
      data.layout = layout;
      return {
        queryKey: ["/api/pages", slug, locale],
        data,
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
    let locale = cleanUrl.match(/^\/(es)\b/) ? "es" : "en";
    if (resolved.params?.locale) {
      locale = resolved.params.locale;
    } else if (!cleanUrl.match(/^\/(en|es)\b/)) {
      const commonData = contentIndex.loadCommonData(contentType, slug);
      if (commonData?.locale && typeof commonData.locale === "string") {
        locale = commonData.locale;
      }
    }

    if (apiPath && schema) {
      const localeOrVariant = locale;

      const result = contentIndex.loadContent({
        contentType,
        slug,
        schema,
        localeOrVariant,
      });

      if (!result.success) return null;

      const data = result.data as any;
      if (data.sections && Array.isArray(data.sections)) {
        applyComponentSectionDefaults(data.sections);
      }
      if (
        contentType === "page" &&
        data.sections &&
        Array.isArray(data.sections)
      ) {
        data.sections = (await resolveDynamicEntries(
          data.sections,
          locale,
        )) as any;
      }
      const rawContent = contentIndex.loadMergedContent(
        contentType,
        slug,
        locale,
      );
      const layout = resolveLayout(contentType, rawContent.data || {});
      data.layout = layout;

      return {
        queryKey: [apiPath, slug, locale],
        data,
      };
    }

    const genericResult = contentIndex.loadContent({
      contentType,
      slug,
      schema: templatePageSchema,
      localeOrVariant: locale,
    });

    if (!genericResult.success) return null;

    const genericData = genericResult.data as any;
    if (genericData.sections && Array.isArray(genericData.sections)) {
      applyComponentSectionDefaults(genericData.sections);
      genericData.sections = (await resolveDynamicEntries(
        genericData.sections,
        locale,
      )) as any;
    }
    const genericRaw = contentIndex.loadMergedContent(
      contentType,
      slug,
      locale,
    );
    const genericLayout = resolveLayout(contentType, genericRaw.data || {});
    genericData.layout = genericLayout;

    const genericApiPath = `/api/content-pages/${contentType}`;
    return {
      queryKey: [genericApiPath, slug, locale],
      data: genericData,
    };
  } catch {
    return null;
  }
}

export function initialDataMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.path.startsWith("/api/") || req.path.startsWith("/private/")) {
    return next();
  }

  const ext = req.path.split(".").pop();
  if (
    ext &&
    [
      "js",
      "ts",
      "tsx",
      "css",
      "map",
      "woff2",
      "woff",
      "ttf",
      "png",
      "jpg",
      "jpeg",
      "webp",
      "svg",
      "ico",
      "json",
    ].includes(ext)
  ) {
    return next();
  }

  const payloadPromise = resolveInitialData(req.originalUrl).catch(() => null);

  const originalEnd = res.end;
  res.end = function (this: Response, chunk?: any, ...args: any[]) {
    const contentType = res.getHeader("content-type");
    if (contentType && String(contentType).includes("text/html") && chunk) {
      payloadPromise
        .then((payload) => {
          if (payload) {
            try {
              const html =
                typeof chunk === "string" ? chunk : chunk.toString("utf-8");
              const scriptTag = `<script id="__INITIAL_DATA__" type="application/json">${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>`;
              const injected = html.replace("</body>", scriptTag + "</body>");

              const newLength = Buffer.byteLength(injected, "utf-8");
              res.setHeader("content-length", newLength);

              originalEnd.call(this, injected, ...args);
            } catch {
              originalEnd.call(this, chunk, ...args);
            }
          } else {
            originalEnd.call(this, chunk, ...args);
          }
        })
        .catch(() => {
          originalEnd.call(this, chunk, ...args);
        });
      return this;
    }
    return originalEnd.call(this, chunk, ...args);
  } as any;

  next();
}
