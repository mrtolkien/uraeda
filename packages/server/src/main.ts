// `uraeda`: takes the port first, then starts the server on it, or hands the repository to the
// server already there, with the host token. The session cache and the sign-in file are opened
// only once the port is this process's.
import { rmSync } from "node:fs";
import { createServer, type RequestListener, type Server as HttpServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { chatImages } from "./attach.ts";
import { loadBinding } from "./binding.ts";
import type { Binding } from "./fate/context.ts";
import { browserOpens, openBrowser } from "./browser.ts";
import { loadDataDir, loadEnv } from "./env.ts";
import { handOff, type HandOff, newKeyOn } from "./open-client.ts";
import { HELP, type Options, parseOptions } from "./options.ts";
import { layout, requireWeb } from "./paths.ts";
import { ClaudeAdapter } from "./runner/claude.ts";
import { keyLines, newKeyLines, startServer } from "./server.ts";
import { readHostToken, removeHostToken, writeHostToken } from "./sign-in/host.ts";
import { browserAddress, linkPages } from "./sign-in/links.ts";

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

/** Why a handoff failed, as `uraeda: <reason>` prints it. */
function handOffError(answer: Exclude<HandOff, { kind: "opened" }>, port: number): string {
  switch (answer.kind) {
    case "refused":
      return answer.error;
    case "unauthorized":
      return `port ${port} is used by an Uraeda server with another data folder.`;
    case "other":
      return `port ${port} is used by another program: pass --port to use another one`;
  }
}

/**
 * Hands the repository to the server on the port, with the host token of the data folder: makes a
 * new key first with `--new-key`, then prints its page and opens the browser through a one-time
 * link, or prints why it could not. Returns the exit code.
 */
async function handOver(options: Options, dataDir: string): Promise<number> {
  const { port } = options;
  const token = readHostToken(dataDir, port);
  if (options.newKey) {
    const key = token === undefined ? undefined : await newKeyOn(port, token);
    if (key === undefined) {
      process.stderr.write(`uraeda: the server on port ${port} refused the new key.\n`);
      return 1;
    }
    process.stdout.write(newKeyLines(key));
  }
  const opens = options.open && browserOpens();
  const request = { folder: options.repo, given: options.given, signIn: opens };
  const answer = await handOff(port, request, token);
  if (answer.kind !== "opened") {
    process.stderr.write(`uraeda: ${handOffError(answer, port)}\n`);
    return 1;
  }
  const address = `http://127.0.0.1:${port}`;
  process.stdout.write(`Uraeda already runs at ${address}${answer.url}\n`);
  if (opens) {
    // A one-time link goes through a page in the data folder: the launcher's command line, which
    // every user of the machine can read, never holds it.
    openBrowser(browserAddress(linkPages(dataDir, port), address, answer.signIn));
  }
  return 0;
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

/** What the first start needs besides its options: the binding, and the paths it starts on. */
type Start = { binding: Binding; dataDir: string; plugin: string; web: string };

/**
 * Starts the server on the port this process took, with a new host token, removed at exit. Prints
 * its address, then the access key when this start made it, or the new one with `--new-key`, and
 * opens the browser through a one-time link, made only when a browser opens.
 */
async function serve(http: HttpServer, options: Options, start: Start): Promise<number> {
  const { binding, dataDir, plugin, web } = start;
  const attach = serveWhenReady(http);
  const hostToken = writeHostToken(dataDir, options.port);
  process.once("exit", () => {
    removeHostToken(dataDir, options.port);
    // The pages of one-time links, even after a crash; a stop removes them first.
    rmSync(linkPages(dataDir, options.port), { force: true, recursive: true });
  });
  const server = await startServer({
    ...options,
    adapter: new ClaudeAdapter({ imagesDir: chatImages(dataDir).dir, pluginDir: plugin }),
    binding,
    dataDir,
    hostToken,
    webRoot: web,
  });
  // The sessions and Storybooks end with the server: their turns are interrupted, their processes
  // closed, then the server exits. A closed terminal, SIGHUP, stops it the same way.
  for (const signal of ["SIGHUP", "SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void server.stop().finally(() => process.exit(0));
    });
  }
  // A key this start made is already new: `--new-key` makes no second one.
  const key = server.key ?? (options.newKey ? server.newKey() : undefined);
  attach(getRequestListener(server.app.fetch));
  http.on("upgrade", server.upgrade);
  const address = `http://127.0.0.1:${options.port}`;
  const shown = key === undefined ? "" : options.newKey ? newKeyLines(key) : keyLines(key);
  process.stdout.write(`Uraeda server on ${address}\n${shown}`);
  // A one-time link only for a browser that opens: none over SSH.
  if (options.open && browserOpens()) {
    openBrowser(server.signInPage(server.url));
  }
  return 0;
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
  // Only a path: the second start reads its host token there, and never opens a file the running
  // server owns.
  const dataDir = loadDataDir(checkout, binding);
  // The port first: a second start must never open the session cache or the sign-in file, which
  // the running server owns.
  const http = await takePort(options.port);
  if (!http) {
    return handOver(options, dataDir);
  }
  return serve(http, options, { binding, dataDir, plugin, web });
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`uraeda: ${(error as Error).message}\n`);
  process.exit(1);
}
