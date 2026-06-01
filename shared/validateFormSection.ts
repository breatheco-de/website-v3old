import { CONVERSION_NAMES } from "../marketing-content/component-registry/_common/schema";

/**
 * Validates a section's `form` config.
 *
 * Returns null if the section has no `form` key or the config is valid.
 * Returns a human-readable error string if `form.conversion_name` is missing
 * or not one of the known CONVERSION_NAMES.
 */
export function validateFormSection(section: Record<string, unknown>): string | null {
  if (!("form" in section)) return null;

  const form = section.form as Record<string, unknown> | null | undefined;

  if (!form || typeof form !== "object") {
    return "section.form must be an object with a valid conversion_name";
  }

  const conversionName = form.conversion_name;

  if (conversionName === undefined || conversionName === null || conversionName === "") {
    return `section.form.conversion_name is required. Valid values: ${CONVERSION_NAMES.join(", ")}`;
  }

  if (!(CONVERSION_NAMES as readonly unknown[]).includes(conversionName)) {
    return `section.form.conversion_name "${conversionName}" is not valid. Valid values: ${CONVERSION_NAMES.join(", ")}`;
  }

  return null;
}
