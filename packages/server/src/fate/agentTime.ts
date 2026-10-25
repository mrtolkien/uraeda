// A feature's agent time, from its sessions' turns: the seconds its turns ran, and the start of the
// one running now, so the browser counts that one to the present.
import type { TurnRow } from "../runner/cache.ts";

/**
 * A feature's agent time: `seconds` is the sum over ended turns, and `runningSince` the start of a
 * turn running now, which the browser adds as `now - runningSince`.
 */
export type FeatureAgent = { runningSince: string | null; seconds: number };

/**
 * The agent time of a feature's turns; null when no turn has a start. A turn with no end that is not
 * running (queued, or failed or killed without an end) adds nothing: its time cannot be counted, and
 * is not guessed.
 */
export function agentTime(turns: ReadonlyArray<TurnRow>): FeatureAgent | null {
  if (!turns.some((turn) => turn.startedAt !== null)) {
    return null;
  }
  let seconds = 0;
  let runningSince: string | null = null;
  for (const { endedAt, startedAt, state } of turns) {
    if (startedAt === null) {
      continue;
    }
    if (endedAt !== null) {
      const elapsed = (Date.parse(endedAt) - Date.parse(startedAt)) / 1000;
      // A clock set back leaves a negative span: not a time that ran.
      seconds += Math.max(0, elapsed);
    } else if (state === "running") {
      runningSince = startedAt;
    }
  }
  return { runningSince, seconds };
}
