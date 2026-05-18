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

## Auth

All endpoints are protected by an API key when `MCP_API_KEY` is set. Pass it via:
- `X-Api-Key: <key>` header, or
- `Authorization: Bearer <key>` header

If `MCP_API_KEY` is not set the server runs without auth (development only).

## Running locally

The MCP server starts automatically alongside the main app via the **MCP Server** workflow. It listens on port `3001` by default (configurable via `MCP_PORT`).

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `MCP_API_KEY` | _(none)_ | API key for auth. Set this before connecting any client. |
| `MCP_PORT` | `3001` | Port the MCP server listens on. |

Set `MCP_API_KEY` in the Replit Secrets tab (or `.env` locally).

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

## Connect via claude.com (custom connector)

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

## Health check

```
GET /health
```

Returns `{"status":"ok","server":"content-pages-mcp","version":"1.0.0"}`.
