// Home's core, above the "Overview" line: the problems that stop the workflow, when there are any,
// what waits on the human, what agents work on, and the sessions without a workflow, when one runs.
// Each is a pane of the sidebar's own cards; `coreParts` gives each its node and its height, for
// the layout.
import type { Icon } from "@astryxdesign/core/Icon";
import { colorVars, focusVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";
import { waiting } from "../labels.ts";
import { Empty } from "../layout/Empty.tsx";
import { Pane } from "../layout/Pane.tsx";
import { byStatus, type Feature, type Row } from "../sidebar/cards.ts";
import { FeatureCard, SessionCard } from "../sidebar/Cards.tsx";

const styles = stylex.create({
  // A card, framed as a list's row: the keyboard's focus ring around the whole card, its task list
  // too, drawn just inside it, not the ring of its row alone, whose edge would cut across it.
  card: {
    outlineColor: { ":has(:focus-visible)": colorVars["--color-accent"], default: null },
    outlineOffset: {
      ":has(:focus-visible)": `calc(-1 * ${focusVars["--focus-outline-width"]})`,
      default: null,
    },
    outlineStyle: { ":has(:focus-visible)": "solid", default: null },
    outlineWidth: { ":has(:focus-visible)": focusVars["--focus-outline-width"], default: null },
  },
  // The card's own row draws no ring: the card does.
  ringless: { [focusVars["--focus-outline-style"]]: "none" },
  // The card the keys or the pointer picked: the mauve tint of a list's selected row, with its bar
  // at the start, so that home has one selection, whether it is in a pane or in a list.
  picked: {
    backgroundColor: colorVars["--color-accent-muted"],
    boxShadow: `inset 2px 0 0 0 ${colorVars["--color-accent"]}`,
  },
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
 * A pane of cards: `cards` each with its detail line if it has one, or `empty` text. The card whose
 * key is `picked` is drawn picked.
 */
function part(
  key: string,
  pane: {
    count: number;
    icon: ComponentProps<typeof Icon>["icon"];
    title: string;
    tone?: "attention" | "problem";
  },
  cards: Array<CoreCard>,
  empty: string,
  picked: string | undefined,
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
              {...stylex.props(styles.card, card.key === picked && styles.picked)}
            >
              <div {...stylex.props(styles.ringless)}>{card.node}</div>
            </div>
          ))
        )}
      </Pane>
    ),
  };
}

/**
 * The core's panes in their reading order: the problems, when there are any, what waits on the
 * human, what is in progress, and the sessions without a workflow, when one runs. The card whose
 * key is `picked` is drawn picked.
 */
export function coreParts({
  agents,
  human,
  invalid,
  picked,
  rows,
}: {
  agents: Array<Feature>;
  human: Array<Feature>;
  invalid: Array<Feature>;
  picked?: string | undefined;
  rows: Array<Row>;
}): Array<CorePart> {
  const rowOf = (feature: Feature) => rows.find((row) => row.folder === feature.folder);
  const feature = (f: Feature, detail?: string): CoreCard => ({
    detail,
    key: `f:${f.folder}`,
    node: <FeatureCard detail={detail} feature={f} pathname="" row={rowOf(f)} />,
  });
  const sessions = byStatus(
    rows
      .filter((row) => row.folder === null && !row.archived && !row.done)
      .map((row) => ({
        row,
        start: row.startedAt,
        status: { label: row.statusLabel, status: row.status },
      })),
  );
  return [
    ...(invalid.length === 0
      ? []
      : [
          part(
            "problems",
            { count: invalid.length, icon: "warning", title: "Problems", tone: "problem" },
            invalid.map((f) => feature(f, f.problems[0]?.message)),
            "",
            picked,
          ),
        ]),
    part(
      "needs-you",
      { count: human.length, icon: "uraeda:hourglass", title: "Needs you", tone: "attention" },
      human.map((f) => feature(f, waiting(f).line)),
      "Nothing waits on you.",
      picked,
    ),
    part(
      "in-progress",
      { count: agents.length, icon: "uraeda:activity", title: "In progress" },
      agents.map((f) => feature(f, f.step.task ?? undefined)),
      "Nothing in progress.",
      picked,
    ),
    // Only while a session runs, as the sidebar's: an empty pane has nothing to tell.
    ...(sessions.length === 0
      ? []
      : [
          part(
            "sessions",
            { count: sessions.length, icon: "uraeda:bot", title: "Sessions" },
            sessions.map(({ row }) => ({
              key: `s:${row.id}`,
              node: <SessionCard pathname="" row={row} />,
            })),
            "",
            picked,
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
