// The Activity's walks over a session's turns and their pages, which read what the panel draws and
// draw nothing themselves. Without a stretch in the address, one walk goes back from the latest
// turn's last page; with one, a walk goes forward from the stretch's page, and another back from
// the page before it (ruling R25). Each reads pages until they hold the rows the bound needs, and
// one more, which tells whether rows are left beyond; and at most a budget of pages, since rows
// count the main agent's calls alone, so a turn of a sub-agent's calls, or a long chat of few
// calls, would be read whole (ruling R24). They suspend until what they read is in, so the rows
// drawn stay while they read more.
import { type ReactNode, useLayoutEffect } from "react";
import { useTurn, useTurnLog } from "../sessionData.ts";
import { type ReadPage, rowCount } from "./activityRuns.ts";

/** A walk's end, given the pages it read, the earliest first, and whether its budget stopped it. */
type WalkEnd = (acc: ReadonlyArray<ReadPage>, capped: boolean) => ReactNode;

/** Where a walk is, and what it looks for. */
type WalkProps = {
  /** The pages read so far, the earliest first. */
  acc: ReadonlyArray<ReadPage>;
  /** The pages the walk may still read. */
  budget: number;
  /** What the walk draws once it ends: the next walk, or the hand-over of what it read. */
  end: WalkEnd;
  /** The place of the turn walked in `turns`. */
  index: number;
  /** The rows still needed, from this page on. */
  need: number;
  /** The page walked, or its turn's last. */
  page: number | "last";
  /** The session's turns, oldest first. */
  turns: ReadonlyArray<string>;
};

/** A walk's direction: the component of its steps, and the place after a page, in its way. */
type Way = {
  step: (walking: WalkProps, page: number, pages: number) => Place | undefined;
  Walker: (props: WalkProps) => ReactNode;
};

/** A turn's page, by its turn's place in the session's turns. */
type Place = { index: number; page: number | "last" };

/** Hands the pages read to the panel, drawing nothing. */
function Settled({ onRead }: { onRead: () => void }) {
  useLayoutEffect(() => onRead());
  return null;
}

/**
 * The walk's next step, with what is left of `walking`, to the place `step`, while rows are still
 * needed and the budget allows; else its end, capped when its budget stopped it before the
 * session's edge.
 */
function next(
  walking: WalkProps,
  left: Pick<WalkProps, "acc" | "budget" | "need">,
  step: Place | undefined,
  { Walker }: Way,
) {
  if (step && left.need > 0 && left.budget > 0) {
    return <Walker {...walking} {...left} {...step} />;
  }
  return walking.end(left.acc, step !== undefined && left.need > 0);
}

/** The page before `page` of the turn at `index`: its turn's, or the last of the turn before. */
function pageBefore(index: number, page: number): Place | undefined {
  if (page > 0) {
    return { index, page: page - 1 };
  }
  return index > 0 ? { index: index - 1, page: "last" } : undefined;
}

/** The page after `page` of the walked turn, `pages` long: its turn's, or the next turn's first. */
function pageAfter(walking: WalkProps, page: number, pages: number): Place | undefined {
  if (page + 1 < pages) {
    return { index: walking.index, page: page + 1 };
  }
  return walking.index + 1 < walking.turns.length
    ? { index: walking.index + 1, page: 0 }
    : undefined;
}

/**
 * A page of a turn `pages` long, read: its rows counted, the walk going on its `way`. The session's
 * latest turn's last page, which may still grow, is read live.
 */
function WalkPage({ pages, way, ...walking }: WalkProps & { pages: number; way: Way }) {
  const page = walking.page === "last" ? pages - 1 : walking.page;
  const turn = walking.turns[walking.index]!;
  const latest = walking.index === walking.turns.length - 1 && page === pages - 1;
  const log = useTurnLog(`${turn}:${page}`, latest);
  const items = log?.items ?? [];
  const read = { items, page, turn };
  const acc = way === FORWARD ? [...walking.acc, read] : [read, ...walking.acc];
  const left = { acc, budget: walking.budget - 1, need: walking.need - rowCount(items) };
  return next(walking, left, way.step(walking, page, pages), way);
}

/**
 * Walks back from a turn's page: the turn's record says how many pages it has, and a turn with no
 * item yet is passed.
 */
function WalkBack(props: WalkProps) {
  const turn = useTurn(props.turns[props.index]!, props.index === props.turns.length - 1);
  const pages = turn?.pages ?? 0;
  return pages > 0 ? (
    <WalkPage {...props} pages={pages} way={BACK} />
  ) : (
    next(props, props, pageBefore(props.index, 0), BACK)
  );
}

/**
 * Walks forward from a turn's page: the turn's record says how many pages it has, and a page past
 * them, as a turn with no item yet, is passed.
 */
function WalkForward(props: WalkProps) {
  const turn = useTurn(props.turns[props.index]!, props.index === props.turns.length - 1);
  const pages = turn?.pages ?? 0;
  const at = props.page === "last" ? pages - 1 : props.page;
  return at >= 0 && at < pages ? (
    <WalkPage {...props} pages={pages} way={FORWARD} />
  ) : (
    next(props, props, pageAfter(props, Math.max(at, pages - 1), pages), FORWARD)
  );
}

const BACK: Way = {
  step: (walking, page) => pageBefore(walking.index, page),
  Walker: WalkBack,
};
const FORWARD: Way = { step: pageAfter, Walker: WalkForward };

/** What the walks read, handed to the panel. */
export type WalkRead = {
  /** Whether a budget stopped the walk forward, so later rows may exist. */
  cappedAfter: boolean;
  /** Whether a budget stopped the walk back, so earlier rows may exist. */
  cappedBefore: boolean;
  /** The pages read, the earliest first. */
  pages: ReadonlyArray<ReadPage>;
  /** How many of `pages` lie before the window's start: those the walk back read. */
  split: number;
};

/** The window a walk reads: its start, if not the latest, and the rows before and after it. */
export type Window = {
  /** The rows wanted after the start. */
  after: number;
  /** The rows wanted before the start, or before the latest without one. */
  before: number;
  /** The page the window starts on, a stretch's; the latest's end without one. */
  start: { index: number; page: number } | undefined;
};

/**
 * The walks that read the window `window` of the session's `turns`, `budget(rows)` pages at most
 * for `rows` rows. `onRead` hears what they read, once committed.
 */
export function walkOf(
  { after, before, start }: Window,
  turns: ReadonlyArray<string>,
  budget: (rows: number) => number,
  onRead: (read: WalkRead) => void,
): ReactNode {
  // Each walk reads a row past those it needs: one there tells that rows are left beyond.
  const back = (from: Place | undefined, then: WalkEnd) =>
    from ? (
      <WalkBack
        {...from}
        acc={[]}
        budget={budget(before)}
        end={then}
        need={before + 1}
        turns={turns}
      />
    ) : (
      then([], false)
    );
  if (start === undefined) {
    const latest = { index: turns.length - 1, page: "last" as const };
    return back(latest, (pages, cappedBefore) => {
      const read = { cappedAfter: false, cappedBefore, pages, split: pages.length };
      return <Settled onRead={() => onRead(read)} />;
    });
  }
  return back(pageBefore(start.index, start.page), (earlier, cappedBefore) => (
    <WalkForward
      {...start}
      acc={[]}
      budget={budget(after)}
      end={(later, cappedAfter) => {
        const pages = [...earlier, ...later];
        const read = { cappedAfter, cappedBefore, pages, split: earlier.length };
        return <Settled onRead={() => onRead(read)} />;
      }}
      need={after + 1}
      turns={turns}
    />
  ));
}
