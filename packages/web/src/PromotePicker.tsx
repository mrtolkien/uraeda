// `p` on a note of the inbox: one quick picker of where the note goes up to. First the priorities'
// levels, Now, Next, and Later, where it becomes a proposal at the end; then every proposal, where
// it becomes the proposal's last item, or for a proposal with a file, the end of the file's "What";
// then the proposal files no proposal links. A note with a note file is offered no proposal to go
// under. Each item's preview is the place it lands in, the note in it. A pick runs as the note's
// actions run it (`useNoteActions`), with a toast and Undo, then opens the priorities with the
// note's row selected, or the proposal file's page.
import { useEffect } from "react";
import type { Proposal } from "uraeda-server/fate";
import { type ProposalFileText, usePriorities } from "./data.ts";
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
function levelPreview(title: string, proposals: ReadonlyArray<Proposal>, placed: Placed) {
  return [
    `## ${title}`,
    "",
    ...proposals.map((proposal) => `- ${proposal.text}`),
    ...noteLines(placed, 0),
  ].join("\n");
}

/** A proposal with its own items, and the note as the last of them. */
function linePreview(proposal: Proposal, placed: Placed) {
  return [
    `- ${proposal.text}`,
    ...proposal.children.map((child) => `${"  ".repeat(child.depth)}- ${child.text}`),
    ...noteLines(placed, 2),
  ].join("\n");
}

/**
 * A proposal file's text with the note at the end of its "What", where a move adds it, else at its
 * end.
 */
function filePreview(text: string, placed: Placed) {
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
 * Whether the picker offers the proposal `proposal`: a note with a note file never goes under a
 * proposal, where nested, its file would no longer be found by its link; it goes into a proposal's
 * file.
 */
function isOffered(proposal: Proposal, placed: Placed) {
  return placed.note.file === undefined || proposal.file !== undefined;
}

/**
 * The picker of `placed`'s note, while `isOpen`, over the inbox of `hash`. `files` are the
 * proposal files and their texts, once read. A refusal goes to `onRefused`.
 */
export function PromotePicker({
  files,
  hash,
  isOpen,
  onClose,
  onRefused,
  placed,
}: {
  files: ReadonlyArray<ProposalFileText> | undefined;
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
  const proposals = sections.flatMap((section) => section.proposals);
  const textOf = (path: string) => files?.find((file) => file.path === path)?.text;
  const linked = new Set(
    proposals.flatMap((proposal) => (proposal.file ? [proposal.file.path] : [])),
  );
  const items: ReadonlyArray<PickerItem> = [
    ...[...TITLES].map(([id, title]) => ({
      icon: "uraeda:layers" as const,
      id: `level:${id}`,
      kind: "priorities" as const,
      path: "",
      preview: levelPreview(
        title,
        sections.find((section) => section.section === id)?.proposals ?? [],
        placed,
      ),
      title,
    })),
    ...proposals
      .filter((proposal) => isOffered(proposal, placed))
      .map((proposal) => {
        const file = proposal.file?.path;
        const text = file === undefined ? undefined : textOf(file);
        return {
          icon: file === undefined ? ("uraeda:list" as const) : ("uraeda:file-text" as const),
          id: file === undefined ? `line:${proposal.key}` : `file:${file}`,
          kind: "priorities" as const,
          path: "",
          preview:
            file === undefined
              ? linePreview(proposal, placed)
              : text === undefined
                ? "Loading the proposal…"
                : filePreview(text, placed),
          // Its words, its links' text without their targets.
          title: plain(proposal.spans),
        };
      }),
    ...(files ?? [])
      .filter((file) => !linked.has(file.path))
      .map((file) => ({
        icon: "uraeda:file-text" as const,
        id: `file:${file.path}`,
        kind: "notes" as const,
        path: "",
        preview: filePreview(file.text, placed),
        title: file.title,
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
          void actions.toProposal(target);
        } else if (kind === "line") {
          const proposal = proposals.find((one) => one.key === target);
          if (proposal) {
            void actions.underProposal({ id: proposal.id, key: proposal.key, text: item.title });
          }
        } else {
          void actions.intoProposal(target, item.title);
        }
      }}
      placeholder="Promote to…"
      title="Promote the note"
    />
  );
}
