// A job's schedule and its times in words, as its card and its page read them, in the server's
// time zone, the one its schedules run in (`serverClock`), whatever the device's: "Every day at
// 3:00", "Tomorrow at 3:00", "Skipped: the change “Upgrade” is still open.".
import { serverClock, serverDaysAgo } from "../../store";
import type { Job, JobRun, JobSchedule } from "../../store/protocol";
import type { CardFact } from "../../ui/lists";

/** The days, Monday first, as the core numbers them from 1. */
export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** A time of day, the hour unpadded: "3:00", "16:05". */
const clock = (at: { hour: number; minute: number }) =>
  `${at.hour}:${String(at.minute).padStart(2, "0")}`;

/** The schedule in words: "Every hour", "Every day at 3:00", "Every Monday at 4:00", "Weekdays at 5:00". */
export function scheduleWords(schedule: JobSchedule): string {
  switch (schedule.kind) {
    case "hourly":
      return "Every hour";
    case "weekdays":
      return `Weekdays at ${clock(schedule)}`;
    case "weekly":
      return `Every ${DAY_NAMES[(schedule.day ?? 1) - 1]} at ${clock(schedule)}`;
    default:
      return `Every day at ${clock(schedule)}`;
  }
}

/** The job's schedule as its card says it: in words, or as written when it is not understood. */
export const whenItRuns = (job: Pick<Job, "schedule" | "scheduleText">) =>
  job.schedule === null ? `“${job.scheduleText}”` : scheduleWords(job.schedule);

/**
 * A time ahead or past, as a person says it: "Today at 3:00", "Tomorrow at 3:00", then a day
 * ahead by its name and date, "Monday 16 November at 4:00"; a day past is "Yesterday at 4:00",
 * its name within the week, "Saturday at 5:00", and its date after, "2 November at 5:00". Another
 * year's date says its year.
 */
export function whenWords(at: string, now: number): string {
  const then = serverClock(at);
  const today = serverClock(now);
  const days = -serverDaysAgo(at, now);
  const time = clock(then);
  const year = then.year === today.year ? "" : ` ${then.year}`;
  const date = `${then.day} ${MONTHS[then.month - 1]}${year}`;
  // `weekday` counts from Sunday.
  const name = DAY_NAMES[(then.weekday + 6) % 7];
  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Tomorrow at ${time}`;
  if (days > 1) return `${name} ${date} at ${time}`;
  if (days === -1) return `Yesterday at ${time}`;
  return days > -7 ? `${name} at ${time}` : `${date} at ${time}`;
}

/**
 * A time typed as a person writes it, as the core reads one, `HH:MM`: "3:00" and "3" are "03:00",
 * "930" and "9.30" are "09:30". Text that is not a time is sent as typed, for the server to say
 * why.
 */
export function clockOf(typed: string): string {
  const text = typed.trim();
  const parts = /^(\d{1,2})(?:[:.h]?(\d{2}))?$/.exec(text);
  if (parts === null) return text;
  return `${parts[1].padStart(2, "0")}:${parts[2] ?? "00"}`;
}

/** Why a time was skipped: its last run still works, or the change that blocked it, by its title. */
export function skippedWords(run: JobRun): string {
  if (run.reason === "working") return "Skipped: its last run still works.";
  return run.blockedBy === null
    ? "Skipped: a change it started is still open."
    : `Skipped: the change “${run.blockedBy.title}” is still open.`;
}

/** A start that failed, in the skipped times' form: why it could not. */
export const failedWords = (run: Pick<JobRun, "error">) =>
  `Could not start: ${run.error ?? "the agent did not say why"}`;

/**
 * When the job runs next, or why it does not, in the scheduler's order of reasons: its problem,
 * "Paused", "Scheduled jobs are off", the server's words for an agent that does not run it, a
 * change still open, else the time. A problem of the job that is not the reason, as a repository
 * it names that is not listed, is a fact of its own after it. On the list's cards, `listed`, the
 * scheduler being off is the list's banner's to say, once: a card says what is its own.
 */
export function nextFacts(job: Job, now: number, listed = false): Array<CardFact> {
  const { at, text, why } = job.next;
  const facts: Array<CardFact> = [];
  switch (why) {
    case "problem":
      facts.push({
        icon: "triangle-alert",
        label: job.problem ?? "Not running: the job has a problem.",
        tone: "danger",
      });
      break;
    case "paused":
      facts.push({ icon: "pause", label: "Paused", tone: "quiet" });
      break;
    case "off":
      if (!listed) facts.push({ icon: "pause", label: "Scheduled jobs are off", tone: "quiet" });
      break;
    case "agent-off":
      facts.push({
        icon: "triangle-alert",
        label: text ?? "Not running here: its agent is not available.",
        tone: "danger",
      });
      break;
    case "change-open":
      facts.push({ icon: "hourglass", label: "Waits for the change it started to close" });
      break;
    default:
      if (at !== null) {
        facts.push({ icon: "calendar-clock", label: `Next run: ${whenWords(at, now)}` });
      } else if (!listed) {
        facts.push({ icon: "pause", label: "Scheduled jobs are off", tone: "quiet" });
      }
  }
  if (why !== "problem" && job.problem !== null) {
    facts.push({ icon: "triangle-alert", label: job.problem, tone: "danger" });
  }
  return facts;
}

/**
 * What the last run left, as the card's fact: its time, then what its session asks now
 * (`status`, its label), the change it started, or why its start failed; "Never ran" first.
 */
export function lastFact(job: Job, now: number, status: string | undefined): CardFact {
  const run = job.last;
  if (run === null) return { icon: "square-dashed", label: "Last run: never", tone: "quiet" };
  const when = `Last run: ${whenWords(run.at, now)}`;
  if (run.outcome === "failed") {
    return { icon: "triangle-alert", label: `${when} · ${failedWords(run)}`, tone: "danger" };
  }
  if (run.session === null) {
    return { icon: "history", label: `${when} · its session is gone`, tone: "quiet" };
  }
  const change = run.folder === null || run.title === null ? "" : ` · started “${run.title}”`;
  const asks = status === undefined ? "" : ` · ${status.toLowerCase()}`;
  return { icon: run.folder === null ? "history" : "git-branch", label: `${when}${change}${asks}` };
}
