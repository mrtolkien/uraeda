import { createMiddleware } from "hono/factory";

/** What a browser's `Sec-Fetch-Site` says of a request the server's own page, or its user, sent. */
const OWN_SITES = new Set(["same-origin", "none"]);

/**
 * Rejects requests a web page could send to the local server: any `Host` but the server's own or
 * an allowed host name, as in DNS rebinding, any `Origin` but theirs and the allowed ones, and a
 * write without an `Origin` that the browser says another site sent. A request without either
 * header, from a test or `curl`, passes.
 */
export function guard({
  allowedHosts = [],
  allowOrigins,
  port,
}: {
  allowedHosts?: Array<string>;
  allowOrigins: Array<string>;
  port: number;
}) {
  const own = [`127.0.0.1:${port}`, `localhost:${port}`];
  // `tailscale serve` passes the machine's name, without a port behind HTTPS.
  const hosts = new Set([...own, ...allowedHosts, ...allowedHosts.map((h) => `${h}:${port}`)]);
  const origins = new Set([
    ...own.map((host) => `http://${host}`),
    ...allowedHosts.map((host) => `https://${host}`),
    ...allowOrigins,
  ]);

  return createMiddleware(async (context, next) => {
    // @hono/node-server builds the request's URL from its `Host` header.
    if (!hosts.has(new URL(context.req.url).host)) {
      return context.text("Forbidden host", 403);
    }
    const origin = context.req.header("origin");
    if (origin !== undefined && !origins.has(origin)) {
      return context.text("Forbidden origin", 403);
    }
    const site = context.req.header("sec-fetch-site");
    if (
      origin === undefined &&
      site !== undefined &&
      !OWN_SITES.has(site) &&
      !["GET", "HEAD"].includes(context.req.method)
    ) {
      return context.text("Forbidden site", 403);
    }
    await next();
  });
}
