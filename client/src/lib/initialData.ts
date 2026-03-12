import { queryClient } from "./queryClient";

interface SingleQuery {
  queryKey: unknown[];
  data: unknown;
}

interface InitialDataPayload {
  queries: SingleQuery[];
}

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
    }
  } catch {
  }

  script.remove();
}
