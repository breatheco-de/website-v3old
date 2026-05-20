# Content & Pages MCP Server

An MCP (Model Context Protocol) server that gives Claude read and write access to the platform's YAML-driven content pages. Works with both **Claude Desktop** (via a local URL) and **claude.com** (as a deployed custom connector).

## Tools

| Tool | Description |
|---|---|
| `list_pages` | List all YAML-driven pages with slug, content type, locales, and title |
| `get_page` | Get the full merged content of a page (sections, meta, title) |
| `update_section_field` | Patch a single section field (or safe top-level field) using dot-notation path |
| `update_section_fields` | Patch multiple section fields in one write |
| `update_meta_field` | Patch a single SEO/meta field, auto-routed to the correct file |
| `update_meta_fields` | Patch multiple SEO/meta fields in one call, auto-routed per field |
| `add_section` | Insert a new section at a given index (or append) |
| `remove_section` | Remove a section by index |
| `reorder_sections` | Reorder sections by supplying a new index order |
| `list_components` | List all available section component types with versions and variants |
| `get_component_schema` | Get the field schema and worked YAML examples for a component |
| `commit_changes` | Commit all pending content edits to GitHub with an optional message |

---

## Tool Reference

### `list_pages`

Lists all YAML-driven content pages.

**Returns:** slug, contentType, locales, title, and `urls` (a per-locale map of resolved paths, e.g. `{ en: '/en/career-programs/ai-engineering' }`) for each page.

**Parameters:** none

---

### `get_page`

Gets the full merged content of a page. Merges `_common.yml` with the locale file.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `slug` | string | yes | Page slug (folder name), e.g. `home` or `full-stack-developer` |
| `locale` | string | no | Locale code (default: `en`), e.g. `en` or `es` |
| `contentType` | string | no | Content type hint (e.g. `page`, `program`). Omit to auto-detect from slug. |

---

### `update_section_field`

Updates a **single** section field (or safe top-level page field) in a page's locale YAML file.

Use this for all **content and section edits**. Do **not** use it for SEO/meta fields — use `update_meta_field` instead.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `slug` | string | yes | Page slug |
| `locale` | string | no | Locale code (default: `en`) |
| `field_path` | string | yes | Dot-notation path. Must start with `sections.` (e.g. `sections.0.title`) or be a safe top-level field: `title` or `slug`. Paths starting with `meta.` are rejected. |
| `value` | any | yes | New value for the field |
| `contentType` | string | no | Content type hint. Omit to auto-detect from slug. |

**Example:**

```json
{
  "name": "update_section_field",
  "arguments": {
    "slug": "home",
    "locale": "en",
    "field_path": "sections.0.title",
    "value": "Learn AI From Day One"
  }
}
```

---

### `update_section_fields`

Updates **multiple** section fields (or safe top-level page fields) in a single write to a page's locale YAML file.

Use this for all **content and section edits** when changing more than one field at once. Do **not** use it for SEO/meta fields — use `update_meta_fields` instead.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `slug` | string | yes | Page slug |
| `locale` | string | no | Locale code (default: `en`) |
| `fields` | object | yes | Map of dot-notation field paths to new values. Every key must start with `sections.` or be `title`/`slug`. |
| `contentType` | string | no | Content type hint. Omit to auto-detect from slug. |

**Example:**

```json
{
  "name": "update_section_fields",
  "arguments": {
    "slug": "home",
    "locale": "en",
    "fields": {
      "sections.0.title": "Learn AI From Day One",
      "sections.0.subtitle": "Join thousands of students worldwide",
      "title": "Home"
    }
  }
}
```

---

### `update_meta_field`

Updates a **single** SEO/meta field on a page. Known fields are **auto-routed** to the correct YAML file — see the routing table below.

For non-standard meta fields not in the known list, use `custom_fields` + `target`.

Do **not** use this for section/content edits — use `update_section_field` instead.

#### Meta field auto-routing

