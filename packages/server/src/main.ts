import { serve } from "@hono/node-server";
import { chatImages } from "./attach.ts";
import { loadBinding } from "./binding.ts";
import { loadDataDir, loadEnv } from "./env.ts";
import { HELP, parseOptions } from "./options.ts";
import { layout, requireWeb } from "./paths.ts";
import { ClaudeAdapter } from "./runner/claude.ts";
import { startServer } from "./server.ts";

async function main(argv: Array<string>) {
  const { checkout, plugin, web } = layout();
  const options = parseOptions(argv, loadEnv(checkout));
  // `--help` needs no binding: it works before the binding is built or installed.
  if (options.show === "help") {
    process.stdout.write(HELP);
    return;
  }
  const binding = await loadBinding();
  if (options.show === "version") {
    process.stdout.write(`${binding.version()}\n`);
    return;
  }
  requireWeb(web);
  const dataDir = loadDataDir(checkout, binding);
  const { app, stop } = await startServer({
    ...options,
    adapter: new ClaudeAdapter({ imagesDir: chatImages(dataDir).dir, pluginDir: plugin }),
    binding,
    dataDir,
    webRoot: web,
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
    process.stderr.write(`uraeda: ${message}\n`);
    void stop().finally(() => process.exit(1));
  });
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`uraeda: ${(error as Error).message}\n`);
  process.exit(1);
}
