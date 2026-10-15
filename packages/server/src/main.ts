// `uraeda`: takes the port first, then starts the server on it, or hands the repository to the
// server already there. The session cache is opened only once the port is this process's.
import { createServer, type RequestListener, type Server as HttpServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { chatImages } from "./attach.ts";
import { loadBinding } from "./binding.ts";
import { openBrowser } from "./browser.ts";
import { loadDataDir, loadEnv } from "./env.ts";
import { handOff } from "./open-client.ts";
import { HELP, type Options, parseOptions } from "./options.ts";
import { layout, requireWeb } from "./paths.ts";
import { ClaudeAdapter } from "./runner/claude.ts";
import { startServer } from "./server.ts";

/** Listens on 127.0.0.1:`port`; null when another process holds it. */
function takePort(port: number): Promise<HttpServer | null> {
  return new Promise((resolve, reject) => {
    const http = createServer();
    const failed = (error: NodeJS.ErrnoException) =>
      error.code === "EADDRINUSE" ? resolve(null) : reject(error);
    http.once("error", failed);
    http.listen(port, "127.0.0.1", () => {
      http.off("error", failed);
      resolve(http);
    });
  });
}

/**
 * Hands the repository to the server on the port: prints its page and opens it, or prints why it
 * could not. Returns the exit code.
 */
async function handOver(options: Options): Promise<number> {
  const { port } = options;
  const answer = await handOff(port, { folder: options.repo, given: options.given });
  if (answer.kind === "opened") {
    const url = `http://127.0.0.1:${port}${answer.url}`;
    process.stdout.write(`Uraeda already runs at ${url}\n`);
    if (options.open) {
      openBrowser(url);
    }
    return 0;
  }
  const message =
    answer.kind === "refused"
      ? answer.error
      : `port ${port} is used by another program: pass --port to use another one`;
  process.stderr.write(`uraeda: ${message}\n`);
  return 1;
}

/**
 * Hands the port's requests to the app once it is resolved: a request arriving while the server
 * starts, like a second start's handoff, waits for it instead of going unanswered.
 */
function serveWhenReady(http: HttpServer): (listener: RequestListener) => void {
  let resolve!: (listener: RequestListener) => void;
  const app = new Promise<RequestListener>((done) => (resolve = done));
  http.on("request", (request, response) => {
    void app.then((listener) => listener(request, response));
  });
  return resolve;
}

async function main(argv: Array<string>): Promise<number> {
  const { checkout, plugin, web } = layout();
  const options = parseOptions(argv, loadEnv(checkout));
  // `--help` needs no binding: it works before the binding is built or installed.
  if (options.show === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  const binding = await loadBinding();
  if (options.show === "version") {
    process.stdout.write(`${binding.version()}\n`);
    return 0;
  }
  requireWeb(web);
  // The port first: a second start must never open the session cache, which would mark the
  // running server's turns stopped.
  const http = await takePort(options.port);
  if (!http) {
    return handOver(options);
  }
  const attach = serveWhenReady(http);
  const dataDir = loadDataDir(checkout, binding);
  const server = await startServer({
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
      void server.stop().finally(() => process.exit(0));
    });
  }
  attach(getRequestListener(server.app.fetch));
  http.on("upgrade", server.upgrade);
  const address = `http://127.0.0.1:${options.port}`;
  process.stdout.write(`Uraeda server on ${address}\n`);
  if (options.open) {
    openBrowser(`${address}${server.url}`);
  }
  return 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`uraeda: ${(error as Error).message}\n`);
  process.exit(1);
}
