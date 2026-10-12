import { createMiddleware } from "hono/factory";

/**
 * Rejects requests a web page could send to the local server: any `Host` but the server's own or
 * an allowed host name, as in DNS rebinding, and any `Origin` but theirs and the allowed ones.
 */
export function guard({
  port,
  allowedHosts = [],
  allowOrigins,
}: {
  port: number;
  allowedHosts?: Array<string>;
  allowOrigins: Array<string>;
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
    await next();
  });
}
