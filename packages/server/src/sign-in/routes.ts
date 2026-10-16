// Signing in and out: `/session` and `/sessions`. The session check runs before them, and sets the
// device a valid cookie names.
import { type Context, Hono, type Next } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  address,
  clearSessionCookie,
  type Device,
  fromHost,
  refused,
  setSessionCookie,
  type SignInOptions,
} from "./check.ts";

type SignInContext = Context<{ Variables: { device?: Device } }>;

/** The largest body `POST /session` reads, before anyone signed in: a key is 47 characters. */
const SIGN_IN_BODY = 4 * 1024;

/** The origin a redirect's target is resolved against: one no request has. */
const NOWHERE = "http://redirect.invalid";

/**
 * A redirect's target as a path on this server: `to` when it resolves on the server itself, else
 * `/`. `//evil.com`, `/\evil.com`, and a full address lead to another site, and are refused.
 */
function onServer(to: string | undefined): string {
  if (to?.startsWith("/")) {
    try {
      if (new URL(to, NOWHERE).origin === NOWHERE) {
        return to;
      }
    } catch {
      // Not a URL: the server's root instead.
    }
  }
  return "/";
}

/** Every answer of the session routes is never cached: they set and clear the session cookie. */
async function noStore(context: Context, next: Next) {
  await next();
  context.header("Cache-Control", "no-store");
}

/**
 * The session routes, mounted at `/`: `GET /session`, 204 when signed in, else 401; `POST /session`
 * with `{ key }`, which signs the device in, or after a second answers 401 and logs the address, a
 * body over 4 KB refused at once with 413; `DELETE /session`, which signs it out; `DELETE
 * /sessions`, which signs every device out, past the session check; and
 * `GET /session/<token>?to=<path>`, a one-time link, which signs in once and
 * redirects to its path on the server; and `POST /session/key` with the host token, which makes a
 * new access key, signs every device out, and answers `{ key }`. Signing in again ends the session
 * the device had.
 */
export function signInRoutes(options: SignInOptions & { allowedHosts: Array<string> }) {
  const {
    allowedHosts,
    hostToken,
    links,
    log = (line) => process.stderr.write(`${line}\n`),
    store,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;
  /** Makes the device's new session, ending the one it had, and sets its cookie. */
  const signIn = (context: SignInContext) => {
    const device = context.get("device");
    if (device) {
      store.endSession(device.id);
    }
    setSessionCookie(context, allowedHosts, store.createSession());
  };
  const app = new Hono<{ Variables: { device?: Device } }>();
  for (const path of ["/session", "/session/*", "/sessions"]) {
    app.use(path, noStore);
  }
  app.get("/session", (context) =>
    context.get("device") ? context.body(null, 204) : refused(context, allowedHosts),
  );
  app.post("/session", bodyLimit({ maxSize: SIGN_IN_BODY }), async (context) => {
    const body = (await context.req.json().catch(() => null)) as { key?: unknown } | null;
    if (typeof body?.key !== "string" || !store.checkKey(body.key)) {
      await wait(1000);
      log(`uraeda: failed sign-in from ${address(context, allowedHosts)}`);
      return context.json({ error: "This is not Uraeda's access key." }, 401);
    }
    signIn(context);
    return context.body(null, 204);
  });
  app.delete("/session", (context) => {
    const device = context.get("device");
    if (device) {
      store.endSession(device.id);
    }
    clearSessionCookie(context, allowedHosts);
    return context.body(null, 204);
  });
  app.delete("/sessions", (context) => {
    store.endAll();
    clearSessionCookie(context, allowedHosts);
    return context.body(null, 204);
  });
  // The session check lets a signed-in request through too: only the host token makes a new key.
  app.post("/session/key", (context) =>
    fromHost(context, hostToken)
      ? context.json({ key: store.replaceKey() })
      : context.json({ error: "Sign in to Uraeda." }, 401),
  );
  app.get("/session/:token", (context) => {
    const to = links.use(context.req.param("token"));
    if (to !== undefined) {
      signIn(context);
    }
    return context.redirect(onServer(to ?? context.req.query("to")), 303);
  });
  return app;
}
