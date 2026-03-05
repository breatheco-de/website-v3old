/**
 * LLM Prompt Reporter
 *
 * Formats validation results as a structured prompt intended to be pasted
 * into a local LLM (e.g. Claude, GPT, Ollama) running on the same machine.
 * File paths are absolute so the LLM can read or edit files directly.
 */

import type { ValidationRunResult, ValidatorResult } from "../shared/types";

const SYSTEM_CONTEXT = `You are a content engineer working inside a YAML-based CMS repository.

## Repository context
- Content root: /home/runner/workspace/marketing-content/
- Files use YAML format (.yml)
- Merge chain (each level overrides the parent):
    _common.single.yml  →  {slug}/_common.yml  →  {slug}/{locale}.yml
- Editing rule: fix the most specific locale file unless the change should
  apply to all locales, in which case edit _common.yml instead.
- Never modify _common.single.yml unless explicitly instructed.`;

const TASK_INSTRUCTION = `## Your task
For every error listed above:
1. Open the file at the exact path shown.
2. Provide the minimal YAML edit that resolves the issue.
3. Show the changed lines with 3–5 lines of surrounding context so the
   location is unambiguous (use a unified-diff style or "before / after" blocks).
4. Do not change anything that is not listed as an error or warning.
5. After all edits, briefly explain why each change fixes the issue.`;

function formatIssues(
  issues: ValidatorResult["errors"],
  label: "Error" | "Warning",
  fixLabel: "Fix" | "Hint",
): string {
  if (issues.length === 0) return "";
  const lines: string[] = [`### ${label}s (${issues.length})`];
  for (const issue of issues) {
    lines.push(`- [${issue.code}] ${issue.message}`);
    if (issue.file) lines.push(`  File: ${issue.file}`);
    if (issue.suggestion) lines.push(`  ${fixLabel}: ${issue.suggestion}`);
  }
  return lines.join("\n");
}

function formatValidatorBlock(v: ValidatorResult): string {
  const blocks: string[] = [
    `## Validator: ${v.name}`,
    v.description,
  ];

  const errorsBlock = formatIssues(v.errors, "Error", "Fix");
  if (errorsBlock) blocks.push(errorsBlock);

  const warningsBlock = formatIssues(v.warnings, "Warning", "Hint");
  if (warningsBlock) blocks.push(warningsBlock);

  return blocks.join("\n\n");
}

export function formatAsLlmPrompt(result: ValidationRunResult): string {
  const failing = result.validators.filter(
    (v) => v.errors.length > 0 || v.warnings.length > 0,
  );

  const totalIssues = failing.reduce(
    (n, v) => n + v.errors.length + v.warnings.length,
    0,
  );

  const sections: string[] = [
    SYSTEM_CONTEXT,
    `## Run summary\n- Validators run: ${result.validators.length}\n- Failed: ${result.summary.failed}\n- Warnings: ${result.summary.warnings}\n- Total issues: ${totalIssues}`,
    ...failing.map(formatValidatorBlock),
    TASK_INSTRUCTION,
  ];

  return sections.join("\n\n---\n\n");
}

export function formatSingleValidatorAsLlmPrompt(v: ValidatorResult): string {
  const totalIssues = v.errors.length + v.warnings.length;

  const sections: string[] = [
    SYSTEM_CONTEXT,
    `## Run summary\n- Validator: ${v.name}\n- Errors: ${v.errors.length}\n- Warnings: ${v.warnings.length}\n- Total issues: ${totalIssues}`,
    formatValidatorBlock(v),
    TASK_INSTRUCTION,
  ];

  return sections.join("\n\n---\n\n");
}
