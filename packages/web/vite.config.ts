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
    name: "uraeda-server",
    configureServer(server) {
      checkBinding();
      server.middlewares.use(devHandler(root, options));
      server.httpServer?.once("close", () => void stopDevRuns());
    },
  };
}

export default defineConfig({
  plugins: [
    // Compiles the app's `stylex.create` calls. `vp dev` gets the CSS through the tags it adds to
    // `index.html`, the build appends it to the app's stylesheet, and tests, which have neither,
    // get each module's CSS injected when it loads.
    stylex.vite({
      runtimeInjection: Boolean(process.env.VITEST),
      // Browsers with `light-dark()`, which Astryx's tokens use: lowering it breaks dark mode.
      lightningcssOptions: {
        targets: { chrome: 123 << 16, firefox: 120 << 16, safari: (17 << 16) | (5 << 8) },
      },
    }) as Plugin,
    react(),
    fate({
      module: "uraeda-server/fate",
      transport: "native",
    }),
    uraedaServer(),
  ],
  server: devServer(loadEnv(root)),
  test: {
    environment: "happy-dom",
    // A mockup's frame is not loaded: the server in process answers only the UI's own requests.
    environmentOptions: {
      happyDOM: {
        url: "http://127.0.0.1:4310/",
        settings: { disableIframePageLoading: true },
      },
    },
    // The browser project checks the layout; its tests run in WebKit, from the root's config.
    exclude: ["src/__browser__/**", "**/node_modules/**"],
    // Each test builds a git repository and reads it through the binding.
    testTimeout: 20_000,
  },
});
