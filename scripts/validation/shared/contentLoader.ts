/**
 * Content Loader
 * 
 * Scans and loads all YAML content files from marketing-content directory.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { escapeTemplateVars, unescapeObjectVars } from "../../../shared/templateVars";
import type { ContentFile, ContentMeta, SchemaRef } from "./types";

const MARKETING_CONTENT_PATH = path.join(process.cwd(), "marketing-content");

export const CONTENT_PATHS = {
  programs: path.join(MARKETING_CONTENT_PATH, "programs"),
  landings: path.join(MARKETING_CONTENT_PATH, "landings"),
  locations: path.join(MARKETING_CONTENT_PATH, "locations"),
  pages: path.join(MARKETING_CONTENT_PATH, "pages"),
};

interface RawContentData {
  slug?: string;
  title?: string;
  name?: string;
  meta?: ContentMeta;
  schema?: SchemaRef;
  variant?: string;
  version?: number;
}

function parseYamlFile(filePath: string): RawContentData | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { escaped, map } = escapeTemplateVars(content);
    const parsed = yaml.load(escaped) as RawContentData;
    if (!parsed) return null;
    return unescapeObjectVars(parsed, map) as RawContentData;
  } catch (err) {
    console.error(`Failed to parse ${filePath}:`, err);
    return null;
  }
}

function extractLocaleFromFilename(filename: string): string {
  const match = filename.match(/\.([a-z]{2})\.yml$/);
  if (match) return match[1];
  
  const simpleMatch = filename.match(/^([a-z]{2})\.yml$/);
  if (simpleMatch) return simpleMatch[1];
  
  return "en";
}

function extractVariantFromFilename(filename: string): { variant?: string; version?: number } {
  const match = filename.match(/^(.+?)\.v(\d+)\.([a-z]{2})\.yml$/);
  if (match) {
    return { variant: match[1], version: parseInt(match[2], 10) };
  }
  return {};
}

export function loadContentDirectory(
  dirPath: string,
  type: ContentFile["type"]
): ContentFile[] {
  const files: ContentFile[] = [];

  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const dirs = fs.readdirSync(dirPath);

  for (const dir of dirs) {
    const contentPath = path.join(dirPath, dir);
    if (!fs.statSync(contentPath).isDirectory()) continue;

    const yamlFiles = fs.readdirSync(contentPath).filter((f) => f.endsWith(".yml"));

    for (const yamlFile of yamlFiles) {
      const isCommon = yamlFile === "_common.yml" || yamlFile === "_common.yaml";
      if (yamlFile.startsWith("_") && !isCommon) continue;
      
      const filePath = path.join(contentPath, yamlFile);
      const data = parseYamlFile(filePath);
      
      if (!data) continue;

      const locale = isCommon ? "_common" : extractLocaleFromFilename(yamlFile);
      const { variant, version } = isCommon ? {} : extractVariantFromFilename(yamlFile);

      files.push({
        slug: data.slug || dir,
        title: data.title || data.name || dir,
        meta: data.meta,
        schema: data.schema,
        type,
        locale,
        filePath,
        variant,
        version,
      });
    }
  }

  return files;
}

export function loadAllContent(): ContentFile[] {
  const programs = loadContentDirectory(CONTENT_PATHS.programs, "program");
  const landings = loadContentDirectory(CONTENT_PATHS.landings, "landing");
  const locations = loadContentDirectory(CONTENT_PATHS.locations, "location");
  const pages = loadContentDirectory(CONTENT_PATHS.pages, "page");
  
  return [...programs, ...landings, ...locations, ...pages];
}

export function getContentByType(type: ContentFile["type"]): ContentFile[] {
  const pathMap: Record<ContentFile["type"], string> = {
    program: CONTENT_PATHS.programs,
    landing: CONTENT_PATHS.landings,
    location: CONTENT_PATHS.locations,
    page: CONTENT_PATHS.pages,
  };
  
  return loadContentDirectory(pathMap[type], type);
}
