// The session's Sub-agents (US3): each sub-agent the main agent runs, with its calls, what it does
// now, and how long it has run, ticking each second. A sub-agent's own sub-agents are rows of its
// group in the Activity, not here. The server lists the running ones alone: the panel keeps the
// rows it drew while its tab is open, and marks those gone from the list "Done", their time frozen
// (ruling R10). A workflow session's sub-agents are sessions Uraeda runs (spec of Run options): the
// pane lists those sub-sessions instead, each with its role, what it works on, its agent, model,
// effort, state, times, and usage, a link to its read-only page. A chat keeps its agent's own.
// Both are drawn as the same card (`runs/AgentCard.tsx`), each with the facts it has.
import { Icon } from "@astryxdesign/core/Icon";
import { type ReactNode, useRef, useState } from "react";
import type { Session } from "uraeda-server/fate";
import { useSession } from "../sessionData.ts";
import { StatusMark } from "../StatusMark.tsx";
import { useNow } from "../useNow.ts";
import { useLatestInView } from "./ActivityPanel.tsx";
import { Section } from "./Section.tsx";
import { subagentText } from "./stretches.ts";
import { Empty } from "../layout/Empty.tsx";
import { AgentCard, AgentCards, type Ending, lasted, Times, Unit } from "../runs/AgentCard.tsx";
import { SubSessionCards } from "../runs/SubSessionRow.tsx";
import type { SubSession } from "../runs/subSessions.ts";

/** A running sub-agent, as the session's record lists it. */
type Subagent = Session["subagents"][number];

/** A row the panel drew: its sub-agent as last listed, and when it was seen gone, once it was. */
type Row = { endedAt?: number; subagent: Subagent };

/** The sub-agents the main agent started, of the session's running ones: not their own. */
export function topLevel(subagents: ReadonlyArray<Subagent>): Array<Subagent> {
  return subagents.filter((subagent) => subagent.parent === null);
}

/**
 * `rows` with `running` now: a row still listed takes its new calls; one gone is ended at `now`,
 * once; a new one is added after them, so a row keeps its place.
 */
function merged(rows: ReadonlyArray<Row>, running: ReadonlyArray<Subagent>, now: number) {
  const listed = new Map(running.map((subagent) => [subagent.id, subagent]));
  const kept = rows.map((row): Row => {
    const subagent = listed.get(row.subagent.id);
    if (subagent) {
      return { subagent };
    }
    return row.endedAt === undefined ? { ...row, endedAt: now } : row;
  });
  const known = new Set(rows.map((row) => row.subagent.id));
  return [
    ...kept,
    ...running.filter((subagent) => !known.has(subagent.id)).map((subagent) => ({ subagent })),
  ];
}

/**
 * The rows of the running sub-agents `running`, and of those listed since the panel opened, gone
 * now, ended at `now`, the panel's clock: the panel's state, kept while it is drawn. Merged again
 * only when the list changes.
 */
function useKeptRows(running: ReadonlyArray<Subagent>, now: number): ReadonlyArray<Row> {
  const listed = JSON.stringify(running);
  const [kept, setKept] = useState(() => ({ listed, rows: merged([], running, 0) }));
  if (kept.listed !== listed) {
    // Kept as the list changes, as React derives state from a prop: the render that sees the new
    // list draws the merged rows.
    const next = { listed, rows: merged(kept.rows, running, now) };
    setKept(next);
    return next.rows;
  }
  return kept.rows;
}

/**
 * A sub-agent's card: working or done, its description, and how long it has run on its head, what
 * it does under it, then when it started and when it was seen gone, or that it runs.
 */
function SubagentRow({ now, row: { endedAt, subagent } }: { now: number; row: Row }) {
  const ending: Ending = endedAt === undefined ? "running" : { at: endedAt };
  return (
    <AgentCard
      duration={lasted(subagent.startedAt, ending, now)}
      isWorking={endedAt === undefined}
      line={<Unit>{subagentText(subagent)}</Unit>}
      mark={
        endedAt === undefined ? (
          <StatusMark isSubagent label="Working" small status="working" />
        ) : (
          <Icon color="secondary" icon="uraeda:badge-check" label="Done" size="sm" />
        )
      }
      rowKey={subagent.id}
      title={subagent.description}
    >
      <Times ending={ending} now={now} startedAt={subagent.startedAt} />
    </AgentCard>
  );
}

/**
 * The session `session`'s sub-agents, from its record, read here: the sub-sessions Uraeda started
 * for its runs, when it has any, else its agent's own.
 */
function Subagents({ session }: { session: string }) {
  const record = useSession(session);
  const now = useNow(1000);
  const rows = useKeptRows(topLevel(record?.subagents ?? []), now);
  const subs = record?.subSessions ?? [];
  // Once the session has sub-sessions, its agent's own sub-agents are not drawn: sub-sessions come
  // from workflow runs, which take the agent's own sub-agents away and run their implementers and
  // reviewers as sub-sessions instead, so the pane lists one kind, never both mixed.
  if (subs.length > 0) {
    return <SubSessions subs={subs} />;
  }
  if (rows.length === 0) {
    return <Empty>No sub-agent running.</Empty>;
  }
  return (
    <AgentCards label="The session's sub-agents" order={rows.map((row) => row.subagent.id)}>
      {rows.map((row) => (
        <SubagentRow key={row.subagent.id} now={now} row={row} />
      ))}
    </AgentCards>
  );
}

/**
 * The sub-sessions a workflow session started, in the order they started, the latest last, as the
 * Activity and the chat read, each a link to its page.
 */
function SubSessions({ subs }: { subs: ReadonlyArray<SubSession> }) {
  const ordered = subs.toSorted((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  return <SubSessionCards subs={ordered} />;
}

/** The Sub-agents of the session `session`, or, before it exists, that none runs. */
export function SubagentsPanel({ session }: { session?: string | undefined }) {
  if (session === undefined) {
    return <Empty>No sub-agent running.</Empty>;
  }
  return (
    <Section>
      <FollowedEnd>
        <Subagents session={session} />
      </FollowedEnd>
    </Section>
  );
}

/**
 * Keeps the list's end in view, as the Activity does: it opens on the latest sub-agent, and follows
 * the ones that start while the human is there; scrolled up, nothing moves.
 */
function FollowedEnd({ children }: { children: ReactNode }) {
  const list = useRef<HTMLDivElement>(null);
  useLatestInView(list, true, true);
  return <div ref={list}>{children}</div>;
}
