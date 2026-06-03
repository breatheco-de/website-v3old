/**
 * Consent Legacy Keys Validator
 *
 * Flags any YAML file under `marketing-content/` that contains `marketing_text:`
 * or `sms_text:` under a `consent:` key.
 *
 * These keys are obsolete — the lead form always resolves consent text through
 * `reserved.consent_general` / `reserved.consent_sms` and silently ignores
 * per-entry overrides. Re-introducing them would confuse editors and create
 * dead configuration.
 *
 * To fix: remove the `marketing_text:` / `sms_text:` lines from the affected
 * `consent:` block, or run:
 *   npx tsx scripts/admin/remove-consent-legacy-keys.ts --write
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import type { Validator, ValidatorResult, ValidationContext, ValidationIssue } from "../shared/types";

const MARKETING_CONTENT_DIR = path.join(process.cwd(), "marketing-content");

const OBSOLETE_KEYS = ["marketing_text", "sms_text"] as const;

function walkYamlFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkYamlFiles(fullPath));
    } else if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Recursively walks an arbitrary parsed YAML value, collecting the path to
 * every `consent` object that contains `marketing_text` or `sms_text`.
 */
function findObsoleteConsentKeys(
  value: unknown,
  breadcrumb: string,
  hits: Array<{ breadcrumb: string; keys: string[] }>
): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (Array.isArray(value)) {
      value.forEach((item, idx) =>
        findObsoleteConsentKeys(item, `${breadcrumb}[${idx}]`, hits)
      );
    }
    return;
  }

  const obj = value as Record<string, unknown>;

  // Check if this object is a `consent` block with obsolete keys
  // (caller will have labelled the breadcrumb already — we just need to check
  //  direct children)
  if (breadcrumb.endsWith(".consent") || breadcrumb === "consent") {
    const found = OBSOLETE_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(obj, k));
    if (found.length > 0) {
      hits.push({ breadcrumb, keys: found });
    }
  }

  // Recurse into all children regardless
  for (const [key, child] of Object.entries(obj)) {
    const childPath = breadcrumb ? `${breadcrumb}.${key}` : key;
    findObsoleteConsentKeys(child, childPath, hits);
  }
}

export const consentLegacyKeysValidator: Validator = {
  name: "consent-legacy-keys",
  description: "Flags obsolete marketing_text / sms_text keys inside consent: blocks",
  apiExposed: true,
  estimatedDuration: "fast",
  category: "forms",

  async run(_context: ValidationContext): Promise<ValidatorResult> {
    const startTime = Date.now();
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    const yamlFiles = walkYamlFiles(MARKETING_CONTENT_DIR);

    for (const filePath of yamlFiles) {
      let parsed: unknown;
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        parsed = yaml.load(raw);
      } catch {
        continue;
      }

      if (!parsed || typeof parsed !== "object") continue;

      const hits: Array<{ breadcrumb: string; keys: string[] }> = [];
      findObsoleteConsentKeys(parsed, "", hits);

      if (hits.length === 0) continue;

      const relativePath = path.relative(process.cwd(), filePath);

      for (const hit of hits) {
        const keyList = hit.keys.map((k) => `\`${k}:\``).join(" and ");
        errors.push({
          type: "error",
          code: "CONSENT_OBSOLETE_KEY",
          message:
            `Obsolete consent key(s) ${keyList} found at ${hit.breadcrumb || "(root)"} in ${relativePath}. ` +
            `These keys are silently ignored — the lead form always falls back to ` +
            `\`reserved.consent_general\` / \`reserved.consent_sms\`. Remove them.`,
          file: relativePath,
          suggestion:
            "Remove the obsolete key(s) from the consent: block, or run: " +
            "npx tsx scripts/admin/remove-consent-legacy-keys.ts --write",
          fix: {
            type: "script",
            label: "Remove obsolete consent keys",
            command: "npx tsx scripts/admin/remove-consent-legacy-keys.ts --write",
          },
        });
      }
    }

    return {
      name: this.name,
      description: this.description,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      warnings,
      duration: Date.now() - startTime,
    };
  },
};
