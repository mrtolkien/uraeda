// "How it is built, and its limits": the parts after the stories, each drawn for what it holds. The
// architecture's units as bullets, then each tradeoff with a "Cost" pill; the edge cases by
// importance, the niche ones folded; each criterion's id and measure as pills before its sentence;
// the assumptions as their blocks. The core finds each part's items: the page draws them, and every
// item, row, and other block takes a comment as the spec's other blocks do.
import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { Block } from "uraeda-binding";
import { Selectable } from "../Selection.tsx";
import { Spans } from "../Spans.tsx";
import { Criteria } from "./builtParts/Criteria.tsx";
import { EdgeCases } from "./builtParts/EdgeCases.tsx";
import {
  builtStyles,
  childrenIn,
  type DrawingProps,
  inOrder,
  Nested,
  parentsOf,
} from "./builtParts/shared.tsx";
import { Panel } from "./Panel.tsx";
import { BUILT_PARTS, GROUPS, type PartProps, partOf, type SpecItems } from "./parts.ts";

/** What the parts after the stories draw: the page's context, and the spec's items. */
export type BuiltPartsProps = PartProps & { items: SpecItems };

/** A tradeoff of the architecture, after its "Cost" pill, then the blocks nested in it. */
function Cost({ item, props }: { item: Block; props: PartProps }) {
  return (
    <li>
      <HStack align="start" gap={2}>
        <span {...stylex.props(builtStyles.pill)}>
          <Badge label="Cost" variant="warning" />
        </span>
        <Selectable block={item} selection={props.selection}>
          <Text display="block" type="inherit" xstyle={builtStyles.reading}>
            <Spans spans={item.spans} />
          </Text>
          <Nested item={item} props={props} />
        </Selectable>
      </HStack>
    </li>
  );
}

/**
 * The architecture: its blocks in order as written, its units as bullets, the paragraph
 * "Tradeoffs:" giving way to each tradeoff with a "Cost" pill.
 */
function Architecture({ items, part, props }: DrawingProps) {
  const tradeoffs = parentsOf(props, items.tradeoffs);
  // The paragraph "Tradeoffs:", right before their list, where the core cuts the units from them.
  const title = part.blocks[part.blocks.findIndex((id) => tradeoffs.has(id)) - 1];
  return inOrder(part, props, (block) => {
    if (tradeoffs.has(block.id)) {
      return (
        <VStack aria-label="Tradeoffs" as="ul" gap={2} key={block.id} xstyle={builtStyles.list}>
          {childrenIn(props, items.tradeoffs, block.id).map((item) => (
            <Cost item={item} key={item.id} props={props} />
          ))}
        </VStack>
      );
    }
    return block.id === title ? null : undefined;
  });
}

/** Each part after the stories, by its section's title, drawn its own way. */
const DRAWINGS: Record<string, (args: DrawingProps) => ReactNode> = {
  Architecture,
  Assumptions: ({ part, props }) => inOrder(part, props, () => undefined),
  "Edge cases": EdgeCases,
  "Success criteria": Criteria,
};

/**
 * The architecture, the edge cases, the success criteria, and the assumptions, in this order, each
 * a card whose id is its section's anchor; a section the spec lacks has none.
 */
export function BuiltParts({ items, ...props }: BuiltPartsProps) {
  return BUILT_PARTS.map((title) => {
    const part = partOf(items, title);
    const Drawing = DRAWINGS[title];
    return (
      part &&
      Drawing && (
        <Panel crumbs={[GROUPS.built.title]} id={part.anchor} key={part.anchor} title={part.title}>
          <Drawing items={items} part={part} props={props} />
        </Panel>
      )
    );
  });
}
