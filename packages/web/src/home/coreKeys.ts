// The keys and the pointer of home's core, the panes above "Overview", which select its cards as a
// list selects its rows: `j k h l` and the arrows move the focus between them, up and down in a
// column, sideways to the same place of the other; the mouse moving over a card takes the focus to
// it. Down from a column's last card goes to the list under the core, as up from the list's first
// row comes back (see `WorkList`'s `onEdge`). The core takes the keys on its own cards only,
// before the page's keys, which then leave them. Each card is found by its `data-core-key`.
import { type KeyboardEvent, type PointerEvent, type RefObject, useCallback } from "react";
import { useLeaderWaits, useSingleKeys } from "../keys/registry.tsx";

/** A move of the keys among the core's cards. */
export type CoreStep = "down" | "up" | "left" | "right";

const STEPS: Record<string, CoreStep> = {
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  h: "left",
  j: "down",
  k: "up",
  l: "right",
};

/** A card's link, which takes the focus. */
const linkIn = (card: Element) => card.querySelector<HTMLElement>("a[href]");

/** The core's columns, each the links of its cards in reading order: the empty ones left out. */
function columnsOf(core: HTMLElement | null) {
  return [...(core?.querySelectorAll("[data-core-column]") ?? [])]
    .map((column) =>
      [...column.querySelectorAll("[data-core-key]")].flatMap((c) => linkIn(c) ?? []),
    )
    .filter((links) => links.length > 0);
}

/** The key of the card `element` is in, if it is in one. */
export function cardKeyOf(element: EventTarget | null) {
  // An element, which a window or a document, also event targets, is not.
  return element !== null && "closest" in element
    ? ((element as Element).closest("[data-core-key]")?.getAttribute("data-core-key") ?? undefined)
    : undefined;
}

/**
 * Puts the focus on the first or the last card of the core's column `column`, or of the last one
 * there is: whether there was one.
 */
export function focusCore(
  core: RefObject<HTMLElement | null>,
  column: number,
  at: "first" | "last",
) {
  const columns = columnsOf(core.current);
  const links = columns[Math.min(column, columns.length - 1)];
  const link = at === "first" ? links?.[0] : links?.at(-1);
  link?.focus();
  return link !== undefined;
}

/**
 * Moves the focus from the card whose key is `from` by `step`: down from a column's last card calls
 * `onLeave(column)`, which the list under it takes. Whether the card is there.
 */
export function stepCore(
  core: RefObject<HTMLElement | null>,
  from: string,
  step: CoreStep,
  onLeave: (column: number) => void,
) {
  const columns = columnsOf(core.current);
  const column = columns.findIndex((links) => links.some((link) => cardKeyOf(link) === from));
  const links = columns[column];
  if (links === undefined) {
    return false;
  }
  const at = links.findIndex((link) => cardKeyOf(link) === from);
  if (step === "down") {
    if (at < links.length - 1) {
      links[at + 1]?.focus();
    } else {
      onLeave(column);
    }
  } else if (step === "up") {
    links[Math.max(at - 1, 0)]?.focus();
  } else {
    const to = Math.min(Math.max(column + (step === "left" ? -1 : 1), 0), columns.length - 1);
    const next = columns[to] ?? [];
    next[Math.min(at, next.length - 1)]?.focus();
  }
  return true;
}

/**
 * The core's key handler, for its element: see `stepCore`. A key a sequence or the leader's menu
 * waits for is theirs: `g h`'s `h`, or `Space` then `j`, never moves the focus.
 */
export function useCoreKeys(
  core: RefObject<HTMLElement | null>,
  onLeave: (column: number) => void,
) {
  const singleKeys = useSingleKeys();
  const leaderWaits = useLeaderWaits();
  return useCallback(
    (event: KeyboardEvent) => {
      const step = STEPS[event.key];
      const isLetter = event.key.length === 1;
      const from = cardKeyOf(event.target);
      if (
        step === undefined ||
        from === undefined ||
        leaderWaits() ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        (isLetter && !singleKeys)
      ) {
        return;
      }
      if (stepCore(core, from, step, onLeave)) {
        event.preventDefault();
      }
    },
    [core, leaderWaits, onLeave, singleKeys],
  );
}

/**
 * The mouse moving over a card takes the focus to it, as over a list's row: the keys then go on
 * from it. A card scrolled under a still pointer takes nothing.
 */
export function onCorePointer(event: PointerEvent) {
  if (event.pointerType !== "mouse" || (event.movementX === 0 && event.movementY === 0)) {
    return;
  }
  const card = (event.target as Element).closest("[data-core-key]");
  const link = card && linkIn(card);
  if (link && document.activeElement !== link) {
    link.focus({ preventScroll: true });
  }
}
