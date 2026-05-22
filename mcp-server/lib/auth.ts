import { getTokenUsername } from "./oauth.js";

const MAIN_SERVER_PORT = process.env.PORT || "5000";
const MCP_API_KEY = process.env.MCP_API_KEY || "";

/**
 * Check whether the user associated with the given MCP bearer token holds the
 * required capability, optionally scoped to a content type.
 *
 * Delegates to the main server's /api/auth/check-capability endpoint so that
 * all authorisation logic remains in one place.
 *
 * Fails closed (returns false) on any network error or when the token cannot
 * be resolved to a username.
 */
export async function checkCap(
  mcpToken: string,
  cap: string,
  contentType?: string,
): Promise<boolean> {
  const username = getTokenUsername(mcpToken);
  if (!username) return false;

  try {
    const params = new URLSearchParams({ cap, username });
    if (contentType) params.set("contentType", contentType);
    const url = `http://localhost:${MAIN_SERVER_PORT}/api/auth/check-capability?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${MCP_API_KEY}` },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { allowed?: boolean };
    return data.allowed === true;
  } catch {
    return false;
  }
}

/**
 * Return the standard MCP error shape for a capability denial.
 * Keeps individual tool handlers concise.
 */
export function denyResponse(cap: string, contentType?: string) {
  const scopeMsg = contentType ? ` for content type '${contentType}'` : "";
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: "forbidden",
          message: `Insufficient permissions: capability '${cap}' required${scopeMsg}.`,
        }),
      },
    ],
    isError: true,
  };
}
