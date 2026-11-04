// The conflict bar: over each conflict git wrote into the text, a bar with "Use origin/main", "Use
// main", and "Use both", its sides named by branch, each replacing the block in the editor's text,
// as typing would: the text stays editable, and unsaved until the human saves it. CodeMirror draws
// the bar among its own lines, where React and Astryx's Button cannot render: its buttons are the
// browser's, styled from the Astryx theme's tokens, as the editor's look is (`theme.ts`), an Astryx
// gap the plan lists.
import { type EditorState, type Extension, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { type ConflictChoice, chosenLines, conflictsIn } from "./conflicts.ts";

/** The names of a conflict's sides: git's stage 2, `ours`, and its stage 3, `theirs`. */
export type SideLabels = { ours: string; theirs: string };

/** Replaces the `index`th block of the editor's text, as it is now, by `choice`. */
function choose(view: EditorView, index: number, choice: ConflictChoice) {
  const text = view.state.doc.toString();
  const block = conflictsIn(text)[index];
  if (block) {
    view.dispatch({
      changes: { from: block.from, insert: chosenLines(text, block, choice), to: block.to },
      userEvent: "input",
    });
    view.focus();
  }
}

/** The bar over the `index`th block. */
class Bar extends WidgetType {
  readonly labels: SideLabels;
  readonly index: number;

  constructor(labels: SideLabels, index: number) {
    super();
    this.labels = labels;
    this.index = index;
  }

  override eq(other: Bar) {
    return (
      other.index === this.index &&
      other.labels.ours === this.labels.ours &&
      other.labels.theirs === this.labels.theirs
    );
  }

  toDOM(view: EditorView) {
    const bar = document.createElement("div");
    bar.className = "cm-conflict-bar";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", `Conflict ${this.index + 1}`);
    const sides: Array<[string, ConflictChoice]> = [
      [`Use ${this.labels.ours}`, "ours"],
      [`Use ${this.labels.theirs}`, "theirs"],
      ["Use both", "both"],
    ];
    for (const [label, choice] of sides) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => choose(view, this.index, choice));
      bar.append(button);
    }
    return bar;
  }

  // The bar's clicks are its buttons', not the editor's to place the cursor.
  override ignoreEvent() {
    return true;
  }
}

/** A bar over each block of the state's text. */
function barsOf(state: EditorState, labels: SideLabels): DecorationSet {
  const blocks = conflictsIn(state.doc.toString());
  return Decoration.set(
    blocks.map((block, index) =>
      Decoration.widget({ block: true, side: -1, widget: new Bar(labels, index) }).range(
        block.from,
      ),
    ),
  );
}

/** The bar's look: a muted strip, its buttons as Astryx's small ghost buttons. */
const barTheme = EditorView.baseTheme({
  ".cm-conflict-bar": {
    backgroundColor: "var(--color-background-muted)",
    display: "flex",
    flexWrap: "wrap",
    fontFamily: "var(--font-family-body)",
    gap: "var(--spacing-1)",
    padding: "var(--spacing-1) var(--spacing-2)",
  },
  ".cm-conflict-bar button": {
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "var(--radius-element)",
    color: "var(--color-text-primary)",
    cursor: "pointer",
    font: "inherit",
    fontSize: "var(--font-size-sm)",
    fontWeight: "var(--font-weight-medium)",
    padding: "var(--spacing-0-5) var(--spacing-2)",
  },
  ".cm-conflict-bar button:focus-visible": {
    outline: "2px solid var(--color-accent)",
    outlineOffset: "1px",
  },
  ".cm-conflict-bar button:hover": { backgroundColor: "var(--color-background-gray)" },
});

/** The conflict bar, its sides named `labels`. */
export function conflictBar(labels: SideLabels): Extension {
  const bars = StateField.define<DecorationSet>({
    create: (state) => barsOf(state, labels),
    provide: (field) => EditorView.decorations.from(field),
    update: (value, transaction) =>
      transaction.docChanged ? barsOf(transaction.state, labels) : value,
  });
  return [bars, barTheme];
}
