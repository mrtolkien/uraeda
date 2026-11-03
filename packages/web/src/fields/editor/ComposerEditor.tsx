// The composer's field: the shared editor in Astryx's `ChatComposer`, as the custom input its
// context takes. The composer's text, placeholder, and disabled state come from that context, and
// the composer's box focuses the field through its input control, as a click on its empty space.
import { type ChatComposerInputControl, useChatComposerContext } from "@astryxdesign/core/Chat";
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { Editor, type EditorHandle } from "./Editor.tsx";

/** The images a paste carries, the clipboard's files. */
const pastedFiles = (event: ClipboardEvent) => [...(event.clipboardData?.files ?? [])];

/** Puts the cursor after the text, as a click on the composer's empty space means. */
function toEnd(handle: EditorHandle | null) {
  const view = handle?.view();
  view?.dispatch({ selection: { anchor: view.state.doc.length } });
}

/**
 * Gives the composer's box the field's focus, as the input control its context holds, until the
 * returned function takes it back.
 */
function register(control: RefObject<ChatComposerInputControl | null>, focus: () => void) {
  control.current = { focus };
  return () => {
    control.current = null;
  };
}

/**
 * The composer's field: `rows` lines empty, growing upward with its text to `maxRows`, then
 * scrolling inside. Enter adds a line; Ctrl+Enter or Cmd+Enter runs `onSubmit`; Escape leaves the
 * field, keeping the draft, even inside a layer: the composer has no menu of its own (no `@` or `/`
 * triggers). A pasted image goes to `onFiles`, never into the text; a dropped one is the page's drop
 * target's, which the composer's box is. `handleRef` reaches the field, for a page that focuses it
 * or inserts text.
 */
export function ComposerEditor({
  handleRef,
  label,
  maxRows,
  onFiles,
  onSubmit,
  rows,
}: {
  handleRef?: RefObject<EditorHandle | null>;
  label: string;
  maxRows: number;
  onFiles: (files: Array<File>) => void;
  onSubmit?: () => void;
  rows: number;
}) {
  const composer = useChatComposerContext();
  const own = useRef<EditorHandle>(null);
  const handle = handleRef ?? own;
  // A draft the field opens with is written after: focused, the cursor goes after it.
  useLayoutEffect(() => toEnd(handle.current), [handle]);
  const control = composer?.inputControlRef;
  useEffect(
    () =>
      control &&
      register(control, () => {
        toEnd(handle.current);
        handle.current?.focus();
      }),
    [control, handle],
  );
  return (
    <Editor
      isDisabled={composer?.isDisabled ?? false}
      label={label}
      maxRows={maxRows}
      onChange={(value) => composer?.onChange(value)}
      onEscape={(leave) => {
        leave();
        return "handled";
      }}
      {...(onSubmit ? { onSubmit } : {})}
      onPaste={(event) => {
        const files = pastedFiles(event);
        if (files.length > 0) {
          onFiles(files);
        }
        return files.length > 0;
      }}
      placeholder={composer?.placeholder ?? label}
      ref={handle}
      rows={rows}
      value={composer?.value ?? ""}
      variant="composer"
    />
  );
}
