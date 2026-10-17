// The preview proxy: forwards the reads and WebSocket upgrades of
// `/r/<name>/preview/<secret>/<folder>/`, with the current frame secret, to the Storybook the runner
// runs for that path, and nothing else, without Uraeda's credentials. Every response, forwarded or
// its own, is sandboxed, readable from a sandboxed frame, and sends no referrer.
import { request as httpRequest, type IncomingMessage } from "node:http";
import { connect } from "node:net";
import type { Duplex } from "node:stream";
import { Readable } from "node:stream";
import { type Context as HonoContext, Hono } from "hono";
import type { FateVariables } from "../fate.ts";
import { type guardCheck, PREVIEW_PATH, refusalStatus } from "../guard.ts";
import type { FrameSecret } from "../sign-in/frames.ts";
import { NOT_RUNNING, type Previews } from "./runner.ts";

/** The `Content-Security-Policy` of every forwarded response, replacing Storybook's own. */
export const SANDBOX = "sandbox allow-scripts allow-popups";

/** Headers of one connection, which a proxy does not pass on. */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/** Storybook's headers that would reach Uraeda's own origin: its cookies, and site data clearing. */
const OWN_ORIGIN = new Set(["clear-site-data", "set-cookie", "set-cookie2"]);

/**
 * Uraeda's credentials, never sent to a Storybook: every cookie on Uraeda's origin is Uraeda's, as
 * Storybook's own `Set-Cookie` never reaches it (R4).
 */
const CREDENTIALS = new Set(["authorization", "cookie"]);

/** The headers a proxy does not pass on: hop-by-hop ones, and those `connection` names. */
function notPassed(connection: string | Array<string> | null | undefined): Set<string> {
  const named = [connection ?? []]
    .flat()
    .flatMap((value) => value.split(","))
    .map((name) => name.trim().toLowerCase());
  return new Set([...HOP_BY_HOP, ...named]);
}

/** Statuses whose responses have no body. */
const NO_BODY = new Set([101, 204, 205, 304]);

/** The base and the rest of a preview's normalized path; undefined outside a preview. */
function previewPath(path: string): { base: string; rest?: string } | undefined {
  const match = PREVIEW_PATH.exec(path);
  return match === null ? undefined : { base: `${match[1]}/`, rest: match[3] };
}

/**
 * The headers that open a response to any origin, sandbox it, and keep its address, which holds the
 * frame secret, out of the `Referer` of what it loads or links.
 */
const SANDBOXED = {
  "access-control-allow-origin": "*",
  "content-security-policy": SANDBOX,
  "referrer-policy": "no-referrer",
};

/**
 * A forwarded response's headers: Storybook's, without those that are not passed on, or would
 * reach Uraeda's own origin, nor those `SANDBOXED` replaces.
 */
function forwarded(response: IncomingMessage): Headers {
  const dropped = notPassed(response.headers.connection);
  const headers = new Headers();
  for (const [name, value] of Object.entries(response.headers)) {
    if (value === undefined || dropped.has(name) || OWN_ORIGIN.has(name)) {
      continue;
    }
    for (const one of Array.isArray(value) ? value : [value]) {
      headers.append(name, one);
    }
  }
  return headers;
}

const notRunning = () => new Response(NOT_RUNNING, { status: 503 });

/**
 * Sends a read to the Storybook on `port` at `path`, with its own `Host` and without Uraeda's
 * credentials, and the response back as it streams; 503 when the connection fails.
 */
function forward(port: number, path: string, request: Request): Promise<Response> {
  const dropped = notPassed(request.headers.get("connection"));
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    if (!dropped.has(name) && !CREDENTIALS.has(name)) {
      headers[name] = value;
    }
  });
  headers.host = `127.0.0.1:${port}`;
  return new Promise((resolve) => {
    const upstream = httpRequest(
      { headers, host: "127.0.0.1", method: request.method, path, port, signal: request.signal },
      (response) => {
        const status = response.statusCode ?? 502;
        const empty = request.method === "HEAD" || NO_BODY.has(status);
        if (empty) {
          response.resume();
        }
        const body = empty ? null : (Readable.toWeb(response) as ReadableStream<Uint8Array>);
        resolve(new Response(body, { headers: forwarded(response), status }));
      },
    );
    upstream.on("error", () => resolve(notRunning()));
    upstream.end();
  });
}

/**
 * A preview's request: without the current frame secret, 404; the path alone is sent to its slash;
 * GET and HEAD go to the Storybook the runner has ready for the base, without the base; other
 * methods are refused.
 */
async function preview(context: HonoContext<{ Variables: FateVariables }>) {
  const url = new URL(context.req.url);
  const found = previewPath(url.pathname);
  if (found === undefined || !context.get("fate").frames.allows(url.pathname)) {
    return context.text("Not found", 404);
  }
  if (found.rest === undefined) {
    return context.redirect(`${found.base}${url.search}`, 301);
  }
  if (!["GET", "HEAD"].includes(context.req.method)) {
    return context.text("Method not allowed", 405, { allow: "GET, HEAD" });
  }
  const state = context.get("fate").previews.state(found.base);
  if (state?.state !== "ready") {
    return notRunning();
  }
  return forward(state.port, `${found.rest}${url.search}`, context.req.raw);
}

/** The preview routes, mounted at `/r/:name`: every answer is sandboxed. */
export function previewRoutes() {
  const app = new Hono<{ Variables: FateVariables }>();
  app.use("/preview/*", async (context, next) => {
    await next();
    for (const [name, value] of Object.entries(SANDBOXED)) {
      context.res.headers.set(name, value);
    }
  });
  app.all("/preview/*", preview);
  return app;
}

