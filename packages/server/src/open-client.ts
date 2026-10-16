// A second start's side of the handoff: it asks the server already on the port to open its folder,
// or to make a new key, with the host token, and never touches the list, the session cache, or the
// sign-in file itself (R3).
import type { OpenAnswer, OpenRequest } from "./open.ts";

/**
 * What the server on the port did: opened the folder, with the address the browser opens, refused
 * it, refused the host token, as a server with another data folder does, or is another program.
 */
export type HandOff =
  | { kind: "opened"; signIn: string; url: string }
  | { error: string; kind: "refused" }
  | { kind: "unauthorized" }
  | { kind: "other" };

/** The headers of a request to the server on the port, with the host token when there is one. */
const headers = (token: string | undefined): Record<string, string> => ({
  "content-type": "application/json",
  ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
});

/**
 * Whether a page of the answer is a path on the server: it starts with `/`, never `//` or `/\`,
 * which a browser may take for another site, so the browser opens nothing but the server's pages.
 */
const onServer = (path: unknown): path is string =>
  typeof path === "string" && /^\/(?![/\\])/.test(path);

/**
 * Asks the server on 127.0.0.1:`port` to open `request.folder`, with the host token `token`, within
 * `timeoutMs`, 2000 by default. "refused" for a 400 with an `error`; "unauthorized" for a 401;
 * "other" for a refused connection, a timeout, an answer without `uraeda`, or one whose `url` or
 * `signIn` is not a path on the server. An answer without `signIn`, from a server without sign-in,
 * opens the page itself.
 */
export async function handOff(
  port: number,
  request: OpenRequest,
  token?: string,
  timeoutMs = 2000,
): Promise<HandOff> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/open`, {
      body: JSON.stringify(request),
      headers: headers(token),
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await response.json().catch(() => null)) as Partial<
      OpenAnswer & { error: string }
    > | null;
    if (response.status === 401) {
      return { kind: "unauthorized" };
    }
    if (response.status === 400 && typeof body?.error === "string") {
      return { error: body.error, kind: "refused" };
    }
    const signIn = body?.signIn ?? body?.url;
    if (response.ok && typeof body?.uraeda === "string" && onServer(body.url) && onServer(signIn)) {
      return { kind: "opened", signIn, url: body.url };
    }
  } catch {
    // A refused connection or a timeout: not a server that answers.
  }
  return { kind: "other" };
}

/**
 * Asks the server on 127.0.0.1:`port` for a new access key, with the host token: the key, or
 * undefined when it refuses or does not answer within `timeoutMs`.
 */
export async function newKeyOn(
  port: number,
  token: string,
  timeoutMs = 2000,
): Promise<string | undefined> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/session/key`, {
      headers: headers(token),
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await response.json().catch(() => null)) as { key?: unknown } | null;
    return response.ok && typeof body?.key === "string" ? body.key : undefined;
  } catch {
    return undefined;
  }
}
