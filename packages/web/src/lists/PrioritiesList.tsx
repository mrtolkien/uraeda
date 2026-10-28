// The priorities on the shared list, as an outliner (see `useOutline`): "Ongoing", the entries whose
// feature or change runs, in green, then Now, Next, Later, and Blocked, in the file's order, as
// columns, each with its context, its colour, and its Add row. Blocked shows only when it has
// lines. Each line draws its nested items as rows of their own, at any depth, edited in place.
// The file keeps the started entries at the top of Now; on screen they show apart.
import { useEffect, useState } from "react";
import { useFateClient } from "react-fate";
import type { PriorityEntry } from "uraeda-server/fate";
import type { usePriorities } from "../data.ts";
import { stepKindOf } from "../sidebar/cards.ts";
import { STEP_ICONS } from "../sidebar/StepIcon.tsx";
import { titleOf, TITLES } from "../QuickAdd.tsx";
import { refusal } from "../errors.ts";
import { currentEntry, navigate, useLocalPath, useRepoPath } from "../routes.tsx";
import { plain } from "../Spans.tsx";
import { DraftView, PrioritiesView } from "../views.ts";
import { fileIndex } from "./cardMoves.ts";
import { type Outline, type OutlineItem, useOutline } from "./useOutline.tsx";
import {
  type Tone,
  type WorkLayout,
  WorkList,
  type WorkRow,
  type WorkSection,
} from "./WorkList.tsx";

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
 * sidebar draws it, or an icon for the file of its draft. Either way its text is a hyperlink: a
 * click leads to its feature's page, or its draft's.
 */
export function lookOf(entry: PriorityEntry) {
  if (entry.running) {
    return { icon: STEP_ICONS[stepKindOf(entry.running.step)], isLinked: true };
  }
  return entry.draft ? { icon: "uraeda:file-text" as const, isLinked: true } : {};
}

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

/** The priorities as the outliner reads them: a running entry stays as it is. */
function outlineOf(priorities: Priorities): Outline<PriorityEntry> {
  return {
    hash: priorities.hash,
    sections: priorities.sections.map((section) => ({
      id: section.section,
      items: section.entries.map((entry) => ({
        children: entry.children,
        id: entry.id,
        isFixed: entry.running !== undefined,
        key: entry.key,
        source: entry,
        spans: entry.spans,
        // Its draft is found by its link, a line's: nested, it would have none.
        staysItem: entry.draft !== undefined,
        text: entry.text,
      })),
    })),
  };
}

/** How a list writes a change: it resolves with its refusal, if any. */
type Run = (call: () => Promise<{ error?: unknown }>) => Promise<string | undefined>;

/**
 * The priorities as an outliner (see `useOutline`): each write goes through `run`, and a refused
 * one to `onMoveRefused`.
 */
function usePrioritiesOutline(
  priorities: Priorities,
  run: Run,
  onMoveRefused: ((message: string | undefined) => void) | undefined,
) {
  const fate = useFateClient();
  return useOutline(
    priorities,
    {
      add: (now, section, text) =>
        run(() =>
          fate.mutations.priorities.add({
            input: { hash: now.hash, section, text },
            view: PrioritiesView,
          }),
        ),
      drop: (now, from, to) => {
        // A line among a section's lines counts them as they show, the running ones apart.
        const entries = now.sections.find((s) => "section" in to && s.section === to.section);
        return run(() =>
          fate.mutations.priorities.drop({
            input: {
              ...(from.at === undefined ? {} : { at: from.at }),
              entry: from.id,
              hash: now.hash,
              ...("under" in to
                ? {
                    index: to.index,
                    under: to.under.id,
                    ...(to.under.at === undefined ? {} : { underAt: to.under.at }),
                  }
                : {
                    index: fileIndex(entries?.entries ?? [], "", to.index),
                    section: to.section,
                  }),
            },
            view: PrioritiesView,
          }),
        );
      },
      edit: (now, id, at, kind, text) =>
        run(() =>
          fate.mutations.priorities.outline({
            input: {
              ...(at === undefined ? {} : { at }),
              entry: id,
              hash: now.hash,
              kind,
              ...(text === undefined ? {} : { text }),
            },
            view: PrioritiesView,
          }),
        ),
      read: outlineOf,
    },
    onMoveRefused,
    { edit: "Edit the line", fresh: "New line" },
  );
}

