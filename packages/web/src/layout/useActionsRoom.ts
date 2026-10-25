import { type RefObject, useLayoutEffect, useState } from "react";

/** The least room, in px, a title keeps beside the actions: less, and it goes under them. */
const TITLE_ROOM = 160;

/**
 * Where the title goes with the actions in the top border: beside them, wrapping before them, or,
 * where they leave it less than `TITLE_ROOM`, under them. Undefined without actions, or until
 * measured.
 */
export function useActionsRoom(
  pane: RefObject<HTMLElement | null>,
  actions: RefObject<HTMLDivElement | null>,
  hasActions: boolean,
) {
  const [room, setRoom] = useState<{ height: number; under: boolean; width: number }>();
  useLayoutEffect(() => {
    const own = pane.current;
    const box = actions.current;
    if (!hasActions || !own || !box) {
      return;
    }
    const measure = () => {
      const width = Math.ceil(box.getBoundingClientRect().width);
      const height = Math.ceil(box.getBoundingClientRect().height);
      const under = own.clientWidth - width < TITLE_ROOM;
      setRoom((known) =>
        known?.width === width && known.height === height && known.under === under
          ? known
          : { height, under, width },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(own);
    observer.observe(box);
    return () => observer.disconnect();
  }, [actions, hasActions, pane]);
  return hasActions ? room : undefined;
}
