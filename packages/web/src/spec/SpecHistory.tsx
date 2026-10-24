// "History", at the spec page's end: the records of the earlier reviews, in a pane folded to its
// title, not mounted while folded. Its fold is kept in the history entry, as the spec's other folds
// are, so Back and a reload keep it, and a link into it opens it. Not reviewed, so its blocks take
// no comment.
import { useMemo } from "react";
import type { Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { type Folds, useHashFold } from "../Folds.tsx";
import { Pane } from "../layout/Pane.tsx";
import { useOpenKeys } from "../useOpenKeys.ts";
import { GROUPS, groupId, partOf, type SpecItems } from "./parts.ts";

/** History's key among the history entry's open items, beside the stories' ids. */
const KEY = "history";

/** The spec's `## History`, in a pane folded to its title; nothing when the spec has none. */
export function SpecHistory({ document, items }: { document: Document; items: SpecItems }) {
  const keys = useOpenKeys();
  const part = partOf(items, "History");
  const list = useMemo(
    () =>
      part ? [{ ids: [part.heading, ...part.blocks], key: KEY, label: GROUPS.history.title }] : [],
    [part],
  );
  const folds: Folds | undefined =
    list.length > 0 ? { list, onOpenChange: keys.onOpenChange, open: keys.open } : undefined;
  // A link to the part's heading, the pane's id, or to a block in it, opens it and lands there.
  useHashFold(document, folds);
  if (!part) {
    return null;
  }
  return (
    <Pane
      fold={{
        isOpen: keys.open.includes(KEY),
        onOpenChange: (isOpen) => keys.onOpenChange(KEY, isOpen),
      }}
      icon="uraeda:history"
      id={groupId(items, GROUPS.history)}
      title={GROUPS.history.title}
    >
      <Blocks document={document} ids={part.blocks} />
    </Pane>
  );
}
