// The extensions' routes: each one's `/x/<name>/…`, globally and under a repository's `/r/<repo>`,
// and the page bundle the page runtime fetches. All are server paths, so the session check closes
// them as it closes `/fate`. A route, and the page bundle, refuse a request another site sent,
// whatever its method: the session's cookie goes with a link followed from another site, a route
// may act on a GET, and a page bundle holds the extension's code.
import type { Context, Hono } from "hono";
import type { FateVariables } from "../fate.ts";
import type { Hosts } from "../repositories.ts";
import type { ExtensionsHost } from "./server.ts";

/** Whether a browser says another site, or another port of this one, sent the request. */
const fromOtherSite = (c: Context) =>
  ["cross-site", "same-site"].includes(c.req.header("sec-fetch-site") ?? "");

/** Adds the extensions' routes to `app`. */
export function extensionRoutes(
  app: Hono<{ Variables: FateVariables }>,
  extensions: ExtensionsHost,
  hosts: Pick<Hosts, "current">,
): void {
  app.get("/extensions/:name/page", (c) => {
    if (fromOtherSite(c)) {
      return c.text("Refused: another site sent this request", 403);
    }
    const bundle = extensions.pageBundle(c.req.param("name"));
    c.header("Cache-Control", "no-store");
    return bundle ? c.json(bundle) : c.json({ error: "no page" }, 404);
  });
  app.all("/x/:extension/*", async (c) => {
    if (fromOtherSite(c)) {
      return c.text("Refused: another site sent this request", 403);
    }
    return extensions.answer(c, c.req.param("extension"), c.req.path, null);
  });
  app.all("/r/:name/x/:extension/*", async (c) => {
    if (fromOtherSite(c)) {
      return c.text("Refused: another site sent this request", 403);
    }
    const name = c.req.param("name");
    const host = await hosts.current(name);
    if (!host) {
      return c.text(`No repository named “${name}”`, 404);
    }
    const path = c.req.path.replace(/^\/r\/[^/]+/, "");
    return extensions.answer(c, c.req.param("extension"), path, host.name);
  });
}
