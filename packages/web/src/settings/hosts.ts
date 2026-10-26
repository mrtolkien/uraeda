// The allowed host names' rule that needs no page: which removal would cut this browser off.

/** The names that reach the server whatever its settings say. */
const ALWAYS_ALLOWED = new Set(["127.0.0.1", "localhost"]);

/**
 * Whether removing `name` cuts this browser off: it is the host name the browser reached the
 * server through, `browser`, not one that always passes, and the file's names are in force, which
 * `source` says: a flag or a variable overriding the list leaves the file's names unused.
 */
export function cutsOff(name: string, browser: string, source: { kind: string }): boolean {
  const host = browser.toLowerCase();
  return !ALWAYS_ALLOWED.has(host) && source.kind === "file" && name === host;
}
