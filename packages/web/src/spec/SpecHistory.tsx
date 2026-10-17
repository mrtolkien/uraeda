// "History", at the spec page's end: the records of the earlier reviews, folded. Not reviewed, so
// its blocks take no comment.
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Text } from "@astryxdesign/core/Text";
import type { Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { GROUPS, partOf, type SpecItems } from "./parts.ts";

/** The spec's `## History`, folded under its title; nothing when the spec has none. */
export function SpecHistory({ document, items }: { document: Document; items: SpecItems }) {
  const part = partOf(items, "History");
  if (!part) {
    return null;
  }
  return (
    <div id={GROUPS.history.id}>
      <Collapsible
        chevronPosition="start"
        defaultIsOpen={false}
        trigger={<Text weight="semibold">{GROUPS.history.title}</Text>}
      >
        <Blocks document={document} ids={part.blocks} />
      </Collapsible>
    </div>
  );
}
