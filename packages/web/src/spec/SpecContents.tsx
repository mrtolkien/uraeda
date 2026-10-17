// "Contents", the spec page's column on a wide screen: every part, decision, and story, each with
// the count of pending comments on it, a tap jumping to it, and the verdict at its foot. Hidden
// with its button or `]`, the choice kept in the browser, the verdict then at the page's end.
import { Badge } from "@astryxdesign/core/Badge";
import { List, ListItem } from "@astryxdesign/core/List";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { Block, CommentItem, DecisionChange, Document } from "uraeda-binding";
import { SideColumn } from "../layout/SideColumn.tsx";
import { useStoredShown } from "../layout/useStoredShown.ts";
import { holderOf } from "../reviewField.ts";
import { jumpTo } from "../RoundNav.tsx";
import { BUILT_PARTS, decisionId, GROUPS, partOf, type SpecItems, storyId } from "./parts.ts";

const styles = stylex.create({
  column: {
    paddingBlockEnd: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-3"],
  },
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
  own(partOf(items, "Your review")?.blocks, GROUPS.answers.id);
  own(partOf(items, "Decisions")?.blocks, GROUPS.decisions.id);
  for (const decision of items.decisions) {
    owners.set(decision.block, decisionId(decision.name));
  }
  for (const story of items.stories) {
    own([story.headingBlock, ...story.blocks], storyId(story.id));
  }
  for (const title of BUILT_PARTS) {
    const part = partOf(items, title);
    own(part?.blocks, part?.anchor ?? "");
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
    ...(items.answers.length > 0 ? [entry(GROUPS.answers.id, GROUPS.answers.title)] : []),
    ...(decisions.length > 0 ? [entry(GROUPS.decisions.id, GROUPS.decisions.title)] : []),
    ...decisions.map((d) => entry(decisionId(d.name), d.title, true)),
    ...(items.stories.length > 0 ? [entry(GROUPS.stories.id, GROUPS.stories.title)] : []),
    ...items.stories.map((s) => entry(storyId(s.id), `${s.id} ${s.title}`, true)),
    ...(hasData ? [entry(GROUPS.data.id, GROUPS.data.title)] : []),
    ...BUILT_PARTS.flatMap((title) => {
      const part = partOf(items, title);
      return part ? [entry(part.anchor, part.title)] : [];
    }),
  ];
}

/** Every entry, a tap jumping to its part. */
function Entries({ entries }: { entries: ReadonlyArray<Entry> }) {
  return (
    <List aria-label="Parts" density="compact">
      {entries.map(({ count, id, label, nested }) => (
        <ListItem
          href={`#${id}`}
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
          onClick={(event: React.MouseEvent) => {
            event.preventDefault();
            jumpTo(id);
          }}
          xstyle={nested ? styles.nested : undefined}
        />
      ))}
    </List>
  );
}

/** Where the column's folded state is kept, for every spec. */
const KEY = "uraeda.specContents";

/** Whether "Contents" shows, kept in the browser for every spec. */
export function useContentsShown() {
  return useStoredShown(KEY);
}

/**
 * The page beside "Contents" on a wide screen: its entries, then `verdict`, given only while it
 * shows. On the phone, the page alone.
 */
export function SpecContents({
  children,
  entries,
  shown: [isShown, setShown],
  verdict,
}: {
  /** The page. */
  children: ReactNode;
  entries: ReadonlyArray<Entry>;
  shown: ReturnType<typeof useContentsShown>;
  verdict: ReactNode;
}) {
  return (
    <SideColumn
      content={children}
      isShown={isShown}
      label="Contents"
      onShownChange={setShown}
      // Room for the verdict's longest button, "Request changes and start the agent", uncut.
      sizes={{ default: 440, min: 420 }}
      storageKey="uraeda.specContents.width"
    >
      <VStack gap={4} xstyle={styles.column}>
        <Entries entries={entries} />
        {verdict}
      </VStack>
    </SideColumn>
  );
}
