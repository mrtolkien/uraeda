// TEMPORARY: task 13 of the specs redesign rewrites the decision cards, each change marked in place,
// each rule with its strength's icon. Until then, each decision the spec lists is a card holding its
// item, each one the branch changes without listing it a card saying so, and the section's other
// blocks follow.
import { Badge } from "@astryxdesign/core/Badge";
import { Text } from "@astryxdesign/core/Text";
import type { DecisionChange } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Selectable } from "../Selection.tsx";
import { Spans } from "../Spans.tsx";
import { Panel } from "./Panel.tsx";
import { decisionId, GROUPS, type PartProps, type SpecItems } from "./parts.ts";

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

/** Each kind's badge. */
const KINDS: Record<string, { label: string; variant: "error" | "success" | "warning" }> = {
  changed: { label: "Changed", variant: "warning" },
  new: { label: "New", variant: "success" },
  removed: { label: "Removed", variant: "error" },
};

/** A decision's kind as a badge. */
function KindBadge({ kind }: { kind: string }) {
  const { label, variant } = KINDS[kind] ?? { label: kind, variant: "warning" };
  return <Badge label={label} variant={variant} />;
}

/** The listed decisions' cards, in the items' order, then the unlisted changes', then the rest. */
export function DecisionCards({ changes, document, items, part, selection }: DecisionCardsProps) {
  const listed = new Set(items.map((item) => item.name));
  const lists = new Set(items.map((item) => document.blocks[item.block]?.parent));
  const rest = part?.blocks.filter((id) => !lists.has(id)) ?? [];
  return (
    <>
      {items.map((item) => {
        const block = document.blocks[item.block];
        return (
          <Panel
            badges={<KindBadge kind={item.kind} />}
            crumbs={[GROUPS.decisions.title]}
            id={decisionId(item.name)}
            key={item.name}
            title={item.title}
          >
            {block && (
              <Selectable block={block} selection={selection}>
                <Text display="block" type="inherit">
                  <Spans spans={block.spans} />
                </Text>
              </Selectable>
            )}
          </Panel>
        );
      })}
      {changes
        .filter((change) => !listed.has(change.name))
        .map((change) => (
          <Panel
            badges={
              <>
                <KindBadge kind={change.kind} />
                <Badge label="Not listed in the spec" variant="error" />
              </>
            }
            crumbs={[GROUPS.decisions.title]}
            id={decisionId(change.name)}
            key={change.name}
            title={change.title}
          >
            <Text color="secondary">The branch changes this decision.</Text>
          </Panel>
        ))}
      {rest.length > 0 && <Blocks document={document} ids={rest} selection={selection} />}
    </>
  );
}
