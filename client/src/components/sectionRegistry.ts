import type { ComponentType } from "react";

type SectionLoader = () => Promise<{ default: ComponentType<unknown> }>;

const sectionLoaders = import.meta.glob("./*/variants/*.tsx") as Record<string, SectionLoader>;

function snakeToPascal(str: string): string {
  return str.split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join("");
}

function deriveVariant(type: string, filenameBase: string): string {
  const prefix = snakeToPascal(type);
  const remainder = filenameBase.slice(prefix.length);
  if (!remainder) return "default";
  return remainder.charAt(0).toLowerCase() + remainder.slice(1);
}

export function normalizeSectionVariant(v: string): string {
  return v.replace(/[-_]/g, "").replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** type -> normalizedVariant -> module path (e.g. ./hero/variants/HeroShowcase.tsx) */
const pathIndex: Record<string, Record<string, string>> = {};

for (const filePath of Object.keys(sectionLoaders)) {
  const match = filePath.match(/^\.\/([^/]+)\/variants\/([^/]+)\.tsx$/);
  if (!match) continue;
  const type = match[1];
  const filenameBase = match[2];
  const variantName = normalizeSectionVariant(deriveVariant(type, filenameBase));
  if (!pathIndex[type]) pathIndex[type] = {};
  pathIndex[type][variantName] = filePath;
}

const componentCache = new Map<string, ComponentType<unknown>>();

function cacheKey(type: string, variant: string): string {
  return `${type}::${normalizeSectionVariant(variant)}`;
}

function resolveModulePath(type: string, variant: string): string | undefined {
  const registry = pathIndex[type];
  if (!registry) return undefined;
  const normalized = normalizeSectionVariant(variant);
  return registry[normalized] ?? registry.default;
}

export function getCachedSectionComponent(
  type: string,
  variant: string,
): ComponentType<{ data: unknown }> | null {
  const cached = componentCache.get(cacheKey(type, variant));
  return (cached as ComponentType<{ data: unknown }> | undefined) ?? null;
}

export async function loadSectionComponent(
  type: string,
  variant: string,
): Promise<ComponentType<{ data: unknown }> | null> {
  const key = cacheKey(type, variant ?? "default");
  const existing = componentCache.get(key);
  if (existing) return existing as ComponentType<{ data: unknown }>;

  const modulePath = resolveModulePath(type, variant ?? "default");
  if (!modulePath) return null;

  const loader = sectionLoaders[modulePath];
  if (!loader) return null;

  const mod = await loader();
  if (!mod.default) return null;

  componentCache.set(key, mod.default);
  return mod.default as ComponentType<{ data: unknown }>;
}

export interface SectionRef {
  type: string;
  variant?: string;
}

export function collectSectionsFromData(data: unknown, out: SectionRef[]): void {
  if (!data || typeof data !== "object") return;

  const record = data as Record<string, unknown>;
  if (!Array.isArray(record.sections)) return;

  for (const section of record.sections) {
    if (section && typeof section === "object" && "type" in section) {
      const s = section as { type: string; variant?: string };
      out.push({ type: s.type, variant: s.variant });
    }
  }
}

export type InitialDataPayload =
  | { queries: Array<{ queryKey: unknown[]; data: unknown }>; queryKey?: never; data?: never }
  | { queryKey: unknown[]; data: unknown; queries?: never };

export function extractSectionsFromInitialData(
  payload: InitialDataPayload | null,
): SectionRef[] {
  const sections: SectionRef[] = [];
  if (!payload) return sections;

  if (payload.queries && Array.isArray(payload.queries)) {
    for (const { data } of payload.queries) {
      collectSectionsFromData(data, sections);
    }
  } else if (payload.data !== undefined) {
    collectSectionsFromData(payload.data, sections);
  }

  return sections;
}

export async function preloadSections(sections: SectionRef[]): Promise<void> {
  const seen = new Set<string>();
  const loads: Promise<ComponentType<{ data: unknown }> | null>[] = [];

  for (const { type, variant } of sections) {
    const key = cacheKey(type, variant ?? "default");
    if (seen.has(key)) continue;
    seen.add(key);
    loads.push(loadSectionComponent(type, variant ?? "default"));
  }

  await Promise.all(loads);
}

export async function preloadSectionsFromInitialData(
  payload: InitialDataPayload | null,
): Promise<void> {
  await preloadSections(extractSectionsFromInitialData(payload));
}

export function hasSectionType(type: string): boolean {
  return !!pathIndex[type];
}
