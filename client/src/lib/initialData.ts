import { queryClient } from "./queryClient";

interface SingleQuery {
  queryKey: unknown[];
  data: unknown;
}

type InitialDataPayload =
  | { queries: SingleQuery[]; queryKey?: never; data?: never }
  | { queryKey: unknown[]; data: unknown; queries?: never };

export let isSSRHydration = false;

export function hydrateInitialData() {
  const script = document.getElementById("__INITIAL_DATA__");
  if (!script) return;

  try {
    const payload: InitialDataPayload = JSON.parse(script.textContent || "");

    if (payload.queries && Array.isArray(payload.queries)) {
      for (const { queryKey, data } of payload.queries) {
        if (queryKey && data !== undefined) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    } else if (payload.queryKey && payload.data !== undefined) {
      queryClient.setQueryData(payload.queryKey, payload.data);
    }
  } catch {
  }

  isSSRHydration = true;
  script.remove();
  setTimeout(() => { isSSRHydration = false; }, 0);
}
