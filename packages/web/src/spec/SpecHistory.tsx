// "History", at the spec page's end: the records of the earlier reviews, in a pane folded to its
// title, not mounted while folded. Not reviewed, so its blocks take no comment.
import { useState } from "react";
import type { Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Pane } from "../layout/Pane.tsx";
import { GROUPS, groupId, partOf, type SpecItems } from "./parts.ts";

/** The spec's `## History`, in a pane folded to its title; nothing when the spec has none. */
export function SpecHistory({ document, items }: { document: Document; items: SpecItems }) {
  const [isOpen, setOpen] = useState(false);
  const part = partOf(items, "History");
  if (!part) {
    return null;
  }
  return (
    <Pane
      fold={{ isOpen, onOpenChange: setOpen }}
      icon="uraeda:history"
      id={groupId(items, GROUPS.history)}
      title={GROUPS.history.title}
    >
      <Blocks document={document} ids={part.blocks} />
    </Pane>
  );
}
