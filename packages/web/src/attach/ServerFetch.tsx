import { createContext, type ReactNode, useContext, useMemo } from "react";
import { signedFetch } from "../sign-in/signedOut.ts";

/**
 * The `fetch` of the app's plain requests to its server, like uploads: the browser's in the app,
 * the in-process server's in the happy-dom tests, as the fate client gets it.
 */
const ServerFetchContext = createContext<typeof globalThis.fetch>((input, init) =>
  globalThis.fetch(input, init),
);

/** Gives the app's plain requests a `fetch` of its own. */
export function ServerFetch({
  children,
  fetch,
}: {
  children: ReactNode;
  fetch: typeof globalThis.fetch;
}) {
  return <ServerFetchContext.Provider value={fetch}>{children}</ServerFetchContext.Provider>;
}

/**
 * The `fetch` the app's plain requests go through, like uploads and image deletions: a 401 shows
 * the sign-in screen.
 */
export function useServerFetch() {
  const fetch = useContext(ServerFetchContext);
  return useMemo(() => signedFetch(fetch), [fetch]);
}
