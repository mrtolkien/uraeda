// The session's Sub-agents (US3): each sub-agent the main agent runs, with its calls, what it does
// now, and how long it has run, ticking each second. A sub-agent's own sub-agents are rows of its
// group in the Activity, not here. The server lists the running ones alone: the panel keeps the
// rows it drew while its tab is open, and marks those gone from the list "Done", their time frozen
// (ruling R10).
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { useState } from "react";
import type { Session } from "uraeda-server/fate";
import { useSession } from "../sessionData.ts";
import { StatusMark } from "../StatusMark.tsx";
import { elapsed } from "../TurnLines.tsx";
import { useNow } from "./RecapLine.tsx";
import { Section } from "./Section.tsx";
import { doingText } from "./stretches.ts";

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

/** "1 call", "6 calls". */
function callCount(count: number): string {
  return `${count} ${count === 1 ? "call" : "calls"}`;
}

/** A sub-agent's line under its description: its calls, then what its latest does. */
function doing({ calls, latest }: Subagent): string {
  return latest === null ? "no call yet" : `${callCount(calls)} · ${doingText(latest)}`;
}

/** A sub-agent's row: working or done, its description, what it does, and how long it has run. */
function SubagentRow({ now, row: { endedAt, subagent } }: { now: number; row: Row }) {
  const lasting = Math.max((endedAt ?? now) - Date.parse(subagent.startedAt), 0);
  return (
    <ListItem
      align="first-line"
      description={doing(subagent)}
      endContent={
        <Text color="secondary" type="supporting">
          {elapsed(lasting)}
        </Text>
      }
      label={<Text weight="bold">{subagent.description}</Text>}
      startContent={
        endedAt === undefined ? (
          <StatusMark label="Working" small status="working" />
        ) : (
          <Icon icon="uraeda:badge-check" label="Done" size="sm" />
        )
      }
    />
  );
}

/** The session `session`'s sub-agents, from its record, read here. */
function Subagents({ session }: { session: string }) {
  const record = useSession(session);
  const now = useNow();
  const rows = useKeptRows(topLevel(record?.subagents ?? []), now);
  if (rows.length === 0) {
    return <Text color="secondary">No sub-agent running.</Text>;
  }
  return (
    <List aria-label="The session's sub-agents" density="compact">
      {rows.map((row) => (
        <SubagentRow key={row.subagent.id} now={now} row={row} />
      ))}
    </List>
  );
}

/** The Sub-agents of the session `session`, or, before it exists, that none runs. */
export function SubagentsPanel({ session }: { session?: string | undefined }) {
  if (session === undefined) {
    return <Text color="secondary">No sub-agent running.</Text>;
  }
  return (
    <Section>
      <Subagents session={session} />
    </Section>
  );
}
