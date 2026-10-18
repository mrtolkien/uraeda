// The spec's decisions, after what you approve: a card per decision the spec lists, in its order,
// then one per decision the branch changes without listing it, marked so, then the section's other
// blocks, like the "Relied on" table.
import { fontWeightVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { Block, DecisionChange, Span } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";
import { branchDecisionPath, useRepoPath } from "../routes.tsx";
import { type Selection, Selectable } from "../Selection.tsx";
import { Spans } from "../Spans.tsx";
import { DecisionCard } from "./DecisionCard.tsx";
import { decisionId, GROUPS, type PartProps, type SpecItems } from "./parts.ts";

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
  return (
    <Selectable block={block} selection={selection}>
      <Paragraph xstyle={styles.note}>
        <Spans spans={noteOf(block.spans)} />
      </Paragraph>
    </Selectable>
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
  const byName = new Map(changes.map((change) => [change.name, change]));
  const listed = new Set(items.map((item) => item.name));
  const lists = new Set(items.map((item) => document.blocks[item.block]?.parent));
  const rest = part?.blocks.filter((id) => !lists.has(id)) ?? [];
  const card = (name: string, kind: string) => ({
    comments,
    crumbs: [GROUPS.decisions.title],
    href: kind === "removed" ? undefined : here(branchDecisionPath(folder, name)),
    id: decisionId(name),
    kind,
    name,
    parts: selection?.parts,
  });
  return (
    <>
      {items.map((item) => {
        const change = byName.get(item.name);
        const block = document.blocks[item.block];
        // The change's kind once compared: a decision listed as changed may be new to the branch.
        const kind = change?.compared ? change.kind : item.kind;
        return (
          <DecisionCard
            {...card(item.name, kind)}
            change={change}
            key={item.name}
            note={block && <Note block={block} selection={selection} />}
            title={item.title}
          />
        );
      })}
      {changes
        .filter((change) => !listed.has(change.name))
        .map((change) => (
          <DecisionCard
            {...card(change.name, change.kind)}
            change={change}
            key={change.name}
            title={change.title}
            unlisted
          />
        ))}
      {rest.length > 0 && <Blocks document={document} ids={rest} selection={selection} />}
    </>
  );
}
