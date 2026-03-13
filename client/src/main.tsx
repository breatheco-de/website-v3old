import { hydrateRoot } from "react-dom/client";
import App from "./App";
import { hydrateInitialData } from "./lib/initialData";

hydrateInitialData();

hydrateRoot(document.getElementById("root")!, <App />);
