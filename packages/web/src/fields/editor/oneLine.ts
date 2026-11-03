// A one-line field refuses line breaks: whatever inserts one, a paste, a drop, or a layer's command,
// gets a space in its place, so a pasted "first\nsecond" reads "first second".
import { type ChangeSpec, EditorState, type Extension, Transaction } from "@codemirror/state";

/** Whether a transaction inserts a line break. */
function breaksLine(transaction: Transaction) {
  let breaks = false;
  transaction.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
    breaks ||= inserted.lines > 1;
  });
  return breaks;
}

/**
 * Its changes, each line break a space: one character for one, as CodeMirror's text holds `\n`
 * alone, so the transaction's selection keeps its places.
 */
export const oneLine: Extension = EditorState.transactionFilter.of((transaction) => {
  if (!transaction.docChanged || !breaksLine(transaction)) {
    return transaction;
  }
  const changes: Array<ChangeSpec> = [];
  transaction.changes.iterChanges((from, to, _fromB, _toB, inserted) => {
    changes.push({ from, insert: inserted.sliceString(0).replaceAll("\n", " "), to });
  });
  const userEvent = transaction.annotation(Transaction.userEvent);
  return {
    annotations: userEvent === undefined ? [] : [Transaction.userEvent.of(userEvent)],
    changes,
    effects: transaction.effects,
    scrollIntoView: transaction.scrollIntoView,
    selection: transaction.selection,
  };
});
