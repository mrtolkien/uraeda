// What a job's card says: when it runs next, or why it does not, and what its last run left for the
// human, each as a fact with an icon in its role's colour. Pure over the record, so the cards of the
// page and of the stories read alike.
import type { ComponentProps } from "react";
import type { Icon } from "@astryxdesign/core/Icon";
import type { JobRow, JobRunView } from "uraeda-server/fate";
import type { SessionStatus } from "uraeda-server/fate";
import { STEP_ICONS, type StepKind } from "../sidebar/StepIcon.tsx";
import { whenWords } from "./words.ts";

type IconName = ComponentProps<typeof Icon>["icon"];

/** The colour of a fact's icon: the role it has for the human. */
export type Tone = "needsYou" | "problem" | "quiet" | "unread" | "working";

/** A fact of a job's card: its icon in its tone's colour, and its words. */
export type Fact = { icon: IconName; text: string; tone: Tone };

/**
 * What the sidebar's card says of a run's session: its status and its label, and, for a change or a
 * feature it became, the step its card names.
 */
export type RunSession = {
  done: boolean;
  /** The session's status label, "New reply", "Needs you". */
  label: string;
  status: SessionStatus;
  step?: { kind: StepKind; label: string };
};

/** The words for each reason a job has no next time. */
const WHY = {
  "change-open": "Waits for that change to close",
  off: "Scheduled jobs are off",
  paused: "Paused",
} as const;

/**
 * When the job runs next, or why it does not: the time in words, "Paused", its problem in the error
 * colour, "Waits for that change to close", or, for an agent that is off here, the agent's words.
 */
export function nextFact(
  job: Pick<JobRow, "agent" | "next" | "problem">,
  now: Date,
  zone: string,
): Fact {
  const { at, why } = job.next;
  if (at !== null) {
    return { icon: "uraeda:hourglass", text: whenWords(new Date(at), now, zone), tone: "quiet" };
  }
  if (why === "problem" || job.problem !== null) {
    return {
      icon: "uraeda:triangle-alert",
      text: job.problem ?? "Not running: the job has a problem.",
      tone: "problem",
    };
  }
  if (why === "paused") {
    return { icon: "uraeda:square", text: WHY.paused, tone: "quiet" };
  }
  if (why === "agent-off") {
    return {
      icon: "uraeda:triangle-alert",
      text:
        job.agent === null
          ? "Not running here: no agent is on in this repository."
          : `Not running here: ${job.agent} is not available.`,
      tone: "problem",
    };
  }
  if (why === "change-open") {
    return { icon: "uraeda:hourglass", text: WHY["change-open"], tone: "quiet" };
  }
  return { icon: "uraeda:square", text: WHY.off, tone: "quiet" };
}

/** The icon and tone of a session's status, as the sidebar's card reads it. */
function statusLook(session: RunSession): Pick<Fact, "icon" | "tone"> {
  switch (session.status) {
    case "attention":
      return { icon: "uraeda:triangle-alert", tone: "problem" };
    case "needs-you":
      return { icon: "uraeda:comment", tone: "needsYou" };
    case "unread":
      return { icon: "uraeda:comment", tone: "unread" };
    case "working":
      return { icon: "uraeda:activity", tone: "working" };
    default:
      return session.done
        ? { icon: "uraeda:badge-check", tone: "quiet" }
        : { icon: "uraeda:square", tone: "quiet" };
  }
}

/** What the session asks of the human, lower case after a time: "new reply", "PR ready", "read". */
function asks(session: RunSession): string {
  if (session.step !== undefined) {
    return session.step.label;
  }
  return session.status === "idle" && session.done ? "read" : session.label.toLowerCase();
}

/**
 * What the job's last run left: its time, then what its session or its change asks, as the
 * sidebar's card names it; "Never ran" before a first start. `run` is the latest start of the job
 * here, `session` its session as the sidebar reads it, absent once the session is gone.
 */
export function lastFact(
  run: JobRunView | undefined,
  session: RunSession | undefined,
  now: Date,
  zone: string,
): Fact {
  if (run === undefined) {
    return { icon: "uraeda:square-dashed", text: "Never ran", tone: "quiet" };
  }
  const when = whenWords(new Date(run.at), now, zone);
  if (session === undefined) {
    return {
      icon: "uraeda:square",
      text: `${when} · ${run.title === null ? "its session is gone" : `“${run.title}”`}`,
      tone: "quiet",
    };
  }
  const look = statusLook(session);
  if (run.folder !== null && session.step !== undefined) {
    const title = run.title === null ? "" : ` “${run.title}”`;
    const icon = look.tone === "quiet" ? look.icon : (STEP_ICONS[session.step.kind] as IconName);
    return { icon, text: `${when} · started${title}, ${asks(session)}`, tone: look.tone };
  }
  return { ...look, text: `${when} · ${asks(session)}` };
}

/** The latest run of the job here that started a session, or undefined: its history is newest first. */
export const latestStart = (job: Pick<JobRow, "history">): JobRunView | undefined =>
  job.history.find((run) => run.outcome === "started");
