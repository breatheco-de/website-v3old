import { renderToString } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { Router } from "wouter";
import App from "./App";

interface SingleQuery {
  queryKey: unknown[];
  data: unknown;
}

type InitialDataPayload =
  | { queries: SingleQuery[]; queryKey?: never; data?: never }
  | { queryKey: unknown[]; data: unknown; queries?: never };

// Third-party libraries (Radix UI, etc.) emit useLayoutEffect SSR warnings that
// are harmless — suppress them so server logs stay readable.
function withSuppressedLayoutEffectWarning<T>(fn: () => T): T {
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
  try {
    return fn();
  } finally {
    console.error = original;
  }
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

  const html = withSuppressedLayoutEffectWarning(() =>
    renderToString(
      <Router ssrPath={cleanUrl}>
        <App ssrQueryClient={ssrQueryClient} />
      </Router>,
    ),
  );

  return html;
}
