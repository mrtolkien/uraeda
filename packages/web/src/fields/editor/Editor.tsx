// The one editor every text field is (Text editing decision): CodeMirror's view, Markdown
// highlighted, lines wrapped, in a terminal's look. It owns the field's element, its accessible name,
// its keys (keys.ts), and its Escape; the caller owns its text, as a controlled field's.
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { Annotation, Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  placeholder as placeholderText,
  type ViewUpdate,
} from "@codemirror/view";
import {
  type Ref,
  type RefObject,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { isLayerOpen } from "../../keys/layers.ts";
import { fieldKeys } from "./keys.ts";
import { markdown } from "./markdown.ts";
import { setFocused, setPlace, type Place } from "./modeStore.ts";
import { oneLine } from "./oneLine.ts";
import { type EditorActions, mountEditor, slotContent, vimSlot } from "./slot.ts";
import { editorTheme, sizeTheme } from "./theme.ts";

/** What a caller reaches of its field. */
export type EditorHandle = {
  element(): HTMLElement | null;
  focus(): void;
  /** Inserts text at the cursor, as typed. */
  insertText(text: string): void;
  view(): EditorView | null;
};

export type EditorProps = {
  /** The content element's id, as a field's own: `document.getElementById(id)?.focus()` works. */
  id?: string;
  isAutoFocused?: boolean;
  isDisabled?: boolean;
  /** The field's accessible name, on its content element. */
  label: string;
  onChange: (value: string) => void;
  /** Enter's action, Shift+Enter aside: in a one-line field, which never breaks its line, or any. */
  onEnter?: () => void;
  /**
   * Escape's action, outside Vim's insert and visual modes: `"pass"` leaves the key to what holds
   * the field. Its default leaves the field, keeping the text, or inside a layer, like a dialog,
   * passes, so the layer's Escape closes it. `leave` takes the focus out of the field.
   */
  onEscape?: (leave: () => void) => "handled" | "pass";
  onFocus?: () => void;
  /** Takes a paste first: `true` says it took it, as an image a field attaches. */
  onPaste?: (event: ClipboardEvent) => boolean;
  /** Ctrl+Enter's and Cmd+Enter's action, in every variant. */
  onSubmit?: () => void;
  placeholder?: string;
  ref?: Ref<EditorHandle>;
  /** A several-lines field's height, in lines, scrolling past them. */
  rows?: number;
  value: string;
  variant: "line" | "lines";
};

/** Marks a change the caller's text made, which is no typing to report back. */
const fromCaller = Annotation.define<boolean>();

/** The parts of a field's state its props set, each reconfigured as they change. */
const parts = {
  attributes: new Compartment(),
  editable: new Compartment(),
  placeholder: new Compartment(),
  size: new Compartment(),
};

/** The props the parts are made of. */
type PartProps = Pick<
  EditorProps,
  "id" | "isDisabled" | "label" | "placeholder" | "rows" | "variant"
>;

/** Each part's content, from the props. */
function partsOf(props: PartProps) {
  const { id, isDisabled = false, label, placeholder, rows = 3, variant } = props;
  return {
    attributes: EditorView.contentAttributes.of({
      "aria-label": label,
      "aria-multiline": String(variant === "lines"),
      ...(placeholder ? { "aria-placeholder": placeholder } : {}),
      ...(id === undefined ? {} : { id }),
    }),
    editable: [EditorView.editable.of(!isDisabled), EditorState.readOnly.of(isDisabled)],
    placeholder: placeholder ? placeholderText(placeholder) : [],
    size: [sizeTheme(variant, rows), variant === "line" ? oneLine : []],
  };
}

/** How far the field is scrolled, as Vim's ruler says it: All, Top, Bot, or a percentage. */
function progressOf({ scrollDOM: { clientHeight, scrollHeight, scrollTop } }: EditorView) {
  if (scrollHeight <= clientHeight) {
    return "All";
  }
  if (scrollTop <= 0) {
    return "Top";
  }
  const end = scrollHeight - clientHeight;
  return scrollTop >= end ? "Bot" : `${Math.round((scrollTop / end) * 100)}%`;
}

/** The cursor's place, for the status line. */
function placeOf(view: EditorView): Place {
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  return { column: head - line.from + 1, line: line.number, progress: progressOf(view) };
}

/** The field holding the focus, which alone may say that none does. */
let focusedView: EditorView | null = null;

/** Tells the mode store of a field's focus and cursor. */
function reportFocus(update: ViewUpdate) {
  const { view } = update;
  if (update.focusChanged && view.hasFocus) {
    focusedView = view;
    setFocused({ mode: "insert", ...placeOf(view) });
  } else if (update.focusChanged && focusedView === view) {
    focusedView = null;
    setFocused(null);
  } else if (
    view.hasFocus &&
    (update.selectionSet || update.docChanged || update.geometryChanged)
  ) {
    setPlace(placeOf(view));
  }
}

/** Makes the caller's text the field's, changing only what differs, so the cursor keeps its place. */
function showText(view: EditorView, value: string) {
  const doc = view.state.doc.toString();
  if (doc === value) {
    return;
  }
  let start = 0;
  while (start < doc.length && start < value.length && doc[start] === value[start]) {
    start += 1;
  }
  let [end, valueEnd] = [doc.length, value.length];
  while (end > start && valueEnd > start && doc[end - 1] === value[valueEnd - 1]) {
    end -= 1;
    valueEnd -= 1;
  }
  view.dispatch({
    annotations: fromCaller.of(true),
    changes: { from: start, insert: value.slice(start, valueEnd), to: end },
  });
}

/** A field's actions, from its latest props: what its keys and a layer's commands run. */
function actionsOf(view: EditorView, latest: { current: EditorProps }): EditorActions {
  const leave = () => view.contentDOM.blur();
  return {
    enter: () => {
      latest.current.onEnter?.();
      return latest.current.onEnter !== undefined;
    },
    escape: () => {
      const { onEscape } = latest.current;
      if (onEscape) {
        return onEscape(leave);
      }
      if (isLayerOpen(view.contentDOM)) {
        return "pass";
      }
      leave();
      return "handled";
    },
    submit: () => {
      latest.current.onSubmit?.();
      return latest.current.onSubmit !== undefined;
    },
  };
}

/** The extensions of a new field's state. */
function extensionsOf(latest: { current: EditorProps }, actions: () => EditorActions): Extension {
  const now = partsOf(latest.current);
  return [
    // First: a layer like Vim's takes its keys before the field's own.
    vimSlot.of(slotContent()),
    fieldKeys(() => ({
      ...actions(),
      enters: latest.current.onEnter !== undefined,
      line: latest.current.variant === "line",
    })),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    markdown(),
    EditorView.lineWrapping,
    editorTheme,
    ...Object.entries(parts).map(([part, compartment]) =>
      compartment.of(now[part as keyof typeof parts]),
    ),
    EditorView.domEventHandlers({
      focus: () => {
        latest.current.onFocus?.();
      },
      paste: (event) => {
        const took = latest.current.onPaste?.(event) ?? false;
        if (took) {
          event.preventDefault();
        }
        return took;
      },
      scroll: (_event, view) => {
        if (view.hasFocus) {
          setPlace(placeOf(view));
        }
      },
    }),
    EditorView.updateListener.of((update) => {
      reportFocus(update);
      if (update.docChanged && !update.transactions.some((tr) => tr.annotation(fromCaller))) {
        latest.current.onChange(update.state.doc.toString());
      }
    }),
  ];
}

/**
 * A text field: `line` wraps and grows to 9 lines, then scrolls inside, and refuses line breaks;
 * `lines` is `rows` lines tall. Ctrl+Enter runs `onSubmit`, Enter `onEnter`, Escape `onEscape`, none
 * of them while an input method composes.
 */
export function Editor(props: EditorProps) {
  const { id, isDisabled, label, placeholder, ref, rows, value, variant } = props;
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  useLayoutEffect(() => {
    // The actions need the view, which its keys, made before it, reach once it is made.
    const own: { current?: EditorActions } = {};
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: latest.current.value,
        extensions: extensionsOf(latest, () => own.current!),
      }),
    });
    own.current = actionsOf(view, latest);
    viewRef.current = view;
    const unmount = mountEditor(view, own.current);
    if (latest.current.isAutoFocused) {
      view.focus();
    }
    return () => {
      unmount();
      if (focusedView === view) {
        focusedView = null;
        setFocused(null);
      }
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (viewRef.current) {
      showText(viewRef.current, value);
    }
  }, [value]);

  useLayoutEffect(() => {
    const now = partsOf({ id, isDisabled, label, placeholder, rows, variant });
    viewRef.current?.dispatch({
      effects: Object.entries(parts).map(([part, compartment]) =>
        compartment.reconfigure(now[part as keyof typeof parts]),
      ),
    });
  }, [id, isDisabled, label, placeholder, rows, variant]);

  useImperativeHandle(
    ref,
    () => ({
      element: () => viewRef.current?.dom ?? null,
      focus: () => viewRef.current?.focus(),
      insertText: (text: string) => {
        const view = viewRef.current;
        if (view) {
          view.dispatch(view.state.replaceSelection(text), {
            scrollIntoView: true,
            userEvent: "input",
          });
        }
      },
      view: () => viewRef.current,
    }),
    [],
  );

  return <div ref={host} />;
}

/**
 * The element of the editor a handle reaches, as a ref: for what reads a field's element, like the
 * drop's target, which holds the focus while it does.
 */
export function useEditorElement(
  handle: RefObject<EditorHandle | null>,
): RefObject<HTMLElement | null> {
  return useMemo(
    () => ({
      get current() {
        return handle.current?.element() ?? null;
      },
    }),
    [handle],
  );
}
