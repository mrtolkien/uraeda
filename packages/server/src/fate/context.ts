import type { Sessions } from "../runner/sessions.ts";

/** The binding, as the server loads it. */
export type Binding = typeof import("uraeda-binding");

/**
 * fate's request context: the repository the server reads and writes, through the binding, and the
 * session manager that talks to agents about its features, and without one.
 */
export type Context = { binding: Binding; repo: string; sessions: Sessions };
