// Home's core, above the "Overview" line: the problems that stop the workflow, when there are any,
// what needs the human, what is in progress, and the sessions without a workflow, or at work on
// what left the flight, when one runs.
// Each is a pane of the sidebar's own cards; `coreParts` gives each its node and its height, for
// the layout. Needs you has Continue all in its border while a run there asks to go on; while it is
// under the pointer or focused, the cards it continues are tinted and every other card is dimmed.
import type { Icon } from "@astryxdesign/core/Icon";
import { focusVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";
import { continuedByAll } from "uraeda-server/status";
import { waiting } from "../labels.ts";
import { Empty } from "../layout/Empty.tsx";
import { Pane } from "../layout/Pane.tsx";
import { pickedStyles } from "../layout/picked.ts";
import {
  byStatus,
  type Feature,
  isSessionCard,
  needsYou,
  type Row,
  rowOf,
} from "../sidebar/cards.ts";
import { FeatureCard, SessionCard } from "../sidebar/Cards.tsx";
import { waitTime } from "../wait.ts";
import { ContinueAll, previewStyles } from "./ContinueAll.tsx";

const styles = stylex.create({
  // The card's own row draws no ring: the card does, around the whole card, its task list too, not
  // the ring of its row alone, whose edge would cut across it (`pickedStyles.ringWithin`).
  ringless: { [focusVars["--focus-outline-style"]]: "none" },
});

/** A pane of the core, drawn by `key`, as tall as `height` card lines. */
export type CorePart = { height: number; key: string; node: ReactNode };

/** Card lines in a pane's frame, in a card, and in its empty text. */
const FRAME = 2;
const CARD = 3;
const EMPTY = 1.5;

/** A card of the core: its key among them, `f:<folder>` or `s:<session>`, and its node. */
type CoreCard = { detail?: string | undefined; key: string; node: ReactNode };

/**
 * How the cards are drawn: the one whose key is `picked` picked; while Continue all's preview is
 * on, the ones in `continued` picked and the others dimmed instead.
 */
type Look = { continued: ReadonlySet<string>; isPreviewing: boolean; picked: string | undefined };

/** A card's style, as `look` draws it. */
function lookOf(key: string, { continued, isPreviewing, picked }: Look) {
  if (isPreviewing) {
    return continued.has(key) ? pickedStyles.picked : previewStyles.dimmed;
  }
  return key === picked && pickedStyles.picked;
}

/** A pane of cards: `cards` each with its detail line if it has one, or `empty` text. */
function part(
  key: string,
  pane: {
    actions?: ReactNode;
    count: number;
    icon: ComponentProps<typeof Icon>["icon"];
    title: string;
    tone?: "attention" | "problem";
  },
  cards: Array<CoreCard>,
  empty: string,
  look: Look,
): CorePart {
  const height = FRAME + (cards.length === 0 ? EMPTY : cards.length * CARD);
  return {
    height,
    key,
    node: (
      <Pane {...pane}>
        {cards.length === 0 ? (
          <Empty isInset>{empty}</Empty>
        ) : (
          cards.map((card) => (
            // What the core's keys and pointer find it by (see `coreKeys.ts`).
            <div
              data-core-key={card.key}
              key={card.key}
              // A card, framed as a list's row: the keyboard's ring around the whole card, its task list too;
              // picked, a list's selected row's tint, so home has one selection, in a pane or a list.
              // Into Continue all's preview and out of it, it fades.
              {...stylex.props(pickedStyles.ringWithin, previewStyles.row, lookOf(card.key, look))}
            >
              <div {...stylex.props(styles.ringless)}>{card.node}</div>
            </div>
          ))
        )}
      </Pane>
    ),
  };
}

/** A session's card in the core. */
/** Whether a session waits on the human: in Needs you, as in the sidebar. */
const asks = (row: Row) => needsYou({ label: row.statusLabel, status: row.status });

const session = (row: Row): CoreCard => ({
  key: `s:${row.id}`,
  node: <SessionCard pathname="" row={row} />,
});

/** A feature's detail in progress: its task, and when a usage limit holds it, until when. */
function progressDetail(f: Feature): string | undefined {
  const { task } = f.step;
  const { wait } = f.status;
  if (wait?.reason !== "limit") {
    return task ?? undefined;
  }
  const until = `the usage limit, until ${waitTime(wait)}`;
  return task ? `${task} · waiting for ${until}` : `Waiting for ${until}`;
}

/** The keys of the features Continue all continues, by the server's own rule. */
export const continuedKeys = (human: Array<Feature>): ReadonlySet<string> =>
  new Set(human.filter(continuedByAll).map((f) => `f:${f.folder}`));

/**
 * The core's panes in their reading order: the problems, when there are any, what needs the human,
 * what is in progress, the sessions at work among them, and the other sessions without a workflow,
 * when there are any. The card whose key is `picked` is drawn picked. `preview` is Continue all's:
 * whether it is on, and what turns it on and off.
 */
export function coreParts({
  agents,
  human,
  invalid,
  picked,
  preview,
  rows,
}: {
  agents: Array<Feature>;
  human: Array<Feature>;
  invalid: Array<Feature>;
  picked?: string | undefined;
  preview?: { isOn: boolean; onChange: (isOn: boolean) => void };
  rows: Array<Row>;
}): Array<CorePart> {
  const continued = continuedKeys(human);
  const look: Look = { continued, isPreviewing: preview?.isOn ?? false, picked };
  const feature = (f: Feature, detail?: string): CoreCard => ({
    detail,
    key: `f:${f.folder}`,
    node: <FeatureCard detail={detail} feature={f} pathname="" row={rowOf(f, rows)} />,
  });
  const flying = new Set([...agents, ...human, ...invalid].map((f) => f.folder));
  const all = byStatus(
    rows
      .filter((row) => isSessionCard(row, flying) && !row.archived && !row.done)
      .map((row) => ({
        row,
        start: row.startedAt,
        status: { label: row.statusLabel, status: row.status },
      })),
  ).map(({ row }) => row);
  // A session at work is in progress, after the features; the others wait in Sessions.
  const working = all.filter((row) => row.status === "working");
  // A session waiting on the human needs you, as in the sidebar; the others wait in Sessions.
  const waitingRows = all.filter((row) => row.status !== "working" && asks(row));
  const sessions = all.filter((row) => row.status !== "working" && !asks(row));
  const progress = [...agents.map((f) => feature(f, progressDetail(f))), ...working.map(session)];
  return [
    ...(invalid.length === 0
      ? []
      : [
          part(
            "problems",
            { count: invalid.length, icon: "warning", title: "Problems", tone: "problem" },
            invalid.map((f) => feature(f, f.problems[0]?.message)),
            "",
            look,
          ),
        ]),
    part(
      "needs-you",
      {
        ...(continued.size === 0 || preview === undefined
          ? {}
          : {
              actions: (
                <ContinueAll
                  names={human.filter(continuedByAll).map((f) => f.slug)}
                  onPreview={preview.onChange}
                />
              ),
            }),
        count: human.length + waitingRows.length,
        icon: "uraeda:hourglass",
        title: "Needs you",
        tone: "attention",
      },
      [...human.map((f) => feature(f, waiting(f).line)), ...waitingRows.map(session)],
      "Nothing waits on you.",
      look,
    ),
    part(
      "in-progress",
      { count: progress.length, icon: "uraeda:activity", title: "In progress" },
      progress,
      "Nothing in progress.",
      look,
    ),
    // Only while a session runs, as the sidebar's: an empty pane has nothing to tell.
    ...(sessions.length === 0
      ? []
      : [
          part(
            "sessions",
            { count: sessions.length, icon: "uraeda:bot", title: "Sessions" },
            sessions.map(session),
            "",
            look,
          ),
        ]),
  ];
}

/**
 * Splits the panes into two columns, each keeping their reading order, so that the columns end as
 * near each other as they can: the least empty space under the shorter one. The first split that
 * reaches the least difference wins, so ties keep the panes on the left, and, among those, the one
 * that keeps the first pane there.
 */
export function splitColumns(parts: Array<CorePart>): [Array<CorePart>, Array<CorePart>] {
  let best = 0;
  let least = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 1 << parts.length; mask++) {
    const right = parts.reduce((sum, p, i) => sum + (mask & (1 << i) ? p.height : 0), 0);
    const left = parts.reduce((sum, p) => sum + p.height, 0) - right;
    const waste = Math.abs(left - right);
    // A split as good as the best, but with the first pane on the left, wins it: the first is the
    // most important, as with two panes, where the splits are mirrors and always tie.
    if (waste < least || (waste === least && best & 1 && !(mask & 1))) {
      least = waste;
      best = mask;
    }
  }
  return [parts.filter((_, i) => !(best & (1 << i))), parts.filter((_, i) => best & (1 << i))];
}