/** The priorities' outline, as `useOutline` gives it. */
type PrioritiesOutline = ReturnType<typeof usePrioritiesOutline>;

/**
 * The sections the list draws, from the `outline`: "Ongoing" first, when something runs, then each
 * section, with its context and its Add row. `here` is the repository's path of a page.
 */
function sectionsOf(
  outline: PrioritiesOutline,
  priorities: Priorities,
  here: (path: string) => string,
): Array<WorkSection> {
  /** An entry's row, with its nested rows, at `index` of its section in the file. */
  const row = (item: OutlineItem<PriorityEntry>, section: string, index: number): WorkRow => {
    const entry = item.source;
    const href = here(`/priorities/${item.key}`);
    const { isWritten, ...drawn } = outline.rowOf(item, { index, section }, href);
    return {
      ...drawn,
      // A line with a draft, or running, opens its page; any other is edited in place.
      editsInPlace: isWritten && !entry?.running && !entry?.draft,
      href,
      ...(entry ? lookOf(entry) : {}),
      marks: entry ? marksOf(entry) : undefined,
      text: plain(item.spans),
    };
  };

  const ongoing: WorkSection = {
    id: "ongoing",
    isFixed: true,
    rows: outline.drawn.sections.flatMap((section) =>
      section.items.flatMap((item, index) =>
        item.source?.running ? [row(item, section.id, index)] : [],
      ),
    ),
    title: "Ongoing",
    tone: "green",
  };
  // A Blocked without lines is not drawn (R1): the file keeps it, the page does not show it.
  const visible = outline.drawn.sections.filter(
    (section) => section.id !== "blocked" || section.items.some((item) => !item.source?.running),
  );
  const sections = visible.map((section): WorkSection => {
    const title = titleOf(section.id);
    const context = priorities.sections.find((one) => one.section === section.id)?.context;
    return {
      context: context ?? undefined,
      id: section.id,
      rows: [
        ...section.items.flatMap((item, index) =>
          item.source?.running ? [] : [row(item, section.id, index)],
        ),
        // The section's last row adds a line: the keyboard's cursor stops on it, and Enter opens a
        // new row at the section's end (the form has no Blocked, R80).
        ...(TITLES.has(section.id)
          ? [
              {
                href: here(`/priorities#add-${section.id}`),
                icon: "uraeda:plus" as const,
                isAdd: true,
                isFixed: true,
                key: `add:${section.id}`,
                lines: [],
                spot: { index: section.items.length, section: section.id },
                text: `Add to ${title}`,
              },
            ]
          : []),
      ],
      title,
      tone: TONES[section.id] ?? "neutral",
    };
  });
  // "Ongoing" shows only when something runs.
  return ongoing.rows.length > 0 ? [ongoing, ...sections] : sections;
}

/**
 * What a line's keys open or make: Enter or a click on a row not edited in place, `p`, and `s`. A
 * failed draft goes to `onMoveRefused`.
 */
