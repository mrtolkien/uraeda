import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
// The fonts each part of the UI may pick (`theme/fonts.ts`): their files load once a page uses
// them.
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/inter/wght-italic.css";
import "@fontsource-variable/atkinson-hyperlegible-next/index.css";
import "@fontsource-variable/literata/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import "@fontsource/monaspace-neon/400.css";
import "@fontsource/monaspace-neon/500.css";
import "@fontsource/monaspace-neon/600.css";
import "@fontsource/monaspace-neon/700.css";
import "@fontsource/monaspace-neon/400-italic.css";
import "@fontsource/monaspace-argon/400.css";
import "@fontsource/monaspace-argon/500.css";
import "@fontsource/monaspace-argon/600.css";
import "@fontsource/monaspace-argon/700.css";
import "@fontsource/monaspace-argon/400-italic.css";
import "@fontsource/monaspace-xenon/400.css";
import "@fontsource/monaspace-xenon/500.css";
import "@fontsource/monaspace-xenon/600.css";
import "@fontsource/monaspace-xenon/700.css";
import "@fontsource/monaspace-xenon/400-italic.css";
import "@fontsource/monaspace-radon/400.css";
import "@fontsource/monaspace-radon/500.css";
import "@fontsource/monaspace-radon/600.css";
import "@fontsource/monaspace-radon/700.css";
import "@fontsource/monaspace-radon/400-italic.css";
import "@fontsource/monaspace-krypton/400.css";
import "@fontsource/monaspace-krypton/500.css";
import "@fontsource/monaspace-krypton/600.css";
import "@fontsource/monaspace-krypton/700.css";
import "@fontsource/monaspace-krypton/400-italic.css";
import "./theme/built/uraeda.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { fateClients } from "./clients.ts";
import { applyStoredFonts } from "./theme/fonts.ts";

/** One fate client per repository, `/r/<name>/fate`, and the global one, `/fate`, made once each. */
const clientFor = fateClients();

applyStoredFonts();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App clientFor={clientFor} />
  </StrictMode>,
);
