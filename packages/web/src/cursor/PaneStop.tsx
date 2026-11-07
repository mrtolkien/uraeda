// A whole pane as a stop of the keyboard's cursor, as a question card, the round's notes, or its
// Submit: marked a pane and a stop, its own focus ring off, ringed while held, and its keys
// declared and drawn in its bar only while held, so the three look and behave alike.
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, type RefObject, useRef } from "react";
import { pickedStyles } from "../layout/picked.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { useHeld } from "./held.ts";
import { HeldKeys, type StopKey } from "./StopKeys.tsx";
import { stopProps } from "./stops.ts";

const styles = stylex.create({
  // The pane's ring shows the cursor on it: the stop, which holds the focus, draws none of its own,
  // which would ring it twice, or once under a click.
  stop: {
    outlineStyle: "none",
  },
});

/** What a pane stop gives its element and its pane. */
export type PaneStop<T extends HTMLElement> = {
  /** Its keys' bar while held, `null` otherwise: where the pane draws it, under its content. */
  bar: ReactNode;
  held: boolean;
  /** The held look, for the box drawn as the pane, the stop itself or a card inside it. */
  look: stylex.StyleXStyles;
  /** The props of the stop's element: its marks, its focus, and where it is. */
  props: { "data-pane": ""; ref: RefObject<T | null> } & ReturnType<typeof stopProps>;
  /** The stop's own style, for its element: no focus ring of its own. */
  style: stylex.StyleXStyles;
};

/**
 * A pane as a stop: held, `keys` run before the page's, and the bar draws them, with `shown`, keys
 * the bar names but the page declares, as the round's `n`. The keys are declared only while held,
 * mounted then: a page of many cards declares nothing for the others, and the card the cursor
 * leaves lets its keys go before the next declares its own. `ref` is the stop's element where the
 * page needs it too, as Submit's row, which the bar's Submit scrolls to.
 */
export function usePaneStop<T extends HTMLElement = HTMLElement>(
  keys: ReadonlyArray<StopKey>,
  shown: ReadonlyArray<StopKey> = keys,
  ref?: RefObject<T | null>,
): PaneStop<T> {
  const own = useRef<T>(null);
  const element = ref ?? own;
  const held = useHeld(element);
  const narrow = isNarrow(useWidthClass());
  return {
    bar: held && <HeldKeys keys={keys} shown={shown} />,
    held,
    look: held && (narrow ? pickedStyles.paneNarrow : pickedStyles.pane),
    props: { "data-pane": "", ref: element, ...stopProps("pane") },
    style: styles.stop,
  };
}
