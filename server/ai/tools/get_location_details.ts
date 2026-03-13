/*
 * @tool
 * {
 *   "name": "get_location_details",
 *   "description": "Fetch details for a specific campus location by slug",
 *   "parameters": {
 *     "type": "object",
 *     "properties": {
 *       "slug": { "type": "string", "description": "The location slug (e.g. 'miami', 'madrid')" },
 *       "locale": { "type": "string", "description": "Language code (en or es)", "default": "en" }
 *     },
 *     "required": ["slug"]
 *   }
 * }
 */

import { contentCompiler } from "../ContentCompiler";

export const schema = {
  name: "get_location_details",
  description: "Fetch details for a specific campus location by slug",
  parameters: {
    type: "object",
    properties: {
      slug: { type: "string", description: "The location slug (e.g. 'miami', 'madrid')" },
      locale: { type: "string", description: "Language code (en or es)", default: "en" },
    },
    required: ["slug"],
  },
};

export default function handler(args: Record<string, string>): string {
  const locale = args.locale || "en";
  if (!args.slug) return "Error: slug is required";
  return contentCompiler.compilePageContext("location", args.slug, locale);
}
