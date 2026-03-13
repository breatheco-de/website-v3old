/*
 * @tool
 * {
 *   "name": "get_faqs",
 *   "description": "Fetch FAQ entries, optionally filtered by program",
 *   "parameters": {
 *     "type": "object",
 *     "properties": {
 *       "program_slug": { "type": "string", "description": "Optional program slug to filter FAQs" },
 *       "locale": { "type": "string", "description": "Language code", "default": "en" }
 *     },
 *     "required": []
 *   }
 * }
 */

import { contentCompiler } from "../ContentCompiler";

export const schema = {
  name: "get_faqs",
  description: "Fetch FAQ entries, optionally filtered by program",
  parameters: {
    type: "object",
    properties: {
      program_slug: { type: "string", description: "Optional program slug to filter FAQs" },
      locale: { type: "string", description: "Language code", default: "en" },
    },
    required: [],
  },
};

export default function handler(args: Record<string, string>): string {
  const locale = args.locale || "en";
  return contentCompiler.compileFaqContext(args.program_slug, locale);
}
