import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "./theme/built/uraeda.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createFateClient } from "react-fate/client";
import { App } from "./App.tsx";

const client = createFateClient({ url: "/fate" });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App client={client} />
  </StrictMode>,
);
