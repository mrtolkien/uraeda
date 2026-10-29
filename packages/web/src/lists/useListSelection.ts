// The selection of a list of work (see `WorkList`): the row the address names, the keys, or the
// pointer picked, the row whose bar shows, and the row a write placed, selected again.
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { controlOf } from "./rowPointer.ts";

/**
 * The selection of the list: the key the address names, once it names one, and that card after the
 * address stops naming it, as the overlay closes. It moves with the keys and with a click.
 */
function useSelection(named: string | undefined, initial: string | undefined) {
  const [selected, setSelected] = useState(named ?? initial);
  const [seen, setSeen] = useState(named);
  if (named !== seen) {
    setSeen(named);
    if (named !== undefined) {
      setSelected(named);
    }
  }
  return [selected, setSelected] as const;
}

/**
 * The list's selection, which `onSelected` hears, and none once `clear` is a new object; and the
 * row whose bar shows, which `pick` selects with its bar.
 */
export function useListSelection({
  clear,
  initial,
  named,
  onSelected,
}: {
  clear: object | undefined;
  initial: string | undefined;
  named: string | undefined;
  onSelected: ((key: string | undefined) => void) | undefined;
}) {
  const [selected, setSelected] = useSelection(named, initial);
  // Something else on the page took the selection: none here.
  useEffect(() => {
    if (clear !== undefined) {
      setSelected(undefined);
    }
  }, [clear, setSelected]);
  const heard = useEffectEvent((key: string | undefined) => onSelected?.(key));
  useEffect(() => heard(selected), [selected]);
  // The row whose bar shows: the one the keys, a click, or a write picked, while it is selected. The
  // mouse passing over a row selects it with no bar, which would push the rows under it as it goes.
  const [barred, setBarred] = useState<string>();
  const pick = useCallback(
    (key: string) => {
      setSelected(key);
      setBarred(key);
    },
    [setSelected],
  );
  return { barred, pick, selected, setBarred, setSelected };
}

/**
 * A row a write placed elsewhere, as an indent did, is selected again where it went, with the
 * focus, once it is drawn there: each new `follow` selects it again. Not while a field is open,
 * edited or new (`isTyping`): the focus is the human's there.
 */
export function useFollow(
  follow: { key: string } | undefined,
  isTyping: boolean,
  pick: (key: string) => void,
) {
  const onFollow = useEffectEvent((key: string) => {
    if (isTyping) {
      return;
    }
    pick(key);
    // With the focus, once drawn, and in view: it may have come from elsewhere on the page.
    requestAnimationFrame(() => {
      controlOf(key)?.focus({ preventScroll: true });
      document
        .querySelector(`[data-row-key="${CSS.escape(key)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  });
  useEffect(() => {
    if (follow !== undefined) {
      onFollow(follow.key);
    }
  }, [follow]);
}
