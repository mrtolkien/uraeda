import type { Limit, UsageWindow } from "./events.ts";

/**
 * Codex's usage windows and the limits that refuse its turns, from its `RateLimitSnapshot` and a
 * failed turn's `TurnError`. Codex's formats stay here, in its adapter.
 */

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A window of a snapshot, as Codex sends it: its share used in percent, its length, its reset. */
type CodexWindow = { minutes?: number; resetsAt?: string; used: number };

/**
 * The windows Claude Code also has, by their length in minutes, with Claude Code's IDs and labels,
 * so the usage pane draws both agents' windows alike.
 */
const KNOWN: Record<number, { id: string; label: string }> = {
  10_080: { id: "seven_day", label: "Week" },
  300: { id: "five_hour", label: "5h" },
};

/** The window that resets every five hours, Codex's session limit. */
const SESSION_MINUTES = 300;

/** A length for people: `1h`, `2d`, or `45m`. */
function lengthLabel(minutes: number): string {
  if (minutes % 1440 === 0) {
    return `${minutes / 1440}d`;
  }
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
}

/** One of a snapshot's windows, `primary` or `secondary`; none when malformed or absent. */
function windowOf(limits: unknown, key: "primary" | "secondary"): CodexWindow | undefined {
  const window = isObject(limits) ? limits[key] : undefined;
  if (!isObject(window) || typeof window.usedPercent !== "number") {
    return undefined;
  }
  const used = window.usedPercent;
  if (!Number.isFinite(used) || used < 0) {
    return undefined;
  }
  const minutes = window.windowDurationMins;
  const reset = typeof window.resetsAt === "number" ? new Date(window.resetsAt * 1000) : undefined;
  return {
    used,
    ...(typeof minutes === "number" && minutes > 0 ? { minutes } : {}),
    ...(reset && Number.isFinite(reset.getTime()) ? { resetsAt: reset.toISOString() } : {}),
  };
}

const windowsOf = (limits: unknown): Array<CodexWindow & { key: string }> =>
  (["primary", "secondary"] as const).flatMap((key) => {
    const window = windowOf(limits, key);
    return window ? [{ key, ...window }] : [];
  });

/**
 * The usage windows of a rate-limit snapshot: the five-hour and weekly windows by Claude Code's IDs
 * and labels, any other by its length. A window without its reset is left out, and the other kept.
 */
export function codexWindows(limits: unknown): Array<UsageWindow> {
  return windowsOf(limits).flatMap(({ key, minutes, resetsAt, used }): Array<UsageWindow> => {
    if (resetsAt === undefined) {
      return [];
    }
    const named =
      minutes === undefined
        ? { id: key, label: key === "primary" ? "Primary" : "Secondary" }
        : (KNOWN[minutes] ?? { id: `${minutes}m`, label: lengthLabel(minutes) });
    // A tenth of a percent, as Claude Code's are.
    const share = Math.min(1, Math.round(used * 10) / 1000);
    return [{ ...named, resetsAt, used: share }];
  });
}

/**
 * The window a refusal falls back to when none reads full yet, the snapshot lagging the refusal:
 * the primary window when it is the five-hour one with its reset, so the run resumes by itself.
 */
function sessionWindow(windows: Array<CodexWindow & { key: string }>) {
  const primary = windows.find((window) => window.key === "primary");
  return primary?.minutes === SESSION_MINUTES && primary.resetsAt !== undefined
    ? primary
    : undefined;
}

/** Whether a turn's error is Codex's usage limit. */
const isUsageLimit = (error: unknown): boolean =>
  isObject(error) && error.codexErrorInfo === "usageLimitExceeded";

/**
 * The limit that refused a turn: a failed turn's `usageLimitExceeded` error, or a snapshot with its
 * `rateLimitReachedType` set. It is `session` when the five-hour window is the full one that
 * resets last, or when no window reads full and the primary one is the five-hour window, and
 * resumes at that window's reset; credits run out, or a full weekly window, are `other`. `text` is
 * the error's message.
 */
export function codexLimit(limits: unknown, error?: unknown): Limit | undefined {
  const reached = isObject(limits) ? limits.rateLimitReachedType : undefined;
  const refused = isUsageLimit(error) || (typeof reached === "string" && reached !== "");
  if (!refused) {
    return undefined;
  }
  const message = isObject(error) && typeof error.message === "string" ? error.message : "";
  const text = message === "" ? {} : { text: message };
  // Credits run out: no window resets them.
  if (typeof reached === "string" && reached !== "" && reached !== "rate_limit_reached") {
    return { kind: "other", ...text };
  }
  const windows = windowsOf(limits);
  const full =
    windows
      .filter((window) => window.used >= 100 && window.resetsAt !== undefined)
      .toSorted((a, b) => (a.resetsAt! < b.resetsAt! ? 1 : -1))[0] ?? sessionWindow(windows);
  return {
    kind: full?.minutes === SESSION_MINUTES ? "session" : "other",
    ...(full?.resetsAt === undefined ? {} : { resetsAt: full.resetsAt }),
    ...text,
  };
}
