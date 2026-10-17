// TEMPORARY: task 12 of the specs redesign rewrites the parts after the stories, each drawn for
// what it holds: the architecture's units as small cards, the edge cases by importance, the
// criteria's ids and measures as pills. Until then, each part's card draws its blocks.
import { Blocks } from "../Blocks.tsx";
import { Panel } from "./Panel.tsx";
import { BUILT_PARTS, GROUPS, type PartProps, partOf, type SpecItems } from "./parts.ts";

/** What the parts after the stories draw: the page's context, and the spec's items. */
export type BuiltPartsProps = PartProps & { items: SpecItems };

/**
 * The architecture, the edge cases, the success criteria, and the assumptions, in this order, each
 * a card whose id is its section's anchor; a section the spec lacks has none.
 */
export function BuiltParts({ document, folds, items, selection }: BuiltPartsProps) {
  return BUILT_PARTS.map((title) => partOf(items, title)).map(
    (part) =>
      part && (
        <Panel crumbs={[GROUPS.built.title]} id={part.anchor} key={part.anchor} title={part.title}>
          <Blocks document={document} folds={folds} ids={part.blocks} selection={selection} />
        </Panel>
      ),
  );
}
