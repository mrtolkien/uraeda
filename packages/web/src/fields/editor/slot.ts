// The editor's slot for a layer every field takes, Vim's: one compartment in each editor's state,
// filled with what is registered here, in the editors mounted then and in those mounted after. And
// each editor's own actions, by its view, which such a layer calls rather than acting itself.
import { Compartment, type Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

/**
 * The compartment of the layer, in every editor's state. Reconfiguring it keeps the state, the text
 * and the selection: a layer turned on or off never rebuilds a field.
 */
export const vimSlot = new Compartment();

/** The extensions registered, each a factory, called once per editor: each gets its own. */
const registered = new Set<() => Extension>();

/** The editors mounted now. */
const mounted = new Set<EditorView>();

/** What the slot holds in a new state, or in a state reconfigured. */
export const slotContent = (): Extension => [...registered].map((make) => make());

function refresh() {
  for (const view of mounted) {
    view.dispatch({ effects: vimSlot.reconfigure(slotContent()) });
  }
}

/**
 * Puts `extension` in every editor's slot, mounted or to come, until the returned function takes it
 * out of them.
 */
export function registerEditorExtension(extension: () => Extension) {
  registered.add(extension);
  refresh();
  return () => {
    registered.delete(extension);
    refresh();
  };
}

/** What an editor's own keys do, for a layer that runs them on keys of its own (`:w`, `:q`). */
export type EditorActions = {
  /** Enter's action in a one-line field: `false` when it has none. */
  enter(): boolean;
  /** Escape's action, as Escape outside a layer's modes runs it: leaves or cancels. */
  escape(): "handled" | "pass";
  /** Ctrl+Enter's action: `false` when the field has none. */
  submit(): boolean;
};

const actions = new WeakMap<EditorView, EditorActions>();

/** Adds an editor, with its actions, to those the slot reaches. Returns its removal. */
export function mountEditor(view: EditorView, own: EditorActions) {
  mounted.add(view);
  actions.set(view, own);
  return () => {
    mounted.delete(view);
    actions.delete(view);
  };
}

/** An editor's own actions, by its view. */
export const editorActions = (view: EditorView) => actions.get(view);
