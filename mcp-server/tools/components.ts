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

  // commit_changes
  mcp.tool(
    "commit_changes",
    "Commit all pending local content changes to GitHub. Call this after making edits with update_field, add_section, remove_section, or reorder_sections to persist them to the repository. Requires GitHub to be configured on the main server (GITHUB_TOKEN, GITHUB_REPO, and GITHUB_BRANCH environment variables).",
    {
      message: z.string().optional().describe("Commit message. Defaults to 'Content update via MCP' if omitted."),
      author: z.string().optional().describe("Author name to prepend to the commit message, e.g. 'Claude'. Omit to use the default committer."),
    },
    async ({ message, author }) => {
      const commitMessage = message?.trim() || "Content update via MCP";
      const mainServerPort = process.env.PORT || "5000";
      const url = `http://localhost:${mainServerPort}/api/github/commit`;

      let responseBody: { success?: boolean; commitHash?: string; error?: string };
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: commitMessage,
            ...(author?.trim() ? { author: author.trim() } : {}),
          }),
        });
        const rawText = await res.text();
        try {
          responseBody = JSON.parse(rawText) as typeof responseBody;
        } catch {
          return { content: [{ type: "text", text: `Commit failed: server returned non-JSON response (HTTP ${res.status}): ${rawText.slice(0, 200)}` }], isError: true };
        }
        if (!res.ok) {
          const errMsg = responseBody?.error || `HTTP ${res.status}`;
          return { content: [{ type: "text", text: `Commit failed: ${errMsg}` }], isError: true };
        }
      } catch (err) {
        return { content: [{ type: "text", text: `Failed to reach main server at ${url}: ${(err as Error).message}` }], isError: true };
      }

      if (responseBody!.success) {
        const hashNote = responseBody!.commitHash ? ` (${responseBody!.commitHash.slice(0, 7)})` : "";
        return { content: [{ type: "text", text: `Changes committed to GitHub successfully${hashNote}.` }] };
      }

      return { content: [{ type: "text", text: `Commit failed: ${responseBody!.error ?? "Unknown error"}` }], isError: true };
    }
  );
}
