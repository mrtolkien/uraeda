// A write over the hash of a file as the browser holds it: the inbox and the priorities, kept up to
// date by the server's live updates, so a write waits for no read first. A hash gone stale is
// refused by the server as a conflict, and read again from the server for one more try.
import { refusal } from "./errors.ts";

/** How a read before a write reads: from what the browser holds, or from the server. */
export type BaseMode = "cache-first" | "network-only";

/** Whether `error` is the server's refusal of a write over a stale hash. */
function isConflict(error: unknown) {
  return error !== undefined && error !== null && refusal(error).kind === "conflict";
}

/** Whether a write's outcome, an answer with an `error` or not, is a conflict. */
function conflicted(outcome: unknown) {
  return typeof outcome === "object" && outcome !== null && "error" in outcome
    ? isConflict(outcome.error)
    : false;
}

/**
 * Writes over `read`'s base, a hash or the record it is in, as the browser holds it. A conflict,
 * answered or thrown, reads the base from the server and writes once more over it: a second
 * conflict is the caller's to show.
 */
export async function withFreshBase<B, T>(
  read: (mode: BaseMode) => Promise<B>,
  write: (base: B) => Promise<T>,
): Promise<T> {
  try {
    const outcome = await write(await read("cache-first"));
    if (!conflicted(outcome)) {
      return outcome;
    }
  } catch (error) {
    if (!isConflict(error)) {
      throw error;
    }
  }
  return write(await read("network-only"));
}
