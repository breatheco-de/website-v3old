import { hydrateRoot, createRoot } from "react-dom/client";
import App from "./App";
import { hydrateInitialData } from "./lib/initialData";

hydrateInitialData();

const rootEl = document.getElementById("root")!;

if (rootEl.hasChildNodes()) {
  hydrateRoot(rootEl, <App />);
} else {
  createRoot(rootEl).render(<App />);
}
