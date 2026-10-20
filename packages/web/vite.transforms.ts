import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import { unplugin as stylex } from "@stylexjs/unplugin";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { fate } from "react-fate/vite";
import type { Plugin, PluginOption } from "vite-plus";

/**
 * Compiles the app's `stylex.create` calls. `vp dev` gets the CSS through the tags it adds to
 * `index.html`, the build appends it to the app's stylesheet, and tests, which have neither, get
 * each module's CSS injected when it loads.
 */
function stylexPlugin(): Plugin {
  const plugin = stylex.vite({
    runtimeInjection: Boolean(process.env.VITEST),
    // Browsers with `light-dark()`, which Astryx's tokens use: lowering it breaks dark mode.
    lightningcssOptions: {
      targets: { chrome: 123 << 16, firefox: 120 << 16, safari: (17 << 16) | (5 << 8) },
    },
  }) as Plugin;
  // Its dev server polls for CSS changes until its HTTP server closes, and Vitest's server has
  // none: the timer would keep the tests' process from exiting. Tests inject their CSS instead.
  return process.env.VITEST ? { ...plugin, configureServer: undefined } : plugin;
}

/** Shared by production, browser and focused tests without loading the production server. */
export function uiTransforms(): Array<PluginOption> {
  return [
    stylexPlugin(),
    react(),
    // React Compiler memoizes the components, in the build, the dev server, and the tests, which
    // reuse these plugins (see `specs/decisions/toolchain.md`).
    babel({ presets: [reactCompilerPreset()] }),
    fate({
      module: "uraeda-server/fate",
      transport: "native",
    }),
  ];
}

/** The web tests' settings, shared by the web UI's configuration and fast's focused project. */
export function uiTestOptions() {
  return {
    // The feature page's times are in the browser's time zone: the tests read them in UTC.
    env: { TZ: "UTC" },
    environment: "happy-dom",
    // A mockup's frame is not loaded: the server in process answers only the UI's own requests.
    environmentOptions: {
      happyDOM: {
        settings: { disableIframePageLoading: true },
        url: "http://127.0.0.1:4310/",
      },
    },
    // The binding's setup gives each test file its own temporary folder; the UI's leaves out
    // happy-dom's error for each mockup frame it does not load.
    setupFiles: [
      fileURLToPath(new URL("../binding/test-setup.ts", import.meta.url)),
      fileURLToPath(new URL("src/__tests__/setup.ts", import.meta.url)),
    ],
    // Each test builds a git repository and reads it through the binding.
    testTimeout: 20_000,
  };
}