function useLineActions(
  priorities: Priorities,
  outline: PrioritiesOutline,
  onMoveRefused: ((message: string | undefined) => void) | undefined,
) {
  const fate = useFateClient();
  const here = useRepoPath();

  /** The line of a row: itself, or the line a nested row is in. */
  const lineOf = (row: WorkRow) =>
    priorities.sections
      .flatMap((section) => section.entries)
      .find((entry) => entry.key === (row.parent ?? row.key));

  /**
   * Enter or a click on a row not edited in place: a line that runs opens its feature, a line with
   * a draft opens the draft's page, and an Add row opens a new row at its section's end.
   */
  const open = (href: string) => {
    const adding = /#add-([a-z]+)$/.exec(href)?.[1];
    if (adding !== undefined) {
      outline.openAt(adding);
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
   * A nested row's is its line's.
   */
  const onPromote = (row: WorkRow) => {
    const entry = lineOf(row);
    if (!entry || entry.running || entry.spans.some((span) => span.link?.path)) {
      return entry?.draft
        ? void navigate(here(`/edit/${entry.draft.path}`), { focus: "text" })
        : false;
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
    return undefined;
  };

  /**
   * `s`: the New page, its composer holding the line, its nested rows, and a link to the file;
   * nothing starts before the human sends it. A line with a draft starts from its draft's page; a
   * running one has started.
   */
  const onStart = (row: WorkRow) => {
    const entry = lineOf(row);
    if (!entry || entry.running) {
      return;
    }
    if (entry.draft) {
      navigate(here(`/edit/${entry.draft.path}`));
      return;
    }
    navigate(here("/new?kind=feature"), { insert: `line:${entry.id}` });
  };

  return { onPromote, onStart, open };
}

/**
 * The page opens on the row its arrival names, as a note just moved there, with the keyboard's
 * focus on it, once: `arrival` is that row, if any, and `isArriving` holds for the page's first
 * render.
 */
function useArrival() {
  const [arrival] = useState(() => currentEntry().select);
  // That row in the middle of the screen, once drawn: the page just opened, nothing moves.
  useEffect(() => {
    if (arrival === undefined) {
      return undefined;
    }
    const frame = requestAnimationFrame(() =>
      document
        .querySelector(`[data-row-key="${CSS.escape(arrival)}"]`)
        ?.scrollIntoView({ block: "center" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [arrival]);
  // The first committed render's, and the frame after it: the list's focus is put on the row then,
  // and a later render of the page moves it no more.
  const [isArriving, setArriving] = useState(true);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setArriving(false));
    return () => cancelAnimationFrame(frame);
  }, []);
  return { arrival, isArriving };
}

/**
 * The priorities' sections, with "Ongoing" first, and each section's Add row. `select` is the key
 * of a row to select, for a mockup; otherwise the row whose overlay is open is. `isFocused` puts the
 * keyboard's focus on it. `run` writes a change and resolves with its refusal, if any; a refused
 * write goes to `onMoveRefused`.
 */
export function PrioritiesList({
  isFocused = false,
  layout = "columns",
  onMoveRefused,
  priorities,
  run,
  select,
}: {
  isFocused?: boolean;
  /** As the human picked it: columns or the table, at any width. */
  layout?: WorkLayout;
  onMoveRefused?: (message: string | undefined) => void;
  priorities: Priorities;
  run: Run;
  select?: string;
}) {
  const fate = useFateClient();
  const here = useRepoPath();
  const pathname = useLocalPath();
  const outline = usePrioritiesOutline(priorities, run, onMoveRefused);
  const all = sectionsOf(outline, priorities, here);
  const { onPromote, onStart, open } = useLineActions(priorities, outline, onMoveRefused);

  /** A line moved by a drop or its keys, in turn with the outline's writes. */
  const onMove = (key: string, section: string, index: number) =>
    outline.write((now) => {
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

  const { arrival, isArriving } = useArrival();
  // Else on the highest row of Now.
  const firstNow = all.find((section) => section.id === "now")?.rows[0]?.key;
  const selected =
    select ??
    all.flatMap((section) => section.rows).find((r) => pathname === `/priorities/${r.key}`)?.key;

  return (
    <WorkList
      follow={outline.follow}
      initial={arrival ?? firstNow}
      isFocused={isFocused || isArriving}
      isLayoutChosen
      isRoomy
      layout={layout}
      onAddBeside={(_section, row, isAbove) => outline.onAddBeside(row, isAbove)}
      onDelete={outline.onDelete}
      onMove={onMove}
      onNest={outline.onNest}
      onOpen={open}
      onOutline={outline.onOutline}
      onPromote={onPromote}
      onStart={onStart}
      sections={all}
      selected={selected}
    />
  );
}
