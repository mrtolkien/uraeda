import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "./theme/built/uraeda.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { fateClients } from "./clients.ts";

/** One fate client per repository, `/r/<name>/fate`, and the global one, `/fate`, made once each. */
const clientFor = fateClients();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App clientFor={clientFor} />
  </StrictMode>,
);
