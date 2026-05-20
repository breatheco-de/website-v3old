import * as jsYaml from "js-yaml";

export interface YamlValidationIssue {
  message: string;
}

export interface YamlValidationResult {
  valid: boolean;
  issues: YamlValidationIssue[];
}

export function validateYamlSections(yamlString: string): YamlValidationResult {
  const issues: YamlValidationIssue[] = [];

  let parsed: unknown;
  try {
    parsed = jsYaml.load(yamlString);
  } catch (err) {
    return {
      valid: false,
      issues: [{ message: `YAML parse error: ${err instanceof Error ? err.message : String(err)}` }],
    };
  }

  if (parsed === null || parsed === undefined || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { valid: true, issues: [] };
  }

  const doc = parsed as Record<string, unknown>;

  if (!("sections" in doc)) {
    return { valid: true, issues: [] };
  }

  const sections = doc.sections;

  if (!Array.isArray(sections)) {
    issues.push({ message: "`sections` is not an array — it may have been accidentally indented or merged into a parent item." });
    return { valid: false, issues };
  }

  sections.forEach((item, index) => {
    if (Array.isArray(item)) {
      issues.push({ message: `Section at index ${index} is a nested list, not an object. This usually means a misplaced dash.` });
    } else if (item === null || item === undefined || typeof item !== "object") {
      issues.push({ message: `Section at index ${index} is a ${item === null ? "null" : typeof item} value, not an object.` });
    } else {
      const section = item as Record<string, unknown>;
      if (!section.type || typeof section.type !== "string" || section.type.trim() === "") {
        issues.push({ message: `Section at index ${index} has no \`type\` field.` });
      }
    }
  });

  return { valid: issues.length === 0, issues };
}
