// What the spec page's parts share: the file and its items as the page reads them, the context
// every part draws with, and the page's groups, in their order.
import type { CommentItem, Document } from "uraeda-binding";
import type { useFile } from "../data.ts";
import type { Folds } from "../Folds.tsx";
import type { Selection } from "../Selection.tsx";

export type File = NonNullable<ReturnType<typeof useFile>>;

/** A spec's items, as the core reads them. */
export type SpecItems = NonNullable<File["current"]["items"]["spec"]>;

/** What every part of the spec page draws with. */
export type PartProps = {
  /**
   * The review's pending comments, none once the spec waits no more. Those on the spec's lines
   * also show under their blocks, through `selection`.
   */
  comments: ReadonlyArray<CommentItem>;
  /** The spec's tree, as reviewed: the version at the branch's tip while it waits. */
  document: Document;
  /** The feature's folder. */
  folder: string;
  /** The folds of the spec's blocks, opened in the history entry: each story's more scenarios. */
  folds: Folds | undefined;
  /** How a tap on a block starts a comment on its lines: none once the spec waits no more. */
  selection: Selection | undefined;
  /** Whether the window is of the wide class. */
  wide: boolean;
};

/**
 * The page's groups of parts, in its order: their title, the spec's section they draw, if one, and
 * their element's id without it. A group drawing a section takes the section's anchor as its id
 * (see `groupId`), so a link to the section lands on it.
 */
export const GROUPS = {
  answers: { id: "your-review", part: "Your review", title: "Your review, answered" },
  approve: { id: "what-you-approve", title: "What you approve" },
  built: { id: "how-it-is-built", title: "How it is built, and its limits" },
  data: { id: "data", title: "Data" },
  decisions: { id: "decisions", part: "Decisions", title: "Decisions" },
  history: { id: "history", part: "History", title: "History" },
  stories: { id: "user-stories", part: "User stories", title: "What changes for users" },
} as const;

type Group = (typeof GROUPS)[keyof typeof GROUPS];

/** The element id of a group: its section's anchor, if it draws one the spec has. */
export function groupId(items: SpecItems, group: Group): string {
  return ("part" in group && partOf(items, group.part)?.anchor) || group.id;
}

/** The parts after the stories, by their section's title, in the page's order. */
export const BUILT_PARTS = ["Architecture", "Edge cases", "Success criteria", "Assumptions"];

/**
 * The items the core did not read, among the lists holding items it read: a part draws them as the
 * spec's blocks, so no text of the spec goes missing.
 */
export function unreadItems(document: Document, read: ReadonlyArray<number>): Array<number> {
  const lists = new Set(read.map((id) => document.blocks[id]?.parent));
  const items = new Set(read);
  return document.blocks
    .filter((block) => block.parent != null && lists.has(block.parent) && !items.has(block.id))
    .map((block) => block.id);
}

/** The element id of a decision's card. */
export function decisionId(name: string): string {
  return `decision-${name}`;
}

/** The element id of a story's card: its heading's anchor, `us2-complete-a-repeating-task-p1`. */
export function storyId(document: Document, story: SpecItems["stories"][number]): string {
  return document.blocks[story.headingBlock]?.anchor ?? story.id.toLowerCase();
}

/** A section of the spec by its title, if it has one. */
export function partOf(items: SpecItems, title: string) {
  return items.parts.find((part) => part.title === title);
}
