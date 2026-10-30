import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
// The fonts each part of the UI may pick (`theme/fonts.ts`).
import "./theme/fontFiles.ts";
import "./theme/built/uraeda.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { fateClients } from "./clients.ts";
import { observeTimings } from "./slow.ts";

/** One fate client per repository, `/r/<name>/fate`, and the global one, `/fate`, made once each. */
const clientFor = fateClients();

// The timings the benchmark reads start before the first page, and warn of a slow one in development.
observeTimings();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App clientFor={clientFor} />
  </StrictMode>,
);
