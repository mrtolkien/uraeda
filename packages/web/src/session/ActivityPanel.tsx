// The session's Activity: its runs, each titled by its place and length, with its calls and
// thoughts, sub-agents as folded groups (US1). It mounts the latest 200 rows, counting rows and not
// messages, and "Show earlier runs" adds 200 more (SC-002): a walk back over the turns' pages, from
// the latest, reads as many as the bound needs, and back to the stretch the address names, whose
// rows it marks and whose run it scrolls to. The tail's walk counts messages and keeps its start,
// so the Activity has its own (the plan's complexity tracking).
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import {
  startTransition,
  Suspense,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { scroller } from "../following.ts";
import { keepPlace, scrollInstantly, topOf } from "../keepPlace.ts";
import { statusStyles } from "../Question.tsx";
import { currentEntry, updateEntry, useSearch } from "../routes.tsx";
import { useSession, useTurn } from "../sessionData.ts";
import { sentAt } from "../TranscriptMessages.tsx";
import { elapsed } from "../TurnLines.tsx";
import { type OpenKeys, useOpenKeys } from "../useOpenKeys.ts";
import { type ActivityWalk, Walk } from "./ActivityWalk.tsx";
import { drawnFrom, type ReadPage, type Run, runsOf } from "./activityRuns.ts";
import { RowList, rowWeight } from "./ActivityRows.tsx";
import { Section } from "./Section.tsx";
import { STRETCH_PARAMETER } from "./stretches.ts";

/** How many rows the Activity mounts at first, and how many "Show earlier runs" adds. */
export const ACTIVITY_ROWS = 200;

/** The items of a turn's page, as the server pages them (`TURN_PAGE`): a stretch's page by its seq. */
const PAGE_ITEMS = 100;

const styles = stylex.create({
  // The run's start, after its title, as the mockup's group title.
  start: { flexShrink: 0 },
});

/** What the Activity reads before the session's first call, as before its first message. */
export function NoCall() {
  return <Text color="secondary">No call yet.</Text>;
}

/** The stretch `?stretch=<turn>:<seq>` names among the session's `turns`, if one of theirs. */
function targetOf(
  stretch: string | null,
  turns: ReadonlyArray<string>,
): ActivityWalk["target"] | undefined {
  const match = stretch === null ? null : /^(\d+):(\d+)$/.exec(stretch);
  const index = match ? turns.indexOf(match[1]!) : -1;
  return match && index >= 0
    ? { index, key: match[0], page: Math.floor(Number(match[2]) / PAGE_ITEMS) }
    : undefined;
}

/** Whether two walks read the same pages, as the same records. */
const same = (a: ReadonlyArray<ReadPage> | undefined, b: ReadonlyArray<ReadPage>) =>
  a?.length === b.length &&
  a.every(
    (read, at) =>
      read.turn === b[at]!.turn && read.page === b[at]!.page && read.items === b[at]!.items,
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

/**
 * A run: its title, "Run 1 · 2 min", "failed" in the error colour, its start, and its rows from
 * `from`. Holding the stretch the address names, it hands its title to `onTarget` once drawn.
 */
function RunPart({
  from,
  keys,
  marked,
  number,
  onTarget,
  run,
}: {
  from: number;
  keys: OpenKeys;
  marked: string | undefined;
  number: number;
  onTarget: (title: HTMLElement) => void;
  run: Run;
}) {
  const turn = useTurn(run.turn);
  const title = useRef<HTMLDivElement>(null);
  const rows = run.rows.slice(from);
  const holds = marked !== undefined && rows.some((row) => run.stretches.get(row.seq) === marked);
  useLayoutEffect(() => {
    if (holds && title.current) {
      onTarget(title.current);
    }
  }, [holds, onTarget]);
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
    <VStack gap={1}>
      <HStack align="center" gap={2} justify="between" ref={title}>
        <Heading accessibilityLevel={3} color="secondary" level={6}>
          {`Run ${number} · `}
          <span {...stylex.props(length === "failed" && statusStyles.error)}>{length}</span>
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
function scrollToTop(element: HTMLElement) {
  const box = scroller(element);
  if (box) {
    scrollInstantly(element.getBoundingClientRect().top - box.getBoundingClientRect().top, box);
  }
}

/** The weight of the rows drawn from `from` on, of each run. */
function weightFrom(runs: ReadonlyArray<Run>, from: ReadonlyArray<number>, keys: OpenKeys) {
  return runs.reduce(
    (total, run, at) =>
      run.rows.slice(from[at]).reduce((sum, row) => sum + rowWeight(run, row, keys), total),
    0,
  );
}

/**
 * The runs of the pages `read`, their latest `shown` rows, and back to the stretch `target`; with
 * "Show earlier runs" above them while rows are left out before. `onDrawn` hears how many rows draw,
 * and whether any is left out, at each commit.
 */
function Runs({
  onDrawn,
  onMore,
  read,
  shown,
  target,
  turns,
}: {
  onDrawn: (drawn: number, before: boolean) => void;
  onMore: (drawn: number, anchor: Element | null) => void;
  read: ReadonlyArray<ReadPage>;
  shown: number;
  target: ActivityWalk["target"] | undefined;
  turns: ReadonlyArray<string>;
}) {
  const keys = useOpenKeys();
  const box = useRef<HTMLDivElement>(null);
  const runs = useMemo(() => runsOf(read), [read]);
  const { earlier, from } = drawnFrom(
    runs,
    shown,
    (run, row) => rowWeight(run, row, keys),
    target?.key,
  );
  // The stretch is scrolled to once, when its run first draws.
  const scrolled = useRef<string | undefined>(undefined);
  const onTarget = useCallback(
    (title: HTMLElement) => {
      if (target && scrolled.current !== target.key) {
        scrolled.current = target.key;
        scrollToTop(title);
      }
    },
    [target],
  );
  const first = read[0];
  const before =
    earlier || (first !== undefined && (first.page > 0 || turns.indexOf(first.turn) > 0));
  const drawn = weightFrom(runs, from, keys);
  useLayoutEffect(() => onDrawn(drawn, before));
  if (drawn === 0 && !before) {
    return <NoCall />;
  }
  return (
    <VStack gap={3}>
      {before && (
        <Button
          clickAction={() => onMore(drawn, box.current?.firstElementChild ?? null)}
          label="Show earlier runs"
          size="sm"
          variant="ghost"
        />
      )}
      <VStack gap={3} ref={box}>
        {runs.map((run, at) =>
          run.rows.length > from[at]! ? (
            <RunPart
              from={from[at]!}
              key={run.turn}
              keys={keys}
              marked={target?.key}
              number={turns.indexOf(run.turn) + 1}
              onTarget={onTarget}
              run={run}
            />
          ) : null,
        )}
      </VStack>
    </VStack>
  );
}

/** A press of "Show earlier runs" waiting for its rows to draw. */
type Press = { done: () => void; next: number };

/**
 * "Show earlier runs": the count of rows drawn, kept in the history entry so Back and a reload
 * draw as many, and the press that raises it by 200, keeping the reader's place once its rows draw.
 */
function useShown() {
  const [shown, setShown] = useState(() => currentEntry().activity ?? ACTIVITY_ROWS);
  const presses = useRef<Array<Press>>([]);
  const more = (drawn: number, anchor: Element | null) => {
    const next = Math.max(shown, drawn) + ACTIVITY_ROWS;
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
  // A press is done once its rows are drawn, or all there are: nothing is left out before.
  const onDrawn = (drawn: number, before: boolean) => {
    const done = (press: Press) => drawn >= press.next || !before;
    const waiting = presses.current.filter(done);
    presses.current = presses.current.filter((press) => !done(press));
    waiting.forEach((press) => press.done());
  };
  return { more, onDrawn, shown };
}

/** The Activity of the session `session`, once its record is in. */
function Activity({ session }: { session: string }) {
  const turns = useSession(session)?.turns ?? [];
  const stretch = new URLSearchParams(useSearch()).get(STRETCH_PARAMETER);
  const { more, onDrawn, shown } = useShown();
  const [read, setRead] = useState<ReadonlyArray<ReadPage>>();
  const onRead = useCallback(
    (next: ReadonlyArray<ReadPage>) => setRead((old) => (same(old, next) ? old : next)),
    [],
  );
  const key = turns.join(" ");
  const target = useMemo(() => targetOf(stretch, key.split(" ")), [key, stretch]);
  // The walk draws again only when what it walks changes, not as the panel draws what it read.
  const walk = useMemo(() => {
    const list = key === "" ? [] : key.split(" ");
    return list.length === 0 ? null : (
      <Walk
        acc={[]}
        index={list.length - 1}
        need={shown}
        onRead={onRead}
        page="last"
        root
        target={target}
        turns={list}
      />
    );
  }, [key, onRead, shown, target]);
  if (walk === null) {
    return <NoCall />;
  }
  return (
    <>
      <Suspense fallback={null}>{walk}</Suspense>
      {read && (
        <Runs
          onDrawn={onDrawn}
          onMore={more}
          read={read}
          shown={shown}
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
