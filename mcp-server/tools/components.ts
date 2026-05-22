import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  COMPONENT_REGISTRY_PATH,
  listComponents,
  getComponentSchema,
  getComponentVariant,
} from "../lib/content.js";
import { assertSafeSegment, assertWithinBase } from "../lib/sanitize.js";

export function registerComponentTools(mcp: McpServer, _mcpToken?: string): void {
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
    "Get the top-level schema info for a component: name, description, when_to_use, and the list of variants (each with name, description, best_for). Use this to understand which variant fits your use case. Call get_component_variant next to get the field definitions and a worked YAML example for your chosen variant.",
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
      const schema = getComponentSchema(componentType);
      if (!schema) {
        return { content: [{ type: "text", text: `Component '${componentType}' not found in registry.` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify({ componentType, ...schema }, null, 2) }] };
    }
  );

  // get_component_variant
  mcp.tool(
    "get_component_variant",
    "Get the field definitions (variant_props) and a worked YAML example for a specific component variant. Call get_component_schema first to see the available variants, then call this tool with your chosen variant to get everything you need to write the YAML.",
    {
      componentType: z.string().describe("Component type name, e.g. 'hero', 'faq', 'two_column'"),
      variant: z.string().describe("Variant name as listed by get_component_schema, e.g. 'singleColumn', 'showcase'"),
    },
    async ({ componentType, variant }) => {
      try {
        assertSafeSegment(componentType, "componentType");
        assertSafeSegment(variant, "variant");
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const componentPath = path.join(COMPONENT_REGISTRY_PATH, componentType);
      try { assertWithinBase(componentPath, COMPONENT_REGISTRY_PATH); } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
      const detail = getComponentVariant(componentType, variant);
      if (!detail) {
        return { content: [{ type: "text", text: `Variant '${variant}' not found for component '${componentType}'.` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(detail, null, 2) }] };
    }
  );

}
