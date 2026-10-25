// The session's Activity: its runs, each titled by its place and length, with its calls and
// thoughts, sub-agents as folded groups (US1). It mounts the latest 200 rows, counting rows and not
// messages, and "Show earlier runs" adds 200 more (SC-002): a walk back over the turns' pages, from
// the latest, reads as many as the bound needs. At a stretch the address names, it mounts 200 rows
// from the stretch's page on instead, with "Show later runs" below them, and marks the stretch's
// rows (ruling R25). The tail's walk counts messages and keeps its start, so the Activity has its
// own (the plan's complexity tracking).
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import {
  type RefObject,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TURN_PAGE } from "uraeda-server/limits";
import { atEnd, scroller } from "../following.ts";
import { keepPlace, scrollInstantly, topOf } from "../keepPlace.ts";
import { statusStyles } from "../Question.tsx";
import { CHANGE } from "../routeHistory.ts";
import { currentEntry, updateEntry, useSearch } from "../routes.tsx";
import { useSession, useTurn } from "../sessionData.ts";
import { sentAt } from "../TranscriptMessages.tsx";
import { elapsed } from "../TurnLines.tsx";
import { type OpenKeys, useOpenKeys } from "../useOpenKeys.ts";
import { walkOf, type WalkRead, type Window } from "./ActivityWalk.tsx";
import { drawnRows, rowCount, type Run, runsOf } from "./activityRuns.ts";
import { RowList, rowWeight } from "./ActivityRows.tsx";
import { Section } from "./Section.tsx";
import { STRETCH_PARAMETER } from "./stretches.ts";

/** How many rows the Activity mounts at first, and how many "Show earlier runs" adds. */
export const ACTIVITY_ROWS = 200;

/**
 * How many pages the walk reads at most for each 200 rows it draws: past the two or three pages
 * dense rows take, so a turn of a sub-agent's calls, or a chat of few calls, is not read whole.
 */
const WALK_PAGES = 4;

const styles = stylex.create({
  // The run's start, after its title, as the mockup's group title.
  start: { flexShrink: 0 },
});

/** What the Activity reads before the session's first call, as before its first message. */
export function NoCall() {
  return <Text color="secondary">No call yet.</Text>;
}

/** The stretch the address names: its key, its turn's place, and its first item's page. */
type Target = { index: number; key: string; page: number };

/**
 * The stretch `?stretch=<turn>:<seq>` names among the session's `turns`, if one of theirs: its page
 * by its seq, as the server pages a turn's items.
 */
function targetOf(stretch: string | null, turns: ReadonlyArray<string>): Target | undefined {
  const match = stretch === null ? null : /^(\d+):(\d+)$/.exec(stretch);
  const index = match ? turns.indexOf(match[1]!) : -1;
  return match && index >= 0
    ? { index, key: match[0], page: Math.floor(Number(match[2]) / TURN_PAGE) }
    : undefined;
}

/**
 * What the walks read, the window they read, and the rows above its start they were walked for,
 * which tells a press of "Show earlier runs" its rows are in.
 */
type Read = WalkRead & { walked: number; window: Window };

/** Whether two walks read the same pages, as the same records, and ended the same. */
const same = (a: Read | undefined, b: Read) =>
  a?.cappedAfter === b.cappedAfter &&
  a.cappedBefore === b.cappedBefore &&
  a.split === b.split &&
  a.walked === b.walked &&
  a.window === b.window &&
  a.pages.length === b.pages.length &&
  a.pages.every(
    (read, at) =>
      read.turn === b.pages[at]!.turn &&
      read.page === b.pages[at]!.page &&
      read.items === b.pages[at]!.items,
  );

/** The turn's words after "Run N · ": its length (ruling R4), "live", "failed", or "stopped". */
function lengthOf(turn: { endedAt: string | null; startedAt: string | null; state: string }) {
  if (turn.state === "running" || turn.state === "queued") {
    return "live";
  }
  if (turn.state === "failed" || turn.state === "stopped") {
    return turn.state;
  }
  return elapsed(Date.parse(turn.endedAt ?? "") - Date.parse(turn.startedAt ?? "") || 0);
}

/** Where the Activity scrolls to reach the stretch the address names: its run's title, or row. */
type Aim = "row" | "title";

