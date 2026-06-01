/**
 * FormState — registry of form sections found across content YAMLs.
 *
 * Local file at marketing-content/.form-state.json, synced to GCS
 * at sync/form-state.json on every write (production only).
 *
 * Follows the same pattern as server/user-store.ts.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { gcs } from "./gcs";

const LOCAL_PATH = path.join(
  process.cwd(),
  "marketing-content",
  ".form-state.json"
);
const GCS_KEY = "sync/form-state.json";
const CONTENT_DIR = path.join(process.cwd(), "marketing-content");
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export interface FormStateEntry {
  file: string;
  content_type: string;
  slug: string;
  locale: string;
  section_id: string;
  section_type: string;
  conversion_name: string;
  tags?: string[];
  variant?: string;
}

interface FormState {
  forms: FormStateEntry[];
  conversion_names: Record<string, string[]>;
  last_built: string;
}

let state: FormState = {
  forms: [],
  conversion_names: {},
  last_built: new Date().toISOString(),
};

// ─── Persistence ────────────────────────────────────────────────────────────

function saveLocal(): void {
  try {
    const dir = path.dirname(LOCAL_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("[FormState] Error saving local file:", err);
  }
}

async function saveToBucket(): Promise<void> {
  if (!IS_PRODUCTION || !gcs.available) return;
  try {
    const content = JSON.stringify(state, null, 2);
    gcs.debouncedUpload(GCS_KEY, Buffer.from(content, "utf-8"), "application/json");
  } catch (err) {
    console.error("[FormState] Error saving to GCS:", err);
  }
}

function save(): void {
  saveLocal();
  saveToBucket().catch((err) => {
    console.error("[FormState] Background GCS save failed:", err);
  });
}

// ─── YAML scanning ───────────────────────────────────────────────────────────

/** Walk every non-hidden .yml file under marketing-content/ */
function collectYmlFiles(dir: string, result: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectYmlFiles(fullPath, result);
    } else if (entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))) {
      result.push(fullPath);
    }
  }
  return result;
}

/**
 * Parse a relative file path into content_type / slug / locale components.
 * Relative path format: <content_type>/<slug>/<locale>.yml  (or _common.yml)
 */
function parseRelativePath(relPath: string): {
  content_type: string;
  slug: string;
  locale: string;
} | null {
  const parts = relPath.split("/");
  if (parts.length < 3) return null;
  const content_type = parts[0];
  const slug = parts[1];
  const filename = parts[parts.length - 1];
  const locale = filename.replace(/\.(yml|yaml)$/, "");
  return { content_type, slug, locale };
}

/** Recursively search an object for `form` blocks containing `conversion_name`. */
function extractFormBlocks(
  obj: unknown,
  sectionId: string,
  sectionType: string,
  variant: string | undefined,
  results: Array<{
    conversion_name: string;
    tags: string[];
    variant?: string;
  }>
): void {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) extractFormBlocks(item, sectionId, sectionType, variant, results);
    return;
  }

  const record = obj as Record<string, unknown>;

  // If this object is a form block with conversion_name
  if (typeof record.conversion_name === "string") {
    results.push({
      conversion_name: record.conversion_name,
      tags: Array.isArray(record.tags)
        ? (record.tags as string[]).filter((t) => typeof t === "string")
        : [],
      variant,
    });
    return;
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "form" && value && typeof value === "object" && !Array.isArray(value)) {
      const formObj = value as Record<string, unknown>;
      if (typeof formObj.conversion_name === "string") {
        results.push({
          conversion_name: formObj.conversion_name,
          tags: Array.isArray(formObj.tags)
            ? (formObj.tags as string[]).filter((t) => typeof t === "string")
            : [],
          variant,
        });
      }
    } else {
      extractFormBlocks(value, sectionId, sectionType, variant, results);
    }
  }
}

/** Scan a single YAML file and return all FormStateEntries found in it. */
function scanFile(absPath: string): FormStateEntry[] {
  const relPath = path.relative(CONTENT_DIR, absPath);
  const parsed = parseRelativePath(relPath);
  if (!parsed) return [];

  let doc: unknown;
  try {
    const raw = fs.readFileSync(absPath, "utf-8");
    doc = yaml.load(raw);
  } catch {
    return [];
  }

  if (!doc || typeof doc !== "object") return [];

  const record = doc as Record<string, unknown>;
  const sections = record.sections;
  if (!Array.isArray(sections)) return [];

  const entries: FormStateEntry[] = [];

  for (const section of sections) {
    if (!section || typeof section !== "object" || Array.isArray(section)) continue;
    const sec = section as Record<string, unknown>;
    const section_id = typeof sec.id === "string" ? sec.id : "";
    const section_type = typeof sec.type === "string" ? sec.type : "";
    const variant = typeof sec.variant === "string" ? sec.variant : undefined;

    const formBlocks: Array<{ conversion_name: string; tags: string[]; variant?: string }> = [];
    extractFormBlocks(sec, section_id, section_type, variant, formBlocks);

    for (const block of formBlocks) {
      entries.push({
        file: relPath,
        content_type: parsed.content_type,
        slug: parsed.slug,
        locale: parsed.locale,
        section_id,
        section_type,
        conversion_name: block.conversion_name,
        ...(block.tags.length > 0 ? { tags: block.tags } : {}),
        ...(block.variant !== undefined ? { variant: block.variant } : {}),
      });
    }
  }

  return entries;
}

