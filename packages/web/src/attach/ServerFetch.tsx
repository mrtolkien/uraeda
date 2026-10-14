import { createContext, type ReactNode, useContext } from "react";

/**
 * The `fetch` of the app's plain requests to its server, like uploads: the browser's in the app,
 * the in-process server's in the happy-dom tests, as the fate client gets it.
 */
const ServerFetchContext = createContext<typeof globalThis.fetch>((input, init) =>
  globalThis.fetch(input, init),
);

/** Gives the app's plain requests a `fetch` of its own. */
export function ServerFetch({
  fetch,
  children,
}: {
  fetch: typeof globalThis.fetch;
  children: ReactNode;
}) {
  return <ServerFetchContext.Provider value={fetch}>{children}</ServerFetchContext.Provider>;
}

/** The `fetch` the app's plain requests go through. */
export function useServerFetch() {
  return useContext(ServerFetchContext);
}
