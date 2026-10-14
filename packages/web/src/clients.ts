// The UI's fate clients: one per repository, at `/r/<name>/fate`, so one repository's records never
// mix with another's in a cache, and the global one, at `/fate`, for the list of repositories.
import { createFateClient } from "react-fate/client";

export type FateClient = ReturnType<typeof createFateClient>;

/**
 * Gives the client of a repository, or the global one for null, each made once: `origin` is the
 * server's, the page's own when empty, and `fetch` sends its requests, the browser's by default.
 */
export function fateClients({
  origin = "",
  fetch,
}: { origin?: string; fetch?: typeof globalThis.fetch } = {}): (repo: string | null) => FateClient {
  const clients = new Map<string | null, FateClient>();
  return (repo) => {
    let client = clients.get(repo);
    if (!client) {
      const base = repo === null ? "" : `/r/${encodeURIComponent(repo)}`;
      client = createFateClient({ url: `${origin}${base}/fate`, ...(fetch ? { fetch } : {}) });
      clients.set(repo, client);
    }
    return client;
  };
}
