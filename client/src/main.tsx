import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { hydrateInitialData } from "./lib/initialData";

hydrateInitialData();

createRoot(document.getElementById("root")!).render(<App />);
