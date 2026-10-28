// `p` on a note of the inbox: one quick picker of where the note goes up to. First the priorities'
// levels, Now, Next, and Later, where it becomes a line at the end; then every line, where it
// becomes the line's last item, or for a line with a draft, the end of the draft's "What"; then the
// drafts no line links. Each item's preview is the place it lands in, the note in it. A pick runs
// as the note's actions run it (`useNoteActions`), with a toast and Undo, then opens the priorities
// with the note's row selected, or the draft's page.
import { useEffect } from "react";
import type { PriorityEntry } from "uraeda-server/fate";
import { type DraftText, usePriorities } from "./data.ts";
import { KeyPicker } from "./keys/KeyPicker.tsx";
import type { PickerItem } from "./keys/pickerSources.ts";
import { TITLES } from "./QuickAdd.tsx";
import { plain } from "./Spans.tsx";
import { type Placed, useNoteActions } from "./useNoteActions.ts";

/** Where a note lands, shown as the file has it: a mark at the end of the note's first line. */
const HERE = "   ← here";

/** The note's lines, `indent` spaces in, its first one marked. */
function noteLines(placed: Placed, indent: number) {
  return placed.note.lines.map((line, at) => `${" ".repeat(indent)}${line}${at === 0 ? HERE : ""}`);
}

/** A section of the priorities with the note at its end. */
function levelPreview(title: string, entries: ReadonlyArray<PriorityEntry>, placed: Placed) {
  return [
    `## ${title}`,
    "",
    ...entries.map((entry) => `- ${entry.text}`),
    ...noteLines(placed, 0),
  ].join("\n");
}

/** A line with its own items, and the note as the last of them. */
function linePreview(entry: PriorityEntry, placed: Placed) {
  return [
    `- ${entry.text}`,
    ...entry.children.map((child) => `${"  ".repeat(child.depth)}- ${child.text}`),
    ...noteLines(placed, 2),
  ].join("\n");
}

/** A draft's text with the note at the end of its "What", where a move adds it, else at its end. */
function draftPreview(text: string, placed: Placed) {
  const lines = text.split("\n");
  const what = lines.findIndex((line) => /^##\s+What\s*$/.test(line));
  const next = what === -1 ? -1 : lines.findIndex((line, at) => at > what && /^##\s/.test(line));
  let end = next === -1 ? lines.length : next;
  while (end > 0 && lines[end - 1]?.trim() === "") {
    end -= 1;
  }
  return [...lines.slice(0, end), ...noteLines(placed, 0), ...lines.slice(end)].join("\n");
}

/**
 * The picker of `placed`'s note, while `isOpen`, over the inbox of `hash`. `drafts` are the drafts
 * and their texts, once read. A refusal goes to `onRefused`.
 */
export function PromotePicker({
  drafts,
  hash,
  isOpen,
  onClose,
  onRefused,
  placed,
}: {
  drafts: ReadonlyArray<DraftText> | undefined;
  hash: string;
  isOpen: boolean;
  onClose: () => void;
  onRefused: (message: string | undefined) => void;
  placed: Placed;
}) {
  const actions = useNoteActions(placed, hash, () => undefined);
  const priorities = usePriorities();
  useEffect(() => {
    if (actions.message !== undefined) {
      onRefused(actions.message);
    }
  }, [actions.message, onRefused]);
  const sections = priorities?.sections ?? [];
  const entries = sections.flatMap((section) => section.entries);
  const textOf = (path: string) => drafts?.find((draft) => draft.path === path)?.text;
  const linked = new Set(entries.flatMap((entry) => (entry.draft ? [entry.draft.path] : [])));
  const items: ReadonlyArray<PickerItem> = [
    ...[...TITLES].map(([id, title]) => ({
      icon: "uraeda:layers" as const,
      id: `level:${id}`,
      kind: "priorities" as const,
      path: "",
      preview: levelPreview(
        title,
        sections.find((section) => section.section === id)?.entries ?? [],
        placed,
      ),
      title,
    })),
    // A note that is a draft never goes into its own draft.
    ...entries
      .filter((entry) => placed.note.draft === undefined || entry.draft?.path !== placed.note.draft)
      .map((entry) => {
        const draft = entry.draft?.path;
        const text = draft === undefined ? undefined : textOf(draft);
        return {
          icon: draft === undefined ? ("uraeda:list" as const) : ("uraeda:file-text" as const),
          id: draft === undefined ? `line:${entry.key}` : `draft:${draft}`,
          kind: "priorities" as const,
          path: "",
          preview:
            draft === undefined
              ? linePreview(entry, placed)
              : text === undefined
                ? "Loading the draft…"
                : draftPreview(text, placed),
          // Its words, its links' text without their targets.
          title: plain(entry.spans),
        };
      }),
    ...(drafts ?? [])
      .filter((draft) => !linked.has(draft.path) && draft.path !== placed.note.draft)
      .map((draft) => ({
        icon: "uraeda:file-text" as const,
        id: `draft:${draft.path}`,
        kind: "notes" as const,
        path: "",
        preview: draftPreview(draft.text, placed),
        title: draft.title,
      })),
  ];
  return (
    <KeyPicker
      isOpen={isOpen}
      items={items}
      onClose={onClose}
      onPick={(item) => {
        onClose();
        const [kind = "", ...rest] = item.id.split(":");
        const target = rest.join(":");
        if (kind === "level") {
          void actions.toPriorities(target);
        } else if (kind === "line") {
          const entry = entries.find((one) => one.key === target);
          if (entry) {
            void actions.underPriority({ id: entry.id, key: entry.key, text: item.title });
          }
        } else {
          void actions.toDraft(target, item.title);
        }
      }}
      placeholder="Promote to…"
      title="Promote the note"
    />
  );
}
