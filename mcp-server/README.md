# Content & Pages MCP Server

An MCP (Model Context Protocol) server that gives Claude read and write access to the platform's YAML-driven content pages. Works with both **Claude Desktop** (via a local URL) and **claude.com** (as a deployed custom connector).

## Tools

| Tool | Description |
|---|---|
| `list_pages` | List all YAML-driven pages with slug, content type, locales, and title |
| `get_page` | Get the full merged content of a page (sections, meta, title) |
| `update_field` | Patch a single field using dot-notation path |
| `add_section` | Insert a new section at a given index (or append) |
| `remove_section` | Remove a section by index |
| `reorder_sections` | Reorder sections by supplying a new index order |
| `list_components` | List all available section component types with versions and variants |
| `get_component_schema` | Get the field schema and worked YAML examples for a component |
| `commit_changes` | Commit all pending content edits to GitHub with an optional message |

## Auth

All `/mcp` requests require an API key. **`MCP_API_KEY` must be set** — the server will refuse to start without it. Pass the key via:
- `X-Api-Key: <key>` header, or
- `Authorization: Bearer <key>` header

The `/health` endpoint is open without auth.

## Running locally

The MCP server starts automatically alongside the main app via the **MCP Server** workflow. It listens on port `3001` by default (configurable via `MCP_PORT`).

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `MCP_API_KEY` | _(none)_ | API key for auth. Required — server exits without it. |
| `MCP_PORT` | `3001` | Port the MCP server listens on. |
| `OAUTH_CLIENT_ID` | _(none)_ | OAuth 2.0 Client ID for the Claude.ai connector flow. |
| `OAUTH_CLIENT_SECRET` | _(none)_ | OAuth 2.0 Client Secret for the Claude.ai connector flow. |
| `PUBLIC_URL` | `http://localhost:<port>` | Public base URL used in OAuth metadata. Set this to the deployed URL (e.g. `https://your-project.replit.app`). |

Set all secrets in the Replit **Secrets** tab (or `.env` locally).

## GitHub setup (for `commit_changes`)

The `commit_changes` tool delegates to the main application server at `/api/github/commit`. For it to succeed, the main server must be configured with a GitHub Personal Access Token (classic or fine-grained) that has **Contents: read & write** permission on the target repository.

Set these environment variables (in the Replit Secrets tab or `.env`):

| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | Personal Access Token with repo write access |
| `GITHUB_REPO` | Repository in `owner/repo` format, e.g. `acme/marketing-site` |
| `GITHUB_BRANCH` | Branch to commit to, e.g. `main` |

If these variables are not set, `commit_changes` will return an error but all other tools will continue to work normally — edits are still saved to local YAML files.

## Connect via Claude Desktop

Add this to your `claude_desktop_config.json` (usually at `~/Library/Application Support/Claude/claude_desktop_config.json` on Mac):

```json
{
  "mcpServers": {
    "content-pages": {
      "type": "http",
      "url": "http://localhost:3001/mcp",
      "headers": {
        "X-Api-Key": "YOUR_MCP_API_KEY"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

## Connect via Claude.ai (OAuth 2.0)

Claude.ai's custom connector UI only accepts OAuth 2.0 credentials — it has no field for a raw API key header. Follow these steps to connect:

### 1. Set OAuth secrets

In the Replit **Secrets** tab, add two new secrets:

| Secret | Value |
|---|---|
| `OAUTH_CLIENT_ID` | Any string you invent, e.g. `claude-connector` |
| `OAUTH_CLIENT_SECRET` | A strong random secret, e.g. from `openssl rand -hex 32` |

The MCP server will print a warning at startup if these are not set, but it will still serve `X-Api-Key` requests normally.

### 2. Deploy the project

Anthropic's cloud must be able to reach your server from the internet. Deploy the Replit project so it gets a public URL (e.g. `https://your-project.replit.app`).

### 3. Add the connector in Claude.ai

1. Go to **Claude.ai → Settings → Connectors** and click **+**.
2. Enter the **Connector URL**: `https://your-project.replit.app/mcp`
3. When prompted for OAuth credentials enter:
   - **Client ID**: the value you set for `OAUTH_CLIENT_ID`
   - **Client Secret**: the value you set for `OAUTH_CLIENT_SECRET`
4. Claude.ai will redirect your browser to the MCP server's consent page.
5. Click **Allow** on the consent page.
6. You are redirected back to Claude.ai and the connector is now active.

The connector is now available in conversations via the **+** button.

> **Note**: Access tokens are long-lived and stored in memory. Restarting the MCP server will invalidate all existing tokens — repeat the OAuth flow to reconnect.

## Connect via claude.com (API key header — legacy)

1. Deploy the Replit project so it gets a public URL (e.g. `https://your-project.replit.app`).
2. In Claude → **Settings → Connectors**, click **+** and enter:
   - **Name**: Content Pages
   - **URL**: `https://your-project.replit.app/mcp`
3. Click **Advanced settings** and add a custom header:
   - `X-Api-Key: YOUR_MCP_API_KEY`
4. Click **Add**. The connector is now available in conversations via the **+** button.

> **Note**: Anthropic's cloud connects to your server from the internet, so the Replit project must be deployed (not just running in dev mode).

## Example workflow for Claude

A typical editing session looks like this:

1. **Discover available components**
   ```
   Call list_components to see what section types exist.
   Call get_component_schema with componentType="faq" to see field requirements and examples.
   ```

2. **Find the right page**
   ```
   Call list_pages to find all available pages.
   Call get_page with contentType="page", slug="home", locale="en" to read its content.
   ```

3. **Make edits**
   ```
   Call add_section to insert a new FAQ section.
   Call update_field to change the page title.
   Call reorder_sections to move the new section earlier.
   ```

4. **Push to GitHub**
   ```
   Call commit_changes with message="Add FAQ section to home page" to commit and push all edits.
   Optionally pass author="Claude" to attribute the change in the commit message.
   ```

## Transport

The server uses the **MCP Streamable HTTP transport** on a single `/mcp` endpoint. This satisfies the "HTTP + SSE" intent from the original design: the client sends a JSON-RPC POST and the server responds either as plain JSON or as a Server-Sent Events stream depending on what the client's `Accept` header requests. Both modes work through the same URL — no separate SSE endpoint is needed.

Clients must include both `application/json` and `text/event-stream` in their `Accept` header, which all MCP-compatible clients do automatically.

## Smoke test (curl)

Use these commands to verify auth and basic read/write behaviour. Replace `$KEY` with your `MCP_API_KEY` value.

```bash
# Health (no auth required)
curl http://localhost:3001/health

# Auth enforcement — should return 401
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# List all pages (read tool)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Api-Key: $KEY" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":2,"params":{"name":"list_pages","arguments":{}}}'

# Get a specific page by slug only (contentType auto-detected)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Api-Key: $KEY" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":3,"params":{"name":"get_page","arguments":{"slug":"home","locale":"en"}}}'

# Update a field (write tool)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Api-Key: $KEY" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":4,"params":{"name":"update_field","arguments":{"slug":"home","locale":"en","field_path":"meta.page_title","value":"My New Title"}}}'

# Commit all pending changes to GitHub
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Api-Key: $KEY" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":5,"params":{"name":"commit_changes","arguments":{"message":"Update home page title","author":"Claude"}}}'
```

## Health check

```
GET /health
```

Returns `{"status":"ok","server":"content-pages-mcp","version":"1.0.0"}`.
