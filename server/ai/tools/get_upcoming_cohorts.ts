/*
 * @tool
 * {
 *   "name": "get_upcoming_cohorts",
 *   "description": "Fetch upcoming cohort start dates for a program",
 *   "parameters": {
 *     "type": "object",
 *     "properties": {
 *       "program_slug": { "type": "string", "description": "The program slug" }
 *     },
 *     "required": []
 *   }
 * }
 */

import { contentCompiler } from "../ContentCompiler";

export const schema = {
  name: "get_upcoming_cohorts",
  description: "Fetch upcoming cohort start dates for a program",
  parameters: {
    type: "object",
    properties: {
      program_slug: { type: "string", description: "The program slug" },
    },
    required: [],
  },
};

export default function handler(args: Record<string, string>): string {
  const locale = args.locale || "en";
  const programSlug = args.program_slug || args.slug;

  if (programSlug) {
    const ctx = contentCompiler.compilePageContext("program", programSlug, locale);
    const cohortLines = ctx.split("\n").filter(l =>
      l.toLowerCase().includes("cohort") ||
      l.toLowerCase().includes("start date") ||
      l.toLowerCase().includes("upcoming") ||
      l.toLowerCase().includes("next batch") ||
      l.toLowerCase().includes("schedule")
    );
    if (cohortLines.length > 0) return cohortLines.join("\n");
  }

  const globalCtx = contentCompiler.compile(null, null, locale);
  const globalCohortLines = globalCtx.globalSummary.split("\n").filter(l =>
    l.toLowerCase().includes("cohort") ||
    l.toLowerCase().includes("start date") ||
    l.toLowerCase().includes("upcoming")
  );
  if (globalCohortLines.length > 0) return globalCohortLines.join("\n");

  return "For the most up-to-date cohort start dates, please visit the program page or contact admissions directly.";
}
