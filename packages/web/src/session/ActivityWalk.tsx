// The Activity's walk back over a session's turns, from the latest, and each turn's pages from its
// last: it reads pages until they hold the rows the bound needs, and back to the stretch the address
// names, then hands the pages read to the panel, which draws them. It draws nothing itself, and
// suspends until what it reads is in, so the rows drawn stay while it reads more.
import { useLayoutEffect } from "react";
import { useTurn, useTurnLog } from "../sessionData.ts";
import { type ReadPage, rowCount } from "./activityRuns.ts";

/** Where the walk is, and what it looks for. */
export type ActivityWalk = {
  /** The pages read so far, the earliest first. */
  acc: ReadonlyArray<ReadPage>;
  /** The place of the turn walked in `turns`. */
  index: number;
  /** The rows still needed, from this page back. */
  need: number;
  /** Called with the pages the walk ended on, once committed. */
  onRead: (read: ReadonlyArray<ReadPage>) => void;
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
function Settled({ acc, onRead }: Pick<ActivityWalk, "acc" | "onRead">) {
  useLayoutEffect(() => onRead(acc));
  return null;
}

/**
 * The walk's next step from the page `page`, with the pages read `acc`: the page before, while rows
 * are still `need`ed or the stretch the address names lies before, else the end of the walk.
 */
function next(walking: ActivityWalk, page: number, acc: ReadonlyArray<ReadPage>, need: number) {
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
  if (previous && (need > 0 || behind)) {
    return <Walk {...walking} {...previous} acc={acc} need={need} root={false} />;
  }
  return <Settled acc={acc} onRead={walking.onRead} />;
}

/** A step of the walk over a page of a turn `pages` long: it counts the page's rows. */
function WalkPage({ pages, ...walking }: ActivityWalk & { pages: number }) {
  const page = walking.page === "last" ? pages - 1 : walking.page;
  const turn = walking.turns[walking.index]!;
  const log = useTurnLog(`${turn}:${page}`, walking.root && page === pages - 1);
  const items = log?.items ?? [];
  const acc = [{ items, page, turn }, ...walking.acc];
  return next(walking, page, acc, walking.need - rowCount(items));
}

/**
 * Walks back from a turn's page: the turn's record says how many pages it has, and a turn with no
 * item yet is passed.
 */
export function Walk(props: ActivityWalk) {
  const turn = useTurn(props.turns[props.index]!, props.root);
  const pages = turn?.pages ?? 0;
  return pages > 0 ? <WalkPage {...props} pages={pages} /> : next(props, 0, props.acc, props.need);
}
