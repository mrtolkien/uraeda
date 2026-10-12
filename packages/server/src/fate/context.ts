/** The binding, as the server loads it. */
export type Binding = typeof import("uraeda-binding");

/** fate's request context: the repository the server reads and writes, through the binding. */
export type Context = { binding: Binding; repo: string };
