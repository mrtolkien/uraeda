// Whether this browser is signed out: learnt from a 401 of any request the UI sends but its own
// sign-in, through `signedFetch`, or from `GET /session` once a live stream fails. Once set, the app
// shows the sign-in screen until the page loads again.
import { useSyncExternalStore } from "react";

let signedOut = false;
const listeners = new Set<() => void>();

/** Sets the signed-out state: the app shows the sign-in screen. */
export function markSignedOut() {
  if (signedOut) {
    return;
  }
  signedOut = true;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Forgets the signed-out state, as a new page load does. Tests, which mount the app many times in
 * one module, start each one signed in again.
 */
export function forgetSignedOut() {
  signedOut = false;
  for (const listener of listeners) {
    listener();
  }
}

/** Whether this browser is signed out, drawn again when it changes. */
export function useSignedOut(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => signedOut,
  );
}

/** The browser's `fetch`, looked up at each call. */
const browserFetch: typeof globalThis.fetch = (input, init) => globalThis.fetch(input, init);

/** The path a request goes to. */
function pathOf(input: Parameters<typeof globalThis.fetch>[0]): string {
  const url = typeof input === "string" ? input : "url" in input ? input.url : input.href;
  return new URL(url, "http://uraeda.invalid").pathname;
}

/**
 * `fetch`, the browser's by default, that sets the signed-out state on a 401 from any path but
 * `/session`, whose 401 is a wrong key or the check of `probeSession`.
 */
export function signedFetch(
  fetch: typeof globalThis.fetch = browserFetch,
): typeof globalThis.fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    if (response.status === 401 && pathOf(input) !== "/session") {
      markSignedOut();
    }
    return response;
  };
}

/**
 * Asks the server whether this browser is still signed in, `GET /session` on `origin`, the page's
 * own by default: a 401 sets the signed-out state. Called when a live stream fails, since a closed
 * `EventSource` gives no status. A server out of reach changes nothing.
 */
export async function probeSession(
  fetch: typeof globalThis.fetch = browserFetch,
  origin = "",
): Promise<void> {
  try {
    const response = await fetch(`${origin}/session`);
    if (response.status === 401) {
      markSignedOut();
    }
  } catch {
    // Out of reach: the live stream tries again, and the next request tells.
  }
}
