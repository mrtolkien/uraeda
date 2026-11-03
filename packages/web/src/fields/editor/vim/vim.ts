// The Vim layer, a chunk of its own that `load.ts` imports with the switch on and a fine pointer:
// CodeMirror's Vim engine in every field's slot (Text editing decision: Vim's keys come from the
// engine, never from keys handled by hand). The layer only calls the field's own actions: insert
// mode at focus, Escape in normal mode and Shift+Escape in any mode run the field's Escape, Enter
// in normal mode its Enter, `:w` `:q` `:wq` its Ctrl+Enter and Escape; a yank also reaches the
// clipboard; and the human's commands run when it starts, each refusal with its line.
import { type Extension, Prec } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { type CodeMirror, type CodeMirrorV, getCM, Vim, vim } from "@replit/codemirror-vim";
import { placeOf } from "../Editor.tsx";
import { type Mode, setFocused, setMode } from "../modeStore.ts";
import { editorActions } from "../slot.ts";

type CM = CodeMirror;

/** The engine's editor, as its commands type it. */
const withVim = (cm: CM) => cm as unknown as CodeMirrorV;

/** Whether the engine's line at the field's foot is its prompt, `:` or `/`, not a message. */
const prompting = (cm: CM) => Boolean(cm.state.dialog?.querySelector("input"));

/** The engine's mode, as the status line names it. */
function modeOf(cm: CM): Mode {
  const state = cm.state.vim;
  if (prompting(cm)) {
    return "command";
  }
  if (!state || state.insertMode) {
    return cm.state.overwrite ? "replace" : "insert";
  }
  if (state.visualMode) {
    return state.visualLine ? "visual-line" : state.visualBlock ? "visual-block" : "visual";
  }
  return "normal";
}

/** Whether the engine waits for more keys, like after `d`, `"a`, or `3`: Escape only drops them. */
function pending(cm: CM) {
  const input = cm.state.vim?.inputState;
  return Boolean(
    input &&
    (input.operator ||
      input.registerName ||
      input.keyBuffer.length > 0 ||
      input.prefixRepeat.length > 0),
  );
}

/** The view of the engine's editor, which its commands get. */
const viewOf = (cm: CM) => (cm as unknown as { cm6: EditorView }).cm6;

/**
 * A command's field action, run once the engine's prompt has closed: closing, it gives the focus
 * back to the field, which would undo `:q`'s leave.
 */
function afterPrompt(
  cm: CM,
  run: (actions: NonNullable<ReturnType<typeof editorActions>>) => void,
) {
  const actions = editorActions(viewOf(cm));
  if (actions) {
    queueMicrotask(() => run(actions));
  }
}

Vim.defineEx("write", "w", (cm: CM) => afterPrompt(cm, (actions) => actions.submit()));
Vim.defineEx("quit", "q", (cm: CM) => afterPrompt(cm, (actions) => actions.escape()));
Vim.defineEx("wq", "wq", (cm: CM) =>
  afterPrompt(cm, (actions) => {
    actions.submit();
    actions.escape();
  }),
);

// A yank to the unnamed register also reaches the system clipboard; a delete never replaces what
// was copied elsewhere. `p` pastes the engine's register, as Vim does.
const registers = Vim.getRegisterController();
const push = registers.pushText.bind(registers);
registers.pushText = (name, operator, text, linewise, blockwise) => {
  push(name, operator, text, linewise, blockwise);
  if (operator === "yank" && (!name || name === '"')) {
    void navigator.clipboard?.writeText(registers.unnamedRegister.toString()).catch(() => {});
  }
};

/**
 * Runs the human's commands, like `imap jj <Esc>`, in order, over the mappings of the commands run
 * before, which go: the errors, each `Line N: <the engine's message>`.
 */
export function runCommands(lines: ReadonlyArray<string>): Array<string> {
  Vim.mapclear();
  // An editor of its own, never drawn, whose engine shows its messages here.
  const view = new EditorView({ extensions: vim() });
  const cm = getCM(view)!;
  let message: string | undefined;
  cm.openNotification = (template: Node) => {
    message ??= template.textContent ?? "";
    return () => {};
  };
  const errors: Array<string> = [];
  lines.forEach((line, index) => {
    if (line.trim() === "") {
      return;
    }
    message = undefined;
    try {
      Vim.handleEx(withVim(cm), line);
    } catch (error) {
      message ??= String(error);
    }
    if (message !== undefined) {
      errors.push(`Line ${index + 1}: ${message}`);
    }
  });
  view.destroy();
  return errors;
}

