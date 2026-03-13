// Tool registration uses static imports (not runtime fs scanning) because the
// production build (esbuild --bundle) inlines all server code into a single file.
// To add a new tool: create a .ts file with @tool annotation, exported schema,
// and default handler, then add an import + entry to the tools array below.
import type OpenAI from "openai";

import get_program_details, { schema as get_program_details_schema } from "./get_program_details";
import get_location_details, { schema as get_location_details_schema } from "./get_location_details";
import get_upcoming_cohorts, { schema as get_upcoming_cohorts_schema } from "./get_upcoming_cohorts";
import get_faqs, { schema as get_faqs_schema } from "./get_faqs";
import get_pricing, { schema as get_pricing_schema } from "./get_pricing";

interface ToolEntry {
  schema: { name: string; description: string; parameters: Record<string, unknown> };
  handler: (args: Record<string, string>) => string;
}

const tools: ToolEntry[] = [
  { schema: get_program_details_schema, handler: get_program_details },
  { schema: get_location_details_schema, handler: get_location_details },
  { schema: get_upcoming_cohorts_schema, handler: get_upcoming_cohorts },
  { schema: get_faqs_schema, handler: get_faqs },
  { schema: get_pricing_schema, handler: get_pricing },
];

const handlerMap = new Map<string, (args: Record<string, string>) => string>();

export const TOOL_DEFINITIONS: OpenAI.Chat.ChatCompletionTool[] = tools.map(t => {
  handlerMap.set(t.schema.name, t.handler);
  return {
    type: "function" as const,
    function: t.schema,
  };
});

export function executeToolCall(name: string, args: Record<string, string>): string {
  const handler = handlerMap.get(name);
  if (!handler) return `Unknown tool: ${name}`;
  return handler(args);
}
