// "Contents", a tab of the spec's and the plan's column, and the phone's sheet: every part,
// decision, and story, each with the count of pending comments on it, the part at the top marked,
// a tap jumping to it.
import { Badge } from "@astryxdesign/core/Badge";
import { List, ListItem } from "@astryxdesign/core/List";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { CommentItem, DecisionChange, Document } from "uraeda-binding";
import { holderOf } from "../reviewField.ts";
import { SinceSign } from "../sinceMarks.tsx";
import { jumpTo, useQuestionAtTop } from "../roundJump.ts";
import { useColumnGo } from "./columnGo.ts";
import { CommentCount } from "./CommentCount.tsx";
import {
  BUILT_PARTS,
  decisionId,
  entryOfBlock,
  entryOwners,
  GROUPS,
  groupId,
  otherParts,
  partOf,
  type SpecItems,
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

/**
 * An entry of "Contents": the element it jumps to, its text, its depth, its comments, and whether it
 * holds a part changed since your review.
 */
export type Entry = { count: number; id: string; label: string; nested: boolean; since?: boolean };

/**
 * The entry a comment counts for: its decision's, for a decision comment, whose lines are the
 * decision's own; else the innermost entry of its block in the spec.
 */
function ownerOf(document: Document, owners: Map<number, string>, comment: CommentItem) {
  if (comment.decision != null) {
    return decisionId(comment.decision);
  }
  return entryOfBlock(document, owners, holderOf(document, comment.endLine));
}

/** The number of comments on each entry. */
function countsOf(document: Document, items: SpecItems, comments: ReadonlyArray<CommentItem>) {
  const owners = entryOwners(document, items);
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
  since = new Set(),
}: {
  changes: ReadonlyArray<DecisionChange>;
  comments: ReadonlyArray<CommentItem>;
  document: Document;
  hasData: boolean;
  items: SpecItems;
  /** The entries holding a part changed since your review. */
  since?: ReadonlySet<string>;
}): Array<Entry> {
  const counts = countsOf(document, items, comments);
  const entry = (id: string, label: string, nested = false): Entry => ({
    count: counts.get(id) ?? 0,
    id,
    label,
    nested,
    since: since.has(id),
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
 * item's link does not call the item's `onClick`. A click with a modifier or another button than
 * the first is left to the browser.
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
        // A link opened in a new tab or window, or with another button, is the browser's.
        const plain =
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey;
        if (link && plain) {
          event.preventDefault();
          const id = link.getAttribute("href")!.slice(1);
          go(() => jumpTo(id));
        }
      }}
    >
      <List aria-label="Parts" density="compact">
        {entries.map(({ count, id, label, nested, since }) => (
          <ListItem
            href={`#${id}`}
            isSelected={id === (current ?? entries[0]?.id)}
            key={id}
            label={
              <span {...stylex.props(styles.label)}>
                {label}
                {since && <SinceSign />}
                {count > 0 && (
                  <>
                    {" "}
                    <Badge label={<CommentCount count={count} />} variant="warning" />
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
