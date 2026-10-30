// What the New page starts from, the same under all three cards: the inbox's notes and the
// priorities' proposals not yet started, as the lists draw them everywhere else (`WorkList`): cards
// in two columns, `j k` between them and `h l` across, the search filtering them. Selecting a card
// inserts its text in the composer, with a link to the file it is in; a card with a file of its
// own, a proposal file or a note file, opens that file's page instead.
import { useInbox, usePriorities } from "./data.ts";
import { isPending } from "./lists/outline.ts";
import { WorkList, type WorkRow, type WorkSection } from "./lists/WorkList.tsx";
import { titleOf } from "./QuickAdd.tsx";
import { navigate, useRepoPath } from "./routes.tsx";
import { plain } from "./Spans.tsx";
import { proposalFilePage } from "./readAhead.ts";

/** What an entry is: a note of the inbox, or a proposal line of the priorities. */
export type SourceKind = "line" | "note";

/** A note or a proposal, as the page reads it: its text, its nested lines, and its file's page. */
export type Entry = {
  /** The file it is in. */
  file: string;
  id: string;
  kind: SourceKind;
  lines: ReadonlyArray<string>;
  /** The path the editor takes for its own file, a proposal or a note file, when it has one. */
  linked?: string;
  /** The page of its own file, which a card with one opens. */
  linkedHref?: string;
  /** A line's section of the priorities: `now`, `next`, `later`, or `blocked`. */
  section?: string;
  text: string;
};

/**
 * An entry the composer was filled from: what a start takes out of its file, and its text, which
 * finds a line of Now again.
 */
export type Source = Pick<Entry, "id" | "kind" | "linked" | "section" | "text"> & {
  /** The text inserted, to tell whether the composer still holds what it was filled with. */
  inserted: string;
};

/** The file each kind of entry is in. */
const FILES: Record<SourceKind, string> = { line: "specs/PRIORITIES.md", note: "specs/INBOX.md" };

/**
 * What an entry becomes in the composer: its text, its nested lines as bullets under it, each
 * indented as its line is, and a link to its file from the repository's root on a line of its own,
 * so that the text alone is the first line, a change's title.
 */
export function insertion(entry: Entry): string {
  const name = entry.file.split("/").pop() ?? entry.file;
  const nested = entry.lines
    .map((line) => {
      const indent = /^ */.exec(line)?.[0] ?? "";
      return `\n${indent}- ${line.trimStart()}`;
    })
    .join("");
  return `${entry.text}${nested}\nFrom [${name}](/${entry.file})`;
}

/**
 * A proposal line of the priorities, in `section`, as an entry to start from: its nested items as
 * lines, each indented two spaces a level below the first.
 */
export function lineEntry(
  line: NonNullable<ReturnType<typeof usePriorities>>["sections"][number]["proposals"][number],
  section: string,
  here: ReturnType<typeof useRepoPath>,
): Entry {
  return {
    ...(line.file ? { linked: line.file.path } : {}),
    ...(line.file ? { linkedHref: here(`/edit/${line.file.path}`) } : {}),
    file: FILES.line,
    id: line.id,
    kind: "line",
    lines: line.children.map((child) => `${"  ".repeat(child.depth - 1)}${plain(child.spans)}`),
    section,
    text: plain(line.spans),
  };
}

/** What is in the composer, then `added`, a paragraph under it: just `added` in an empty one. */
export function withAdded(text: string, added: string): string {
  return text.trim() === "" ? added : `${text.trimEnd()}\n\n${added}`;
}

/** Whether any of `parts` holds `needle`, in any case: every entry matches an empty search. */
const holds = (needle: string, parts: ReadonlyArray<string>) =>
  needle === "" || parts.some((part) => part.toLowerCase().includes(needle));

/** A row's marks, as small text after its own: its category or section. */
const marksOf = (...marks: ReadonlyArray<string | false | undefined>) => {
  const shown = marks.filter(Boolean);
  return shown.length === 0 ? undefined : shown.join(" · ");
};

/**
 * The entries as the list's sections, "Inbox" and "Priorities", the notes apart from the proposals
 * that have not started, and each card's entry by its address. The search
 * keeps the cards whose text, or a nested line, holds it.
 */
function useEntries(search: string) {
  const here = useRepoPath();
  const inbox = useInbox();
  const priorities = usePriorities();
  const needle = search.trim().toLowerCase();
  const byHref = new Map<string, Entry>();
  const rowOf = (entry: Entry, href: string, key: string, marks: string | undefined): WorkRow => {
    byHref.set(href, entry);
    return {
      href,
      ...(entry.linked === undefined ? {} : { page: proposalFilePage(entry.linked) }),
      // An entry with a file of its own reads as a link to it.
      ...(entry.linkedHref ? { icon: "uraeda:file-text" as const, isLinked: true } : {}),
      isFixed: true,
      key,
      lines: entry.lines,
      ...(marks === undefined ? {} : { marks }),
      text: entry.text,
    };
  };
  // A row not written yet has no page and no id the core knows: it is offered once written.
  const notes = (inbox?.categories ?? []).flatMap((category) =>
    category.notes.flatMap((note) => {
      if (isPending(note.key)) {
        return [];
      }
      const entry: Entry = {
        ...(note.file === undefined ? {} : { linked: note.file }),
        ...(note.file === undefined ? {} : { linkedHref: here(`/edit/${note.file}`) }),
        file: FILES.note,
        id: note.id,
        kind: "note",
        lines: note.nestedSpans.map(plain),
        text: plain(note.spans),
      };
      if (!holds(needle, [entry.text, ...entry.lines])) {
        return [];
      }
      return [rowOf(entry, here(`/inbox/${note.key}`), `note:${note.key}`, marksOf(category.name))];
    }),
  );
  const lines = (priorities?.sections ?? []).flatMap((section) =>
    section.proposals
      // Not running, and linking no file but its proposal file: those have started.
      .filter((line) => !line.running && (line.file || !line.spans.some((span) => span.link)))
      .filter((line) => !isPending(line.key))
      .flatMap((line) => {
        const entry = lineEntry(line, section.section, here);
        if (!holds(needle, [entry.text, ...entry.lines])) {
          return [];
        }
        return [
          rowOf(
            entry,
            here(`/priorities/${line.key}`),
            `line:${line.key}`,
            marksOf(titleOf(section.section)),
          ),
        ];
      }),
  );
  const empty = (nothing: string) =>
    needle === "" ? { context: nothing } : { context: "No match." };
  const sections: Array<WorkSection> = [
    {
      ...(notes.length === 0 ? empty("The inbox is empty.") : {}),
      icon: "uraeda:inbox",
      id: "inbox",
      isFixed: true,
      rows: notes,
      title: "Inbox",
      tone: "neutral",
    },
    {
      ...(lines.length === 0 ? empty("Nothing to start from.") : {}),
      icon: "uraeda:list",
      id: "priorities",
      isFixed: true,
      rows: lines,
      title: "Priorities",
      tone: "blue",
    },
  ];
  return { byHref, sections };
}

/**
 * The list under the composer, whatever the kind: `onInsert` takes the entry a card selects, unless
 * the entry has a file of its own, whose page opens.
 */
export function EntryLists({
  onInsert,
  search,
}: {
  onInsert: (entry: Entry) => void;
  search: string;
}) {
  const { byHref, sections } = useEntries(search);
  return (
    <WorkList
      layout="columns"
      onOpen={(href) => {
        const entry = byHref.get(href);
        if (entry?.linkedHref) {
          navigate(entry.linkedHref);
        } else if (entry) {
          onInsert(entry);
        }
      }}
      sections={sections}
    />
  );
}