/** Ends an upgrade's socket with an HTTP status, and its text, sandboxed. */
export function refuse(socket: Duplex, status: string, text: string) {
  const head = [
    `HTTP/1.1 ${status}`,
    "Connection: close",
    "Content-Type: text/plain; charset=utf-8",
    ...Object.entries(SANDBOXED).map(([name, value]) => `${name}: ${value}`),
  ];
  socket.end(`${head.join("\r\n")}\r\n\r\n${text}`);
}

/**
 * An upgrade's target as a URL; undefined when it is not one, as `//[`, which the server's
 * `upgrade` listeners refuse with a 400: thrown there, it would stop the whole server.
 */
export function upgradeUrl(request: IncomingMessage): URL | undefined {
  try {
    return new URL(request.url ?? "/", "http://127.0.0.1");
  } catch {
    return undefined;
  }
}

/** Whether an upgrade asks for a WebSocket, as a GET: the only upgrade forwarded. */
const webSocket = (request: IncomingMessage) =>
  request.method === "GET" && request.headers.upgrade?.toLowerCase() === "websocket";

/**
 * The upgrade's request head for the Storybook on `port`: its own `Host`, no `Origin`, and of the
 * headers not passed on, only the upgrade's own: never Uraeda's credentials.
 */
function upgradeHead(request: IncomingMessage, path: string, port: number): string {
  const lines = [
    `${request.method ?? "GET"} ${path} HTTP/1.1`,
    `Host: 127.0.0.1:${port}`,
    "Connection: Upgrade",
    `Upgrade: ${request.headers.upgrade}`,
  ];
  const dropped = notPassed(request.headers.connection);
  const raw = request.rawHeaders;
  for (let index = 0; index < raw.length; index += 2) {
    const name = raw[index]!;
    const lower = name.toLowerCase();
    if (!["host", "origin"].includes(lower) && !dropped.has(lower) && !CREDENTIALS.has(lower)) {
      lines.push(`${name}: ${raw[index + 1]}`);
    }
  }
  return `${lines.join("\r\n")}\r\n\r\n`;
}

/** Storybook's channel, at the root of its own address. */
const CHANNEL = "/storybook-server-channel";

/**
 * An upgrade's query for Storybook: to its channel, always a preview's, `page=preview`, whatever
 * `page` it asked, as Storybook gives a manager's channel, or one without a page or an `Origin`, the
 * right to write files in the worktree (R51, and the [stack](/specs/decisions/stack.md) decision's
 * rule). Its token, and the rest, go as asked.
 */
function upstreamSearch(path: string, url: URL): string {
  if (path !== CHANNEL) {
    return url.search;
  }
  const query = new URLSearchParams(url.searchParams);
  query.set("page", "preview");
  return `?${query}`;
}

/**
 * The server's upgrades: refused by the guard's rule, `check`; WebSocket GETs under a preview's
 * path with the current frame secret, which `frames` checks, piped to the Storybook the runner has
 * ready, with the full path for Vite's `vite-hmr` protocol and the rest only otherwise, Storybook's
 * channel as a preview's; anything else is closed with a 404, and a target that is not a URL with a
 * 400.
 */
export function previewUpgrade({
  check,
  frames,
  previews,
}: {
  check: ReturnType<typeof guardCheck>;
  frames: Pick<FrameSecret, "allows">;
  previews: Previews;
}): (request: IncomingMessage, socket: Duplex, head: Buffer) => void {
  return (request, socket, head) => {
    socket.on("error", () => socket.destroy());
    const url = upgradeUrl(request);
    if (url === undefined) {
      refuse(socket, "400 Bad Request", "Bad request");
      return;
    }
    const refusal = check({
      host: request.headers.host ?? "",
      method: request.method ?? "GET",
      origin: request.headers.origin,
      path: url.pathname,
      site: request.headers["sec-fetch-site"] as string | undefined,
      upgrade: true,
    });
    if (refusal !== undefined) {
      const status = refusalStatus(refusal);
      refuse(socket, `${status} ${status === 404 ? "Not Found" : "Forbidden"}`, refusal);
      return;
    }
    const found = previewPath(url.pathname);
    if (found?.rest === undefined || !webSocket(request) || !frames.allows(url.pathname)) {
      refuse(socket, "404 Not Found", "Not found");
      return;
    }
    const state = previews.state(found.base);
    if (state?.state !== "ready") {
      refuse(socket, "503 Service Unavailable", NOT_RUNNING);
      return;
    }
    const protocols = (request.headers["sec-websocket-protocol"] ?? "").split(",");
    const hmr = protocols.some((protocol) => protocol.trim() === "vite-hmr");
    const path = `${hmr ? url.pathname : found.rest}${upstreamSearch(found.rest, url)}`;
    let connected = false;
    const upstream = connect(state.port, "127.0.0.1", () => {
      connected = true;
      upstream.write(upgradeHead(request, path, state.port));
      upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
      // A socket has no use half closed: when either side ends, both go.
      const end = () => {
        upstream.destroy();
        socket.destroy();
      };
      for (const side of [socket, upstream]) {
        side.once("end", end);
        side.once("close", end);
      }
    });
    upstream.on("error", () => {
      if (connected) {
        socket.destroy();
      } else {
        refuse(socket, "503 Service Unavailable", NOT_RUNNING);
      }
    });
    socket.once("close", () => upstream.destroy());
  };
}
