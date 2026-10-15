import { createMiddleware } from "hono/factory";

/** What a browser's `Sec-Fetch-Site` says of a request the server's own page, or its user, sent. */
const OWN_SITES = new Set(["same-origin", "none"]);

/**
 * A path of a checkout's Storybook: its base, `/r/<repository>/preview/<folder>`, without its
 * slash, and the rest, from the slash on, if any. The guard and the proxy read it alike.
 */
export const PREVIEW_PATH = /^(\/r\/[^/]+\/preview\/[^/]+)(\/.*)?$/;

/** Whether `path` is under a preview's base, `/r/<repository>/preview/<folder>/`. */
const underPreview = (path: string) => PREVIEW_PATH.exec(path)?.[2] !== undefined;

/** A request, or an upgrade, as the guard reads it: its path is normalized, without its query. */
export type GuardedRequest = {
  host: string;
  method: string;
  origin?: string;
  path: string;
  site?: string;
  upgrade: boolean;
};

/** Whether the request only reads: a GET or a HEAD, and an upgrade only as a GET. */
const read = (request: GuardedRequest) =>
  request.upgrade ? request.method === "GET" : ["GET", "HEAD"].includes(request.method);

/**
 * The guard's rule, for requests and upgrades alike: the refusal's text, or undefined when the
 * request passes. It rejects what a web page could send to the local server: any `Host` but the
 * server's own or an allowed host name, as in DNS rebinding, any `Origin` but theirs and the
 * allowed ones, and a write without an `Origin` that the browser says another site sent. A request
 * without either header, from a test or `curl`, passes. A sandboxed frame's `Origin: null` passes
 * only for reads and upgrades, as GETs, under a preview's base (SC-004).
 */
export function guardCheck({
  allowedHosts = [],
  allowOrigins,
  port,
}: {
  allowedHosts?: Array<string>;
  allowOrigins: Array<string>;
  port: number;
}): (request: GuardedRequest) => string | undefined {
  const own = [`127.0.0.1:${port}`, `localhost:${port}`];
  // `tailscale serve` passes the machine's name, without a port behind HTTPS.
  const hosts = new Set([...own, ...allowedHosts, ...allowedHosts.map((h) => `${h}:${port}`)]);
  const origins = new Set([
    ...own.map((host) => `http://${host}`),
    ...allowedHosts.map((host) => `https://${host}`),
    ...allowOrigins,
  ]);
  return (request) => {
    if (!hosts.has(request.host)) {
      return "Forbidden host";
    }
    const { origin, site } = request;
    const frame = origin === "null" && read(request) && underPreview(request.path);
    if (origin !== undefined && !origins.has(origin) && !frame) {
      return "Forbidden origin";
    }
    if (origin === undefined && site !== undefined && !OWN_SITES.has(site) && !read(request)) {
      return "Forbidden site";
    }
    return undefined;
  };
}

/** The guard's rule, `guardCheck`, for every request the app answers. */
export function guard(options: Parameters<typeof guardCheck>[0]) {
  const check = guardCheck(options);
  return createMiddleware(async (context, next) => {
    // @hono/node-server builds the request's URL from its `Host` header.
    const url = new URL(context.req.url);
    const refusal = check({
      host: url.host,
      method: context.req.method,
      origin: context.req.header("origin"),
      path: url.pathname,
      site: context.req.header("sec-fetch-site"),
      upgrade: false,
    });
    if (refusal !== undefined) {
      return context.text(refusal, 403);
    }
    await next();
  });
}
