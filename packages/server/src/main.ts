import { serve } from "@hono/node-server";
import { loadBinding } from "./binding.ts";
import { loadDataDir, loadEnv } from "./env.ts";
import { parseOptions } from "./options.ts";
import { ClaudeAdapter, PLUGIN_DIR } from "./runner/claude.ts";
import { startServer } from "./server.ts";

async function main(argv: Array<string>) {
  const options = parseOptions(argv, loadEnv(process.cwd()));
  const binding = await loadBinding();
  const { app, stop } = await startServer({
    ...options,
    binding,
    dataDir: loadDataDir(process.cwd()),
    adapter: new ClaudeAdapter({ pluginDir: PLUGIN_DIR }),
  });
  // The sessions end with the server: their turns are interrupted, their processes closed, then
  // the server exits.
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void stop().finally(() => process.exit(0));
    });
  }
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: options.port }, () => {
    console.log(`Uraeda server on http://127.0.0.1:${options.port}`);
  });
  server.once("error", (error: NodeJS.ErrnoException) => {
    const url = `http://127.0.0.1:${options.port}/`;
    const message =
      error.code === "EADDRINUSE"
        ? `port ${options.port} is in use: another Uraeda server may run at ${url}`
        : error.message;
    process.stderr.write(`uraeda-server: ${message}\n`);
    void stop().finally(() => process.exit(1));
  });
}

main(process.argv.slice(2)).catch((error: Error) => {
  process.stderr.write(`uraeda-server: ${error.message}\n`);
  process.exit(1);
});
