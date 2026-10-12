import type { Runner } from "../runner/runner.ts";

/** The binding, as the server loads it. */
export type Binding = typeof import("uraeda-binding");

/**
 * fate's request context: the repository the server reads and writes, through the binding, and the
 * runner that starts agents on its features.
 */
export type Context = { binding: Binding; repo: string; runner: Runner };
