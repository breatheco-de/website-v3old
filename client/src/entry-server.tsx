import { renderToString } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { Router } from "wouter";
import App from "./App";

interface InitialDataPayload {
  queryKey: unknown[];
  data: unknown;
}

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

  if (initialDataPayload?.queryKey && initialDataPayload?.data) {
    ssrQueryClient.setQueryData(
      initialDataPayload.queryKey as Parameters<typeof ssrQueryClient.setQueryData>[0],
      initialDataPayload.data,
    );
  }

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
