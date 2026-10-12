import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { fate } from "react-fate/vite";
import { devHandler, devServer, loadEnv, stopDevRuns } from "uraeda-server/dev";
import { defineConfig, type Plugin } from "vite-plus";

/** The repository's root, where `.env` lives and `vp dev` runs. */
const root = fileURLToPath(new URL("../..", import.meta.url));

/**
 * The server's routes, in Vite's own server, on Claude Code unless `adapter` says otherwise. The
 * agents' runs end with Vite's server.
 */
export function uraedaServer(options: Parameters<typeof devHandler>[1] = {}): Plugin {
  return {
    name: "uraeda-server",
    configureServer(server) {
      server.middlewares.use(devHandler(root, options));
      server.httpServer?.once("close", () => void stopDevRuns());
    },
  };
}

export default defineConfig({
  plugins: [
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
    environmentOptions: { happyDOM: { url: "http://127.0.0.1:4310/" } },
    // The browser project checks the layout; its tests run in WebKit, from the root's config.
    exclude: ["src/__browser__/**", "**/node_modules/**"],
    // Each test builds a git repository and reads it through the binding.
    testTimeout: 20_000,
  },
});
