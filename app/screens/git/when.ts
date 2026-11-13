// When something happened, in words a person says: "just now", "4 min ago", "3 h ago", then the
// day, "yesterday" or "16 Oct", in the server's zone.
import { serverDay } from "../../store";

/** `seconds`, Unix seconds, against `now`, in milliseconds. */
export function ago(seconds: number, now: number = Date.now()): string {
  const passed = Math.max(0, Math.floor(now / 1000 - seconds));
  if (passed < 60) return "just now";
  if (passed < 3600) return `${Math.floor(passed / 60)} min ago`;
  if (passed < 86_400) return `${Math.floor(passed / 3600)} h ago`;
  if (passed < 2 * 86_400) return "yesterday";
  return serverDay(seconds * 1000, now);
}
