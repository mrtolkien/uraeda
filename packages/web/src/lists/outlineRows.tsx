// An outline's items as the list's rows (see `useOutline`): each item's row and its nested rows,
// with their fields, edited in place, and the new row's.
import type { WorkRow } from "./Card.tsx";
import { OutlineEditor } from "./OutlineEditor.tsx";
import { FRESH, type Fresh, isPending, type OutlineItem, type Spot } from "./outline.ts";
import type { OutlineMove } from "./workSection.ts";

/** What the rows' fields call: the new row's handlers, a row's new text, and its indent. */
export type RowFields = {
  editText: (spot: Spot, key: string, text: string) => void;
  fresh: Fresh | undefined;
  freshDone: (text: string | undefined, then: "next" | "stop") => void;
  freshIndent: (isOut: boolean, text: string) => void;
  labels: { edit: string; fresh: string };
  onOutline: (spot: Spot, key: string, move: OutlineMove) => void;
};

/** The field of the row `key` at `spot`, edited in place, or the new row's. */
function editorOf(fields: RowFields, spot: Spot, key: string, value: string) {
  const { editText, fresh, freshDone, freshIndent, labels, onOutline } = fields;
  return key === FRESH
    ? () => (
        <OutlineEditor
          isNew
          // A new field at each place: the next row, or the same one indented, opens empty, or
          // with its text.
          key={`${spot.section}:${spot.index}:${spot.at ?? ""}:${spot.depth ?? ""}`}
          label={labels.fresh}
          onCancel={() => freshDone(undefined, "stop")}
          onIndent={freshIndent}
          // Enter opens the next new row; leaving the field only saves.
          onSave={(text, how) => freshDone(text, how === "enter" ? "next" : "stop")}
          value={fresh?.text ?? ""}
        />
      )
    : (hooks: { onDone: () => void }) => (
        <OutlineEditor
          label={labels.edit}
          onCancel={hooks.onDone}
          onIndent={(isOut, text) => {
            hooks.onDone();
            if (text !== "" && text !== value.trim()) {
              editText(spot, key, text);
            }
            onOutline(spot, key, isOut ? "outdent" : "indent");
          }}
          onSave={(text) => {
            hooks.onDone();
            editText(spot, key, text);
          }}
          value={value}
        />
      );
}

/**
 * The row of `item` at `spot`, with its nested rows, as the outliner draws it: its key, its
 * place, its field, and whether it is new or not written yet. `href` is where its nested rows
 * lead; a row that stays as it is keeps its nested rows as they are too.
 */
export function rowOf<Source>(
  fields: RowFields,
  item: OutlineItem<Source>,
  spot: Spot,
  href: string,
) {
  const isWritten = !isPending(item.key);
  const isNew = item.key === FRESH;
  const nested = item.children.map((child, at): WorkRow => {
    const childSpot = { ...spot, at, depth: child.depth, item: item.key };
    const isChildWritten = !isPending(child.key);
    const isChildNew = child.key === FRESH;
    return {
      depth: child.depth,
      // A row that stays as it is, a running line, keeps its nested rows as they are too.
      ...(isChildWritten && !item.isFixed
        ? { editor: editorOf(fields, childSpot, child.key, child.text) }
        : {}),
      editsInPlace: isChildWritten && !isChildNew && !item.isFixed,
      href,
      isFixed: item.isFixed === true || !isChildWritten || isChildNew,
      isFresh: isChildNew,
      key: child.key,
      lines: [],
      parent: item.key,
      spot: childSpot,
      text: child.spans.map((span) => span.text).join(""),
    };
  });
  return {
    children: nested,
    ...(isWritten ? { editor: editorOf(fields, spot, item.key, item.text) } : {}),
    isFixed: item.isFixed === true || !isWritten || isNew,
    isFresh: isNew,
    isWritten: isWritten && !isNew,
    key: item.key,
    lines: [],
    spot,
    ...(item.staysItem ? { staysLine: true } : {}),
  };
}
