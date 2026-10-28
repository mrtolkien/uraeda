// Where the keyboard's focus goes back to in a list of cards: the selected card.
import { useEffect, useRef } from "react";
import { isLayerOpen } from "../keys/layers.ts";

/**
 * Puts the keyboard's focus on the selected card: at the start with `isFocused`, and once the overlay
 * of a card closed (`named` turns undefined), which leaves the page a moment after, so the focus
 * waits for the layer rule to say it left. The same once the editor of a card closed (`held` turns
 * undefined). And once a line saved in its card, `renamed`, is the selected one and drawn under its
 * new key: `onRefocused` says it has the focus, and `focusSelected` returns whether it did.
 */
export function useRefocus({
  focusSelected,
  held,
  isFocused,
  named,
  onRefocused,
  renamed,
  selected,
}: {
  focusSelected: () => boolean;
  held: string | undefined;
  isFocused: boolean;
  named: string | undefined;
  onRefocused: () => void;
  renamed: string | undefined;
  selected: string | undefined;
}) {
  const wasNamed = useRef(named !== undefined);
  const wasHeld = useRef(held !== undefined);
  useEffect(() => {
    // The overlay closed: the card it showed is selected, and has the focus once the overlay's
    // layer, which leaves the page a moment after, no longer holds it.
    const closed =
      (wasNamed.current && named === undefined) || (wasHeld.current && held === undefined);
    wasNamed.current = named !== undefined;
    wasHeld.current = held !== undefined;
    const isRenamed = renamed !== undefined && renamed === selected;
    if (!((isFocused && selected !== undefined) || closed || isRenamed)) {
      return undefined;
    }
    let frame = 0;
    const focus = () => {
      if (isLayerOpen()) {
        frame = requestAnimationFrame(focus);
      } else {
        if (focusSelected() && isRenamed) {
          onRefocused();
        }
      }
    };
    focus();
    return () => cancelAnimationFrame(frame);
  }, [held, isFocused, named, onRefocused, renamed, selected, focusSelected]);
}
