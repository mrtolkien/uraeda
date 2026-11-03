// The global fate client, `/fate`, which reads and changes the list of repositories and the
// settings, beside each repository's own client: what the shell's readers of the settings and the
// repository menu reach it through.
import { createContext, type ReactNode, use } from "react";
import { FateClient } from "react-fate";
import type { FateClient as Client } from "./clients.ts";

/**
 * The global fate client, set by `App` around a repository's pages, whose own client is in context
 * there; outside them, the client in context is the global one.
 */
export const ListClientContext = createContext<Client | null>(null);

/** Its children on the global client, which reads and changes the list and the settings. */
export function OnListClient({ children }: { children: ReactNode }) {
  const client = use(ListClientContext);
  return client ? <FateClient client={client}>{children}</FateClient> : children;
}
