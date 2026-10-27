// The priorities on the shared list: "Ongoing", the entries whose feature or change runs, in green,
// then Now, Next, Later, and Blocked, in the file's order, as columns, each with its context, its
// colour, and its Add row. Blocked shows only when it has lines.
// The file keeps the started entries at the top of Now; on screen they show apart.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { PriorityEntry } from "uraeda-server/fate";
import type { usePriorities } from "../data.ts";
import { stepKindOf } from "../sidebar/cards.ts";
import { STEP_ICONS } from "../sidebar/StepIcon.tsx";
import { TITLES, titleOf } from "../QuickAdd.tsx";
import { useOpenAddForm } from "../SidebarAdd.tsx";
import { refusal } from "../errors.ts";
import { navigate, useLocalPath, useRepoPath } from "../routes.tsx";
import { plain } from "../Spans.tsx";
import { DraftView, PrioritiesView } from "../views.ts";
import { fileIndex } from "./cardMoves.ts";
import { PriorityMenu } from "./CardMenu.tsx";
import { PriorityEditor } from "./RowEditors.tsx";
import { type Tone, WorkList, type WorkRow, type WorkSection } from "./WorkList.tsx";

/** The priorities as the page reads them. */
export type Priorities = NonNullable<ReturnType<typeof usePriorities>>;

const TONES: Record<string, Tone> = {
  later: "gray",
  next: "neutral",
  now: "blue",
};

/** An entry's marks, as text after its own: "backlog". A running entry's step is its icon. */
export function marksOf(entry: PriorityEntry) {
  return !entry.running && entry.draft?.backlog ? "backlog" : undefined;
}

/**
 * What an entry's row draws of it besides its text: the icon of the step running on it, as the
 * sidebar draws it, or an icon for the file of its draft, which also draws its text as a hyperlink.
 */
export function lookOf(entry: PriorityEntry) {
  if (entry.running) {
    return { icon: STEP_ICONS[stepKindOf(entry.running.step)] };
  }
  return entry.draft ? { icon: "uraeda:file-text" as const, isLinked: true } : {};
}

/** The width, in px, the list needs for its columns: under it, the sections stack. */
const COLUMNS_FROM = 1000;

/** The refusal of a menu nobody listens to. */
const NOTHING = () => undefined;

/** What Ongoing is, in the spec's own words: the section is derived, so the page says it. */
const ONGOING_CONTEXT = "Running now: an agent works or waits on you.";

/**
 * The priorities as the lists show them (R10): the running entries of every section, apart, then
 * each section with its entries not running. Each keeps the file's order.
 */
export function byRunning(priorities: Pick<Priorities, "sections">) {
  return {
    ongoing: priorities.sections.flatMap((section) =>
      section.entries.filter((entry) => entry.running),
    ),
    sections: priorities.sections.map((section) => ({
      ...section,
      entries: section.entries.filter((entry) => !entry.running),
    })),
  };
}

/**
 * The sections the page draws: "Ongoing" first, only when something runs, then each section of the
 * file with its context and its Add row, but a Blocked without lines (R1).
 */
