import { useState } from "react";
import { IconServer, IconCopy, IconCheck, IconChevronDown, IconChevronRight, IconSearch, IconPlug } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { MCP_TOOL_GROUPS, type McpTool } from "@/data/mcpTools";

function getMcpServerUrl(): string {
  const origin = window.location.origin;
  const port = origin.includes("localhost") ? origin.replace(/:\d+$/, ":3001") : origin;
  return `${port}/mcp`;
}

function getMcpBaseUrl(): string {
  const origin = window.location.origin;
  if (origin.includes("localhost")) {
    return origin.replace(/:\d+$/, ":3001");
  }
  return origin;
}

function buildConfigSnippet(mcpUrl: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        "4geeks-cms": {
          url: mcpUrl,
          headers: {
            Authorization: "Bearer <your-breathecode-token>",
          },
        },
      },
    },
    null,
    2
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={handleCopy}
      data-testid="button-copy-snippet"
      className="shrink-0"
    >
      {copied ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
    </Button>
  );
}

function ToolCard({ tool }: { tool: McpTool }) {
  const [open, setOpen] = useState(false);
  const hasParams = tool.parameters.length > 0;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm font-mono font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded">
              {tool.name}
            </code>
            {tool.parameters.filter((p) => p.required).length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {tool.parameters.filter((p) => p.required).length} required param
                {tool.parameters.filter((p) => p.required).length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            {tool.description}
          </p>
        </div>
      </div>

      {hasParams && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 gap-1.5 text-muted-foreground"
              data-testid={`button-toggle-params-${tool.name}`}
            >
              {open ? (
                <IconChevronDown className="w-3.5 h-3.5" />
              ) : (
                <IconChevronRight className="w-3.5 h-3.5" />
              )}
              Parameters ({tool.parameters.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Req.</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {tool.parameters.map((param, i) => (
                    <tr
                      key={param.name}
                      className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    >
                      <td className="px-3 py-2 font-mono font-medium">{param.name}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{param.type}</td>
                      <td className="px-3 py-2">
                        {param.required ? (
                          <span className="text-foreground font-semibold">yes</span>
                        ) : (
                          <span className="text-muted-foreground">no</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {param.description}
                        {param.default !== undefined && (
                          <span className="ml-1 text-muted-foreground/60">
                            (default: <code className="font-mono">{param.default}</code>)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}

export default function McpServerPage() {
  const [search, setSearch] = useState("");
  const mcpUrl = getMcpServerUrl();
  const baseUrl = getMcpBaseUrl();
  const configSnippet = buildConfigSnippet(mcpUrl);

  const query = search.trim().toLowerCase();
  const filteredGroups = MCP_TOOL_GROUPS.map((group) => ({
    ...group,
    tools: group.tools.filter(
      (tool) =>
        !query ||
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
    ),
  })).filter((group) => group.tools.length > 0);

  const totalTools = MCP_TOOL_GROUPS.reduce((sum, g) => sum + g.tools.length, 0);

  return (
    <ScrollArea className="h-screen">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-muted shrink-0">
            <IconServer className="w-6 h-6 text-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">MCP Server</h1>
            <p className="mt-1 text-muted-foreground">
              Connect any MCP-compatible AI agent (Claude Desktop, Cursor, etc.) to read and modify
              this website's content directly.
            </p>
          </div>
        </div>

        {/* Getting started */}
        <section className="space-y-5">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <IconPlug className="w-5 h-5 shrink-0" />
            Getting started
          </h2>

          <p className="text-sm text-muted-foreground leading-relaxed">
            This MCP server exposes the site's content system to AI agents via the{" "}
            <span className="font-medium text-foreground">Model Context Protocol</span>. An agent can
            list pages, read and update sections, manage SEO metadata, browse the component registry,
            and inspect its own permissions — all without leaving its chat interface.
          </p>

          {/* Server URL */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Server URL</p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded-md text-foreground overflow-x-auto whitespace-nowrap"
                data-testid="text-mcp-server-url"
              >
                {mcpUrl}
              </code>
              <CopyButton text={mcpUrl} />
            </div>
          </div>

          {/* Authentication */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Authentication</p>
            <p className="text-sm text-muted-foreground">
              Pass your{" "}
              <span className="font-medium text-foreground">Breathecode API token</span> as a Bearer
              token in the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Authorization</code> header:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded-md text-foreground overflow-x-auto whitespace-nowrap">
                Authorization: Bearer &lt;your-breathecode-token&gt;
              </code>
              <CopyButton text="Authorization: Bearer <your-breathecode-token>" />
            </div>
            <p className="text-xs text-muted-foreground">
              You can find your token in your{" "}
              <a
                href="https://breathecode.herokuapp.com/v1/auth/view/login"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                Breathecode account
              </a>
              . Your capabilities are scoped to your assigned roles.
            </p>
          </div>

          {/* Config snippet */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Config snippet — Claude Desktop / Cursor
            </p>
            <p className="text-xs text-muted-foreground">
              Add this to your{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">claude_desktop_config.json</code>{" "}
              or Cursor MCP settings:
            </p>
            <div className="relative">
              <pre
                className="text-xs font-mono bg-muted px-4 py-3 rounded-md overflow-x-auto text-foreground leading-relaxed"
                data-testid="text-mcp-config-snippet"
              >
                {configSnippet}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={configSnippet} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Replace{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">&lt;your-breathecode-token&gt;</code>{" "}
              with your actual token. For the OAuth flow, navigate to{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{baseUrl}/oauth/authorize</code>.
            </p>
          </div>
        </section>

        {/* Tools list */}
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-lg font-semibold text-foreground">
              Available tools
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({totalTools} total)
              </span>
            </h2>
            <div className="relative w-64">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search tools…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
                data-testid="input-search-tools"
              />
            </div>
          </div>

          {filteredGroups.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No tools match your search.
            </p>
          )}

          {filteredGroups.map((group) => (
            <div key={group.category} className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-foreground">{group.category}</h3>
                <Badge variant="secondary">{group.tools.length}</Badge>
                <div className="flex-1 border-t" />
              </div>
              <p className="text-xs text-muted-foreground">{group.description}</p>
              <div className="space-y-2">
                {group.tools.map((tool) => (
                  <ToolCard key={tool.name} tool={tool} />
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </ScrollArea>
  );
}
