import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
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
import { variableManager } from "./variable-manager";
import { loadImageRegistry } from "./image-registry";
import { getDefaultLocale } from "./settings";

interface SingleQuery {
  queryKey: unknown[];
  data: unknown;
}

export interface InitialDataPayload {
  queries: SingleQuery[];
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

async function resolvePageQuery(url: string): Promise<SingleQuery | null> {
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

    const { contentType, slug, fromDatabase, patternLocale } = resolved;
    const isNonLocalized = patternLocale === "default";

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
      data.locale = locale;

      return {
        queryKey: [apiPath, slug, isNonLocalized ? "auto" : locale],
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
    genericData.locale = locale;

    const genericApiPath = `/api/content-pages/${contentType}`;
    return {
      queryKey: [genericApiPath, slug, isNonLocalized ? "auto" : locale],
      data: genericData,
    };
  } catch {
    return null;
  }
}

function resolveMenuQuery(menuId: string, locale: string): SingleQuery | null {
  try {
    const menusDir = path.join(process.cwd(), "marketing-content", "menus");
    let filePath: string | null = null;

    if (locale && locale !== getDefaultLocale()) {
      const localizedBase = `${menuId}.${locale}`;
      const localizedYml = path.join(menusDir, `${localizedBase}.yml`);
      const localizedYaml = path.join(menusDir, `${localizedBase}.yaml`);
      if (fs.existsSync(localizedYml)) filePath = localizedYml;
      else if (fs.existsSync(localizedYaml)) filePath = localizedYaml;
    }

    if (!filePath) {
      const baseYml = path.join(menusDir, `${menuId}.yml`);
      const baseYaml = path.join(menusDir, `${menuId}.yaml`);
      if (fs.existsSync(baseYml)) filePath = baseYml;
      else if (fs.existsSync(baseYaml)) filePath = baseYaml;
    }

    if (!filePath) return null;

    const content = fs.readFileSync(filePath, "utf-8");
    const data = yaml.load(content);
    const context = { locale };
    const { data: resolved } = variableManager.resolveDeep(data, context);

    return {
      queryKey: ["/api/menus", menuId, locale],
      data: { name: menuId, locale, data: resolved },
    };
  } catch {
    return null;
  }
}

export async function resolveInitialData(
  url: string,
): Promise<InitialDataPayload | null> {
  const pageQuery = await resolvePageQuery(url);

  const variablesQuery: SingleQuery = {
    queryKey: ["/api/variables"],
    data: variableManager.getDefinitions(),
  };

  const queries: SingleQuery[] = [];
  if (pageQuery) queries.push(pageQuery);
  queries.push(variablesQuery);

  if (pageQuery) {
    const pageData = pageQuery.data as Record<string, unknown>;
    const layout = pageData?.layout as
      | { menu?: { top?: string | null; bottom?: string | null } }
      | undefined;
    const locale =
      (pageData?.locale as string) ||
      (pageQuery.queryKey[2] as string) ||
      getDefaultLocale();

    if (layout?.menu?.top) {
      const mq = resolveMenuQuery(layout.menu.top, locale);
      if (mq) queries.push(mq);
    }
    if (layout?.menu?.bottom) {
      const mq = resolveMenuQuery(layout.menu.bottom, locale);
      if (mq) queries.push(mq);
    }
  }

  const registry = loadImageRegistry();
  if (registry) {
    queries.push({
      queryKey: ["/api/image-registry"],
      data: registry,
    });
  }

  return { queries };
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
              if (html.includes('id="__INITIAL_DATA__"')) {
                originalEnd.call(this, chunk, ...args);
                return;
              }
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
