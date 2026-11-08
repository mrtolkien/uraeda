// What the New page starts from, the same under all three cards: the sections of the extensions on
// here, the inbox's notes and the priorities' proposals not yet started first, as the lists draw them everywhere else (`WorkList`): cards
// in two columns, `j k` between them and `h l` across, the search filtering them. Selecting a card
// inserts its text in the composer, with a link to the file it is in; a card with a file of its
// own, a proposal file or a note file, opens that file's page instead.
import type { ReactNode } from "react";
import { useInbox, usePriorities } from "./data.ts";
import { Collect } from "./extensions/Collect.tsx";
import type { NewSection, NewSectionRead } from "./extensions/registry.ts";
import { useContributions } from "./extensions/useContributions.ts";
import { isPending } from "./lists/outline.ts";
import { WorkList, type WorkRow } from "./lists/WorkList.tsx";
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
 * indented as its line is, and, unless `link` is false, a link to its file from the repository's
 * root on a line of its own, so that the text alone is the first line, a change's title. A line's
 * Start leaves the link out: the start replaces the line by its own.
 */
export function insertion(entry: Entry, { link = true }: { link?: boolean } = {}): string {
  const name = entry.file.split("/").pop() ?? entry.file;
  const nested = entry.lines
    .map((line) => {
      const indent = /^ */.exec(line)?.[0] ?? "";
      return `\n${indent}- ${line.trimStart()}`;
    })
    .join("");
  return link ? `${entry.text}${nested}\nFrom [${name}](/${entry.file})` : `${entry.text}${nested}`;
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

/**
 * Whether a line of the priorities can be started: not running, and linking no file but its
 * proposal file. The others have started.
 */
export function startable(
  line: NonNullable<ReturnType<typeof usePriorities>>["sections"][number]["proposals"][number],
): boolean {
  return !line.running && (Boolean(line.file) || !line.spans.some((span) => span.link));
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

/** What a built-in's section reads: the search, and what takes its section and its cards' entries. */
type Read = { children: (read: NewSectionRead) => ReactNode; search: string };

/** Each card's entry, by its href, as a section's rows are made. */
function rowsOf() {
  const entries = new Map<string, Entry>();
  const rowOf = (entry: Entry, href: string, key: string, marks: string | undefined): WorkRow => {
    entries.set(href, entry);
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
  return { entries, rowOf };
}

/** A section's context while it has no card: what it is without a search, "No match." with one. */
const empty = (needle: string, nothing: string) =>
  needle === "" ? { context: nothing } : { context: "No match." };

/**
 * The inbox's notes, as the New page's "Inbox" section, the search keeping the cards whose text,
 * or a nested line, holds it.
 */
export function InboxNewSection({ children, search }: Read) {
  const here = useRepoPath();
  const inbox = useInbox();
  const needle = search.trim().toLowerCase();
  const { entries, rowOf } = rowsOf();
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
  return children({
    entries,
    section: {
      ...(notes.length === 0 ? empty(needle, "The inbox is empty.") : {}),
      icon: "uraeda:inbox",
      id: "inbox",
      isFixed: true,
      rows: notes,
      title: "Inbox",
      tone: "neutral",
    },
  });
}

/**
 * The priorities' proposals that have not started, as the New page's "Priorities" section, the
 * search keeping the cards whose text, or a nested line, holds it.
 */
export function PrioritiesNewSection({ children, search }: Read) {
  const here = useRepoPath();
  const priorities = usePriorities();
  const needle = search.trim().toLowerCase();
  const { entries, rowOf } = rowsOf();
  const lines = (priorities?.sections ?? []).flatMap((section) =>
    section.proposals
      .filter(startable)
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
  return children({
    entries,
    section: {
      ...(lines.length === 0 ? empty(needle, "Nothing to start from.") : {}),
      icon: "uraeda:list",
      id: "priorities",
      isFixed: true,
      rows: lines,
      title: "Priorities",
      tone: "now",
    },
  });
}

/** What the list's onOpen and the extensions' sections insert. */
type Inserts = { onInsert: (entry: Entry) => void; onInsertText: (text: string) => void };

/**
 * The list under the composer, whatever the kind: the sections of the extensions on here, the
 * inbox's and the priorities' first, in two columns, `j k` between their cards and `h l` across.
 * `onInsert` takes the entry a card selects, unless the entry has a file of its own, whose page
 * opens; an extension's own section inserts its text through `onInsertText`.
 */
export function EntryLists({ onInsert, onInsertText, search }: Inserts & { search: string }) {
  const sections = useContributions("newSection");
  const read = (section: NewSection, next: (read: NewSectionRead) => ReactNode): ReactNode => {
    if (section.section) {
      const Section = section.section;
      return <Section search={search}>{next}</Section>;
    }
    const Body = section.component;
    return next({
      entries: new Map(),
      section: {
        ...(Body ? { footer: <Body onInsert={onInsertText} search={search} /> } : {}),
        id: section.id,
        isFixed: true,
        rows: [],
        title: section.title,
        tone: section.tone,
      },
    });
  };
  return (
    <Collect items={sections} read={read}>
      {(reads) => <Entries onInsert={onInsert} reads={reads} />}
    </Collect>
  );
}

/** The sections' list, a card opening its entry's file, or inserting it. */
function Entries({
  onInsert,
  reads,
}: {
  onInsert: (entry: Entry) => void;
  reads: ReadonlyArray<NewSectionRead>;
}) {
  return (
    <WorkList
      layout="columns"
      onOpen={(href) => {
        const entry = reads.map((one) => one.entries.get(href)).find(Boolean);
        if (entry?.linkedHref) {
          navigate(entry.linkedHref);
        } else if (entry) {
          onInsert(entry);
        }
      }}
      sections={reads.map((one) => one.section)}
    />
  );
}
