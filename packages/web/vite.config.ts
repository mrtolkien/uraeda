import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { unplugin as stylex } from "@stylexjs/unplugin";
import react from "@vitejs/plugin-react";
import { fate } from "react-fate/vite";
import { checkBinding, devHandler, devServer, loadEnv, stopDevRuns } from "uraeda-server/dev";
import { defineConfig, type Plugin } from "vite-plus";

/** The repository's root, where `.env` lives and `vp dev` runs. */
const root = fileURLToPath(new URL("../..", import.meta.url));

/**
 * The server's routes, in Vite's own server, on Claude Code unless `adapter` says otherwise. The
 * agents' runs end with Vite's server. It does not start on a binding older than the Rust core.
 */
export function uraedaServer(options: Parameters<typeof devHandler>[1] = {}): Plugin {
  return {
    configureServer(server) {
      checkBinding();
      server.middlewares.use(devHandler(root, options));
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

export default defineConfig({
  plugins: [
    stylexPlugin(),
    react(),
    fate({
      module: "uraeda-server/fate",
      transport: "native",
    }),
    uraedaServer(),
    themeWatcher(),
  ],
  server: devServer(loadEnv(root)),
  test: {
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
