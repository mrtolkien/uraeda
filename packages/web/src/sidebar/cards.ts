// From the server's features and sessions to the sidebar's cards: which section each goes in, in
// which order, and what its card shows. The core decides each step and its order; this only draws
// them.
import type { SessionStatus } from "uraeda-server/fate";
import type { useNavigation } from "../data.ts";
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

/** A feature's step, as its card draws it: a gate by what it asks, else by the step's name. */
export function stepOf(feature: Feature): CardItem["step"] {
  if (feature.step.name === "human-gate") {
    const kind = feature.files.find((file) => file.name === feature.step.file)?.kind;
    return (kind ? GATES[kind] : undefined) ?? { kind: "proposal", label: waiting(feature).title };
  }
  return { kind: KINDS[feature.step.name] ?? "problem", label: stepLabel(feature.step.name) };
}

/**
 * A feature's status: its session's, or, without a session, "Needs you" while its step waits on
 * the human, and idle otherwise.
 */
export function featureStatus(feature: Feature, row: Row | undefined): Status {
  if (row) {
    return { label: row.statusLabel, status: row.status };
  }
  return feature.step.waitsOn === "human"
    ? { label: "Needs you", status: "needs-you" }
    : { label: "Idle", status: "idle" };
}

/** Whether a status asks something of the human: the sidebar's "Needs you". */
export const needsYou = (status: Status) =>
  status.status === "needs-you" || status.status === "attention";

/** A feature's card, from its session's row when it has one. */
export function toCard(feature: Feature, row: Row | undefined): CardItem {
  const { color, label, pullRequest, step } = feature;
  return {
    ...(color ? { color } : {}),
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

/**
 * The features in flight of a section, in the workflow's order, the earliest step first, then the
 * newest folder.
 */
export function byStep(features: Array<Feature>): Array<Feature> {
  return [...features].sort(
    (a, b) => a.step.order - b.step.order || b.folder.localeCompare(a.folder),
  );
}

/** The features waiting on the human, what needs them first. */
export function byStatus(features: Array<Feature>, statuses: Map<string, Status>) {
  return [...features].sort(
    (a, b) =>
      STATUS_ORDER[statuses.get(a.folder)!.status] - STATUS_ORDER[statuses.get(b.folder)!.status],
  );
}

/** Whether a feature or a change is still in flight: not done, and readable. */
export const inFlight = (feature: Feature) =>
  feature.step.name !== "done" && feature.step.name !== "none";
