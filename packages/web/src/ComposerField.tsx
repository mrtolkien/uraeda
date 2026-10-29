// The composer's field and what folds it on the phone: 7 rows empty on wide screens, 3 on the
// phone, and on the phone one line while it is empty and has no focus, Send beside it, its box on
// the glass of the bar under it.
import { ChatComposerInput, type ChatComposerInputProps } from "@astryxdesign/core/Chat";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, type RefObject, useEffect, useState } from "react";
import { AttachButton } from "./attach/AttachButton.tsx";
import { glassStyles } from "./layout/glass.ts";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";

const styles = stylex.create({
  input: { minHeight: "var(--size-composer-input)" },
  narrow: {
    minHeight: "var(--size-composer-input-narrow)",
    transitionDuration: { "@media (prefers-reduced-motion: reduce)": "0s", default: "150ms" },
    transitionProperty: "min-height",
  },
  // Folded on the phone: one line.
  folded: { minHeight: 0 },
  // The field, and Send beside it while the composer is folded.
  field: { flexGrow: 1, minWidth: 0 },
  row: { alignItems: "flex-end", display: "flex", gap: "var(--spacing-2)" },
  // Folded, the row lies over Astryx's footer, which keeps its 32 px and its gap empty (an Astryx
  // gap): one line, the field's and Send's, over it.
  foldedRow: {
    alignItems: "center",
    // The phone's composer is compact: its gap is `--spacing-1`.
    marginBlockEnd: `calc(-32px - ${spacingVars["--spacing-1"]})`,
    position: "relative",
    zIndex: 1,
  },
  // On the phone, the box alone floats over the transcript, on the glass of the bottom bar under
  // it: Astryx's own fill goes clear, so the glass shows.
  phone: {
    [colorVars["--color-background-popover"]]: "transparent",
  },
});

/**
 * The composer's field: 7 rows empty on wide screens, 3 on the phone, one while `isFolded`,
 * growing upward with its text up to 20 rows, or 9 on the phone (the UI behaviour decision), its
 * text scrolling inside them past that.
 */
function ComposerInput({
  isFolded,
  ...props
}: Omit<ChatComposerInputProps, "maxRows" | "xstyle"> & { isFolded: boolean }) {
  const wide = !isNarrow(useWidthClass());
  return (
    <ChatComposerInput
      {...props}
      maxRows={wide ? 20 : 9}
      xstyle={wide ? styles.input : [styles.narrow, isFolded && styles.folded]}
    />
  );
}

/** The paperclip, which adds its files to the message. */
export function paperclip(isDisabled: boolean, onFiles: (files: Array<File>) => void) {
  return <AttachButton isDisabled={isDisabled} isIconOnly multiple onFiles={onFiles} />;
}

/**
 * The field, with `send` beside it while `isFolded`: it keeps its place either way, so the focus and
 * the text stay with it.
 */
export function FoldingField({
  isFolded,
  send,
  ...props
}: Parameters<typeof ComposerInput>[0] & { send: ReactNode }) {
  return (
    <div {...stylex.props(styles.row, isFolded && styles.foldedRow)}>
      <div {...stylex.props(styles.field)}>
        <ComposerInput isFolded={isFolded} {...props} />
      </div>
      {isFolded && send}
    </div>
  );
}

/**
 * Whether the phone's composer folds to one line, its field and Send, so the transcript keeps the
 * screen: while it is empty and nothing inside it has the focus. A press inside opens it too, since
 * a phone may not focus the button pressed, and it folds a moment after the focus leaves, once a
 * press that moved it inside has landed, or a moment after a press that left no focus inside, as
 * on a disabled composer.
 */
export function useFolded(box: RefObject<HTMLDivElement | null>, canFold: boolean) {
  const [isInside, setInside] = useState(false);
  useEffect(() => {
    const element = box.current;
    if (!element) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const enter = () => {
      clearTimeout(timer);
      setInside(true);
    };
    const pressed = () => {
      enter();
      timer = setTimeout(() => setInside(element.contains(document.activeElement)), 1000);
    };
    const leave = (event: FocusEvent) => {
      if (element.contains(event.relatedTarget as Node | null)) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => setInside(element.contains(document.activeElement)), 300);
    };
    element.addEventListener("focusin", enter);
    element.addEventListener("pointerdown", pressed);
    element.addEventListener("focusout", leave);
    return () => {
      clearTimeout(timer);
      element.removeEventListener("focusin", enter);
      element.removeEventListener("pointerdown", pressed);
      element.removeEventListener("focusout", leave);
    };
  }, [box]);
  return canFold && !isInside;
}

/** The phone's composer box: alone on the glass, over the transcript. */
export const phoneBoxStyles = [glassStyles.surface, glassStyles.floating, styles.phone];