/**
 * Where a run's part scrolls to reach the stretch `marked`, if it holds its first row: the run's
 * title when the stretch is the run's first, else the stretch's first row.
 */
function aimOf(run: Run, from: number, to: number, marked: string | undefined): Aim | undefined {
  const first = run.rows.findIndex((row) => run.stretches.get(row.seq) === marked);
  if (marked === undefined || first < from || first >= to) {
    return undefined;
  }
  return run.start === 0 && first === 0 ? "title" : "row";
}

/**
 * A run: its title, "Run 1 · 2 min", "failed" in the error colour, its start, and its rows from
 * `from` to before `to`. Holding the first row of the stretch the address names, it hands where to
 * scroll to reach it to `onTarget` once drawn.
 */
function RunPart({
  from,
  keys,
  marked,
  number,
  onTarget,
  run,
  to,
}: {
  from: number;
  keys: OpenKeys;
  marked: string | undefined;
  number: number;
  onTarget: ((element: Element) => void) | undefined;
  run: Run;
  to: number;
}) {
  const turn = useTurn(run.turn);
  const part = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const rows = run.rows.slice(from, to);
  const aim = aimOf(run, from, to, marked);
  useLayoutEffect(() => {
    // The stretch's first row is the first marked one in the run's list.
    const element =
      aim === "title" ? title.current : part.current?.querySelector('[aria-current="true"]');
    if (aim && element && onTarget) {
      onTarget(element);
    }
  }, [aim, onTarget]);
  if (!turn) {
    return null;
  }
  const length = lengthOf(turn);
  const view = {
    ended: turn.state !== "running" && turn.state !== "queued",
    keys,
    marked,
    run,
    running: turn.state === "running",
  };
  return (
    <VStack gap={1} ref={part}>
      <HStack align="center" gap={2} justify="between" ref={title}>
        {/* The title in the time's size, as the mockup's group title: a heading to the keyboard. */}
        <Heading accessibilityLevel={3} level={6}>
          <Text color="secondary" type="supporting">
            {`Run ${number} · `}
            <span {...stylex.props(length === "failed" && statusStyles.error)}>{length}</span>
          </Text>
        </Heading>
        {turn.startedAt && (
          <Text color="secondary" type="supporting" xstyle={styles.start}>
            {sentAt(turn.startedAt)}
          </Text>
        )}
      </HStack>
      <RowList items={rows} label={`Run ${number}`} view={view} />
    </VStack>
  );
}

/**
 * Scrolls `element` to the top of its scroller, the column's part, alone: neither the page nor the
 * chat moves.
 */
function scrollToTop(element: Element) {
  const box = scroller(element);
  if (box) {
    scrollInstantly(element.getBoundingClientRect().top - box.getBoundingClientRect().top, box);
  }
}

/** The weight of the rows drawn, of each run from `from` to before `to`. */
function weightOf(
  runs: ReadonlyArray<Run>,
  { from, to }: { from: Array<number>; to: Array<number> },
  keys: OpenKeys,
) {
  return runs.reduce(
    (total, run, at) =>
      run.rows.slice(from[at], to[at]).reduce((sum, row) => sum + rowWeight(run, row, keys), total),
    0,
  );
}

/**
 * Keeps the Activity's latest row in view while `latest`, without a stretch to show: it opens at
 * its end, as the chat does, and follows the rows that arrive, and its part as it shrinks, while
 * the human is there; scrolled up, nothing moves. `list` is the runs' list, in the part of the
 * column that scrolls, once `shown`.
 */
function useLatestInView(list: RefObject<HTMLElement | null>, latest: boolean, shown: boolean) {
  // Whether the human was at the end when the part last scrolled: a part that shrinks or grows
  // sends no scroll, and keeps it. Back from a stretch's rows, the latest open at their end again.
  const following = useRef(true);
  useLayoutEffect(() => {
    if (latest) {
      following.current = true;
    }
  }, [latest]);
  useEffect(() => {
    const box = list.current ? scroller(list.current) : undefined;
    if (!latest || !shown || !box) {
      return;
    }
    const read = () => {
      following.current = atEnd(box);
    };
    box.addEventListener("scroll", read, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            if (following.current) {
              scrollInstantly(box.scrollHeight, box);
            }
          });
    observer?.observe(box);
    return () => {
      box.removeEventListener("scroll", read);
      observer?.disconnect();
    };
  }, [latest, list, shown]);
  useLayoutEffect(() => {
    const box = list.current ? scroller(list.current) : undefined;
    if (latest && box && following.current) {
      scrollInstantly(box.scrollHeight, box);
    }
  });
}

