import { renderToPipeableStream } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { Router } from "wouter";
import { PassThrough, type Writable } from "node:stream";
import App from "./App";
import { preloadSectionsFromInitialData } from "./components/sectionRegistry";

interface SingleQuery {
  queryKey: unknown[];
  data: unknown;
}

type InitialDataPayload =
  | { queries: SingleQuery[]; queryKey?: never; data?: never }
  | { queryKey: unknown[]; data: unknown; queries?: never };

function suppressLayoutEffectWarnings(): () => void {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("useLayoutEffect does nothing on the server")
    ) {
      return;
    }
    original.apply(console, args);
  };
  return () => {
    console.error = original;
  };
}

function seedQueryClient(
  client: QueryClient,
  payload: InitialDataPayload | null,
): void {
  if (!payload) return;

  if (payload.queries && Array.isArray(payload.queries)) {
    for (const { queryKey, data } of payload.queries) {
      client.setQueryData(
        queryKey as Parameters<typeof client.setQueryData>[0],
        data,
      );
    }
  } else if (payload.queryKey && payload.data !== undefined) {
    client.setQueryData(
      payload.queryKey as Parameters<typeof client.setQueryData>[0],
      payload.data,
    );
  }
}

/**
 * Streaming SSR: pipes React output directly into `dest` using onShellReady,
 * so the browser starts receiving HTML as soon as the shell is ready rather
 * than waiting for the full render to complete.
 *
 * IMPORTANT: The caller must NOT write anything to the response before calling
 * this function. The `onShellReadyCb` is invoked synchronously inside
 * `onShellReady` — before any bytes are piped into `dest` — so the caller can
 * safely write the head HTML there. If `onShellError` fires instead, the
 * returned promise rejects before any bytes are written, allowing the caller to
 * send a complete buffered fallback response.
 *
 * @param onShellReadyCb - Optional hook called right before piping starts. Use
 *   it to flush head HTML to the response so ordering is guaranteed.
 */
export async function renderToStream(
  url: string,
  initialDataPayload: InitialDataPayload | null,
  dest: Writable,
  onShellReadyCb?: () => void,
): Promise<void> {
  const ssrQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  seedQueryClient(ssrQueryClient, initialDataPayload);

  const cleanUrl = url.split("?")[0].split("#")[0];
  const restore = suppressLayoutEffectWarnings();

  try {
    await preloadSectionsFromInitialData(initialDataPayload);

    await new Promise<void>((resolve, reject) => {
      const { pipe } = renderToPipeableStream(
        <Router ssrPath={cleanUrl}>
          <App ssrQueryClient={ssrQueryClient} />
        </Router>,
        {
          onShellReady() {
            // Call the hook first (head HTML flush) — then start piping.
            // Node stream writes are synchronous so this ordering is guaranteed.
            onShellReadyCb?.();
            pipe(dest);
          },
          onAllReady() {
            resolve();
          },
          onShellError(error: unknown) {
            // Shell failed: promise rejects before any bytes were written to dest.
            reject(error);
          },
          onError(error: unknown) {
            // Non-fatal Suspense errors (logged but rendering continues).
            console.warn("[SSR stream error]", error);
          },
        },
      );
    });
  } finally {
    restore();
  }
}

export async function render(
  url: string,
  initialDataPayload: InitialDataPayload | null,
): Promise<string> {
  const ssrQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  seedQueryClient(ssrQueryClient, initialDataPayload);

  const cleanUrl = url.split("?")[0].split("#")[0];

  const restore = suppressLayoutEffectWarnings();

  try {
    await preloadSectionsFromInitialData(initialDataPayload);

    const html = await new Promise<string>((resolve, reject) => {
      let chunks = "";
      const passthrough = new PassThrough();
      passthrough.setEncoding("utf-8");
      passthrough.on("data", (chunk: string) => {
        chunks += chunk;
      });
      passthrough.on("end", () => resolve(chunks));
      passthrough.on("error", reject);

      const { pipe } = renderToPipeableStream(
        <Router ssrPath={cleanUrl}>
          <App ssrQueryClient={ssrQueryClient} />
        </Router>,
        {
          onAllReady() {
            pipe(passthrough);
          },
          onError(error: unknown) {
            reject(error);
          },
        },
      );
    });

    return html;
  } finally {
    restore();
  }
}
