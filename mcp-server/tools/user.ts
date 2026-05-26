import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getTokenUsername } from "../lib/oauth.js";

const MAIN_SERVER_PORT = process.env.PORT || "5000";
const MCP_SERVER_SECRET = process.env.MCP_SERVER_SECRET || process.env.MCP_API_KEY || "";

/**
 * Build internal auth headers for loopback calls to the main server,
 * forwarding the resolved username so the endpoint can look up the user record.
 */
function internalHeaders(username: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (MCP_SERVER_SECRET) {
    headers["Authorization"] = `Bearer ${MCP_SERVER_SECRET}`;
  }
  return headers;
}

export function registerUserTools(mcp: McpServer, mcpToken?: string): void {
  mcp.tool(
    "get_current_user",
    "Return the identity, roles, and effective capabilities of the authenticated MCP caller. " +
      "Useful for agents that need to understand who they are acting as and what operations they are permitted to perform. " +
      "Returns: username, firstName, lastName, email, roles (list of role names), and capabilities (list of effective capability names).",
    {},
    async () => {
      const username = mcpToken ? getTokenUsername(mcpToken) : null;

      try {
        const params = new URLSearchParams();
        if (username) params.set("username", username);
        const url = `http://localhost:${MAIN_SERVER_PORT}/api/auth/user-info?${params}`;
        const res = await fetch(url, {
          headers: internalHeaders(username ?? ""),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "failed_to_fetch_user",
                  status: res.status,
                  detail: body,
                }),
              },
            ],
            isError: true,
          };
        }

        const profile = await res.json();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(profile, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "network_error",
                message: (err as Error).message,
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