/** A ghost button of the Activity's: "Show earlier runs" or "Show later runs". */
function More({ label, onPress }: { label: string; onPress: () => void }) {
  return <Button clickAction={onPress} label={label} size="sm" variant="ghost" />;
}

/**
 * The runs of the pages `read`, the rows of its window, with "Show earlier runs" above them while
 * rows are left out before, or the walk's budget stopped it, and "Show later runs" below them
 * alike. `onDrawn` hears the rows the walk drawn was walked for, at each commit.
 */
function Runs({
  arrival,
  onDrawn,
  onLater,
  onMore,
  read,
  target,
  turns,
}: {
  /** How many times the address arrived again, unchanged: each scrolls to the stretch again. */
  arrival: number;
  onDrawn: (walked: number) => void;
  onLater: () => void;
  onMore: (anchor: Element | null) => void;
  read: Read;
  target: Target | undefined;
  turns: ReadonlyArray<string>;
}) {
  const keys = useOpenKeys();
  const box = useRef<HTMLDivElement>(null);
  const runs = useMemo(() => runsOf(read.pages), [read.pages]);
  const split = read.pages
    .slice(0, read.split)
    .reduce((sum, page) => sum + rowCount(page.items), 0);
  const rows = drawnRows(
    runs,
    { after: read.window.after, before: read.window.before, split },
    (run, row) => rowWeight(run, row, keys),
    target?.key,
  );
  // The stretch is scrolled to once per arrival of its address, once the window read for it draws:
  // a window read for another may hold it, and move as its own is read.
  const scrolled = useRef<string | undefined>(undefined);
  const start = read.window.start;
  const aimed = target && start?.index === target.index && start.page === target.page;
  const scrollKey = `${target?.key}#${arrival}`;
  const onTarget = useCallback(
    (element: Element) => {
      if (scrolled.current !== scrollKey) {
        scrolled.current = scrollKey;
        scrollToTop(element);
      }
    },
    [scrollKey],
  );
  // The walks read a row past those drawn: one left out tells that rows exist there.
  const before = rows.earlier || read.cappedBefore;
  const after = rows.later || read.cappedAfter;
  const drawn = weightOf(runs, rows, keys);
  useLayoutEffect(() => onDrawn(read.walked));
  const shown = drawn > 0 || before || after;
  useLatestInView(box, target === undefined, shown);
  if (!shown) {
    return <NoCall />;
  }
  return (
    <VStack gap={3}>
      {before && (
        <More
          // The place kept is the first row drawn: the rows added may join its run, above it,
          // and leave the run's block where it was.
          label="Show earlier runs"
          onPress={() => onMore(box.current?.querySelector("li") ?? null)}
        />
      )}
      <VStack gap={3} ref={box}>
        {runs.map((run, at) =>
          rows.to[at]! > rows.from[at]! ? (
            <RunPart
              from={rows.from[at]!}
              key={run.turn}
              keys={keys}
              marked={target?.key}
              number={turns.indexOf(run.turn) + 1}
              onTarget={aimed ? onTarget : undefined}
              run={run}
              to={rows.to[at]!}
            />
          ) : null,
        )}
      </VStack>
      {after && <More label="Show later runs" onPress={onLater} />}
    </VStack>
  );
}

/** A press of "Show earlier runs" waiting for its rows to draw. */
type Press = { done: () => void; next: number };

/**
 * "Show earlier runs": the count of rows drawn up to the window's start, the latest or a stretch's,
 * kept in the history entry so Back and a reload draw as many, and the press that raises it by 200,
 * keeping the reader's place once its rows draw. `reset` draws 200 again, for another window.
 */
