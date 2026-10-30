// From the server's features and sessions to the sidebar's cards: which section each goes in, in
// which order, and what its card shows. The core decides each step and its order, and the server
// each feature's status (`fate/feature-status.ts`); this only draws them.
import type { SessionStatus } from "uraeda-server/fate";
import { STATUS_ORDER } from "uraeda-server/status";
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

/**
 * What a gate asks, by the kind of file it waits on, in the card's name; `working`, while an agent
 * works on it, which is not ready for the human.
 */
const GATES: Record<string, { kind: StepKind; label: string; working?: string }> = {
  clarifications: { kind: "questions", label: "Questions" },
  plan: { kind: "plan", label: "Plan ready", working: "Plan" },
  proposal: { kind: "proposal", label: "Write proposal" },
  spec: { kind: "spec", label: "Spec ready", working: "Spec" },
};

/** Each step's short label on a card, by the core's step name. */
const SHORT: Record<string, string> = {
  approval: "Approving",
  change: "Changing",
  discovery: "Discovery",
  done: "Done",
  "final-review": "Final review",
  finish: "Opening PR",
  implementation: "Implementing",
  plan: "Planning",
  "plan-revision": "Revising plan",
  "pull-request": "PR ready",
  "pull-request-changes": "PR changes",
  "pull-request-unknown": "PR unknown",
  push: "Push",
  spec: "Writing spec",
  "spec-revision": "Revising spec",
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
  push: "pull-request",
  spec: "spec",
  "spec-revision": "spec",
};

/**
 * The icon kind of a step on its own, as a running proposal carries it: a human gate by the
 * kind of file it waits on, else by the step's name.
 */
export function stepKindOf(step: { fileKind?: string | null; name: string }): StepKind {
  if (step.name === "human-gate") {
    return (step.fileKind ? GATES[step.fileKind]?.kind : undefined) ?? "proposal";
  }
  return KINDS[step.name] ?? "problem";
}

/** Each step's short label while an agent works on it, where it differs: not ready for the human. */
const WORKING: Record<string, string> = { "pull-request": "PR" };

/**
 * A feature's step, as its card draws it: a problem whatever its step, then a gate by what it
 * asks, else by the step's name. A gate's label drops "ready" while an agent works on it. Its notes
 * stay off the card, on its page.
 */
export function stepOf(feature: Feature): NonNullable<CardItem["step"]> {
  if (feature.problems.length > 0) {
    return { kind: "problem", label: "Problem" };
  }
  const working = feature.status.status === "working";
  if (feature.step.name === "human-gate") {
    const kind = feature.files.find((file) => file.name === feature.step.file)?.kind;
    const gate = kind ? GATES[kind] : undefined;
    if (!gate) {
      return { kind: "proposal", label: waiting(feature).title };
    }
    return { kind: gate.kind, label: (working && gate.working) || gate.label };
  }
  const { name } = feature.step;
  return {
    kind: KINDS[name] ?? "problem",
    label: (working && WORKING[name]) || (SHORT[name] ?? stepLabel(name)),
  };
}

/** Whether a status asks something of the human: the sidebar's "Needs you". */
export const needsYou = (status: Status) =>
  status.status === "needs-you" || status.status === "attention";

/**
 * The row of the session a feature's status follows, the one at work on it or its latest, else
 * its folder's first.
 */
export function rowOf(feature: Feature, rows: ReadonlyArray<Row>): Row | undefined {
  const { session } = feature.status;
  return (
    (session === null ? undefined : rows.find((row) => row.id === session)) ??
    rows.find((row) => row.folder === feature.folder)
  );
}

/**
 * Whether a session shows as a card of its own: one without a workflow, or one at work on a feature
 * or a change no longer in flight, such as a merged one, until its run ends, so no running session
 * is missing. `flying` holds the folders in flight.
 */
export const isSessionCard = (row: Row, flying: ReadonlySet<string>) =>
  row.folder === null || (row.status === "working" && !flying.has(row.folder));

/** A feature's card, its status the server's, the session it follows from `row`. */
export function toCard(feature: Feature, row: Row | undefined): CardItem {
  const { label, pullRequest, status, step } = feature;
  return {
    folder: feature.folder,
    ...((row?.backgroundCommands ?? 0) > 0 ? { hasBackgroundCommand: true } : {}),
    ...(row ? { harness: row.agent } : {}),
    kind: feature.kind === "change" ? "change" : "feature",
    label: label ?? feature.slug,
    ...(step.progress ? { progress: step.progress } : {}),
    ...(pullRequest ? { pullRequest: { number: pullRequest.number, url: pullRequest.url } } : {}),
    status: { label: status.label, status: status.status },
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
