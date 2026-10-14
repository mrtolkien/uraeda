import type { Hosts } from "../repositories.ts";
import type { Sessions } from "../runner/sessions.ts";

/** The binding, as the server loads it. */
export type Binding = typeof import("uraeda-binding");

/**
 * fate's request context: the repository the server reads and writes, through the binding, the
 * session manager that talks to agents about its features, and without one, the hosts of every
 * listed repository, and the data folder holding their list.
 */
export type Context = {
  binding: Binding;
  sessions: Sessions;
  hosts: Hosts;
  dataDir: string;
  repo: string;
};
