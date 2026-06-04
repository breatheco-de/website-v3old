import { resolveFormDefaults, type ConversionEventDefaults } from "./resolveFormDefaults";

/**
 * Resolves a form section's effective settings by merging conversion event defaults.
 * Form-level YAML values always win; missing fields fall back to the event definition.
 *
 * Use this as the canonical entry point before rendering or validating any form
 * section — ensures automations, tags, consent, and webhook are consistently derived
 * across the editor UI, live render path, and submission handling.
 *
 * @param section       The raw parsed section object from YAML.
 * @param conversionEvent The matching ConversionEventEntry (or null/undefined).
 * @param formSettingsPath Dot-path to the form settings object within the section (default "form").
 */
export function resolveFormSection(
  section: Record<string, unknown>,
  conversionEvent: ConversionEventDefaults | null | undefined,
  formSettingsPath: string = "form"
): Record<string, unknown> {
  return resolveFormDefaults(section, conversionEvent, formSettingsPath);
}

/**
 * Validates a section's `form` config.
 *
 * Returns null if the section has no `form` key or the config is valid.
 * Returns a human-readable error string if `form.conversion_name` is missing
 * or not one of the provided conversionNames list.
 *
 * When conversionNames is omitted the value check is skipped — only presence
 * of a non-empty conversion_name is enforced.
 */
export function validateFormSection(
  section: Record<string, unknown>,
  conversionNames?: string[]
): string | null {
  if (!("form" in section)) return null;

  const form = section.form as Record<string, unknown> | null | undefined;

  if (!form || typeof form !== "object") {
    return "section.form must be an object with a valid conversion_name";
  }

  // Only validate CMS form components — identified by having a `variant` field
  // (e.g. "stacked", "inline"). Sections that use `form:` for label/config
  // objects (e.g. apply_form, hero signup labels) don't need conversion_name.
  if (!("variant" in form)) return null;

  const conversionName = form.conversion_name;

  if (conversionName === undefined || conversionName === null || conversionName === "") {
    const hint = conversionNames?.length
      ? `Valid values: ${conversionNames.join(", ")}`
      : "Set conversion_name to a valid tracking event name";
    return `section.form.conversion_name is required. ${hint}`;
  }

  if (conversionNames && !conversionNames.includes(conversionName as string)) {
    return `section.form.conversion_name "${conversionName}" is not valid. Valid values: ${conversionNames.join(", ")}`;
  }

  return null;
}
