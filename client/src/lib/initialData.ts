import { queryClient } from "./queryClient";

interface InitialDataPayload {
  queryKey: unknown[];
  data: unknown;
}

export function hydrateInitialData() {
  const script = document.getElementById("__INITIAL_DATA__");
  if (!script) return;

  try {
    const payload: InitialDataPayload = JSON.parse(script.textContent || "");
    if (payload.queryKey && payload.data) {
      queryClient.setQueryData(payload.queryKey, payload.data);
    }
  } catch {
  }

  script.remove();
}
