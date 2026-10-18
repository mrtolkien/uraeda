// A feature's tokens, summed over its session's turns: what the model read for the first time,
// cache writes included, and what it wrote. Re-reads from the cache are left out.
import type { TurnRow } from "../runner/cache.ts";

/**
 * A feature's tokens: `input` is fresh input plus cache writes, `output` the output, `since` the
 * first counted turn's start, and `partial` whether a turn done before it has no counts. A turn
 * killed, stopped, or failed before its result has none either, but the next turn of its agent
 * session counts its work.
 */
export type FeatureTokens = { input: number; output: number; partial: boolean; since: string };

/** The tokens of a session's turns, in order; null when no turn has counts. */
export function featureTokens(turns: ReadonlyArray<TurnRow>): FeatureTokens | null {
  const first = turns.findIndex((turn) => turn.tokens !== null);
  // A counted turn has ended: it has a time.
  const since = turns[first]?.startedAt ?? turns[first]?.endedAt;
  if (!since) {
    return null;
  }
  let input = 0;
  let output = 0;
  for (const { tokens } of turns) {
    input += (tokens?.input ?? 0) + (tokens?.cacheWrite ?? 0);
    output += tokens?.output ?? 0;
  }
  return {
    input,
    output,
    partial: turns.slice(0, first).some((turn) => turn.state === "done"),
    since,
  };
}
