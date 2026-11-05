// The one editor every text field is (Text editing decision): CodeMirror's view, Markdown
// highlighted, lines wrapped, in a terminal's look. It owns the field's element, its accessible name,
// its keys (keys.ts), and its Escape; the caller owns its text, as a controlled field's.
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  Annotation,
  Compartment,
  EditorState,
  type Extension,
  Transaction,
} from "@codemirror/state";
import {
  EditorView,
  type KeyBinding,
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
import { setFocused } from "./modeStore.ts";
import { oneLine } from "./oneLine.ts";
import {
  type EditorActions,
  mountEditor,
  normalKeys,
  readFirst,
  slotContent,
  vimSlot,
} from "./slot.ts";
import { hearLabels } from "./labels.ts";
import { hearLeave, takeDown } from "./leave.ts";
import { editorTheme, sizeTheme } from "./theme.ts";

/** What a caller reaches of its field. */
export type EditorHandle = {
  element(): HTMLElement | null;
  focus(): void;
  /** Inserts text at the cursor, as typed. */
  insertText(text: string): void;
  view(): EditorView | null;
};

/** A key of the field's own, as `"Tab"` or `"Shift-Tab"`: `run` says whether it took the key. */
export type FieldKey = { key: string; run: () => boolean };

export type EditorProps = {
  /**
   * Attributes of the content element beyond the editor's, like a search's combobox role and the
   * list it controls.
   */
  attributes?: Readonly<Record<string, string>>;
  /** Extensions of the caller's, after the editor's own, like the conflict bar: the first render's. */
  extensions?: ReadonlyArray<Extension>;
  /** The content element's id, as a field's own: `document.getElementById(id)?.focus()` works. */
  id?: string;
  isAutoFocused?: boolean;
  isDisabled?: boolean;
  /** Read before it is edited, as a file Vim opens: Vim's mode kept at focus, normal at first. */
  isReadFirst?: boolean;
  /**
   * Keys of the field's own, before CodeMirror's, like a row's Tab that indents it or a search's
   * arrows that move its results: the first render's keys, each running its latest `run`.
   */
  keys?: ReadonlyArray<FieldKey>;
  /** The field's accessible name, on its content element. */
  label: string;
  /** The composer's tallest, in lines, which it grows to from `rows` before scrolling inside. */
  maxRows?: number;
  /**
   * Keys of the field's own in Vim's normal mode, before the engine's, like a picker's `j` and `k`
   * that move its highlighted row, bound as `keys` are. Without Vim, they are typed as text.
   */
  normalKeys?: ReadonlyArray<FieldKey>;
  /** The focus left the field, for anything but its own prompt, like Vim's `:`. */
  onBlur?: () => void;
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
  /** Vim's `:q`, where it leaves more than the field, as a buffer's page: Escape's action without. */
  onQuit?: () => void;
  /** Ctrl+Enter's and Cmd+Enter's action, in every variant; a one-line field's `onEnter` without. */
  onSubmit?: () => void;
  placeholder?: string;
  ref?: Ref<EditorHandle>;
  /** A several-lines field's height, in lines, scrolling past them; the composer's smallest. */
  rows?: number;
  value: string;
  variant: Variant;
};

/**
 * A one-line field, a several-lines one, the composer's, which grows upward from `rows` to
 * `maxRows` lines, unframed in the composer's box, or a page's, a buffer's, as tall as the room its
 * page gives it, scrolling inside.
 */
export type Variant = "line" | "lines" | "composer" | "page";

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
  | "attributes"
  | "id"
  | "isAutoFocused"
  | "isDisabled"
  | "label"
  | "maxRows"
  | "placeholder"
  | "rows"
  | "variant"
>;

/** Each part's content, from the props. */
function partsOf(props: PartProps) {
  const {
    attributes,
    id,
    isAutoFocused,
    isDisabled = false,
    label,
    maxRows,
    placeholder,
    rows = 3,
    variant,
  } = props;
  return {
    attributes: EditorView.contentAttributes.of({
      "aria-label": label,
      "aria-multiline": String(variant !== "line"),
      ...(placeholder ? { "aria-placeholder": placeholder } : {}),
      ...(id === undefined ? {} : { id }),
      // What an overlay gives its focus to once drawn (`useFieldFocus`), as Astryx's fields say.
      ...(isAutoFocused ? { "data-autofocus": "" } : {}),
      ...attributes,
    }),
    editable: [EditorView.editable.of(!isDisabled), EditorState.readOnly.of(isDisabled)],
    placeholder: placeholder ? placeholderText(placeholder) : [],
    size: [sizeTheme(variant, rows, maxRows), variant === "line" ? oneLine : []],
  };
}

/** The field holding the focus, which alone may say that none does. */
let focusedView: EditorView | null = null;

/** Tells the mode store of a field's focus. */
function reportFocus(update: ViewUpdate) {
  const { view } = update;
  if (update.focusChanged && view.hasFocus) {
    focusedView = view;
    setFocused({ mode: "insert" });
  } else if (update.focusChanged && focusedView === view) {
    focusedView = null;
    setFocused(null);
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
  const changes = view.state.changes({
    from: start,
    insert: value.slice(start, valueEnd),
    to: end,
  });
  // A cursor where the text came goes after it, as a suggestion picked fills a search's field.
  // Out of the undo history: undo takes back the human's typing, not the page's restore notice,
  // image link, or new version.
  view.dispatch({
    annotations: [fromCaller.of(true), Transaction.addToHistory.of(false)],
    changes,
    selection: view.state.selection.map(changes, 1),
  });
}

/** A field's Escape: the caller's, else leaving the field, or passing it to a layer holding it. */
function escape(view: EditorView, props: EditorProps, leave: () => void): "handled" | "pass" {
  if (props.onEscape) {
    return props.onEscape(leave);
  }
  if (isLayerOpen(view.contentDOM)) {
    return "pass";
  }
  leave();
  return "handled";
}

/** A field's actions, from its latest props: what its keys and a layer's commands run. */
function actionsOf(view: EditorView, latest: { current: EditorProps }): EditorActions {
  const leave = () => view.contentDOM.blur();
  const quit = () => {
    const { onQuit } = latest.current;
    if (onQuit) {
      onQuit();
    } else {
      escape(view, latest.current, leave);
    }
  };
  // A one-line field's Ctrl+Enter, and `:w`, is its Enter, as a row's saves it.
  const submit = () => {
    const { onEnter, onSubmit, variant } = latest.current;
    const run = onSubmit ?? (variant === "line" ? onEnter : undefined);
    run?.();
    return run !== undefined;
  };
  return {
    enter: () => {
      latest.current.onEnter?.();
      return latest.current.onEnter !== undefined;
    },
    escape: () => escape(view, latest.current, leave),
    quit,
    submit,
    submitAndQuit: () => {
      if (submit() && latest.current.variant === "line") {
        leave();
      } else {
        quit();
      }
    },
  };
}

/** The caller's `keys` or `normalKeys`, bound at the first render, each running its latest `run`. */
function ownKeys(
  latest: { current: EditorProps },
  which: "keys" | "normalKeys" = "keys",
): Array<KeyBinding & FieldKey> {
  return (latest.current[which] ?? []).map(({ key }) => ({
    key,
    run: () => latest.current[which]?.find((each) => each.key === key)?.run() ?? false,
  }));
}

/** The extensions of a new field's state. */
function extensionsOf(latest: { current: EditorProps }, actions: () => EditorActions): Extension {
  const now = partsOf(latest.current);
  return [
    // First: a layer like Vim's takes its keys before the field's own.
    vimSlot.of(slotContent()),
    readFirst.of(latest.current.isReadFirst === true),
    normalKeys.of(ownKeys(latest, "normalKeys")),
    fieldKeys(() => ({
      ...actions(),
      enters: latest.current.onEnter !== undefined,
      line: latest.current.variant === "line",
    })),
    history(),
    // Without CodeMirror's Escape, which would narrow a selection where the field's Escape leaves,
    // or passes to a dialog, which then closes on the second Escape only.
    keymap.of([
      ...ownKeys(latest),
      ...defaultKeymap.filter(({ key }) => key !== "Escape"),
      ...historyKeymap,
    ]),
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
    }),
    EditorView.updateListener.of((update) => {
      reportFocus(update);
      if (update.docChanged && !update.transactions.some((tr) => tr.annotation(fromCaller))) {
        latest.current.onChange(update.state.doc.toString());
      }
    }),
    ...(latest.current.extensions ?? []),
  ];
}