/** The field's keys before the engine's: those that run the field's own actions. */
const fieldFirst = Prec.highest(
  EditorView.domEventHandlers({
    keydown(event, view) {
      const cm = getCM(view);
      const actions = editorActions(view);
      const state = cm?.state.vim;
      if (!cm || !actions || !state || event.ctrlKey || event.metaKey || event.altKey) {
        return false;
      }
      if (event.key === "Escape" && event.shiftKey) {
        // Shift+Escape leaves from any mode; passed, it reaches the layer holding the field, as
        // the engine, which has no `<S-Esc>`, leaves it, and so do the editor's own keys.
        return actions.escape() === "handled";
      }
      const normal = !state.insertMode && !state.visualMode;
      if (event.key === "Escape" && normal && pending(cm)) {
        // Escape after `d` drops the keys typed, as Vim's does, and leaves the field alone.
        Vim.handleKey(cm, "<Esc>", "user");
        event.preventDefault();
        return true;
      }
      if (event.key === "Enter" && !event.shiftKey && normal && !pending(cm) && actions.enter()) {
        // A row's Enter saves it in normal mode too; a several-lines field's moves down a line.
        event.preventDefault();
        return true;
      }
      return false;
    },
  }),
);

/**
 * Each field's link to its engine: insert mode at focus, and the mode, read from the engine as it
 * changes, given to the mode store while the field holds the focus or its prompt is open.
 */
const modeReport = ViewPlugin.fromClass(
  class {
    cm: CM | null;
    view: EditorView;
    /** Whether the focus comes back from the engine's prompt, keeping the mode it left. */
    fromPrompt = false;
    constructor(view: EditorView) {
      this.view = view;
      this.cm = getCM(view);
      this.cm?.on("vim-mode-change", this.report);
      this.cm?.on("dialog", this.dialog);
    }
    report = () => {
      if (this.cm && (this.view.hasFocus || prompting(this.cm))) {
        setMode(modeOf(this.cm));
      }
    };
    dialog = () => {
      if (this.cm && prompting(this.cm)) {
        this.fromPrompt = true;
        setFocused({ mode: "command", ...placeOf(this.view) });
      } else {
        this.report();
      }
    };
    /** At focus, insert mode, unless the focus comes back from the prompt. */
    focus() {
      const { cm } = this;
      if (!cm || this.fromPrompt) {
        this.fromPrompt = false;
        return;
      }
      if (cm.state.vim?.visualMode) {
        Vim.exitVisualMode(withVim(cm));
      }
      if (!cm.state.vim?.insertMode) {
        // Through the engine's own command, which no mapping of the human's changes.
        Vim.handleEx(withVim(cm), "startinsert");
      }
    }
    destroy() {
      this.cm?.off("vim-mode-change", this.report);
      this.cm?.off("dialog", this.dialog);
      // Vim turned off in a focused field: it types as without Vim.
      if (this.view.hasFocus) {
        setMode("insert");
      }
    }
  },
  {
    eventHandlers: {
      focus() {
        this.focus();
      },
    },
  },
);

/**
 * After the editor's own report of the focus, which says `insert`, the engine's mode; and while the
 * prompt holds the focus, the field is still the one the status line reads, in command mode.
 */
const afterFocus = Prec.lowest(
  EditorView.updateListener.of((update) => {
    const cm = getCM(update.view);
    if (!cm || !update.focusChanged) {
      return;
    }
    if (update.view.hasFocus) {
      setMode(modeOf(cm));
    } else if (prompting(cm)) {
      setFocused({ mode: "command", ...placeOf(update.view) });
    }
  }),
);

/**
 * The engine's own elements in the editor's terminal look, over the theme's tokens: the block
 * cursor in the text's colours, drawn in the focused field only, and the prompt's line under the
 * text as the field's own. Each rule outweighs the engine's and CodeMirror's own.
 */
const vimTheme = EditorView.theme({
  // The engine sets the cursor's letter's colour on the element itself.
  "&:not(.cm-focused) .cm-vimCursorLayer": { display: "none" },
  "&.cm-editor .cm-panels.cm-panels-bottom": {
    backgroundColor: "var(--color-background-muted)",
    borderTop: "var(--border-width, 1px) solid var(--color-border)",
    color: "var(--color-text-primary)",
  },
  "&.cm-editor .cm-vim-panel": {
    fontFamily: "var(--font-family-code)",
    padding: "0 var(--spacing-2)",
  },
  "&.cm-editor .cm-vim-panel input": {
    color: "inherit",
    fontFamily: "inherit",
    fontSize: "inherit",
  },
  "&.cm-focused .cm-fat-cursor": {
    background: "var(--color-text-primary)",
    color: "var(--color-background-surface) !important",
  },
});

/** The layer, for each field's slot: the engine, the field's keys before it, its look, its mode. */
export const extension = (): Extension => [
  fieldFirst,
  Prec.highest(vim()),
  vimTheme,
  modeReport,
  afterFocus,
];
