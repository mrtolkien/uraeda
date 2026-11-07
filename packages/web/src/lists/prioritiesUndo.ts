// The priorities' writes as entries of the tab's undo stack: their labels, their place, and their
// moves, which join a run of the list `priorities`. Each entry is made from the change its write
// answered (see `changeEntry`): a refused write answers none, and records nothing.
import { useCallback } from "react";
import { useFateClient } from "react-fate";
import type { ChangeView, Span } from "uraeda-binding";
import { rereadingFile } from "../inboxUndo.ts";
import { plain } from "../Spans.tsx";
import { changeEntry, joinChanges } from "../undo/changeEntry.ts";
import { PrioritiesChangeView } from "../undo/changeViews.ts";
import { fileIndex } from "./cardMoves.ts";
import type { Priorities } from "./PrioritiesList.tsx";
import type { UndoEntry } from "../undo/stack.ts";
import { useUndo } from "../undo/useUndo.ts";

type Fate = ReturnType<typeof useFateClient>;

/** The list the priorities' moves join a run of. */
const LIST = "priorities";

/** The page of the priorities, from the repository. */
const PAGE = "/priorities";

/** A row's text in a label: its first words, as a toast is no place for a whole line. */
export function quoted(text: string) {
  const short = text.length > 40 ? `${text.slice(0, 39).trimEnd()}…` : text;
  return `“${short}”`;
}

/** The place of a row of the priorities, `select` its key, to select once it is back. */
export function prioritiesPlace(select?: string): UndoEntry["place"] {
  return select === undefined ? { path: PAGE } : { path: PAGE, select };
}

/** The change each move entry was made from, for the run it joins. */
const moveChanges = new WeakMap<UndoEntry, ChangeView>();

/**
 * The entry of a move of the priorities that answered `change`, labelled `label`: it joins the run
 * of moves on top, whose change goes from before its first move to after its last.
 */
export function moveEntry(
  fate: Fate,
  change: ChangeView,
  label: string,
  place: UndoEntry["place"],
  subject: string,
): UndoEntry {
  const entry: UndoEntry = {
    ...changeEntry(fate, change, label, place, subject),
    move: {
      join: (earlier) => {
        const first = moveChanges.get(earlier);
        const joined = first ? joinChanges(first, change) : change;
        return moveEntry(fate, joined, label, place, subject);
      },
      list: LIST,
    },
  };
  moveChanges.set(entry, change);
  return entry;
}

/** What a write of the priorities records once it lands: its label, its place, and if a move. */
export type Recorded = { isMove?: boolean; label: string; select?: string; subject: string };

/** A write's answer, with the change it recorded, as the views of `undo/changeViews.ts` select it. */
type Answered = { error?: unknown; result?: { change?: ChangeView | null } | null };

/**
 * Records the writes of the priorities: `recorded(call, made)` runs `call`, and once it lands
 * with a change records its entry, as `made` describes it; a refused write records nothing.
 */
export function usePrioritiesUndo() {
  const fate = useFateClient();
  const record = useUndo();
  return useCallback(
    <R extends Answered>(call: () => Promise<R>, made: Recorded | undefined) =>
      async () => {
        const answer = await call();
        const change = answer.error ? undefined : answer.result?.change;
        if (change && made) {
          const place = prioritiesPlace(made.select);
          record(
            made.isMove
              ? moveEntry(fate, change, made.label, place, made.subject)
              : changeEntry(fate, change, made.label, place, made.subject),
          );
        }
        return answer;
      },
    [fate, record],
  );
}

/** A proposal of the priorities, as the outliner's writes find it. */
type Item = {
  children: ReadonlyArray<Row>;
  id: string;
  key: string;
  spans: ReadonlyArray<Span>;
};

/** A row of the priorities, a proposal or a nested row, by its key and its text's spans. */
type Row = { key: string; spans: ReadonlyArray<Span> };

/**
 * What an outline edit `kind` of the proposal `id`, or of its nested row at `at`, records, over
 * `sections` as the edit found them: an add, an edit, a delete, or a move of the row.
 */
export function outlineRecorded(
  sections: ReadonlyArray<{ proposals: ReadonlyArray<Item> }>,
  id: string,
  at: number | undefined,
  kind: string,
  text: string | undefined,
): Recorded | undefined {
  const item = sections.flatMap((section) => section.proposals).find((one) => one.id === id);
  const row = at === undefined ? item : item?.children[at];
  if (!row) {
    return undefined;
  }
  const subject = plain(row.spans);
  switch (kind) {
    case "edit":
      return { label: `Edited ${quoted(text ?? subject)}`, select: row.key, subject };
    case "remove":
      return { label: `Deleted ${quoted(subject)}`, select: row.key, subject };
    case "append-child":
    case "insert-above":
    case "insert-below":
      return { label: `Added ${quoted(text ?? "")}`, subject: text ?? "" };
    default:
      return { isMove: true, label: `Moved ${quoted(subject)}`, select: row.key, subject };
  }
}

/** What a move or a drop of the row `key` records, found in `sections`: a move, labelled by it. */
export function movedRecorded(
  sections: ReadonlyArray<{ proposals: ReadonlyArray<Item> }>,
  key: string,
): Recorded | undefined {
  for (const item of sections.flatMap((section) => section.proposals)) {
    const row = item.key === key ? item : item.children.find((child) => child.key === key);
    if (row) {
      const subject = plain(row.spans);
      return { isMove: true, label: `Moved ${quoted(subject)}`, select: key, subject };
    }
  }
  return undefined;
}

/**
 * Records a proposal's expand into a file, `text` its line and `key` its key, once its write
 * answered `answer`. Its place is the priorities, the proposal selected, rather than the file's page
 * the expand opened, which its undo deletes; each undo and redo reads the file again, for a page
 * open on it.
 */
export function useRecordExpand() {
  const fate = useFateClient();
  const record = useUndo();
  return useCallback(
    (
      answer: { change?: ChangeView | null; path?: unknown } | null | undefined,
      text: string,
      key: string,
    ) => {
      if (answer?.change && typeof answer.path === "string") {
        const label = `Expanded ${quoted(text)} into a file`;
        const entry = changeEntry(fate, answer.change, label, prioritiesPlace(key), text);
        record(rereadingFile(fate, entry, answer.path));
      }
    },
    [fate, record],
  );
}

/**
 * A proposal moved by a drop or its keys to `index` of `section`: written through `write`, in turn
 * with the outline's writes, and `run`, which resolves with its refusal; recorded as a move.
 */
export function useMoveWrite(
  write: (call: (now: Priorities) => Promise<string | undefined>) => Promise<boolean>,
  run: (call: () => Promise<{ error?: unknown }>) => Promise<string | undefined>,
) {
  const fate = useFateClient();
  const recorded = usePrioritiesUndo();
  return (key: string, section: string, index: number) =>
    write((now) => {
      const proposal = now.sections.flatMap((s) => s.proposals).find((one) => one.key === key);
      const target = now.sections.find((s) => s.section === section);
      if (!proposal || !target) {
        return Promise.resolve("The proposal or its section is no longer in PRIORITIES.md.");
      }
      return run(
        recorded(
          () =>
            fate.mutations.proposals.move({
              input: {
                hash: now.hash,
                index: fileIndex(target.proposals, key, index),
                proposal: proposal.id,
                section,
              },
              view: PrioritiesChangeView,
            }),
          movedRecorded(now.sections, key),
        ),
      );
    });
}
