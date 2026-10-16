// The session check: the only place that decides whether a request may pass without a session,
// and the session cookie's name and attributes.
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { SERVER_PATHS } from "../server-paths.ts";
import type { OneTimeLinks } from "./links.ts";
import { SESSION_DAYS, type SignInStore } from "./store.ts";
import { hash, sameHash } from "./tokens.ts";

/**
 * Sign-in, as `createApp` takes it: the store of the key and sessions, the one-time links, and the
 * host token that `/open` and `/session/key` accept from the host's own `uraeda`, if any. `log`
 * prints a failed sign-in, to the standard error by default, and `wait` delays its answer, a timer
 * by default: tests record them instead.
 */
export type SignInOptions = {
  hostToken?: string;
  links: OneTimeLinks;
  log?: (line: string) => void;
  store: SignInStore;
  wait?: (ms: number) => Promise<void>;
};

/**
 * The signed-in device of a request, as the check sets it on the context, `device`: its session's
 * ID, and the signal aborted when that session ends. Named apart from the agents' sessions.
 */
export type Device = { id: string; signal: AbortSignal };

type DeviceContext = Context<{ Variables: { device?: Device } }>;

/** The cookie's lifetime, in seconds: as long as a session may go unused. */
const COOKIE_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

/**
 * The session cookie's name: `__Host-uraeda` over HTTPS, where it is `Secure`, else `uraeda`. A
 * request counts as HTTPS when its `Host` is a listed host name, exactly: only a proxy on this
 * machine sends one, ending HTTPS, so its `X-Forwarded-For` is the proxy's too.
 */
export function cookieName(host: string, allowedHosts: Array<string>): "__Host-uraeda" | "uraeda" {
  return allowedHosts.includes(host) ? "__Host-uraeda" : "uraeda";
}

/** The cookie's attributes, for a cookie named `name`. */
const attributes = (name: string) =>
  ({
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: name === "__Host-uraeda",
  }) as const;

/** The name of the request's session cookie, by its `Host`. */
const nameOf = (context: Context, allowedHosts: Array<string>) =>
  cookieName(new URL(context.req.url).host, allowedHosts);

/** Sets the session cookie on the answer, `value` being `<id>.<secret>`, for 30 days. */
export function setSessionCookie(context: Context, allowedHosts: Array<string>, value: string) {
  const name = nameOf(context, allowedHosts);
  setCookie(context, name, value, { ...attributes(name), maxAge: COOKIE_MAX_AGE });
}

/** Clears the session cookie in the browser. */
export function clearSessionCookie(context: Context, allowedHosts: Array<string>) {
  const name = nameOf(context, allowedHosts);
  deleteCookie(context, name, attributes(name));
}

/**
 * The answer to a request without a session: 401, never cached, its stale cookie cleared, so it is
 * never sent or refreshed again.
 */
export function refused(context: Context, allowedHosts: Array<string>) {
  if (getCookie(context, nameOf(context, allowedHosts)) !== undefined) {
    clearSessionCookie(context, allowedHosts);
  }
  context.header("Cache-Control", "no-store");
  return context.json({ error: "Sign in to Uraeda." }, 401);
}

/**
 * The address a request came from, for the log: `X-Forwarded-For`'s first entry when the `Host` is
 * a listed host name, else the connection's, else `unknown`. A request called in process, as the
 * tests do, has no connection.
 */
export function address(context: Context, allowedHosts: Array<string>): string {
  const forwarded = context.req.header("x-forwarded-for")?.split(",")[0].trim();
  if (forwarded && nameOf(context, allowedHosts) === "__Host-uraeda") {
    return forwarded;
  }
  try {
    return getConnInfo(context).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Whether a request carries `Authorization: Bearer <host token>`, compared in constant time: never
 * without a host token.
 */
export function fromHost(context: Context, hostToken: string | undefined): boolean {
  return (
    hostToken !== undefined &&
    sameHash(hash(context.req.header("authorization") ?? ""), hash(`Bearer ${hostToken}`))
  );
}

/** The `/session` routes a request without a session may reach: all but `/session/key`. */
const OPEN_PATHS = /^\/session(\/(?!key$)[^/]+)?$/;

/** The routes the host's own `uraeda` calls with the host token. */
const HOST_PATHS = new Set(["/open", "/session/key"]);

/**
 * The session check, Hono middleware after the guard. A path that is not the server's is the
 * built UI's, and passes; so do a frame path that `frames` allows, `/open` and `/session/key` with
 * `Authorization: Bearer <host token>`, and the `/session` routes. Every other request needs the
 * cookie of a session the store finds, or gets 401. A found session is set on the context as
 * `device`, on the open routes too; one used for the first time in a day sets its cookie again,
 * unless the request ended it.
 */
export function sessionCheck(
  options: SignInOptions & {
    allowedHosts: Array<string>;
    frames?: { allows(path: string): boolean };
  },
) {
  const { allowedHosts, frames, hostToken, store } = options;
  const byHost = (context: Context, path: string) =>
    HOST_PATHS.has(path) && fromHost(context, hostToken);
  return createMiddleware(async (context: DeviceContext, next) => {
    const path = context.req.path;
    if (!SERVER_PATHS.test(path) || frames?.allows(path) || byHost(context, path)) {
      await next();
      return;
    }
    const cookie = getCookie(context, nameOf(context, allowedHosts));
    const found = store.findSession(cookie);
    if (!found) {
      if (!OPEN_PATHS.test(path)) {
        return refused(context, allowedHosts);
      }
      await next();
      return;
    }
    const device = { id: found.id, signal: store.signal(found.id) };
    context.set("device", device);
    await next();
    if (found.refreshed && !device.signal.aborted) {
      setSessionCookie(context, allowedHosts, cookie!);
    }
  });
}

/**
 * The request fate's live GET is handed: the same, its signal also aborted when the device's
 * session ends, so signing out closes its streams. Without a device, the request itself.
 */
export function withDevice(context: {
  get(key: "device"): Device | undefined;
  req: { raw: Request };
}): Request {
  const device = context.get("device");
  const request = context.req.raw;
  return device === undefined
    ? request
    : new Request(request, { signal: AbortSignal.any([request.signal, device.signal]) });
}
