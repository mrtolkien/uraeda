/// <reference types="vite-plus/client" />
// Every story of Uraeda's Storybook, as the app draws it: Astryx's stylesheets and Uraeda's theme,
// in the colour mode of the page that embeds it, inside the fixture repository's providers, on a
// fate client that reaches Uraeda's server in Storybook through GETs (R4). The skill's pick script
// lets Uraeda's embeds pick an element in it.
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "../src/theme/built/uraeda.css";
import "../../../skills/uraeda/assets/storybook/uraeda-pick.js";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { Theme } from "@astryxdesign/core/theme";
import type { Decorator, Preview } from "@storybook/react-vite";
import { type ReactNode, Suspense, useSyncExternalStore } from "react";
import { FateClient } from "react-fate";
import { fateClients } from "../src/clients.ts";
import { ListClientContext } from "../src/RepositoryMenu.tsx";
import { RepositoryContext } from "../src/routes.tsx";
import type { ThemeMode } from "../src/theme.tsx";
import { uraedaTheme } from "../src/theme/built/uraeda.js";
import { fetchOverGet, liveWithoutCredentials } from "./fateOverGet.ts";

/** The fixture's name in the server's list: `fixture.ts` builds it at `<folder>/fixture`. */
const REPOSITORY = "fixture";

liveWithoutCredentials();

/** The fate clients, under Storybook's base: Uraeda's address of it, or `/` on its own. */
const clientFor = fateClients({
  fetch: fetchOverGet,
  origin: import.meta.env.BASE_URL.replace(/\/$/, ""),
});

/**
 * The colour mode the embedding page sends, `{ uraeda: "mode", mode }`, from `window.parent` only;
 * the system's until then, and on Storybook's own pages. The page sends it as soon as the pick
 * script says the frame is ready, before the story renders: it is listened for as the preview
 * loads, and kept.
 */
const embeddingMode = (() => {
  let mode: ThemeMode = "system";
  const listeners = new Set<() => void>();
  window.addEventListener("message", (event: MessageEvent) => {
    const data: unknown = event.data;
    if (
      event.source === window.parent &&
      typeof data === "object" &&
      data !== null &&
      "uraeda" in data &&
      data.uraeda === "mode" &&
      "mode" in data &&
      (data.mode === "light" || data.mode === "dark")
    ) {
      mode = data.mode;
      for (const listener of listeners) {
        listener();
      }
    }
  });
  return {
    get: () => mode,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
})();

/** The embedding page's colour mode, its last message's. */
function useEmbeddingMode(): ThemeMode {
  return useSyncExternalStore(embeddingMode.subscribe, embeddingMode.get);
}

/** Uraeda's theme and the fixture repository's providers, around a story. */
function InUraeda({ children }: { children: ReactNode }) {
  const mode = useEmbeddingMode();
  return (
    <FateClient client={clientFor(null)}>
      <Theme mode={mode} theme={uraedaTheme}>
        <LayerProvider>
          <ListClientContext value={clientFor(null)}>
            <RepositoryContext value={REPOSITORY}>
              <FateClient client={clientFor(REPOSITORY)}>
                <Suspense>{children}</Suspense>
              </FateClient>
            </RepositoryContext>
          </ListClientContext>
        </LayerProvider>
      </Theme>
    </FateClient>
  );
}

const inUraeda: Decorator = (Story) => (
  <InUraeda>
    <Story />
  </InUraeda>
);

const preview: Preview = {
  decorators: [inUraeda],
  // Stories are previews, not tests (see `specs/decisions/preview.md`).
  tags: ["!test"],
};

export default preview;