/** Rebuild conversion_names index from the forms array. */
function rebuildIndex(): void {
  const index: Record<string, string[]> = {};
  for (const entry of state.forms) {
    if (!index[entry.conversion_name]) index[entry.conversion_name] = [];
    if (!index[entry.conversion_name].includes(entry.file)) {
      index[entry.conversion_name].push(entry.file);
    }
  }
  state.conversion_names = index;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Full rebuild by scanning all .yml files under marketing-content/. */
export function buildFormState(): void {
  const allFiles = collectYmlFiles(CONTENT_DIR);
  const forms: FormStateEntry[] = [];

  for (const absPath of allFiles) {
    const entries = scanFile(absPath);
    forms.push(...entries);
  }

  state = {
    forms,
    conversion_names: {},
    last_built: new Date().toISOString(),
  };
  rebuildIndex();
  save();

  console.log(`[FormState] Built: ${forms.length} form entry(ies) across ${Object.keys(state.conversion_names).length} conversion name(s)`);
}

/**
 * Incremental update: removes all existing entries for the given file,
 * re-scans just that file, and saves.
 */
export function updateFormStateForFile(relPath: string): void {
  if (!relPath.startsWith("marketing-content/")) return;

  const fileRelToContent = relPath.slice("marketing-content/".length);
  const absPath = path.join(CONTENT_DIR, fileRelToContent);

  // Remove existing entries for this file
  state.forms = state.forms.filter((e) => e.file !== fileRelToContent);

  // Re-scan if file still exists
  if (fs.existsSync(absPath)) {
    const newEntries = scanFile(absPath);
    state.forms.push(...newEntries);
  }

  rebuildIndex();
  save();
}

/**
 * Startup: in production + GCS, download the cached copy first, then rebuild
 * from YAMLs. In dev or without GCS, just rebuild.
 */
export async function loadFormStateFromBucket(): Promise<void> {
  if (IS_PRODUCTION && gcs.available) {
    try {
      const exists = await gcs.exists(GCS_KEY);
      if (exists) {
        const data = await gcs.download(GCS_KEY);
        if (data) {
          state = JSON.parse(data.toString("utf-8")) as FormState;
          saveLocal();
          console.log("[FormState] Loaded cached form state from GCS");
        }
      }
    } catch (err) {
      console.error("[FormState] Error loading from GCS — will rebuild:", err);
    }
  }

  // Always rebuild from YAMLs to ensure accuracy
  buildFormState();
}

/** Returns all form entries matching a conversion name. */
export function getConversionNameUsages(name: string): FormStateEntry[] {
  return state.forms.filter((e) => e.conversion_name === name);
}

/**
 * Bulk-replace every occurrence of `oldName` with `newName` in all scanned
 * YAML files, then refresh the in-memory form-state cache.
 * Returns the number of files that were modified.
 */
export function bulkReplaceConversionName(oldName: string, newName: string): number {
  const allFiles = collectYmlFiles(CONTENT_DIR);
  let count = 0;

  for (const absPath of allFiles) {
    let raw: string;
    try {
      raw = fs.readFileSync(absPath, "utf-8");
    } catch {
      continue;
    }

    const lines = raw.split("\n");
    let changed = false;
    const updatedLines = lines.map((line) => {
      const trimmed = line.trimStart();
      if (!trimmed.startsWith("conversion_name:")) return line;
      const rest = trimmed.slice("conversion_name:".length).trim();
      const unquoted = rest.replace(/^['"]|['"]$/g, "");
      if (unquoted !== oldName) return line;
      const indent = line.slice(0, line.length - trimmed.length);
      changed = true;
      return `${indent}conversion_name: ${newName}`;
    });

    if (changed) {
      fs.writeFileSync(absPath, updatedLines.join("\n"), "utf-8");
      count++;
    }
  }

  for (const entry of state.forms) {
    if (entry.conversion_name === oldName) {
      entry.conversion_name = newName;
    }
  }
  rebuildIndex();
  save();

  return count;
}
