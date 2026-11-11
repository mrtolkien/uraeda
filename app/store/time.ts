// Times as the app shows them: in the server's time zone, whatever the device's, as a job's next
// run is read where the server runs it. Every time a screen shows goes through `serverTime`, or
// `serverClock` for the parts of one. Native Shell's JavaScript has no time zone database: the
// wall clock is read in Rust (`crates/app/src/time.rs`).
import { signal } from "nsh";
import { type ZonedClock, zonedClock } from "uraeda/native";

export type { ZonedClock };

const zone = signal<string | undefined>(undefined);

/**
 * The server's IANA time zone, `Europe/Paris`, once the shell read it: until then, times read in
 * the device's own.
 */
export const serverZone = () => zone();

/** The shell's alone: the zone the server said, from the record `Jobs`, which carries it. */
export function setServerZone(next: string | undefined) {
  if (next !== undefined && next !== zone()) zone.set(next);
}

/** An instant as the server's records give it: an RFC 3339 text, milliseconds, or a `Date`. */
export type Instant = string | number | Date;

const millis = (at: Instant) => (at instanceof Date ? at.getTime() : new Date(at).getTime());

/** The wall clock at `at` in the server's zone: its date, time, and day of the week. */
export function serverClock(at: Instant): ZonedClock {
  return zonedClock(millis(at), zone() ?? "");
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (value: number) => String(value).padStart(2, "0");
/** Days since 1970 of a clock's date, to count the days between two. */
const dayOf = (clock: ZonedClock) => Date.UTC(clock.year, clock.month - 1, clock.day) / 86_400_000;

/**
 * `at` as a person reads it, in the server's zone, as close to `now` as it is: "15:08" today,
 * "Tue 15:08" within a week either way, "12 Nov 15:08" this year, "12 Nov 2025" before.
 */
export function serverTime(at: Instant, now: Instant = Date.now()): string {
  const shown = serverClock(at);
  const today = serverClock(now);
  const time = `${two(shown.hour)}:${two(shown.minute)}`;
  const days = dayOf(shown) - dayOf(today);
  if (days === 0) return time;
  if (Math.abs(days) < 7) return `${DAYS[shown.weekday]} ${time}`;
  const date = `${shown.day} ${MONTHS[shown.month - 1]}`;
  return shown.year === today.year ? `${date} ${time}` : `${date} ${shown.year}`;
}
