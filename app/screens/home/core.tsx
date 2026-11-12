// Home's core: what needs the human, and what runs. Needs you is the server's own list
// (`NeedsYouList`, the sidebar's and the notifications'), this repository's first, then the other
// repositories', each named; and the features whose problems stop the workflow, which nothing else
// lists. A feature of Now that waits for the human's Continue is theirs, so it is in Needs you. In
// progress is the features in flight that wait on no one but an agent, at work first, then those a
// line of the priorities holds elsewhere, saying where, and the chats at work, the oldest started
// first.
import { type HomeCard, Cards, Nothing } from "./Cards";
import { ContinueAll } from "./ContinueAll";
import { navigate, parseRoute, record } from "../../store";
import type { NeedsYouRow, SessionRow, WorkspaceFeature } from "../../store/protocol";
import { ticking } from "../feature/read";
import { runTime } from "../session/panels/words";
import type { IconName } from "../../ui/controls";
import type { Tone } from "../../ui/tokens";

/** How each reason reads: its icon and its tone. */
const REASONS: Record<NeedsYouRow["reason"], { icon: IconName; label: string; tone: Tone }> = {
  attention: { icon: "triangle-alert", label: "Needs a look", tone: "caution" },
  blocked: { icon: "triangle-alert", label: "Blocked", tone: "danger" },
  continue: { icon: "play", label: "Your Continue", tone: "needs" },
  "pull-request": { icon: "git-pull-request", label: "Pull request", tone: "needs" },
  step: { icon: "circle-dot", label: "Waits on you", tone: "needs" },
};

/** A run's time on its card, from its turn: never the session's start, which may be days before. */
const timeOf = (repo: string, turn: string | null | undefined, now: () => number) =>
  turn === null || turn === undefined
    ? undefined
    : runTime(record("Turn", { id: turn, repo })(), now);

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

/** The section of the priorities whose line links a feature: none once dropped, or never put. */
type Section = "blocked" | "later" | "next" | "now" | undefined;

/** Where an idle feature's line is, in words: why nothing moves it. */
const RESTS: Record<string, string> = { blocked: "Blocked", later: "In Later", next: "In Next" };

/**
 * Whether a feature is in progress: in flight, waiting on an agent alone, and either at work or
 * linked by a line of the priorities. One no line links, dropped or never listed, that no agent
 * works on, moves nowhere: the sidebar keeps it, and its page.
 */
const running = (feature: WorkspaceFeature, section: Section) =>
  feature.step.name !== "done" &&
  feature.step.name !== "none" &&
  feature.problems.length === 0 &&
  feature.status.status !== "needs-you" &&
  feature.status.status !== "attention" &&
  (feature.status.status === "working" || section !== undefined);

function featureCard(
  feature: WorkspaceFeature,
  section: Section,
  repo: string,
  now: () => number,
): HomeCard {
  const working = feature.status.status === "working";
  const rests = working || section === undefined ? undefined : RESTS[section];
  return {
    icon: feature.kind === "change" ? "git-branch" : "flag",
    id: feature.folder,
    open: () => navigate({ folder: feature.folder, page: "feature" }),
    state: {
      label: rests ?? feature.status.label,
      running: working,
      tone: working ? "live" : "quiet",
    },
    time: timeOf(repo, feature.status.turn, now),
    title: nameOf(feature),
    who: feature.step.task ?? undefined,
  };
}

function chatCard(row: SessionRow, repo: string, now: () => number): HomeCard {
  const turn = record("Session", { id: row.id, repo })()?.turns.at(-1);
  return {
    icon: "message-square",
    id: `session/${row.id}`,
    open: () => navigate({ id: row.id, page: "session-id" }),
    state: { label: row.statusLabel, running: true, tone: "live" },
    time: timeOf(repo, turn, now),
    title: row.title,
  };
}

/** What runs: the features in flight, then the chats at work, the oldest started first. */
export function InProgress(props: { repo: string }) {
  const workspace = record("Workspace", { repo: props.repo });
  const sessions = record("SessionList", { repo: props.repo });
  const now = ticking(30_000);
  const cards = () => {
    const rows = sessions()?.rows ?? [];
    // The ones at work first, then those that wait for their next run; each the oldest first.
    const startOf = (feature: WorkspaceFeature) =>
      (feature.status.status === "working" ? 0 : 1e15) +
      (rows.find((row) => row.id === feature.status.session)?.startedAt ?? 1e14);
    const lines = workspace()?.priorities ?? [];
    const sectionOf = (feature: WorkspaceFeature) =>
      lines.find((line) => line.feature === feature.folder)?.section as Section;
    const features = (workspace()?.features ?? [])
      .filter((feature) => running(feature, sectionOf(feature)))
      .toSorted((a, b) => startOf(a) - startOf(b));
    const chats = rows
      .filter((row) => row.folder === null && row.status === "working" && !row.archived)
      .toSorted((a, b) => a.startedAt - b.startedAt);
    return [
      ...features.map((feature) => featureCard(feature, sectionOf(feature), props.repo, now)),
      ...chats.map((row) => chatCard(row, props.repo, now)),
    ];
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
