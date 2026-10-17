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

/** The page's groups of parts, in its order: their element's id and their title. */
export const GROUPS = {
  answers: { id: "your-review-answered", title: "Your review, answered" },
  approve: { id: "what-you-approve", title: "What you approve" },
  built: { id: "how-it-is-built", title: "How it is built, and its limits" },
  data: { id: "data", title: "Data" },
  decisions: { id: "decisions", title: "Decisions" },
  history: { id: "history", title: "History" },
  stories: { id: "what-changes-for-users", title: "What changes for users" },
} as const;

/** The parts after the stories, by their section's title, in the page's order. */
export const BUILT_PARTS = ["Architecture", "Edge cases", "Success criteria", "Assumptions"];

/** The element id of a decision's card. */
export function decisionId(name: string): string {
  return `decision-${name}`;
}

/** The element id of a story's card: `us2`. */
export function storyId(id: string): string {
  return id.toLowerCase();
}

/** A section of the spec by its title, if it has one. */
export function partOf(items: SpecItems, title: string) {
  return items.parts.find((part) => part.title === title);
}
