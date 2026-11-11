// The keys of a part that is drawn on a page and in a dialog alike, as the run map is: on a page
// they are the registry's, declared with `useKeys`; inside a layer, which the registry leaves to
// its owner, the part hears the same bindings itself, from the handler this gives, so its keys are
// written once and do the same in both. The rules are the registry's: a key a field or a control
// already took is theirs, a text field owns its keys, a key is matched by its token (`match.ts`),
// and the single-key switch drops the bindings whose key is one printable character.
import { type KeyboardEvent, useLayoutEffect, useState, type RefObject } from "react";
import { inTextField } from "./fields.ts";
import { inLayer } from "./layers.ts";
import { isSingleKey, tokenOf } from "./match.ts";
import { type Binding, useSingleKeys } from "./registry.tsx";

/**
 * What the element holding `bindings` does with a key pressed inside it: nothing on a page, where
 * the registry runs them; inside a layer, the first binding of the key that did something. A key
 * the part binds is taken there whether or not it did something, so Enter on a part of a dialog
 * never presses it too, nor confirms the dialog, and an arrow with nowhere to go moves no caret: a
 * browser gives the focus back to a field that still holds the selection (WebKit), and a layer has
 * no page's key for it to go on to.
 */
export function useLayerKeys(bindings: ReadonlyArray<Binding>) {
  const singleKeys = useSingleKeys();
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || !inLayer(event.currentTarget) || inTextField(event.target)) {
      return;
    }
    const token = tokenOf(event.nativeEvent);
    const bound = bindings.filter(
      (binding) => binding.keys === token && (singleKeys || !isSingleKey(binding.keys)),
    );
    if (bound.length > 0) {
      event.preventDefault();
      bound.find((binding) => binding.run(event.nativeEvent) !== false);
    }
  };
}

/** Whether the element of `ref` is drawn inside a layer, known once it is in the page. */
export function useInLayer(ref: RefObject<Element | null>) {
  const [isInside, setInside] = useState(false);
  useLayoutEffect(() => setInside(inLayer(ref.current)), [ref]);
  return isInside;
}
