// `p` on a note of the inbox: one quick picker of where the note goes up to. First the priorities'
// levels, Now, Next, and Later, where it becomes a proposal at the end; then every proposal, where
// it becomes the proposal's last item, or for a proposal with a file, the end of the file's "What";
// then the proposal files no proposal links. A note with a note file never goes under a proposal,
// where nested, its file would no longer be found by its link: it goes into a file's "Notes", its
// note file's text under its title, the note file gone, and a proposal that links nothing gets its
// file first; one that links a feature or a web page is not offered.
// Each item's preview is the place it lands in, drawn as its page draws it, the note in it
// highlighted: a level or a proposal as the priorities' pane, a file rendered. A pick runs as the note's
// actions run it (`useNoteActions`), with a toast and Undo, then opens the priorities with the
// note's row selected, or the proposal file's page.
import { useEffect } from "react";
import type { Proposal } from "uraeda-server/fate";
import { type ProposalFileText, usePriorities } from "./data.ts";
import { KeyPicker } from "./keys/KeyPicker.tsx";
import { isPending } from "./lists/outline.ts";
import {
  itemRows,
  type PickerItem,
  type PickerPreview,
  textPreview,
} from "./keys/pickerSources.ts";
import { lookOf, sectionTone } from "./lists/PrioritiesList.tsx";
import type { Tone } from "./lists/workSection.ts";
import { TITLES, titleOf } from "./QuickAdd.tsx";
import { plain } from "./Spans.tsx";
import { type Placed, useNoteActions } from "./useNoteActions.ts";

/** The note as the preview's rows, `depth` in, where a pick lands. */
function noteRows(placed: Placed, depth: number) {
  return itemRows(placed.note, { depth, isHere: true });
}

/** A level's proposals as its pane lists them: not those running, which Ongoing lists. */
const listed = (proposals: ReadonlyArray<Proposal>) =>
  proposals.filter((proposal) => !proposal.running);

/** A proposal's rows, as the priorities draw it, and its own items. */
const proposalRows = (proposal: Proposal) => itemRows(proposal, { look: lookOf(proposal) });

/** A level of the priorities, as its pane draws it, with the note at its end. */
function levelPreview(
  section: string,
  proposals: ReadonlyArray<Proposal>,
  placed: Placed,
): PickerPreview {
  return {
    kind: "outline",
    rows: [...listed(proposals).flatMap(proposalRows), ...noteRows(placed, 0)],
    title: titleOf(section),
    tone: sectionTone(section),
  };
}

/** A pane of the priorities' page, as a proposal's preview draws it: its title and its proposals. */
type PrioritiesPane = { proposals: ReadonlyArray<Proposal>; title: string; tone: Tone };

/**
 * The pane `proposal` is drawn in, among `sections`: Ongoing, green, with every running proposal,
 * for a running one; else its level's, with the proposals not running.
 */
function paneOf(
  proposal: Proposal,
  section: string,
  sections: ReadonlyArray<{ proposals: ReadonlyArray<Proposal>; section: string }>,
): PrioritiesPane {
  if (proposal.running) {
    const running = sections.flatMap((one) => one.proposals.filter((each) => each.running));
    return { proposals: running, title: "Ongoing", tone: "green" };
  }
  const own = sections.find((one) => one.section === section)?.proposals ?? [];
  return { proposals: listed(own), title: titleOf(section), tone: sectionTone(section) };
}

/** The pane of `proposal`, as the priorities draw it, with the note as the last of its items. */
function linePreview(proposal: Proposal, pane: PrioritiesPane, placed: Placed): PickerPreview {
  return {
    kind: "outline",
    rows: pane.proposals.flatMap((one) =>
      one.key === proposal.key ? [...proposalRows(one), ...noteRows(placed, 1)] : proposalRows(one),
    ),
    title: pane.title,
    tone: pane.tone,
  };
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

/** A file in three parts: before the note, the note, highlighted, and after it. */
const parts = (
  before: ReadonlyArray<string>,
  note: string,
  after: ReadonlyArray<string>,
): PickerPreview => ({
  kind: "markdown",
  parts: [{ text: before.join("\n") }, { isHere: true, text: note }, { text: after.join("\n") }],
});

/**
 * A proposal file's text with the note where an add puts it: at the end of its "What", else at its
 * end. A note with a note file goes, under its title, at the end of its "Notes", added at its end
 * when the file has none.
 */
function filePreview(text: string, placed: Placed): PickerPreview {
  const lines = text.split("\n");
  if (placed.note.file !== undefined) {
    const heading = `### ${placed.note.fileTitle ?? placed.note.text}`;
    const end = sectionEnd(lines, "Notes");
    if (end === undefined) {
      return parts([text.trimEnd(), "", "## Notes"], heading, []);
    }
    return parts(lines.slice(0, end), heading, lines.slice(end));
  }
  const end = sectionEnd(lines, "What") ?? text.trimEnd().split("\n").length;
  return parts(lines.slice(0, end), placed.note.lines.join("\n"), lines.slice(end));
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
  pane: PrioritiesPane,
  placed: Placed,
  textOf: (path: string) => string | undefined,
): PickerItem | undefined {
  const file = proposal.file?.path;
  // Its words, its links' text without their targets.
  const title = plain(proposal.spans);
  if (file !== undefined) {
    const text = textOf(file);
    const preview =
      text === undefined ? textPreview("Loading the proposal…") : filePreview(text, placed);
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
  const preview = linePreview(proposal, pane, placed);
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
  const actions = useNoteActions(placed, hash);
  const priorities = usePriorities();
  useEffect(() => {
    if (actions.message !== undefined) {
      onRefused(actions.message);
    }
  }, [actions.message, onRefused]);
  const sections = priorities?.sections ?? [];
  // A proposal not written yet has no id the core knows: it is offered once written.
  const placedProposals = sections.flatMap((section) =>
    section.proposals
      .filter((proposal) => !isPending(proposal.key))
      .map((proposal) => ({ proposal, section })),
  );
  const proposals = placedProposals.map((one) => one.proposal);
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
        id,
        sections.find((section) => section.section === id)?.proposals ?? [],
        placed,
      ),
      title,
    })),
    ...placedProposals.flatMap(
      ({ proposal, section }) =>
        proposalItem(proposal, paneOf(proposal, section.section, sections), placed, textOf) ?? [],
    ),
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