function sectionsOf(
  priorities: Priorities,
  here: ReturnType<typeof useRepoPath>,
  onRefused: (message: string | undefined) => void,
): Array<WorkSection> {
  const found = (entry: PriorityEntry) => {
    for (const section of priorities.sections) {
      const index = section.entries.findIndex((one) => one.key === entry.key);
      if (index >= 0) {
        return { entry, index, section };
      }
    }
    return undefined;
  };
  const row = (entry: PriorityEntry): WorkRow => {
    const place = found(entry);
    return {
      // A line the file no longer holds has no editor and no menu: its keys have nothing to open.
      editor:
        place && ((hooks) => <PriorityEditor found={place} hash={priorities.hash} hooks={hooks} />),
      href: here(`/priorities/${entry.key}`),
      isFixed: entry.running !== undefined,
      key: entry.key,
      lines: entry.nestedSpans.map(plain),
      ...lookOf(entry),
      marks: marksOf(entry),
      // A line with a draft, or running, opens its page; any other shows itself in a pane.
      peek: !entry.running && !entry.draft,
      menu: place && <PriorityMenu found={place} hash={priorities.hash} onRefused={onRefused} />,
      text: plain(entry.spans),
    };
  };

  const shown = byRunning(priorities);
  const ongoing: WorkSection = {
    context: ONGOING_CONTEXT,
    id: "ongoing",
    isFixed: true,
    rows: shown.ongoing.map(row),
    title: "Ongoing",
    tone: "green",
  };
  // A Blocked without lines is not drawn (R1): the file keeps it, the page does not show it.
  const visible = shown.sections.filter(
    (section) => section.section !== "blocked" || section.entries.length > 0,
  );
  const sections = visible.map((section): WorkSection => {
    const title = titleOf(section.section);
    return {
      context: section.context ?? undefined,
      id: section.section,
      // The section's last row adds a line: the keyboard's cursor stops on it, and Enter opens the
      // form (the form has no Blocked, R80).
      rows: [
        ...section.entries.map(row),
        ...(TITLES.has(section.section)
          ? [
              {
                href: here(`/priorities#add-${section.section}`),
                icon: "uraeda:plus" as const,
                isAdd: true,
                isFixed: true,
                key: `add:${section.section}`,
                lines: [],
                text: `Add to ${title}`,
              },
            ]
          : []),
      ],
      title,
      tone: TONES[section.section] ?? "neutral",
    };
  });
  // "Ongoing" shows only when something runs.
  return ongoing.rows.length > 0 ? [ongoing, ...sections] : sections;
}

/** How long a write waits for the list to show the one before it, at most. */
const DRAWN_MS = 2000;

/**
 * The list's writes, one after another, as the keys made them ahead of the file: each reads the
 * priorities as the write before it left them, once drawn, for their version and their lines'
 * places, so that a second delete is not refused for the first. `write` resolves with its
 * refusal, if any.
 */
function useWritesInTurn(priorities: Priorities) {
  const latest = useRef(priorities);
  const waiting = useRef(new Set<{ hash: string; resolve: () => void }>());
  useLayoutEffect(() => {
    latest.current = priorities;
    for (const waiter of waiting.current) {
      if (waiter.hash !== priorities.hash) {
        waiting.current.delete(waiter);
        waiter.resolve();
      }
    }
  }, [priorities]);
  /** Once the list shows another version than `hash`, or after `DRAWN_MS`. */
  const drawnAfter = (hash: string) =>
    latest.current.hash === hash
      ? new Promise<void>((resolve) => {
          const waiter = { hash, resolve };
          waiting.current.add(waiter);
          setTimeout(() => {
            waiting.current.delete(waiter);
            resolve();
          }, DRAWN_MS);
        })
      : Promise.resolve();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  return (write: (now: Priorities) => Promise<string | undefined>) => {
    const turn = queue.current.then(async () => {
      const now = latest.current;
      const failed = await write(now);
      if (failed === undefined) {
        await drawnAfter(now.hash);
      }
      return failed;
    });
    queue.current = turn.catch(() => undefined);
    return turn;
  };
}

/**
 * The priorities' sections, with "Ongoing" first, and each section's Add row. `select` is the key
 * of a row to select, for a mockup; otherwise the row whose overlay is open is. `isFocused` puts the
 * keyboard's focus on it. `run` writes a change and resolves with its refusal, if any; a refused
 * move goes to `onMoveRefused`.
 */
