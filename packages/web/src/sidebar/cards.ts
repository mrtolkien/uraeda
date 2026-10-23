// From the server's features and sessions to the sidebar's cards: which section each goes in, in
// which order, and what its card shows. The core decides each step and its order; this only draws
// them.
import type { SessionStatus } from "uraeda-server/fate";
import type { useNavigation } from "../sessionData.ts";
import { stepLabel, waiting } from "../labels.ts";
import type { CardItem } from "./ItemCard.tsx";
import type { StepKind } from "./StepIcon.tsx";

type Data = ReturnType<typeof useNavigation>;
/** A session's row in the sessions' list. */
export type Row = NonNullable<Data["sessionList"]>["rows"][number];
/** A feature or a change, as the navigation reads it. */
export type Feature = NonNullable<Data["workspace"]>["features"][number];
/** A status and its label. */
export type Status = { label: string; status: SessionStatus };

/** The order of statuses within a section: what needs the human first. */
export const STATUS_ORDER: Record<SessionStatus, number> = {
  attention: 1,
  idle: 4,
  "needs-you": 0,
  unread: 2,
  working: 3,
};

/** What a gate asks, by the kind of file it waits on, in the card's name. */
const GATES: Record<string, { kind: StepKind; label: string }> = {
  clarifications: { kind: "questions", label: "Questions to answer" },
  plan: { kind: "plan", label: "Plan to review" },
  proposal: { kind: "proposal", label: "Proposal to write" },
  spec: { kind: "spec", label: "Spec to review" },
};

/** Each step's icon, by the core's step name. */
const KINDS: Record<string, StepKind> = {
  approval: "spec",
  change: "change",
  discovery: "discovery",
  done: "done",
  "final-review": "review",
  finish: "pull-request",
  implementation: "implementation",
  none: "problem",
  plan: "plan",
  "plan-revision": "plan",
  "pull-request": "pull-request",
  "pull-request-changes": "pull-request",
  "pull-request-unknown": "pull-request",
  spec: "spec",
  "spec-revision": "spec",
};

/**
 * A feature's step, as its card draws it: a problem whatever its step, then a gate by what it
 * asks, else by the step's name. Its notes stay off the card, on its page.
 */
export function stepOf(feature: Feature): NonNullable<CardItem["step"]> {
  if (feature.problems.length > 0) {
    return { kind: "problem", label: "Problem to fix" };
  }
  if (feature.step.name === "human-gate") {
    const kind = feature.files.find((file) => file.name === feature.step.file)?.kind;
    return (kind ? GATES[kind] : undefined) ?? { kind: "proposal", label: waiting(feature).title };
  }
  return { kind: KINDS[feature.step.name] ?? "problem", label: stepLabel(feature.step.name) };
}

/** The status of a feature that waits on the human. */
const NEEDS_YOU: Status = { label: "Needs you", status: "needs-you" };

/**
 * A feature's status: "Needs you" while it has a problem, whatever its session; else its session's,
 * or, without a session, "Needs you" while its step waits on the human, and idle otherwise.
 */
export function featureStatus(feature: Feature, row: Row | undefined): Status {
  if (feature.problems.length > 0) {
    return NEEDS_YOU;
  }
  if (row) {
    return { label: row.statusLabel, status: row.status };
  }
  return feature.step.waitsOn === "human" ? NEEDS_YOU : { label: "Idle", status: "idle" };
}

/** Whether a status asks something of the human: the sidebar's "Needs you". */
export const needsYou = (status: Status) =>
  status.status === "needs-you" || status.status === "attention";

/** A feature's card, from its session's row when it has one. */
export function toCard(feature: Feature, row: Row | undefined): CardItem {
  const { label, pullRequest, step } = feature;
  return {
    folder: feature.folder,
    ...((row?.backgroundCommands ?? 0) > 0 ? { hasBackgroundCommand: true } : {}),
    kind: feature.kind === "change" ? "change" : "feature",
    label: label ?? feature.slug,
    ...(step.progress ? { progress: step.progress } : {}),
    ...(pullRequest ? { pullRequest: { number: pullRequest.number, url: pullRequest.url } } : {}),
    status: featureStatus(feature, row),
    step: stepOf(feature),
    ...(row && row.subagents.length > 0 ? { subagents: row.subagents } : {}),
    title: feature.title,
  };
}

/** A session without a workflow's card: its harness's mark, its title, and its status. */
export function sessionCard(row: Row): CardItem {
  return {
    agent: row.agent,
    folder: row.id,
    ...(row.backgroundCommands > 0 ? { hasBackgroundCommand: true } : {}),
    kind: "session",
    label: row.title,
    status: { label: row.statusLabel, status: row.status },
    ...(row.subagents.length > 0 ? { subagents: row.subagents } : {}),
    title: "",
  };
}

/**
 * When a feature or a change started: its first session's start, which a session that became it
 * keeps, or its folder's date before it has one. The date alone would sort before every start of
 * its own day.
 */
export function startOf(feature: Feature, rows: Array<Row>): string {
  const starts = rows.filter((row) => row.folder === feature.folder).map((row) => row.startedAt);
  return starts.length === 0
    ? feature.folder.slice(0, 10)
    : starts.reduce((first, start) => (start < first ? start : first));
}

/** Items in the order they started, the oldest first, so a row keeps its place as agents work. */
export function byStart<T extends { start: string }>(items: Array<T>): Array<T> {
  return [...items].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

/** Items waiting on the human, what needs them first, then the oldest started. */
export function byStatus<T extends { start: string; status: Status }>(items: Array<T>) {
  return byStart(items).sort(
    (a, b) => STATUS_ORDER[a.status.status] - STATUS_ORDER[b.status.status],
  );
}

/** Whether a feature or a change is still in flight: not done, and readable or with a problem. */
export const inFlight = (feature: Feature) =>
  feature.step.name !== "done" && (feature.step.name !== "none" || feature.problems.length > 0);
