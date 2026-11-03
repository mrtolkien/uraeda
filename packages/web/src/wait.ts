// What a run waiting to continue by itself reads: when Uraeda continues it, in the reader's locale.
import type { Wait } from "uraeda-server/status";

/** "8:41": the time the run continues, its hours and minutes, in the reader's locale. */
export function waitTime(wait: Wait): string {
  return new Date(wait.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "Waiting until 8:41": the time the run continues, its hours and minutes. */
export function waitLabel(wait: Wait): string {
  return `Waiting until ${waitTime(wait)}`;
}

/** A status's label, as a status mark reads it: when the run continues, while it waits. */
export function statusLabel(status: { label: string; wait?: Wait | null }): string {
  return status.wait ? waitLabel(status.wait) : status.label;
}