| Field | Written to |
|---|---|
| `page_title` | `{locale}.yml` |
| `description` | `{locale}.yml` |
| `og_image` | `{locale}.yml` |
| `og_type` | `{locale}.yml` |
| `og_url` | `{locale}.yml` |
| `og_locale` | `{locale}.yml` |
| `canonical_url` | `{locale}.yml` |
| `robots` | `_common.yml` |
| `priority` | `_common.yml` |
| `change_frequency` | `_common.yml` |

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `slug` | string | yes | Page slug |
| `locale` | string | no | Locale code (default: `en`) used when writing to a locale file |
| `field` | enum | no* | Known meta field name (see routing table above). Auto-routed to the correct file. Required when not using `custom_fields`. |
| `value` | any | no* | New value for the known `field`. Required when `field` is provided. |
| `custom_fields` | object | no* | Map of non-standard meta field names to values. Cannot contain known field names. Requires `target`. |
| `target` | `"locale"` \| `"common"` | no* | Required when `custom_fields` is provided. `locale` → `{locale}.yml`, `common` → `_common.yml`. |
| `contentType` | string | no | Content type hint. Omit to auto-detect from slug. |

\* Either `field` + `value`, or `custom_fields` + `target`, must be provided.

**Examples:**

Update a known locale field:
```json
{
  "name": "update_meta_field",
  "arguments": {
    "slug": "home",
    "locale": "en",
    "field": "page_title",
    "value": "Learn AI | 4Geeks Academy"
  }
}
```

Update a known common field:
```json
{
  "name": "update_meta_field",
  "arguments": {
    "slug": "home",
    "field": "robots",
    "value": "index, follow"
  }
}
```

Update a non-standard meta field:
```json
{
  "name": "update_meta_field",
  "arguments": {
    "slug": "home",
    "locale": "en",
    "custom_fields": { "twitter_card": "summary_large_image" },
    "target": "locale"
  }
}
```

---

### `update_meta_fields`

Updates **multiple** SEO/meta fields on a page in a single call. Auto-routes each known field to the correct file. May write to both `_common.yml` and a locale file in one call if the fields span both.

For non-standard meta fields not in the known list, use `custom_fields` + `target`.

Do **not** use this for section/content edits — use `update_section_fields` instead.

#### Meta field auto-routing

| Field | Written to |
|---|---|
| `page_title` | `{locale}.yml` |
| `description` | `{locale}.yml` |
| `og_image` | `{locale}.yml` |
| `og_type` | `{locale}.yml` |
| `og_url` | `{locale}.yml` |
| `og_locale` | `{locale}.yml` |
| `canonical_url` | `{locale}.yml` |
| `robots` | `_common.yml` |
| `priority` | `_common.yml` |
| `change_frequency` | `_common.yml` |

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `slug` | string | yes | Page slug |
| `locale` | string | no | Locale code (default: `en`) used when writing to a locale file |
| `fields` | object | no* | Map of **known** meta field names to values. Auto-routed per field. May write to both files in one call. |
| `custom_fields` | object | no* | Map of non-standard meta field names to values. Cannot contain known field names. Requires `target`. |
| `target` | `"locale"` \| `"common"` | no* | Required when `custom_fields` is provided. `locale` → `{locale}.yml`, `common` → `_common.yml`. |
| `contentType` | string | no | Content type hint. Omit to auto-detect from slug. |

\* At least one of `fields` or `custom_fields` must be provided.

**Examples:**

Update multiple known fields (may write to both files automatically):
```json
{
  "name": "update_meta_fields",
  "arguments": {
    "slug": "home",
    "locale": "en",
    "fields": {
      "page_title": "Learn AI | 4Geeks Academy",
      "description": "Join our AI bootcamp and start your tech career.",
      "robots": "index, follow",
      "priority": 0.9
    }
  }
}
```

Known fields + custom fields in one call:
```json
{
  "name": "update_meta_fields",
  "arguments": {
    "slug": "home",
    "locale": "en",
    "fields": {
      "page_title": "Learn AI | 4Geeks Academy",
      "description": "Join our AI bootcamp."
    },
    "custom_fields": { "twitter_card": "summary_large_image" },
    "target": "locale"
  }
}
```

