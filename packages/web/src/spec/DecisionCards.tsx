// The spec's decisions, after what you approve: a pane per decision the spec lists, in its order,
// then one per decision the branch changes without listing it, marked so, then the section's other
// blocks, the "Relied on" table in a pane of its own, alone when no decision is listed or changed.
import { fontWeightVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { Block, DecisionChange, Document, Span } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Pane } from "../layout/Pane.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";
import { branchDecisionPath, useRepoPath } from "../routes.tsx";
import { type Selection, Selectable } from "../Selection.tsx";
import { SinceWords, wordCount } from "../sinceMarks.tsx";
import { plain, Spans } from "../Spans.tsx";
import { DecisionCard } from "./DecisionCard.tsx";
import { UnreadItems } from "./UnreadItems.tsx";
import {
  decisionId,
  decisionPanes,
  GROUPS,
  type PartProps,
  type SpecItems,
  unreadItems,
} from "./parts.ts";

const styles = stylex.create({
  note: {
    // What the spec says of the decision, before its text.
    fontWeight: fontWeightVars["--font-weight-semibold"],
    margin: 0,
  },
});

/**
 * What the decision cards draw: the page's context; the decisions the spec lists, its
 * `items.decisions`; the branch's changes to decisions, the file view's `decisionChanges`, the
 * listed ones and the others; and the `## Decisions` section, whose blocks besides its items, like
 * the "Relied on" table, follow the cards.
 */
export type DecisionCardsProps = PartProps & {
  changes: ReadonlyArray<DecisionChange>;
  items: SpecItems["decisions"];
  part: SpecItems["parts"][number] | undefined;
};

/**
 * What an item says of its decision: its spans after the bold lead, `**Changed: [Title](…)**`,
 * which the card's title and pill already say, without the lead's closing period. A removed one's
 * lead goes on with its file's name, `` (`name.md`) ``, which the card under its title skips (R88).
 */
function noteOf(spans: ReadonlyArray<Span>): Array<Span> {
  const at = spans.findIndex((span) => !span.strong);
  if (at < 0) {
    return [];
  }
  let after = spans.slice(at);
  if (after[0]!.text.trim() === "(" && after[1]?.code && after[2]?.text.startsWith(")")) {
    after = [{ ...after[2], text: after[2].text.slice(1) }, ...after.slice(3)];
  }
  const [first, ...rest] = after;
  const text = first!.code ? first!.text : first!.text.replace(/^[\s.]+/, "");
  return text ? [{ ...first!, text }, ...rest] : rest;
}

/** An item's sentence, which a review comments on as the spec's line it is. */
function Note({ block, selection }: { block: Block; selection: Selection | undefined }) {
  const note = noteOf(block.spans);
  return (
    <Selectable block={block} selection={selection}>
      <Paragraph xstyle={styles.note}>
        {/* Changed since your review: its words after the lead, which its pane's title says. */}
        <SinceWords
          block={block}
          lead={wordCount(plain(block.spans)) - wordCount(plain(note))}
          spans={note}
        >
          <Spans spans={note} />
        </SinceWords>
      </Paragraph>
    </Selectable>
  );
}

/**
 * The section's other blocks: with a table, in a pane "Relied on", counting its rows; as they are
 * otherwise.
 */
function Rest({
  document,
  ids,
  selection,
}: {
  document: Document;
  ids: ReadonlyArray<number>;
  selection: Selection | undefined;
}) {
  if (ids.length === 0) {
    return null;
  }
  const blocks = <Blocks document={document} ids={ids} selection={selection} />;
  const rows = document.blocks.filter(
    (block) => block.kind === "row" && !block.header && ids.includes(block.parent ?? -1),
  ).length;
  return rows === 0 ? (
    blocks
  ) : (
    <Pane count={rows} level={3} title="Relied on">
      {blocks}
    </Pane>
  );
}

/** The listed decisions' cards, in the items' order, then the unlisted changes', then the rest. */
export function DecisionCards({
  changes,
  comments,
  document,
  folder,
  items,
  part,
  selection,
}: DecisionCardsProps) {
  const here = useRepoPath();
  const lists = new Set(items.map((item) => document.blocks[item.block]?.parent));
  const unread = unreadItems(
    document,
    items.map((item) => item.block),
  );
  const rest = part?.blocks.filter((id) => !lists.has(id)) ?? [];
  return (
    <>
      {decisionPanes(items, changes).map(({ change, item, kind, name, title }) => {
        const block = item && document.blocks[item.block];
        return (
          <DecisionCard
            change={change}
            comments={comments}
            crumbs={[GROUPS.decisions.title]}
            href={kind === "removed" ? undefined : here(branchDecisionPath(folder, name))}
            id={decisionId(name)}
            key={name}
            kind={kind}
            name={name}
            note={block && <Note block={block} selection={selection} />}
            parts={selection?.parts}
            title={title}
            unlisted={!item}
          />
        );
      })}
      <UnreadItems document={document} ids={unread} selection={selection} />
      <Rest document={document} ids={rest} selection={selection} />
    </>
  );
}
