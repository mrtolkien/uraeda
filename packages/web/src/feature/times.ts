// The feature page's times, in the browser's time zone: a time, with its date only when the day
// changes, a duration, and a day.

const DAY = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" });
const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
});

/** A date-only string, `YYYY-MM-DD`, as a folder's or a record's day. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A time or a day as a `Date`: a day alone is its local midnight, so it never shifts a day. */
function parse(isoOrDate: string): Date {
  return new Date(DATE_ONLY.test(isoOrDate) ? `${isoOrDate}T00:00:00` : isoOrDate);
}

/** The local calendar day of a date, to compare two. */
function localDay(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * A time, "12:11", or "Oct 18, 09:10" when its local day differs from `previous`'s: the page's
 * header gives the first day, so a date shows only where the day changes.
 */
export function clock(iso: string, previous?: string): string {
  const date = parse(iso);
  const time = TIME.format(date);
  return previous !== undefined && localDay(parse(previous)) !== localDay(date)
    ? `${DAY.format(date)}, ${time}`
    : time;
}

/** A duration in seconds: "< 1 min", "26 min", "2 h 50 min", or "1 d 3 h". */
export function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) {
    return "< 1 min";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
  }
  const days = Math.floor(hours / 24);
  return hours % 24 === 0 ? `${days} d` : `${days} d ${hours % 24} h`;
}

/** A day, "Oct 17", from a time or a date-only string. */
export function day(isoOrDate: string): string {
  return DAY.format(parse(isoOrDate));
}
