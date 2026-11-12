// What a browser gives the shell in place of a machine's host: the server is the one that served
// the page, and the sign-in is a session's cookie, which the server sets for the access key, the
// browser keeps and sends by itself, and no script reads. So the shell gets a server that asks
// for no token, as a sandbox does: the cookie goes with the WebSocket's request.
import { UrlScheme } from "nsh";
import type { ShellHost } from "../screens/shell/host";

/** The server's address, the page's own origin: `http://127.0.0.1:4320`. */
export function origin(): string {
  return new URL(UrlScheme.url() ?? "", "http://127.0.0.1").origin;
}

/** The page's own address within the app: its path, its query, and its hash. */
export function pageAddress(): string {
  const url = new URL(UrlScheme.url() ?? "", "http://127.0.0.1");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Whether the browser is signed in at the server: it answers its own session's check. */
export async function signedIn(address: string): Promise<boolean> {
  return (await fetch(`${address}/session`)).ok;
}

/**
 * Signs the browser in with the access key: the server sets the session's cookie. It fails with
 * the server's words, as for a key that is not its own.
 */
export async function signIn(address: string, key: string): Promise<void> {
  const answer = await fetch(`${address}/session`, {
    body: JSON.stringify({ key }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (answer.ok) return;
  let words = `The server answered ${answer.status}.`;
  try {
    const body = (await answer.json()) as { error?: unknown };
    if (typeof body.error === "string") words = body.error;
  } catch {
    // An answer that is not the server's own JSON: its status says what it can.
  }
  throw new Error(words);
}

/**
 * The shell's host in a signed-in browser. A session the server ended, signed out elsewhere or
 * by a new key, is `signedOut`: the page asks for the key again.
 */
export function webHost(address: string, signedOut: () => void): ShellHost {
  return {
    forget: () => Promise.resolve(signedOut()),
    pair: () => Promise.reject(new Error("A browser signs in with the access key.")),
    server: () => Promise.resolve({ address, local: false, open: true }),
    token: () => Promise.resolve(null),
  };
}
