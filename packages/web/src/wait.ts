// What a run waiting to continue by itself reads: when Uraeda continues it, in the reader's locale.
import type { Wait } from "uraeda-server/status";

/** "Waiting until 8:41": the time the run continues, its hours and minutes. */
export function waitLabel(wait: Wait): string {
  const time = new Date(wait.at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Waiting until ${time}`;
}