---

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
| `PUBLIC_URL` | auto (`REPLIT_DEV_DOMAIN`) | Public base URL used in OAuth metadata. Automatically resolved from `REPLIT_DEV_DOMAIN` in Replit — only set this manually if deploying outside Replit. |
| `OAUTH_CLIENT_ID` | _(none)_ | Optional static Client ID for the legacy pre-configured OAuth flow. Not needed when using dynamic registration (Claude.ai default). |
| `OAUTH_CLIENT_SECRET` | _(none)_ | Optional static Client Secret for the legacy pre-configured OAuth flow. |

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

Claude.ai uses **dynamic client registration** (RFC 7591) — it registers itself automatically when you add the connector URL. No secrets need to be pre-configured.

### 1. Set the public URL secret

In the Replit **Secrets** tab, add:

| Secret | Value |
|---|---|
| `PUBLIC_URL` | Your deployed URL, e.g. `https://your-project.replit.app` |

This tells the OAuth metadata endpoint what base URL to advertise to Claude.ai.

### 2. Deploy the project

Anthropic's cloud must be able to reach your server from the internet. Deploy the Replit project so it gets a public URL (e.g. `https://your-project.replit.app`).

### 3. Add the connector in Claude.ai

1. Go to **Claude.ai → Settings → Connectors** and click **+**.
2. Enter the **Connector URL**: `https://your-project.replit.app/mcp`
3. Claude.ai will automatically register itself with the server (no credentials to enter).
4. Your browser is redirected to the MCP server's consent page.
5. Click **Allow**.
6. You are redirected back to Claude.ai and the connector is now active.

The connector is now available in conversations via the **+** button.

> **Restart behaviour**: Registered clients are persisted to `mcp-server/data/oauth-clients.json` and survive server restarts. However, access tokens are in-memory only — after a restart, Claude.ai will automatically re-exchange its token on the next request. If that fails, disconnect and re-add the connector to repeat the OAuth flow.

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
   Call get_page with slug="home", locale="en" to read its content.
   ```

3. **Make edits**
   ```
   Call add_section to insert a new FAQ section.
   Call update_section_field to change a section heading:
     { slug: "home", locale: "en", field_path: "sections.2.title", value: "FAQ" }
   Call update_meta_field to update the SEO title:
     { slug: "home", locale: "en", field: "page_title", value: "Home | 4Geeks Academy" }
   Call update_meta_fields to set multiple SEO fields at once:
     { slug: "home", locale: "en", fields: { description: "...", robots: "index, follow" } }
   Call reorder_sections to move the new section earlier.
   ```

4. **Push to GitHub**
   ```
   Call commit_changes with message="Add FAQ section to home page" to commit and push all edits.
   Optionally pass author="Claude" to attribute the change in the commit message.
   ```

### Choosing the right update tool

| What you want to edit | Tool to use |
|---|---|
| A section field (e.g. `sections.0.title`) | `update_section_field` |
| Multiple section fields at once | `update_section_fields` |
| Page `title` or `slug` top-level field | `update_section_field` |
| A single SEO/meta field | `update_meta_field` |
| Multiple SEO/meta fields at once | `update_meta_fields` |

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

# Update a section field (write tool)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Api-Key: $KEY" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":4,"params":{"name":"update_section_field","arguments":{"slug":"home","locale":"en","field_path":"sections.0.title","value":"Learn AI From Day One"}}}'

# Update a meta field (write tool)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Api-Key: $KEY" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":5,"params":{"name":"update_meta_field","arguments":{"slug":"home","locale":"en","field":"page_title","value":"Home | 4Geeks Academy"}}}'

# Update multiple meta fields at once
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Api-Key: $KEY" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":6,"params":{"name":"update_meta_fields","arguments":{"slug":"home","locale":"en","fields":{"page_title":"Home | 4Geeks Academy","description":"Join our AI bootcamp.","robots":"index, follow"}}}}'

# Commit all pending changes to GitHub
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Api-Key: $KEY" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":7,"params":{"name":"commit_changes","arguments":{"message":"Update home page title","author":"Claude"}}}'
```

## Health check

```
GET /health
```

Returns `{"status":"ok","server":"content-pages-mcp","version":"1.0.0"}`.
