/*
 * @tool
 * {
 *   "name": "get_pricing",
 *   "description": "Fetch pricing and financing information for a program",
 *   "parameters": {
 *     "type": "object",
 *     "properties": {
 *       "program_slug": { "type": "string", "description": "The program slug" },
 *       "locale": { "type": "string", "description": "Language code", "default": "en" }
 *     },
 *     "required": ["program_slug"]
 *   }
 * }
 */

import { contentCompiler } from "../ContentCompiler";

export const schema = {
  name: "get_pricing",
  description: "Fetch pricing and financing information for a program",
  parameters: {
    type: "object",
    properties: {
      program_slug: { type: "string", description: "The program slug" },
      locale: { type: "string", description: "Language code", default: "en" },
    },
    required: ["program_slug"],
  },
};

export default function handler(args: Record<string, string>): string {
  const locale = args.locale || "en";
  if (!args.program_slug) return "Error: program_slug is required";

  const ctx = contentCompiler.compilePageContext("program", args.program_slug, locale);
  const pricingLines = ctx.split("\n").filter(l =>
    l.toLowerCase().includes("price") ||
    l.toLowerCase().includes("pricing") ||
    l.toLowerCase().includes("cost") ||
    l.toLowerCase().includes("financ") ||
    l.toLowerCase().includes("payment") ||
    l.toLowerCase().includes("scholarship")
  );

  return pricingLines.length > 0 ? pricingLines.join("\n") : ctx;
}
