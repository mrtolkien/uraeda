import { createMiddleware } from "hono/factory";

/**
 * Rejects requests a web page could send to the local server: any `Host` but the server's own,
 * as in DNS rebinding, and any `Origin` but the server's own and the allowed ones.
 */
export function guard({ port, allowOrigins }: { port: number; allowOrigins: Array<string> }) {
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const origins = new Set([...[...hosts].map((host) => `http://${host}`), ...allowOrigins]);

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
