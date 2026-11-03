import type { AgentEvent, Limit } from "./events.ts";

/**
 * Why a Claude Code turn stopped or waits: the usage limit that refused it, and the one-shot
 * wakeups the agent set. Claude Code's formats stay here, in its adapter.
 */

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The server's own time zone, in IANA's words. */
const serverZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The limit of a `rate_limit_info` that refused a request: `rejected`, and not let through on usage
 * credits. `five_hour` is the session's limit; every other type, or none, is weekly, per model, or
 * a spend cap. `resetsAt` is in epoch seconds.
 */
export function limitOfInfo(info: unknown, text?: string): Limit | undefined {
  if (!isObject(info) || info.status !== "rejected" || info.isUsingOverage === true) {
    return undefined;
  }
  const reset = typeof info.resetsAt === "number" ? new Date(info.resetsAt * 1000) : undefined;
  return {
    kind: info.rateLimitType === "five_hour" ? "session" : "other",
    ...(reset && Number.isFinite(reset.getTime()) ? { resetsAt: reset.toISOString() } : {}),
    ...(text ? { text } : {}),
  };
}

/** The reset's wall-clock time, `8:40am` or `11pm`, and the zone in parentheses after it. */
const RESET_TIME = /\bresets\s+(\d{1,2})(?::(\d{2}))?\s*([ap]m)\b(?:\s*\(([^()]+)\))?/i;

/**
 * The limit a refusal's text names, for a Claude Code that sends no typed error:
 * `You've hit your session limit · resets 8:40am (Asia/Tokyo)`. Its reset is the next instant after
 * `now` with that wall-clock time, in the zone the text names, or in `zone`, the server's, without
 * one. Any other limit is `other`, and a text naming no limit gives none.
 */
export function limitOfText(text: string, now: Date, zone = serverZone()): Limit | undefined {
  if (!/\blimit\b/i.test(text)) {
    return undefined;
  }
  if (!/\bsession limit\b/i.test(text)) {
    return { kind: "other", text };
  }
  const match = RESET_TIME.exec(text);
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2] ?? 0);
  const resetsAt =
    match && hour >= 1 && hour <= 12 && minute < 60
      ? nextWallClock((hour % 12) + (match[3].toLowerCase() === "pm" ? 12 : 0), minute, now, {
          zone: match[4]?.trim() ?? zone,
        })
      : undefined;
  return { kind: "session", ...(resetsAt ? { resetsAt } : {}), text };
}

/** A wall-clock date and time, months from 1. */
type WallClock = { day: number; hour: number; minute: number; month: number; year: number };

/** The wall-clock time of an instant in a zone. Throws on an unknown zone. */
function wallClock(instant: number, zone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
    month: "numeric",
    timeZone: zone,
    year: "numeric",
  }).formatToParts(new Date(instant));
  const part = (type: string) => Number(parts.find((each) => each.type === type)?.value);
  return {
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    month: part("month"),
    year: part("year"),
  };
}

/** The instant of a wall-clock time in a zone: the day may overflow its month. */
function zonedInstant(at: WallClock, zone: string): number {
  const asUtc = ({ day, hour, minute, month, year }: WallClock) =>
    Date.UTC(year, month - 1, day, hour, minute);
  const guess = asUtc(at);
  // The zone's offset at the guess, then at the instant it gives, for a guess across a change.
  const first = guess - (asUtc(wallClock(guess, zone)) - guess);
  return guess - (asUtc(wallClock(first, zone)) - first);
}

/** The next instant after `now` at `hour:minute` in a zone, in ISO 8601; none in an unknown zone. */
function nextWallClock(
  hour: number,
  minute: number,
  now: Date,
  { zone }: { zone: string },
): string | undefined {
  let today: WallClock;
  try {
    today = wallClock(now.getTime(), zone);
  } catch {
    return undefined;
  }
  for (const days of [0, 1, 2]) {
    const instant = zonedInstant({ ...today, day: today.day + days, hour, minute }, zone);
    if (instant > now.getTime()) {
      return new Date(instant).toISOString();
    }
  }
  return undefined;
}

/** The days a one-shot cron is searched over: four years, for a 29 February. */
const CRON_DAYS = 4 * 366;

/** A cron field: a number in its range, or `*` for any. Anything else cannot be read. */
function cronField(field: string, min: number, max: number): number | "any" | undefined {
  if (field === "*") {
    return "any";
  }
  const value = /^\d+$/.test(field) ? Number(field) : Number.NaN;
  return value >= min && value <= max ? value : undefined;
}

/**
 * The next fire time of a one-shot cron, `minute hour day month weekday`, read in the server's
 * zone: a fixed minute and hour, the other fields a number or `*`. None for another cron.
 */
function cronFireTime(cron: string, now: Date): string | undefined {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    return undefined;
  }
  const [minute, hour, day, month, weekday] = [
    cronField(fields[0], 0, 59),
    cronField(fields[1], 0, 23),
    cronField(fields[2], 1, 31),
    cronField(fields[3], 1, 12),
    cronField(fields[4], 0, 7),
  ];
  if (typeof minute !== "number" || typeof hour !== "number") {
    return undefined;
  }
  if (day === undefined || month === undefined || weekday === undefined) {
    return undefined;
  }
  const matches = (date: Date) => {
    const dayMatches = day === "any" || date.getDate() === day;
    const weekdayMatches = weekday === "any" || date.getDay() === weekday % 7;
    // Cron fires on either the day or the weekday when both are set.
    const either =
      day !== "any" && weekday !== "any"
        ? dayMatches || weekdayMatches
        : dayMatches && weekdayMatches;
    return either && (month === "any" || date.getMonth() + 1 === month);
  };
  for (let days = 0; days <= CRON_DAYS; days += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, minute);
    if (date > now && matches(date)) {
      return date.toISOString();
    }
  }
  return undefined;
}

/**
 * The one-shot wakeup a tool call sets: `ScheduleWakeup` in `delaySeconds`, or a `CronCreate` that
 * does not recur. A recurring cron, or one that cannot be read, sets none.
 */
export function wakeupOf(name: string, input: Json, now: Date): Array<AgentEvent> {
  if (name === "ScheduleWakeup" && typeof input.delaySeconds === "number") {
    const at = new Date(now.getTime() + input.delaySeconds * 1000);
    return Number.isFinite(at.getTime()) ? [{ at: at.toISOString(), type: "wakeup" }] : [];
  }
  if (name === "CronCreate" && input.recurring === false && typeof input.cron === "string") {
    const at = cronFireTime(input.cron, now);
    return at ? [{ at, type: "wakeup" }] : [];
  }
  return [];
}

/**
 * The usage limit an assistant message reports refusing the turn: its typed error first, with the
 * kind and reset, else the text of a `rate_limit` error.
 */
export function limitOfMessage(message: Json, text: string, now: Date): Array<AgentEvent> {
  const params = isObject(message.api_error_params) ? message.api_error_params : {};
  const limit =
    message.api_error === "usage_limit_reached"
      ? limitOfInfo(params.rate_limit_info, text)
      : message.error === "rate_limit"
        ? limitOfText(text, now)
        : undefined;
  return limit ? [{ limit, type: "limit" }] : [];
}
