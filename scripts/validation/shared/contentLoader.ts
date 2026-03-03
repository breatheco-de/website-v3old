/**
 * Content Loader
 * 
 * Scans and loads all YAML content files from marketing-content directory.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { escapeTemplateVars, unescapeObjectVars } from "../../../shared/templateVars";
import { getAllConfigs } from "../../../server/content-types";
import type { ContentFile, ContentMeta, SchemaRef } from "./types";

const MARKETING_CONTENT_PATH = path.join(process.cwd(), "marketing-content");

function buildContentPaths(): Record<string, string> {
  const configs = getAllConfigs();
  const paths: Record<string, string> = {};
  for (const [type, config] of Object.entries(configs)) {
    paths[type] = path.join(MARKETING_CONTENT_PATH, config.directory);
  }
  return paths;
}

export const CONTENT_PATHS = buildContentPaths();

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
  const configs = getAllConfigs();
  const files: ContentFile[] = [];
  for (const [type, config] of Object.entries(configs)) {
    files.push(...loadContentDirectory(
      path.join(MARKETING_CONTENT_PATH, config.directory),
      type as ContentFile["type"]
    ));
  }
  return files;
}

export function getContentByType(type: ContentFile["type"]): ContentFile[] {
  const dirPath = CONTENT_PATHS[type];
  if (!dirPath) return [];
  return loadContentDirectory(dirPath, type);
}
