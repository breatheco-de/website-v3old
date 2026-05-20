import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  COMPONENT_REGISTRY_PATH,
  listComponents,
  getComponentSchema,
} from "../lib/content.js";
import { assertSafeSegment, assertWithinBase } from "../lib/sanitize.js";

export function registerComponentTools(mcp: McpServer): void {
  // list_components
  mcp.tool(
    "list_components",
    "List all available section component types from the component registry, with version and variant options.",
    {},
    async () => {
      const components = listComponents();
      return { content: [{ type: "text", text: JSON.stringify(components, null, 2) }] };
    }
  );

  // get_component_schema
  mcp.tool(
    "get_component_schema",
    "Get the full field schema and worked YAML examples for a specific component type. Use this before adding a section to understand required and optional fields.",
    {
      componentType: z.string().describe("Component type name, e.g. 'faq', 'hero', 'two_column'"),
    },
    async ({ componentType }) => {
      try {
        assertSafeSegment(componentType, "componentType");
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const componentPath = path.join(COMPONENT_REGISTRY_PATH, componentType);
      try { assertWithinBase(componentPath, COMPONENT_REGISTRY_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const { schema, examples } = getComponentSchema(componentType);
      if (!schema) {
        return { content: [{ type: "text", text: `Component '${componentType}' not found in registry.` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify({ componentType, schema, examples }, null, 2) }] };
    }
  );

}
