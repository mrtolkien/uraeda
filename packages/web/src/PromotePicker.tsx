// `p` on a note of the inbox: one quick picker of where the note goes up to. First the priorities'
// levels, Now, Next, and Later, where it becomes a proposal at the end; then every proposal, where
// it becomes the proposal's last item, or for a proposal with a file, the end of the file's "What";
// then the proposal files no proposal links. A note with a note file never goes under a proposal,
// where nested, its file would no longer be found by its link: it goes into a file's "Notes", its
// note file's text under its title, the note file gone, and a proposal that links nothing gets its
// file first; one that links a feature or a web page is not offered.
// Each item's preview is the place it lands in, the note in it. A pick runs as the note's
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
 * The index of the line after the last non-blank line of the `## name` section of `lines`, which
 * ends at the next `#` or `##` heading; `undefined` without the section.
 */
function sectionEnd(lines: ReadonlyArray<string>, name: string) {
  const heading = lines.findIndex((line) => new RegExp(`^##\\s+${name}\\s*$`).test(line));
  if (heading === -1) {
    return undefined;
  }
  const next = lines.findIndex((line, at) => at > heading && /^#{1,2}\s/.test(line));
  let end = next === -1 ? lines.length : next;
  while (end > heading + 1 && lines[end - 1]?.trim() === "") {
    end -= 1;
  }
  return end;
}

/**
 * A proposal file's text with the note where an add puts it: at the end of its "What", else at its
 * end. A note with a note file goes, under its title, at the end of its "Notes", added at its end
 * when the file has none.
 */
function filePreview(text: string, placed: Placed) {
  const lines = text.split("\n");
  if (placed.note.file !== undefined) {
    const heading = `### ${placed.note.fileTitle ?? placed.note.text}${HERE}`;
    const end = sectionEnd(lines, "Notes");
    if (end === undefined) {
      return [text.trimEnd(), "", "## Notes", "", heading].join("\n");
    }
    return [...lines.slice(0, end), "", heading, ...lines.slice(end)].join("\n");
  }
  const end = sectionEnd(lines, "What") ?? text.trimEnd().split("\n").length;
  return [...lines.slice(0, end), ...noteLines(placed, 0), ...lines.slice(end)].join("\n");
}

/**
 * The proposal file a proposal without one gets for a note with a note file, as expanding it writes
 * it: its text as its title and What, its items after it, then empty Why and Notes, the note's
 * heading under Notes.
 */
function newFilePreview(proposal: Proposal, placed: Placed) {
  const items = proposal.children.map((child) => `${"  ".repeat(child.depth - 1)}- ${child.text}`);
  const what = [proposal.text, ...(items.length === 0 ? [] : ["", ...items])];
  const text = [`# ${proposal.text}`, "", "## What", "", ...what, "", "## Why", "", "## Notes", ""];
  return filePreview(text.join("\n"), placed);
}

/**
 * The picker's item of `proposal`: its file, which `textOf` reads once the files are read; else the
 * proposal to go under, or for a note with a note file, the file the proposal gets first. None for
 * a note with a note file and a proposal that links anything else, like a feature, whose proposal
 * is on its branch, or a web page: it can neither nest the note nor get a file.
 */
function proposalItem(
  proposal: Proposal,
  placed: Placed,
  textOf: (path: string) => string | undefined,
): PickerItem | undefined {
  const file = proposal.file?.path;
  // Its words, its links' text without their targets.
  const title = plain(proposal.spans);
  if (file !== undefined) {
    const text = textOf(file);
    const preview = text === undefined ? "Loading the proposal…" : filePreview(text, placed);
    return {
      icon: "uraeda:file-text",
      id: `file:${file}`,
      kind: "priorities",
      path: "",
      preview,
      title,
    };
  }
  if (placed.note.file !== undefined) {
    if (proposal.spans.some((span) => span.link)) {
      return undefined;
    }
    const preview = newFilePreview(proposal, placed);
    return {
      icon: "uraeda:file-text",
      id: `new:${proposal.key}`,
      kind: "priorities",
      path: "",
      preview,
      title,
    };
  }
  const preview = linePreview(proposal, placed);
  return {
    icon: "uraeda:list",
    id: `line:${proposal.key}`,
    kind: "priorities",
    path: "",
    preview,
    title,
  };
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
    ...proposals.flatMap((proposal) => proposalItem(proposal, placed, textOf) ?? []),
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
        } else if (kind === "line" || kind === "new") {
          const proposal = proposals.find((one) => one.key === target);
          if (proposal) {
            const line = { id: proposal.id, key: proposal.key, text: item.title };
            void (kind === "line" ? actions.underProposal(line) : actions.intoProposalLine(line));
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
