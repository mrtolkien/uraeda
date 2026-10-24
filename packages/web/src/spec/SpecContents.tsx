// "Contents", a tab of the spec's and the plan's column, and the phone's sheet: every part,
// decision, and story, each with the count of pending comments on it, the part at the top marked,
// a tap jumping to it.
import { Badge } from "@astryxdesign/core/Badge";
import { List, ListItem } from "@astryxdesign/core/List";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { Block, CommentItem, DecisionChange, Document } from "uraeda-binding";
import { holderOf } from "../reviewField.ts";
import { jumpTo, useQuestionAtTop } from "../roundJump.ts";
import { useColumnGo } from "./columnGo.ts";
import {
  BUILT_PARTS,
  decisionId,
  GROUPS,
  groupId,
  otherParts,
  partOf,
  type SpecItems,
  storiesIntro,
  storyId,
} from "./parts.ts";

const styles = stylex.create({
  label: {
    // An entry's text wraps: no title is cut.
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  },
  nested: { paddingInlineStart: spacingVars["--spacing-4"] },
});

/** An entry of "Contents": the element it jumps to, its text, its depth, and its comments. */
export type Entry = { count: number; id: string; label: string; nested: boolean };

/** The entry each drawn block belongs to, by the block's id: a top-level block, or a decision's item. */
function ownersOf(document: Document, items: SpecItems): Map<number, string> {
  const owners = new Map<number, string>();
  const own = (ids: ReadonlyArray<number> | undefined, entry: string) => {
    for (const id of ids ?? []) {
      owners.set(id, entry);
    }
  };
  const first = items.parts[0]?.heading ?? document.blocks.length;
  own(
    document.blocks.filter((b) => b.parent == null && b.id < first).map((b) => b.id),
    GROUPS.approve.id,
  );
  own(partOf(items, "Constitution check")?.blocks, GROUPS.approve.id);
  own(partOf(items, "Risk tier")?.blocks, GROUPS.approve.id);
  own(partOf(items, "Your review")?.blocks, groupId(items, GROUPS.answers));
  own(partOf(items, "Decisions")?.blocks, groupId(items, GROUPS.decisions));
  for (const decision of items.decisions) {
    owners.set(decision.block, decisionId(decision.name));
  }
  for (const story of items.stories) {
    own([story.headingBlock, ...story.blocks], storyId(document, story));
  }
  own(storiesIntro(items), groupId(items, GROUPS.stories));
  for (const title of BUILT_PARTS) {
    const part = partOf(items, title);
    own(part?.blocks, part?.anchor ?? "");
  }
  for (const part of otherParts(items)) {
    own(part.blocks, part.anchor);
  }
  return owners;
}

/**
 * The entry a comment counts for: its decision's, for a decision comment, whose lines are the
 * decision's own; else the innermost entry of its block in the spec.
 */
function ownerOf(document: Document, owners: Map<number, string>, comment: CommentItem) {
  if (comment.decision != null) {
    return decisionId(comment.decision);
  }
  let block: Block | undefined = holderOf(document, comment.endLine);
  while (block && !owners.has(block.id)) {
    block = block.parent == null ? undefined : document.blocks[block.parent];
  }
  return block && owners.get(block.id);
}

/** The number of comments on each entry. */
function countsOf(document: Document, items: SpecItems, comments: ReadonlyArray<CommentItem>) {
  const owners = ownersOf(document, items);
  const counts = new Map<string, number>();
  for (const comment of comments.filter((c) => !c.general)) {
    const owner = ownerOf(document, owners, comment);
    if (owner) {
      counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * The entries of "Contents", in the page's order: what you approve; your review answered, on a
 * revision; the decisions, the listed ones then the others the branch changes; the stories; the
 * data, when the feature has a data model; then the parts after them.
 */
export function entriesOf({
  changes,
  comments,
  document,
  hasData,
  items,
}: {
  changes: ReadonlyArray<DecisionChange>;
  comments: ReadonlyArray<CommentItem>;
  document: Document;
  hasData: boolean;
  items: SpecItems;
}): Array<Entry> {
  const counts = countsOf(document, items, comments);
  const entry = (id: string, label: string, nested = false): Entry => ({
    count: counts.get(id) ?? 0,
    id,
    label,
    nested,
  });
  const listed = new Set(items.decisions.map((d) => d.name));
  const unlisted = changes.filter((change) => !listed.has(change.name));
  const decisions = [...items.decisions, ...unlisted];
  return [
    entry(GROUPS.approve.id, GROUPS.approve.title),
    ...(partOf(items, "Your review")
      ? [entry(groupId(items, GROUPS.answers), GROUPS.answers.title)]
      : []),
    ...(decisions.length > 0
      ? [
          entry(
            groupId(items, GROUPS.decisions),
            `${GROUPS.decisions.title} · ${items.decisions.length}`,
          ),
        ]
      : []),
    ...decisions.map((d) => entry(decisionId(d.name), d.title, true)),
    ...(items.stories.length > 0
      ? [entry(groupId(items, GROUPS.stories), `${GROUPS.stories.title} · ${items.stories.length}`)]
      : []),
    ...items.stories.map((s) => entry(storyId(document, s), `${s.id} ${s.title}`, true)),
    ...(hasData ? [entry(GROUPS.data.id, GROUPS.data.title)] : []),
    ...BUILT_PARTS.flatMap((title) => {
      const part = partOf(items, title);
      return part ? [entry(part.anchor, part.title)] : [];
    }),
    ...otherParts(items).map((part) => entry(part.anchor, part.title)),
  ];
}

/**
 * "Contents": every entry, the part at the top marked, a tap jumping to its part and focusing its
 * title, through the column, which closes the phone's sheet first. Caught around the list: a list
 * item's link does not call the item's `onClick`.
 */
export function Contents({ entries }: { entries: ReadonlyArray<Entry> }) {
  const go = useColumnGo();
  const current = useQuestionAtTop(
    entries.map((entry) => entry.id),
    true,
  );
  return (
    <div
      onClickCapture={(event) => {
        const link = (event.target as Element).closest("a[href^='#']");
        if (link) {
          event.preventDefault();
          const id = link.getAttribute("href")!.slice(1);
          go(() => jumpTo(id));
        }
      }}
    >
      <List aria-label="Parts" density="compact">
        {entries.map(({ count, id, label, nested }) => (
          <ListItem
            href={`#${id}`}
            isSelected={id === (current ?? entries[0]?.id)}
            key={id}
            label={
              <span {...stylex.props(styles.label)}>
                {label}
                {count > 0 && (
                  <>
                    {" "}
                    <Badge
                      label={
                        <>
                          {count}
                          <VisuallyHidden> {count === 1 ? "comment" : "comments"}</VisuallyHidden>
                        </>
                      }
                      variant="warning"
                    />
                  </>
                )}
              </span>
            }
            xstyle={nested ? styles.nested : undefined}
          />
        ))}
      </List>
    </div>
  );
}
