import { serve } from "@hono/node-server";
import { chatImages } from "./attach.ts";
import { loadBinding } from "./binding.ts";
import { loadDataDir, loadEnv } from "./env.ts";
import { parseOptions } from "./options.ts";
import { layout } from "./paths.ts";
import { ClaudeAdapter } from "./runner/claude.ts";
import { startServer } from "./server.ts";

async function main(argv: Array<string>) {
  const { checkout, plugin } = layout();
  const options = parseOptions(argv, loadEnv(checkout));
  const binding = await loadBinding();
  const dataDir = loadDataDir(checkout);
  const { app, stop } = await startServer({
    ...options,
    adapter: new ClaudeAdapter({ imagesDir: chatImages(dataDir).dir, pluginDir: plugin }),
    binding,
    dataDir,
  });
  // The sessions end with the server: their turns are interrupted, their processes closed, then
  // the server exits.
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void stop().finally(() => process.exit(0));
    });
  }
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: options.port }, () => {
    process.stdout.write(`Uraeda server on http://127.0.0.1:${options.port}\n`);
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

try {
  await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`uraeda-server: ${(error as Error).message}\n`);
  process.exit(1);
}
