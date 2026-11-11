// Home's core: what needs the human, and what runs. Needs you is the server's own list
// (`NeedsYouList`, the sidebar's and the notifications'), this repository's first, then the other
// repositories', each named; and the features whose problems stop the workflow, which nothing else
// lists. In progress is the features in flight that wait on no one but an agent, and the chats at
// work, the oldest started first.
import { type HomeCard, Cards, Nothing } from "./Cards";
import { ContinueAll } from "./ContinueAll";
import { navigate, parseRoute, record, serverTime } from "../../store";
import type { NeedsYouRow, SessionRow, WorkspaceFeature } from "../../store/protocol";
import type { IconName } from "../../ui/controls";
import type { Tone } from "../../ui/tokens";

/** How each reason reads: its icon and its tone. */
const REASONS: Record<NeedsYouRow["reason"], { icon: IconName; label: string; tone: Tone }> = {
  attention: { icon: "triangle-alert", label: "Needs a look", tone: "caution" },
  blocked: { icon: "triangle-alert", label: "Blocked", tone: "danger" },
  "pull-request": { icon: "git-pull-request", label: "Pull request", tone: "needs" },
  step: { icon: "circle-dot", label: "Waits on you", tone: "needs" },
};

/** When a run started, in the server's zone: "14:02" today, "Tue 14:02" before. */
const started = (at: number) => ({ started: serverTime(at) });

/** A feature's name, as the human gave it in the sidebar, else its title. */
const nameOf = (feature: WorkspaceFeature) => feature.label ?? feature.title;

function needsCard(row: NeedsYouRow, repo: string): HomeCard {
  const look = REASONS[row.reason];
  return {
    icon: look.icon,
    id: row.id,
    open: () => navigate(parseRoute(row.href)),
    state: { label: look.label, tone: look.tone },
    title: row.label,
    who: row.repository === repo ? row.message : `${row.message} · in ${row.repository}`,
  };
}

function problemCard(feature: WorkspaceFeature): HomeCard {
  return {
    icon: "triangle-alert",
    id: `problem/${feature.folder}`,
    open: () => navigate({ folder: feature.folder, page: "feature" }),
    state: { label: "Stopped", tone: "danger" },
    title: nameOf(feature),
    who: feature.problems[0]?.message,
  };
}

/** What waits on the human: this repository's first, then the others', and the problems. */
export function NeedsYou(props: { repo: string }) {
  const needs = record("NeedsYouList", null);
  const workspace = record("Workspace", { repo: props.repo });
  const cards = () => {
    const rows = needs()?.rows ?? [];
    const listed = new Set(rows.map((row) => row.folder));
    const problems = (workspace()?.features ?? []).filter(
      (feature) =>
        feature.problems.length > 0 && feature.step.name !== "done" && !listed.has(feature.folder),
    );
    return [
      ...problems.map(problemCard),
      ...rows
        .filter((row) => row.repository === props.repo)
        .map((row) => needsCard(row, props.repo)),
      ...rows
        .filter((row) => row.repository !== props.repo)
        .map((row) => needsCard(row, props.repo)),
    ];
  };
  return (
    <>
      <ContinueAll repo={props.repo} />
      <Cards
        cards={cards}
        empty={
          <Nothing
            title="Nothing waits on you"
            words="A feature that asks a question, or waits for a review, shows here."
          />
        }
      />
    </>
  );
}

/** Whether a feature is in flight, and waits on an agent alone. */
const running = (feature: WorkspaceFeature) =>
  feature.step.name !== "done" &&
  feature.step.name !== "none" &&
  feature.problems.length === 0 &&
  feature.status.status !== "needs-you" &&
  feature.status.status !== "attention";

function featureCard(feature: WorkspaceFeature, rows: ReadonlyArray<SessionRow>): HomeCard {
  const session = rows.find((row) => row.id === feature.status.session);
  const working = feature.status.status === "working";
  return {
    icon: feature.kind === "change" ? "git-branch" : "flag",
    id: feature.folder,
    open: () => navigate({ folder: feature.folder, page: "feature" }),
    state: { label: feature.status.label, running: working, tone: working ? "live" : "quiet" },
    time: session === undefined ? undefined : started(session.startedAt),
    title: nameOf(feature),
    who: feature.step.task ?? undefined,
  };
}

function chatCard(row: SessionRow): HomeCard {
  return {
    icon: "message-square",
    id: `session/${row.id}`,
    open: () => navigate({ id: row.id, page: "session-id" }),
    state: { label: row.statusLabel, running: true, tone: "live" },
    time: started(row.startedAt),
    title: row.title,
  };
}

/** What runs: the features in flight, then the chats at work, the oldest started first. */
export function InProgress(props: { repo: string }) {
  const workspace = record("Workspace", { repo: props.repo });
  const sessions = record("SessionList", { repo: props.repo });
  const cards = () => {
    const rows = sessions()?.rows ?? [];
    // The ones at work first, then those that wait for their next run; each the oldest first.
    const startOf = (feature: WorkspaceFeature) =>
      (feature.status.status === "working" ? 0 : 1e15) +
      (rows.find((row) => row.id === feature.status.session)?.startedAt ?? 1e14);
    const features = (workspace()?.features ?? [])
      .filter(running)
      .toSorted((a, b) => startOf(a) - startOf(b));
    const chats = rows
      .filter((row) => row.folder === null && row.status === "working" && !row.archived)
      .toSorted((a, b) => a.startedAt - b.startedAt);
    return [...features.map((feature) => featureCard(feature, rows)), ...chats.map(chatCard)];
  };
  return (
    <Cards
      cards={cards}
      empty={
        <Nothing
          title="Nothing in progress"
          words="A feature or a chat an agent works on shows here while it runs."
        />
      }
    />
  );
}