export function PrioritiesList({
  isFocused = false,
  onMoveRefused,
  priorities,
  run,
  select,
}: {
  isFocused?: boolean;
  onMoveRefused?: (message: string | undefined) => void;
  priorities: Priorities;
  run: (call: () => Promise<{ error?: unknown }>) => Promise<string | undefined>;
  select?: string;
}) {
  const fate = useFateClient();
  const here = useRepoPath();
  const pathname = useLocalPath();
  const openForm = useOpenAddForm();

  const inTurn = useWritesInTurn(priorities);

  const onMove = async (key: string, section: string, index: number) => {
    const failed = await inTurn((now) => {
      const entry = now.sections.flatMap((s) => s.entries).find((one) => one.key === key);
      const target = now.sections.find((s) => s.section === section);
      if (!entry || !target) {
        return Promise.resolve("The line or its section is no longer in PRIORITIES.md.");
      }
      return run(() =>
        fate.mutations.priorities.move({
          input: {
            entry: entry.id,
            hash: now.hash,
            index: fileIndex(target.entries, key, index),
            section,
          },
          view: PrioritiesView,
        }),
      );
    });
    onMoveRefused?.(failed);
    return failed === undefined;
  };

  /**
   * `d`, once confirmed: the line leaves the file, a refusal shows where a move's does. Resolves
   * with whether it left.
   */
  const onDelete = async (row: WorkRow) => {
    const failed = await inTurn((now) => {
      const entry = now.sections.flatMap((s) => s.entries).find((one) => one.key === row.key);
      if (!entry) {
        return Promise.resolve("The line is no longer in PRIORITIES.md.");
      }
      return run(() =>
        fate.mutations.priorities.remove({
          input: { entry: entry.id, hash: now.hash },
          view: PrioritiesView,
        }),
      );
    });
    onMoveRefused?.(failed);
    return failed === undefined;
  };

  const entryOf = (key: string) =>
    priorities.sections.flatMap((s) => s.entries).find((candidate) => candidate.key === key);

  /**
   * Enter or a click: a line that runs opens its feature, a line with a draft opens the draft's
   * page. A line with neither opens nothing: `p` makes its draft.
   */
  const open = (href: string) => {
    // An add row: the form of its section.
    const adding = /#add-([a-z]+)$/.exec(href)?.[1];
    if (adding !== undefined) {
      openForm("priority", { section: adding });
      return;
    }
    const entry = priorities.sections
      .flatMap((s) => s.entries)
      .find((candidate) => here(`/priorities/${candidate.key}`) === href);
    if (entry?.running) {
      navigate(here(`/f/${entry.running.folder}`));
    } else if (entry?.draft) {
      navigate(here(`/edit/${entry.draft.path}`));
    }
  };

  /**
   * `p`: the line becomes a draft, its text under "What", and the draft's page opens with the
   * focus in its text. A line with a draft opens it; one that runs or links a file has none to make.
   */
  const onPromote = (row: WorkRow) => {
    const entry = entryOf(row.key);
    if (!entry || entry.running || entry.spans.some((span) => span.link?.path)) {
      return entry?.draft ? void navigate(here(`/edit/${entry.draft.path}`), { focus: "text" }) : false;
    }
    void (async () => {
      const made = await fate.mutations.draft.create({
        input: { hash: priorities.hash, line: entry.id },
        view: DraftView,
      });
      const path = made.result?.path;
      if (made.error || typeof path !== "string") {
        onMoveRefused?.(made.error ? refusal(made.error).message : "Nothing was made.");
        return;
      }
      navigate(here(`/edit/${path}`), { focus: "text" });
    })();
  };

  const all = sectionsOf(priorities, here, onMoveRefused ?? NOTHING);
  // Whether the columns have the room they need, read from this list's own width before it paints,
  // and again as it changes.
  const room = useRef<HTMLDivElement>(null);
  const [hasRoom, setHasRoom] = useState<boolean>();
  useLayoutEffect(() => {
    const element = room.current;
    if (!element) {
      return undefined;
    }
    const read = () => setHasRoom(element.clientWidth >= COLUMNS_FROM);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // The page opens on the highest row of Now, with the keyboard's focus on it, once.
  const firstNow = all.find((section) => section.id === "now")?.rows[0]?.key;
  const [isArriving, setArriving] = useState(true);
  useEffect(() => setArriving(false), []);
  const selected =
    select ??
    all.flatMap((section) => section.rows).find((r) => pathname === `/priorities/${r.key}`)?.key;

  return (
    // Its width is the room the columns have: with less than `COLUMNS_FROM`, the sections stack, as
    // on the phone. Only this page: no size class of the layout.
    <div ref={room}>
    <WorkList
      initial={firstNow}
      isFocused={isFocused || isArriving}
      isRoomy
      layout={hasRoom === false ? "stack" : "columns"}
      // `o`: the form in the section of the line's own place in the file, not "Ongoing"; the form
      // has no Blocked (R80), so a line there opens it in the default place.
      onAddBeside={(sectionId, row) => {
        // An add row names its own section; a line, the one it is in, in the file.
        const own = priorities.sections.find((s) => s.entries.some((e) => e.key === row.key));
        const id = own?.section ?? sectionId;
        openForm("priority", { section: TITLES.has(id) ? id : undefined });
      }}
      onDelete={onDelete}
      onMove={onMove}
      onOpen={open}
      onPromote={onPromote}
      sections={all}
      selected={selected}
    />
    </div>
  );
}
