// "How it is built, and its limits": the parts after the stories, each a titled pane drawn for
// what it holds, its prose read as a round's context, given air, filling a pane of prose. The architecture and the
// assumptions as their blocks; the edge cases by importance, each its situation then what happens,
// the niche ones folded; each criterion's id and measure as pills before its sentence. The core finds each part's items: the page draws
// them, and every item, row, and other block takes a comment as the spec's other blocks do.
import type { ReactNode } from "react";
import { Criteria } from "./builtParts/Criteria.tsx";
import { EdgeCases } from "./builtParts/EdgeCases.tsx";
import { type DrawingProps, inOrder } from "./builtParts/shared.tsx";
import { Pane } from "../layout/Pane.tsx";
import { BUILT_PARTS, type PartProps, partOf, type SpecItems } from "./parts.ts";

/** What the parts after the stories draw: the page's context, and the spec's items. */
export type BuiltPartsProps = PartProps & { items: SpecItems };

/**
 * Each part after the stories, by its section's title: its drawing, its pane's icon, and the count
 * its title shows, if one.
 */
const DRAWINGS: Record<
  string,
  {
    count?: (items: SpecItems) => number;
    draw: (args: DrawingProps) => ReactNode;
    icon: `uraeda:${string}`;
  }
> = {
  // Its blocks as written: its units and its tradeoffs are not drawn apart.
  Architecture: {
    draw: ({ part, props }) => inOrder(part, props, () => undefined),
    icon: "uraeda:layers",
  },
  Assumptions: {
    draw: ({ part, props }) => inOrder(part, props, () => undefined),
    icon: "uraeda:lightbulb",
  },
  "Edge cases": { count: (items) => items.edges.length, draw: EdgeCases, icon: "uraeda:shield" },
  "Success criteria": {
    count: (items) => items.criteria.length,
    draw: Criteria,
    icon: "uraeda:ruler",
  },
};

/**
 * The architecture, the edge cases, the success criteria, and the assumptions, in this order, each
 * a pane with its icon, whose id is its section's anchor, the edge cases and the criteria counted
 * in their title; a section the spec lacks has none.
 */
export function BuiltParts({ items, ...props }: BuiltPartsProps) {
  return BUILT_PARTS.map((title) => {
    const part = partOf(items, title);
    const drawing = DRAWINGS[title];
    if (!part || !drawing) {
      return null;
    }
    const Drawing = drawing.draw;
    return (
      <Pane
        count={drawing.count?.(items)}
        icon={drawing.icon}
        id={part.anchor}
        key={part.anchor}
        level={3}
        title={part.title}
      >
        <Drawing items={items} part={part} props={props} />
      </Pane>
    );
  });
}
