import { TextArea, type TextAreaProps } from "@astryxdesign/core/TextArea";
import type { KeyboardEvent } from "react";

/** The rows of each kind of field: a little more than its usual text, the same everywhere. */
const ROWS = { comment: 7, editor: 20, line: 3, notes: 12 } as const;

/**
 * The app's one text area: Astryx's `TextArea`, whose fixed height its `kind` sets, scrolling past
 * it, with the browser's resize handle. Ctrl+Enter, or Cmd+Enter, calls `onSubmit`, as its Save
 * button does. Its ref and other props go to the `TextArea`, as an image field's paste and outline
 * do.
 */
export function TextField({
  kind,
  onSubmit,
  ...props
}: Omit<TextAreaProps, "rows" | "onChange"> & {
  kind: keyof typeof ROWS;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <TextArea
      {...props}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        props.onKeyDown?.(event);
        if (
          onSubmit &&
          event.key === "Enter" &&
          (event.ctrlKey || event.metaKey) &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          onSubmit();
        }
      }}
      rows={ROWS[kind]}
    />
  );
}
