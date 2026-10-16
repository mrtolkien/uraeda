// The UI's fate clients: one per repository, at `/r/<name>/fate`, so one repository's records never
// mix with another's in a cache, and the global one, at `/fate`, for the list of repositories.
import { createFateClient } from "react-fate/client";
import { probeSession, signedFetch } from "./sign-in/signedOut.ts";

export type FateClient = ReturnType<typeof createFateClient>;

/**
 * Gives the client of a repository, or the global one for null, each made once: `origin` is the
 * server's, the page's own when empty, and `fetch` sends its requests, the browser's by default. A
 * 401 to any of them, or a live stream that fails while `GET /session` answers 401, shows the
 * sign-in screen.
 */
export function fateClients({
  fetch,
  origin = "",
}: { fetch?: typeof globalThis.fetch; origin?: string } = {}): (repo: string | null) => FateClient {
  const clients = new Map<string | null, FateClient>();
  const signed = signedFetch(fetch);
  const onLiveError = () => void probeSession(fetch, origin);
  return (repo) => {
    let client = clients.get(repo);
    if (!client) {
      const base = repo === null ? "" : `/r/${encodeURIComponent(repo)}`;
      client = createFateClient({ fetch: signed, onLiveError, url: `${origin}${base}/fate` });
      clients.set(repo, client);
    }
    return client;
  };
}
