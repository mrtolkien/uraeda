// What the spec page's parts share: the file and its items as the page reads them, the context
// every part draws with, and the page's groups, in their order.
import type { Block, CommentItem, DecisionChange, Document } from "uraeda-binding";
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
  built: { id: "how-it-is-built", title: "How it is built" },
  data: { id: "data", title: "Data" },
  decisions: { id: "decisions", part: "Decisions", title: "Decisions" },
  history: { id: "history", part: "History", title: "History" },
  replaced: { id: "replaced-behaviour", part: "Replaced behaviour", title: "Replaced behaviour" },
  stories: { id: "user-stories", part: "User stories", title: "User stories" },
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

/** The sections the page draws its own way, by title: any other level-2 section is drawn as written. */
const KNOWN_PARTS = new Set([
  "Assumptions",
  "Architecture",
  "Constitution check",
  "Decisions",
  "Edge cases",
  "History",
  "Replaced behaviour",
  "Risk tier",
  "Success criteria",
  "User stories",
  "Your review",
]);

/** The level-2 sections the page has no drawing for, in the spec's order. */
export function otherParts(items: SpecItems): SpecItems["parts"] {
  return items.parts.filter((part) => !KNOWN_PARTS.has(part.title));
}

/** The blocks of the stories' section outside any story, like a paragraph before the first. */
export function storiesIntro(items: SpecItems): ReadonlyArray<number> {
  const inStories = new Set(items.stories.flatMap((s) => [s.headingBlock, ...s.blocks]));
  return partOf(items, "User stories")?.blocks.filter((id) => !inStories.has(id)) ?? [];
}

/**
 * A pane of the Decisions group: the decision's name, title, and kind, its change on the branch if
 * any, and the spec's item listing it, none for a change the spec does not list.
 */
export type DecisionPane = {
  change: DecisionChange | undefined;
  item: SpecItems["decisions"][number] | undefined;
  kind: string;
  name: string;
  title: string;
};

/**
 * The panes the Decisions group draws, in its order: one per decision the spec lists, its kind the
 * change's once compared, as a decision listed as changed may be new to the branch; then one per
 * decision the branch changes without the spec listing it (R21). The group's panes, its heading's
 * counts, and its entries in "Contents" all read them.
 */
export function decisionPanes(
  items: SpecItems["decisions"],
  changes: ReadonlyArray<DecisionChange>,
): Array<DecisionPane> {
  const byName = new Map(changes.map((change) => [change.name, change]));
  const listed = new Set(items.map((item) => item.name));
  return [
    ...items.map((item) => {
      const change = byName.get(item.name);
      const kind = change?.compared ? change.kind : item.kind;
      return { change, item, kind, name: item.name, title: item.title };
    }),
    ...changes
      .filter((change) => !listed.has(change.name))
      .map((change) => ({
        change,
        item: undefined,
        kind: change.kind,
        name: change.name,
        title: change.title,
      })),
  ];
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

/**
 * The entry of "Contents" each drawn block belongs to, by the block's id: a top-level block, or a
 * decision's item. A section's heading belongs to the entry drawing the section, whose title it is.
 */
export function entryOwners(document: Document, items: SpecItems): Map<number, string> {
  const owners = new Map<number, string>();
  const own = (ids: ReadonlyArray<number> | undefined, entry: string) => {
    for (const id of ids ?? []) {
      owners.set(id, entry);
    }
  };
  const ownPart = (part: SpecItems["parts"][number] | undefined, entry: string) =>
    own(part && [part.heading, ...part.blocks], entry);
  const first = items.parts[0]?.heading ?? document.blocks.length;
  own(
    document.blocks.filter((b) => b.parent == null && b.id < first).map((b) => b.id),
    GROUPS.approve.id,
  );
  ownPart(partOf(items, "Constitution check"), GROUPS.approve.id);
  ownPart(partOf(items, "Risk tier"), GROUPS.approve.id);
  ownPart(partOf(items, "Your review"), groupId(items, GROUPS.answers));
  ownPart(partOf(items, "Decisions"), groupId(items, GROUPS.decisions));
  ownPart(partOf(items, "User stories"), groupId(items, GROUPS.stories));
  ownPart(partOf(items, "Replaced behaviour"), groupId(items, GROUPS.replaced));
  for (const decision of items.decisions) {
    owners.set(decision.block, decisionId(decision.name));
  }
  for (const story of items.stories) {
    own([story.headingBlock, ...story.blocks], storyId(document, story));
  }
  own(storiesIntro(items), groupId(items, GROUPS.stories));
  for (const title of BUILT_PARTS) {
    const part = partOf(items, title);
    ownPart(part, part?.anchor ?? "");
  }
  for (const part of otherParts(items)) {
    ownPart(part, part.anchor);
  }
  return owners;
}

/** The entry a block belongs to: its own, else its innermost holder's. */
export function entryOfBlock(
  document: Document,
  owners: Map<number, string>,
  block: Block | undefined,
): string | undefined {
  let at = block;
  while (at && !owners.has(at.id)) {
    at = at.parent == null ? undefined : document.blocks[at.parent];
  }
  return at && owners.get(at.id);
}

/** A block and the blocks holding it, innermost first. */
function holders(document: Document, block: Block): Array<Block> {
  const chain: Array<Block> = [];
  for (let at: Block | undefined = block; at;) {
    chain.push(at);
    at = at.parent == null ? undefined : document.blocks[at.parent];
  }
  return chain;
}

/**
 * Where a block sits in its story, if in one: "US2's journey", "US2, key scenario 1", or "US2,
 * more scenario 2"; none for its heading, which its entry of "Contents" names.
 */
export function placeInStory(
  document: Document,
  items: SpecItems,
  block: Block,
): string | undefined {
  const chain = holders(document, block).map((b) => b.id);
  const top = chain.at(-1);
  const story = items.stories.find(
    (s) => s.headingBlock === top || (top !== undefined && s.blocks.includes(top)),
  );
  if (!story || block.id === story.headingBlock) {
    return undefined;
  }
  const scenario = (list: SpecItems["stories"][number]["key"]) =>
    list.findIndex((s) => chain.includes(s.block)) + 1;
  const key = scenario(story.key);
  if (key > 0) {
    return `${story.id}, key scenario ${key}`;
  }
  const more = scenario(story.more);
  return more > 0 ? `${story.id}, more scenario ${more}` : `${story.id}'s journey`;
}
