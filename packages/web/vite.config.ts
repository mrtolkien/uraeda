// First: a binding older than the Rust core is rebuilt before the imports below load it.
import "uraeda-server/fresh-binding";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  checkBinding,
  devHandler,
  devServer,
  devUpgrade,
  loadEnv,
  stopDevRuns,
} from "uraeda-server/dev";
import { layout } from "uraeda-server/paths";
import { defineConfig, type Plugin } from "vite-plus";

import { uiTransforms } from "./vite.transforms.ts";

/** The repository's root, where `.env` lives and `vp dev` runs. */
const root = layout().checkout;

/**
 * `.env` is the developer's, for `vp dev` and the build: the tests take their settings from the
 * environment only, so a data folder or a port set there never reaches them.
 */
const sources = { file: !process.env.VITEST };

/**
 * The server's routes, in Vite's own server, on Claude Code unless `adapter` says otherwise. The
 * agents' runs end with Vite's server. It does not start on a binding older than the Rust core,
 * which the import of `fresh-binding` above rebuilt.
 */
export function uraedaServer(options: Parameters<typeof devHandler>[1] = {}): Plugin {
  return {
    configureServer(server) {
      if (root !== null) {
        checkBinding(root);
      }
      server.middlewares.use(devHandler(root, { ...sources, ...options }));
      // Vite's own HMR socket is left to Vite: only a preview's sockets go to the server.
      server.httpServer?.on("upgrade", devUpgrade());
      server.httpServer?.once("close", () => void stopDevRuns());
    },
    name: "uraeda-server",
  };
}

/** The theme's source, which `astryx theme build` turns into `theme/built/`, which the app loads. */
const theme = fileURLToPath(new URL("src/theme/theme.ts", import.meta.url));

/**
 * In `vp dev`, rebuilds the theme when its source changes: the built files change in turn, and Vite
 * reloads them. A failed build keeps the last theme, and logs why.
 */
function themeWatcher(): Plugin {
  return {
    apply: "serve",
    configureServer(server) {
      server.watcher.add(theme);
      server.watcher.on("change", (path) => {
        if (path !== theme) {
          return;
        }
        execFile(
          "node_modules/.bin/astryx",
          ["theme", "build", "src/theme/theme.ts", "--out", "src/theme/built/uraeda.css"],
          { cwd: import.meta.dirname },
          (error, _stdout, stderr) => {
            if (error) {
              server.config.logger.error(`Theme not rebuilt: ${stderr || error.message}`);
            } else {
              server.config.logger.info("Theme rebuilt", { timestamp: true });
            }
          },
        );
      });
    },
    name: "uraeda-theme",
  };
}

export default defineConfig({
  plugins: [...uiTransforms(), uraedaServer(), themeWatcher()],
  server: devServer(loadEnv(root, process.env, sources)),
  test: {
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
      "src/__tests__/setup.ts",
    ],
    // The browser project checks the layout; its tests run in WebKit, from the root's config.
    // The lint fixtures are files to lint, not tests: `only-test.test.tsx` holds a `test.only`.
    exclude: ["src/__browser__/**", "src/__lint__/**", "**/node_modules/**"],
    // Each test builds a git repository and reads it through the binding.
    testTimeout: 20_000,
  },
});
