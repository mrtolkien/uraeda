// The priorities on the shared list: "Ongoing", the entries whose feature or change runs, in green,
// then Now, Next, Later, and Blocked, in the file's order, as columns, each with its context, its
// colour, and its Add row. Blocked shows only when it has lines.
// The file keeps the started entries at the top of Now; on screen they show apart.
import { Icon } from "@astryxdesign/core/Icon";
import { useFateClient } from "react-fate";
import type { PriorityEntry } from "uraeda-server/fate";
import type { usePriorities } from "../data.ts";
import { EditableLine } from "../EditableLine.tsx";
import { stepTitle } from "../labels.ts";
import { TITLES, titleOf } from "../QuickAdd.tsx";
import { useOpenAddForm } from "../SidebarAdd.tsx";
import { openDetail, PRIORITY } from "../pane/DetailOverlay.tsx";
import { useLocalPath, useRepoPath } from "../routes.tsx";
import { plain } from "../Spans.tsx";
import { PrioritiesView } from "../views.ts";
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

/** An entry's marks, as text in its border: its running step, "draft", or "backlog". */
export function marksOf(entry: PriorityEntry) {
  if (entry.running) {
    return `● ${stepTitle(entry.running.step)}`;
  }
  if (!entry.draft) {
    return undefined;
  }
  return entry.draft.backlog ? "backlog" : "draft";
}

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
 * file with its context and its Add row, but a Blocked without lines (R1). `add` writes a line to a
 * section.
 */
function sectionsOf(
  priorities: Priorities,
  here: ReturnType<typeof useRepoPath>,
  add: (section: string) => (text: string) => Promise<string | undefined>,
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
      marks: marksOf(entry),
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
      footer: (
        <EditableLine
          display={
            <>
              <Icon icon="uraeda:plus" size="sm" /> Add to {title}
            </>
          }
          field={`priorities#add:${section.section}`}
          label={`Add to ${title}`}
          onSave={add(section.section)}
          stayOpen
          value=""
        />
      ),
      id: section.section,
      rows: section.entries.map(row),
      title,
      tone: TONES[section.section] ?? "neutral",
    };
  });
  // "Ongoing" shows only when something runs.
  return ongoing.rows.length > 0 ? [ongoing, ...sections] : sections;
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

  const add = (section: string) => (text: string) =>
    run(() =>
      fate.mutations.priorities.add({
        input: { hash: priorities.hash, section, text },
        view: PrioritiesView,
      }),
    );

  const onMove = async (key: string, section: string, index: number) => {
    const entry = priorities.sections
      .flatMap((s) => s.entries)
      .find((candidate) => candidate.key === key);
    const target = priorities.sections.find((s) => s.section === section);
    if (!entry || !target) {
      return;
    }
    // Over the version the drag started from: a list changed meanwhile refuses the move.
    const failed = await run(() =>
      fate.mutations.priorities.move({
        input: {
          entry: entry.id,
          hash: priorities.hash,
          index: fileIndex(target.entries, key, index),
          section,
        },
        view: PrioritiesView,
      }),
    );
    onMoveRefused?.(failed);
  };

  const all = sectionsOf(priorities, here, add, onMoveRefused ?? NOTHING);
  const selected =
    select ??
    all.flatMap((section) => section.rows).find((r) => pathname === `/priorities/${r.key}`)?.key;

  return (
    <WorkList
      isFocused={isFocused}
      layout="columns"
      // `o`: the form in the section of the line's own place in the file, not "Ongoing"; the form
      // has no Blocked (R80), so a line there opens it in the default place.
      onAddBeside={(_, row) => {
        const own = priorities.sections.find((s) => s.entries.some((e) => e.key === row.key));
        openForm("priority", { section: own && TITLES.has(own.section) ? own.section : undefined });
      }}
      onMove={onMove}
      onOpen={(href) => openDetail(href, PRIORITY)}
      sections={all}
      selected={selected}
    />
  );
}
