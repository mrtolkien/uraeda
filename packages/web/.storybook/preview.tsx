/// <reference types="vite-plus/client" />
// Every story of Uraeda's Storybook, as the app draws it: Astryx's stylesheets and Uraeda's theme,
// with the fonts the app picked in this browser, or its defaults, in the colour mode and the theme
// of the page that embeds it, inside the fixture repository's providers, on a
// fate client that reaches Uraeda's server in Storybook through GETs (R4), and that server's preview
// URLs under Storybook's base (R43). The skill's pick script lets Uraeda's embeds pick an element in
// it.
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "../src/theme/fontFiles.ts";
import "../src/theme/built/uraeda.css";
import "../../../skills/uraeda/assets/storybook/uraeda-pick.js";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { Theme } from "@astryxdesign/core/theme";
import type { Decorator, Preview } from "@storybook/react-vite";
import { type ReactNode, Suspense, useSyncExternalStore } from "react";
import { FateClient } from "react-fate";
import { fateClients } from "../src/clients.ts";
import { ListClientContext } from "../src/ListClient.tsx";
import { RepositoryContext } from "../src/routes.tsx";
import { PreviewBase } from "../src/stories.tsx";
import type { Drawn, Mode } from "../src/theme.tsx";
import { uraedaTheme } from "../src/theme/built/uraeda.js";
import { applyPalette } from "../src/theme/palette.ts";
import { PickedFonts } from "../src/theme/PickedFonts.tsx";
import { fetchOverGet, liveWithoutCredentials } from "./fateOverGet.ts";

/** The fixture's name in the server's list: `fixture.ts` builds it at `<folder>/fixture`. */
const REPOSITORY = "fixture";

liveWithoutCredentials();

/** Storybook's base, without its last slash: Uraeda's address of it, or empty on its own. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** The fate clients, under Storybook's base. */
const clientFor = fateClients({ fetch: fetchOverGet, origin: BASE });

/** Whether `value` is a plain object. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The tokens of each mode a message carries, `{ dark?, light? }`, each a custom property's name to a
 * `#` colour; nothing when the message has none or another shape. `applyPalette` checks each name
 * and colour again before writing them.
 */
function paletteOf(palette: unknown): Drawn | undefined {
  if (!isObject(palette)) {
    return undefined;
  }
  const modes = Object.entries(palette);
  const valid = modes.every(
    ([mode, tokens]) =>
      (mode === "dark" || mode === "light") &&
      isObject(tokens) &&
      Object.entries(tokens).every(
        ([name, colour]) =>
          name.startsWith("--") && typeof colour === "string" && colour.startsWith("#"),
      ),
  );
  return valid ? (palette as Drawn) : undefined;
}

/**
 * The colour mode the embedding page sends, `{ uraeda: "mode", mode, palette? }`, from
 * `window.parent` only; the system's until then, and on Storybook's own pages. The page sends it as
 * soon as the pick script says the frame is ready, before the story renders: it is listened for as
 * the preview loads, and kept. The palette, the tokens the page draws, is drawn over the built
 * theme, so the story shows the picked theme; a frame sent none, and Storybook's own pages, keep
 * the built Catppuccin.
 */
const embeddingMode = (() => {
  let mode: Mode = "system";
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
      const palette = "palette" in data ? paletteOf(data.palette) : undefined;
      if (palette) {
        applyPalette(palette, document);
      }
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
function useEmbeddingMode(): Mode {
  return useSyncExternalStore(embeddingMode.subscribe, embeddingMode.get);
}

/** Uraeda's theme and the fixture repository's providers, around a story. */
function InUraeda({ children }: { children: ReactNode }) {
  const mode = useEmbeddingMode();
  return (
    <FateClient client={clientFor(null)}>
      <Theme mode={mode} theme={uraedaTheme}>
        <PickedFonts>
          <LayerProvider>
            <ListClientContext value={clientFor(null)}>
              <RepositoryContext value={REPOSITORY}>
                <FateClient client={clientFor(REPOSITORY)}>
                  <PreviewBase value={BASE}>
                    <Suspense>{children}</Suspense>
                  </PreviewBase>
                </FateClient>
              </RepositoryContext>
            </ListClientContext>
          </LayerProvider>
        </PickedFonts>
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
