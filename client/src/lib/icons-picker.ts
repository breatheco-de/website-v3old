/**
 * Full Lucide catalog for the CMS icon picker (editor-only).
 * Uses lucide-react/dynamicIconImports keys — no import * from lucide-react.
 */
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { CUSTOM_ICON_NAMES, kebabToPascal, pascalToKebab } from "@/lib/icons";

let cachedLucideIconSlugs: string[] | null = null;

/**
 * All Lucide icon slugs for the picker (kebab-case).
 */
export function getAllLucideIconSlugs(): string[] {
  if (cachedLucideIconSlugs) return cachedLucideIconSlugs;
  cachedLucideIconSlugs = Object.keys(dynamicIconImports).sort();
  return cachedLucideIconSlugs;
}

/** @deprecated Use getAllLucideIconSlugs — legacy name from Tabler migration. */
export function getAllTablerIconNames(): string[] {
  return getAllLucideIconSlugs();
}

/**
 * Custom icons first (PascalCase), then all Lucide slugs (kebab-case).
 */
export function getAllIconNames(): string[] {
  return [...CUSTOM_ICON_NAMES, ...getAllLucideIconSlugs()];
}

export function getIconDisplayName(name: string): string {
  if (name.startsWith("Icon")) {
    return name.slice(4);
  }
  if (name.includes("-")) {
    return name;
  }
  return pascalToKebab(name);
}

export function iconMatchesSearch(iconName: string, searchLower: string): boolean {
  if (!searchLower) return true;
  const slug = iconName.includes("-") ? iconName : pascalToKebab(iconName);
  const pascal = iconName.includes("-") ? kebabToPascal(iconName) : iconName;
  return (
    iconName.toLowerCase().includes(searchLower) ||
    slug.includes(searchLower) ||
    pascal.toLowerCase().includes(searchLower)
  );
}
