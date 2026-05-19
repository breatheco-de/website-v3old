import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerPageTools } from "./tools/pages.js";
import { registerComponentTools } from "./tools/components.js";
import {
  registerClient,
  lookupClient,
  generateCode,
  exchangeCode,
  validateToken,
} from "./lib/oauth.js";

const PORT = parseInt(process.env.MCP_PORT || "3001", 10);
const API_KEY = process.env.MCP_API_KEY || "";
const STATIC_CLIENT_ID = process.env.OAUTH_CLIENT_ID || "";
const STATIC_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || "";

if (!API_KEY) {
  console.error(
    "[MCP] FATAL: MCP_API_KEY environment variable is not set. Set it before starting the server.",
  );
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function isValidClient(clientId: string): boolean {
  if (lookupClient(clientId)) return true;
  return !!(STATIC_CLIENT_ID && clientId === STATIC_CLIENT_ID);
}

function isAllowedRedirectUri(clientId: string, redirectUri: string): boolean {
  const registered = lookupClient(clientId);
  if (registered) {
    return registered.redirectUris.includes(redirectUri);
  }
  return true;
}

// ─── MCP server factory ───────────────────────────────────────────────────────

function createMcpServer(): McpServer {
  const mcp = new McpServer({ name: "content-pages", version: "1.0.0" });
  registerPageTools(mcp);
  registerComponentTools(mcp);
  return mcp;
}

// ─── Express server ───────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
  const authHeader = req.headers["authorization"] || "";
  const bearerToken =
    typeof authHeader === "string" ? authHeader.replace(/^Bearer\s+/i, "") : "";

  if (bearerToken && validateToken(bearerToken)) {
    next();
    return;
  }

  const candidate = apiKeyHeader || bearerToken;
  if (candidate && candidate === API_KEY) {
    next();
    return;
  }

  res.status(401).json({
    error:
      "Unauthorized. Provide MCP_API_KEY via X-Api-Key header or Bearer token.",
  });
}

// ─── Health ───────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "content-pages-mcp", version: "1.0.0" });
});

// ─── OAuth 2.0 endpoints ──────────────────────────────────────────────────────

app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  const replitDomain = process.env.REPLIT_DEV_DOMAIN;
  const base =
    process.env.PUBLIC_URL ||
    (replitDomain ? `https://${replitDomain}` : `http://localhost:${PORT}`);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
  });
});

app.post("/oauth/register", (req, res) => {
  const body = req.body as {
    client_name?: string;
    redirect_uris?: string[];
    [key: string]: unknown;
  };

  const redirectUris: string[] = Array.isArray(body.redirect_uris)
    ? body.redirect_uris
    : [];
  if (redirectUris.length === 0) {
    res.status(400).json({
      error: "invalid_client_metadata",
      error_description: "redirect_uris is required",
    });
    return;
  }

  for (const uri of redirectUris) {
    try {
      new URL(uri);
    } catch {
      res.status(400).json({
        error: "invalid_client_metadata",
        error_description: `Invalid redirect_uri: ${uri}`,
      });
      return;
    }
  }

  const { clientId, clientSecret } = registerClient(
    body.client_name || "Claude.ai",
    redirectUris,
  );

  const replitDomain = process.env.REPLIT_DEV_DOMAIN;
  const base =
    process.env.PUBLIC_URL ||
    (replitDomain ? `https://${replitDomain}` : `http://localhost:${PORT}`);
  res.status(201).json({
    client_id: clientId,
    client_secret: clientSecret,
    client_name: body.client_name || "Claude.ai",
    redirect_uris: redirectUris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "client_secret_post",
    registration_client_uri: `${base}/oauth/register/${clientId}`,
  });
});

app.get("/oauth/authorize", (req, res) => {
  const { client_id, redirect_uri, response_type, state } = req.query as Record<
    string,
    string
  >;

  if (response_type !== "code") {
    res.status(400).json({ error: "unsupported_response_type" });
    return;
  }
  if (!client_id || !isValidClient(client_id)) {
    res.status(400).json({ error: `invalid_client: ${client_id}` });
    return;
  }
  if (!redirect_uri) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "redirect_uri is required",
    });
    return;
  }
  if (!isAllowedRedirectUri(client_id, redirect_uri)) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "redirect_uri not registered for this client",
    });
    return;
  }

  const stateField = state
    ? `<input type="hidden" name="state" value="${escapeHtml(state)}">`
    : "";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize Claude.ai</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
    p { color: #555; margin-bottom: 1.5rem; }
    .card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 1.5rem; background: #fafafa; }
    button { background: #5046e5; color: #fff; border: none; border-radius: 6px; padding: 0.6rem 1.4rem; font-size: 1rem; cursor: pointer; }
    button:hover { background: #3d35c4; }
    .cancel { margin-left: 1rem; color: #888; font-size: 0.9rem; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Allow Claude.ai to connect</h1>
    <p>Claude.ai is requesting access to your content site via the MCP server. Click <strong>Allow</strong> to grant access.</p>
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(client_id)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri)}">
      <input type="hidden" name="response_type" value="code">
      ${stateField}
      <button type="submit">Allow</button>
      <a class="cancel" href="${escapeHtml(redirect_uri)}?error=access_denied">Cancel</a>
    </form>
  </div>
</body>
</html>`);
});

app.post("/oauth/authorize", (req, res) => {
  const { client_id, redirect_uri, state } = req.body as Record<string, string>;

  if (!client_id || !isValidClient(client_id)) {
    res.status(400).json({ error: `invalid_client: ${client_id}` });
    return;
  }
  if (!redirect_uri) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "redirect_uri is required",
    });
    return;
  }
  if (!isAllowedRedirectUri(client_id, redirect_uri)) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "redirect_uri not registered for this client",
    });
    return;
  }

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(redirect_uri);
  } catch {
    res.status(400).json({
      error: "invalid_request",
      error_description: "redirect_uri is not a valid URL",
    });
    return;
  }

  const code = generateCode(client_id, redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  res.redirect(redirectUrl.toString());
});

app.post("/oauth/token", (req, res) => {
  const { grant_type, client_id, client_secret, code, redirect_uri } =
    req.body as Record<string, string>;

  if (grant_type !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }
  if (!client_id || !client_secret || !code || !redirect_uri) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }

  const token = exchangeCode(
    code,
    client_id,
    client_secret,
    redirect_uri,
    STATIC_CLIENT_ID,
    STATIC_CLIENT_SECRET,
  );
  if (!token) {
    res.status(400).json({ error: "invalid_grant" });
    return;
  }

  res.json({ access_token: token, token_type: "bearer" });
});

// ─── MCP endpoint ─────────────────────────────────────────────────────────────

app.all("/mcp", authMiddleware, async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const mcp = createMcpServer();
  try {
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("finish", () => mcp.close());
  } catch (err) {
    console.error("[MCP] Request error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[MCP] Content-pages MCP server running on port ${PORT}`);
  console.log(`[MCP] Endpoint: http://0.0.0.0:${PORT}/mcp`);
  console.log(
    `[MCP] Auth: API key required (X-Api-Key header) or OAuth 2.0 Bearer token`,
  );
  console.log(`[MCP] OAuth: http://0.0.0.0:${PORT}/oauth/authorize`);
  console.log(
    `[MCP] OAuth registration: http://0.0.0.0:${PORT}/oauth/register`,
  );
  console.log(`[MCP] Health: http://0.0.0.0:${PORT}/health`);
});
