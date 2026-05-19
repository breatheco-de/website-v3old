import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  COMPONENT_REGISTRY_PATH,
  listComponents,
  getComponentSchema,
} from "../lib/content.js";
import { assertSafeSegment, assertWithinBase } from "../lib/sanitize.js";

const MAIN_SERVER_PORT = process.env.PORT || "5000";

interface AutoCommitStatus {
  enabled: boolean;
  pendingFiles: number;
  pendingFilesList: string[];
  conflictedFiles: string[];
  commitIntervalSeconds: number;
  isCommitting: boolean;
  lastCommitSha: string | null;
  lastCommitAt: string | null;
  lastError: string | null;
}

async function fetchAutoCommitStatus(): Promise<AutoCommitStatus | null> {
  try {
    const res = await fetch(
      `http://localhost:${MAIN_SERVER_PORT}/api/github/auto-commit/status`
    );
    if (!res.ok) return null;
    return (await res.json()) as AutoCommitStatus;
  } catch {
    return null;
  }
}

async function fetchRemoteConflictContent(
  filePath: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `http://localhost:${MAIN_SERVER_PORT}/api/github/file-status?file=${encodeURIComponent(filePath)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { remoteContent?: string };
    return data.remoteContent ?? null;
  } catch {
    return null;
  }
}

async function pollForCommitResult(
  queuedFiles: string[],
  commitIntervalSeconds: number,
  timeoutMs = 60_000
): Promise<
  | { outcome: "committed" }
  | { outcome: "conflict"; conflicts: Array<{ file: string; remoteContent: string | null }> }
  | { outcome: "timeout" }
> {
  const deadline = Date.now() + timeoutMs;
  const initialWait = (commitIntervalSeconds + 2) * 1000;
  await new Promise((r) => setTimeout(r, Math.min(initialWait, timeoutMs - 2000)));

  while (Date.now() < deadline) {
    const status = await fetchAutoCommitStatus();
    if (!status) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    const conflicted = queuedFiles.filter((f) =>
      status.conflictedFiles.includes(f)
    );

    if (conflicted.length > 0) {
      const conflicts = await Promise.all(
        conflicted.map(async (f) => ({
          file: f,
          remoteContent: await fetchRemoteConflictContent(f),
        }))
      );
      return { outcome: "conflict", conflicts };
    }

    const stillPending = queuedFiles.filter((f) =>
      status.pendingFilesList.includes(f)
    );

    if (stillPending.length === 0 && !status.isCommitting) {
      return { outcome: "committed" };
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  return { outcome: "timeout" };
}

export function registerComponentTools(mcp: McpServer, mcpAuthor?: string): void {
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
    "Commit all pending local content changes to GitHub. Call this after making edits with update_field, add_section, remove_section, or reorder_sections to persist them to the repository. Requires GitHub to be configured on the main server (GITHUB_TOKEN, GITHUB_REPO, and GITHUB_BRANCH environment variables). When auto-commit is enabled the changes are routed through the sync queue, ensuring correct sequencing and conflict detection. The author is automatically derived from the authenticated session — no need to supply it.",
    {
      message: z.string().optional().describe("Commit message. Defaults to 'Content update via MCP' if omitted."),
    },
    async ({ message }) => {
      const commitMessage = message?.trim() || "Content update via MCP";
      const url = `http://localhost:${MAIN_SERVER_PORT}/api/github/commit`;

      // Author comes from the authenticated OAuth session (Breathecode username).
      // Falls back to "mcp-agent" when the session has no Breathecode user attached.
      const sessionUser = mcpAuthor || "mcp-agent";
      const formattedAuthor = `${sessionUser} [MCP]`;

      let responseBody: {
        success?: boolean;
        commitHash?: string;
        error?: string;
        queued?: boolean;
        files?: string[];
        author?: string;
      };

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: commitMessage,
            author: formattedAuthor,
            queue: true,
          }),
        });

        const rawText = await res.text();
        try {
          responseBody = JSON.parse(rawText) as typeof responseBody;
        } catch {
          return {
            content: [{
              type: "text",
              text: `Commit failed: server returned non-JSON response (HTTP ${res.status}): ${rawText.slice(0, 200)}`,
            }],
            isError: true,
          };
        }

        // 202 Accepted = queued successfully — poll for outcome.
        if (res.status === 202 && responseBody.queued) {
          const queuedFiles = responseBody.files ?? [];

          if (queuedFiles.length === 0) {
            return {
              content: [{ type: "text", text: "No files were queued for commit (nothing pending)." }],
            };
          }

          const status = await fetchAutoCommitStatus();
          const intervalSeconds = status?.commitIntervalSeconds ?? 5;

          const result = await pollForCommitResult(queuedFiles, intervalSeconds);

          if (result.outcome === "committed") {
            return {
              content: [{
                type: "text",
                text: `Changes committed to GitHub successfully via auto-commit queue (${queuedFiles.length} file${queuedFiles.length !== 1 ? "s" : ""}, author: ${formattedAuthor}).`,
              }],
            };
          }

          if (result.outcome === "conflict") {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  error: "conflict",
                  message:
                    "One or more files could not be committed because the remote branch has newer changes. " +
                    "Merge the remote content shown below with your intended changes and retry.",
                  author: formattedAuthor,
                  conflicts: result.conflicts,
                }, null, 2),
              }],
              isError: true,
            };
          }

          // timeout
          return {
            content: [{
              type: "text",
              text: `Changes queued for commit (${queuedFiles.length} file${queuedFiles.length !== 1 ? "s" : ""}, author: ${formattedAuthor}). The auto-commit queue is still processing — the commit will land shortly. Check the sync log for confirmation.`,
            }],
          };
        }

        // Non-202 success path (direct commit fallback when auto-commit is disabled)
        if (res.ok && responseBody.success) {
          const hashNote = responseBody.commitHash
            ? ` (${responseBody.commitHash.slice(0, 7)})`
            : "";
          return {
            content: [{ type: "text", text: `Changes committed to GitHub successfully${hashNote}.` }],
          };
        }

        if (!res.ok) {
          const errMsg = responseBody?.error || `HTTP ${res.status}`;
          return {
            content: [{ type: "text", text: `Commit failed: ${errMsg}` }],
            isError: true,
          };
        }
      } catch (err) {
        return {
          content: [{
            type: "text",
            text: `Failed to reach main server at ${url}: ${(err as Error).message}`,
          }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: `Commit failed: ${(responseBody! as any).error ?? "Unknown error"}` }],
        isError: true,
      };
    }
  );
}
