// The Activity's walk back over a session's turns, from the latest, and each turn's pages from its
// last: it reads pages until they hold the rows the bound needs, one more to tell whether earlier
// rows exist, and back to the stretch the address names, then hands the pages read to the panel,
// which draws them. It reads at most a budget of pages: rows count the main agent's calls alone, so a
// turn of a sub-agent's calls, or a long chat of few calls, would be read whole. It draws nothing itself, and
// suspends until what it reads is in, so the rows drawn stay while it reads more.
import { useLayoutEffect } from "react";
import { useTurn, useTurnLog } from "../sessionData.ts";
import { type ReadPage, rowCount } from "./activityRuns.ts";

/** Where the walk is, and what it looks for. */
export type ActivityWalk = {
  /** The pages read so far, the earliest first. */
  acc: ReadonlyArray<ReadPage>;
  /** The pages the walk may still read. */
  budget: number;
  /** The place of the turn walked in `turns`. */
  index: number;
  /** The rows still needed, from this page back. */
  need: number;
  /**
   * Called with the pages the walk ended on, once committed, and whether its budget stopped it
   * before the session's first page, which leaves earlier rows unknown.
   */
  onRead: (read: ReadonlyArray<ReadPage>, capped: boolean) => void;
  /** The page walked, or its turn's last. */
  page: number | "last";
  /** Whether this is the session's latest turn's last page, which may still grow. */
  root: boolean;
  /** The stretch the address names: its key, its turn's place, and its first item's page. */
  target: { index: number; key: string; page: number } | undefined;
  /** The session's turns, oldest first. */
  turns: ReadonlyArray<string>;
};

/** Hands the pages read to the panel, drawing nothing. */
function Settled({
  acc,
  capped,
  onRead,
}: Pick<ActivityWalk, "acc" | "onRead"> & { capped: boolean }) {
  useLayoutEffect(() => onRead(acc, capped));
  return null;
}

/**
 * The walk's next step from the page `page`, with the pages read `acc` and the `budget` left: the
 * page before, while rows are still `need`ed and the budget allows, or the stretch the address
 * names lies before, else the end of the walk.
 */
function next(
  walking: ActivityWalk,
  { acc, budget, need, page }: Pick<ActivityWalk, "acc" | "budget" | "need"> & { page: number },
) {
  const { index, target } = walking;
  const previous =
    page > 0
      ? { index, page: page - 1 }
      : index > 0
        ? { index: index - 1, page: "last" as const }
        : undefined;
  const behind =
    target !== undefined &&
    (target.index < index || (target.index === index && target.page < page));
  if (previous && ((need > 0 && budget > 0) || behind)) {
    return <Walk {...walking} {...previous} acc={acc} budget={budget} need={need} root={false} />;
  }
  return <Settled acc={acc} capped={previous !== undefined && need > 0} onRead={walking.onRead} />;
}

/** A step of the walk over a page of a turn `pages` long: it counts the page's rows. */
function WalkPage({ pages, ...walking }: ActivityWalk & { pages: number }) {
  const page = walking.page === "last" ? pages - 1 : walking.page;
  const turn = walking.turns[walking.index]!;
  const log = useTurnLog(`${turn}:${page}`, walking.root && page === pages - 1);
  const items = log?.items ?? [];
  const acc = [{ items, page, turn }, ...walking.acc];
  return next(walking, {
    acc,
    budget: walking.budget - 1,
    need: walking.need - rowCount(items),
    page,
  });
}

/**
 * Walks back from a turn's page: the turn's record says how many pages it has, and a turn with no
 * item yet is passed.
 */
export function Walk(props: ActivityWalk) {
  const turn = useTurn(props.turns[props.index]!, props.root);
  const pages = turn?.pages ?? 0;
  return pages > 0 ? <WalkPage {...props} pages={pages} /> : next(props, { ...props, page: 0 });
}
