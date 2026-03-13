/*
 * @tool
 * {
 *   "name": "get_program_details",
 *   "description": "Fetch full details for a specific program by slug",
 *   "parameters": {
 *     "type": "object",
 *     "properties": {
 *       "slug": { "type": "string", "description": "The program slug (e.g. 'full-stack', 'data-science')" },
 *       "locale": { "type": "string", "description": "Language code (en or es)", "default": "en" }
 *     },
 *     "required": ["slug"]
 *   }
 * }
 */

import { contentCompiler } from "../ContentCompiler";

export const schema = {
  name: "get_program_details",
  description: "Fetch full details for a specific program by slug",
  parameters: {
    type: "object",
    properties: {
      slug: { type: "string", description: "The program slug (e.g. 'full-stack', 'data-science')" },
      locale: { type: "string", description: "Language code (en or es)", default: "en" },
    },
    required: ["slug"],
  },
};

export default function handler(args: Record<string, string>): string {
  const locale = args.locale || "en";
  if (!args.slug) return "Error: slug is required";
  return contentCompiler.compilePageContext("program", args.slug, locale);
}