function useShown() {
  const [shown, setShown] = useState(() => currentEntry().activity ?? ACTIVITY_ROWS);
  const presses = useRef<Array<Press>>([]);
  const more = (anchor: Element | null) => {
    const next = shown + ACTIVITY_ROWS;
    void keepPlace(
      anchor ? topOf(anchor) : () => Number.NaN,
      () =>
        new Promise<void>((done) => {
          presses.current.push({ done, next });
          startTransition(() => {
            setShown(next);
            updateEntry({ activity: next });
          });
        }),
      anchor ? scroller(anchor) : undefined,
    );
  };
  // A press is done once the rows of a walk for its count are drawn, however many it found.
  const onDrawn = (walked: number) => {
    const done = (press: Press) => walked >= press.next;
    const waiting = presses.current.filter(done);
    presses.current = presses.current.filter((press) => !done(press));
    waiting.forEach((press) => press.done());
  };
  const reset = () => {
    setShown(ACTIVITY_ROWS);
    updateEntry({ activity: ACTIVITY_ROWS });
  };
  return { more, onDrawn, reset, shown };
}

/**
 * The window the Activity draws: the latest `shown` rows; or, at the stretch `target`, 200 rows
 * from its page on, `later` times 200 more, and `shown` less 200 before (ruling R25).
 */
function windowOf(target: Target | undefined, shown: number, later: number): Window {
  return target === undefined
    ? { after: 0, before: shown, start: undefined }
    : {
        after: ACTIVITY_ROWS * (1 + later),
        before: shown - ACTIVITY_ROWS,
        start: { index: target.index, page: target.page },
      };
}

/**
 * How many times a navigation arrived at the address it left, as a recap line followed again does:
 * the Activity scrolls to its stretch again. Its mount, with a reload or Back, and another stretch,
 * scroll to it on their own: nothing restores the column's place (ruling R26).
 */
function useArrival() {
  const [arrival, setArrival] = useState(0);
  useEffect(() => {
    let search = window.location.search;
    const onChange = () => {
      if (window.location.search === search) {
        setArrival((count) => count + 1);
      }
      search = window.location.search;
    };
    window.addEventListener(CHANGE, onChange);
    return () => window.removeEventListener(CHANGE, onChange);
  }, []);
  return arrival;
}

/** The Activity of the session `session`, once its record is in. */
function Activity({ session }: { session: string }) {
  const turns = useSession(session)?.turns ?? [];
  const stretch = new URLSearchParams(useSearch()).get(STRETCH_PARAMETER);
  const { more, onDrawn, reset, shown } = useShown();
  const arrival = useArrival();
  const [read, setRead] = useState<Read>();
  const [later, setLater] = useState(0);
  const key = turns.join(" ");
  const target = useMemo(() => targetOf(stretch, key.split(" ")), [key, stretch]);
  // Another stretch, or none, draws its own window from 200 rows: the presses were the last one's.
  const [windowFor, setWindowFor] = useState(target?.key);
  if (windowFor !== target?.key) {
    setWindowFor(target?.key);
    setLater(0);
    reset();
  }
  // The walk draws again only when what it walks changes, not as the panel draws what it read.
  const walk = useMemo(() => {
    const list = key === "" ? [] : key.split(" ");
    const bounds = windowOf(target, shown, later);
    const onRead = (walkRead: WalkRead) => {
      const next = { ...walkRead, walked: shown, window: bounds };
      setRead((old) => (same(old, next) ? old : next));
    };
    const budget = (rows: number) => WALK_PAGES * Math.max(1, Math.ceil(rows / ACTIVITY_ROWS));
    return list.length === 0 ? null : walkOf(bounds, list, budget, onRead);
  }, [key, later, shown, target]);
  if (walk === null) {
    return <NoCall />;
  }
  return (
    <>
      <Suspense fallback={null}>{walk}</Suspense>
      {read && (
        <Runs
          arrival={arrival}
          onDrawn={onDrawn}
          onLater={() => startTransition(() => setLater((count) => count + 1))}
          onMore={more}
          read={read}
          target={target}
          turns={turns}
        />
      )}
    </>
  );
}

/** The Activity of the session `session`: its runs, by their latest rows. */
export function ActivityPanel({ session }: { session: string }) {
  return (
    <Section>
      <Activity session={session} />
    </Section>
  );
}
