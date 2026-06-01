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
