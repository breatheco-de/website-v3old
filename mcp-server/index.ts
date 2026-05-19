import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerPageTools } from "./tools/pages.js";
import { registerComponentTools } from "./tools/components.js";

const PORT = parseInt(process.env.MCP_PORT || "3001", 10);
const API_KEY = process.env.MCP_API_KEY || "";

if (!API_KEY) {
  console.error("[MCP] FATAL: MCP_API_KEY environment variable is not set. Set it before starting the server.");
  process.exit(1);
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

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const header = req.headers["x-api-key"] || req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (header !== API_KEY) {
    res.status(401).json({ error: "Unauthorized. Provide MCP_API_KEY via X-Api-Key header or Bearer token." });
    return;
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "content-pages-mcp", version: "1.0.0" });
});

app.all("/mcp", authMiddleware, async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[MCP] Content-pages MCP server running on port ${PORT}`);
  console.log(`[MCP] Endpoint: http://0.0.0.0:${PORT}/mcp`);
  console.log(`[MCP] Auth: API key required (X-Api-Key header)`);
  console.log(`[MCP] Health: http://0.0.0.0:${PORT}/health`);
});
