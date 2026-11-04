// The conflict bar: each of its buttons takes its side into the editor's text, and none does while
// the editor is read-only, as while an agent works in the checkout.
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, expect, test } from "vite-plus/test";
import { conflictBar } from "./conflictBar.ts";

const TEXT = ["top", "<<<<<<< HEAD", "ours", "=======", "theirs", ">>>>>>> other", ""].join("\n");

let view: EditorView | undefined;
afterEach(() => view?.destroy());

/** An editor of TEXT with the bar, read-only or not. */
function editorOf(readOnly: boolean) {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc: TEXT,
      extensions: [
        conflictBar({ ours: "main", theirs: "other" }),
        EditorState.readOnly.of(readOnly),
      ],
    }),
  });
  return view;
}

const buttonOf = (editor: EditorView, label: string) =>
  [...editor.dom.querySelectorAll<HTMLButtonElement>(".cm-conflict-bar button")].find(
    (button) => button.textContent === label,
  )!;

test("a bar's button takes its side", () => {
  const editor = editorOf(false);
  buttonOf(editor, "Use other").click();
  expect(editor.state.doc.toString()).toBe("top\ntheirs\n");
});

// Review minor. Break: the bar's buttons writing into a read-only editor.
test("a read-only editor's bar takes no side", () => {
  const editor = editorOf(true);
  const button = buttonOf(editor, "Use other");
  expect(button.disabled).toBe(true);
  button.dispatchEvent(new MouseEvent("click"));
  expect(editor.state.doc.toString()).toBe(TEXT);
});