/** Reconfigures each part of the view's state as the props it is made of change. */
function useParts(viewRef: RefObject<EditorView | null>, props: PartProps) {
  const { id, isAutoFocused, isDisabled, label, maxRows, placeholder, rows, variant } = props;
  // The attributes as one value, so a caller's new object of the same attributes changes nothing.
  const attributesKey = JSON.stringify(props.attributes ?? {});
  useLayoutEffect(() => {
    const now = partsOf({
      attributes: JSON.parse(attributesKey) as Record<string, string>,
      id,
      isAutoFocused,
      isDisabled,
      label,
      maxRows,
      placeholder,
      rows,
      variant,
    });
    viewRef.current?.dispatch({
      effects: Object.entries(parts).map(([part, compartment]) =>
        compartment.reconfigure(now[part as keyof typeof parts]),
      ),
    });
  }, [
    attributesKey,
    id,
    isAutoFocused,
    isDisabled,
    label,
    maxRows,
    placeholder,
    rows,
    variant,
    viewRef,
  ]);
}

/**
 * A text field: `line` wraps and grows to 9 lines, then scrolls inside, and refuses line breaks;
 * `lines` is `rows` lines tall; `composer` grows from `rows` to `maxRows`. Ctrl+Enter runs
 * `onSubmit`, Enter `onEnter`, Escape `onEscape`, none of them while an input method composes.
 */
export function Editor(props: EditorProps) {
  const { ref, value } = props;
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
    hearLabels(view.dom.ownerDocument);
    const unhear = hearLeave(view, () => latest.current.onBlur?.());
    const unmount = mountEditor(view, own.current);
    if (latest.current.isAutoFocused) {
      view.focus();
    }
    return () => {
      unmount();
      unhear();
      if (focusedView === view) {
        focusedView = null;
        setFocused(null);
      }
      takeDown(view);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (viewRef.current) {
      showText(viewRef.current, value);
    }
  }, [value]);

  useParts(viewRef, props);

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
