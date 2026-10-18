// The items of a list the core did not read, drawn as the spec's own lines: each takes a comment
// like any block of the page, which a list item drawn alone does not, since its list wraps it.
import type { Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Selectable, type Selection } from "../Selection.tsx";

/** Items `ids`, each as a tappable line, in their order. */
export function UnreadItems({
  document,
  ids,
  selection,
}: {
  document: Document;
  ids: ReadonlyArray<number>;
  selection: Selection | undefined;
}) {
  return ids.map((id) => {
    const item = document.blocks[id];
    return (
      item && (
        <Selectable block={item} key={id} selection={selection}>
          <Blocks document={document} ids={[id]} selection={selection} />
        </Selectable>
      )
    );
  });
}
