// The dragging of the shared list: dnd-kit's sensors and announcements, and the order of each
// section's rows while a drag goes on. The list as the drag found it is held until its move is
// written: a live update waits for the drag's end.
import { move } from "@dnd-kit/helpers";
import {
  type DragDropManager,
  type DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
} from "@dnd-kit/react";
import { Accessibility, PointerActivationConstraints } from "@dnd-kit/dom";
import { type ComponentProps, useRef, useState } from "react";
import { dropMove, type Order, spotOf } from "../drop.ts";

/** What a drag needs of a section: its id, its title, its rows' keys, and whether it stays. */
export interface DragSection {
  id: string;
  isFixed?: boolean;
  rows: ReadonlyArray<{ key: string; text: string }>;
  title: string;
}

/**
 * Moves a row: to `section`, at `index` among that section's rows on screen once the row is taken
 * out of them, `Number.MAX_SAFE_INTEGER` for its end. Resolves once the move is written.
 */
export type OnMove = (row: string, section: string, index: number) => Promise<void> | void;

/** The rows of each section that moves, by key, in order: what a drag reorders. */
function orderOf(sections: ReadonlyArray<DragSection>): Order {
  return Object.fromEntries(
    sections
      .filter((section) => !section.isFixed)
      .map((section) => [section.id, section.rows.map((row) => row.key)]),
  );
}

/** What a screen reader hears of a drag: the row, and its place. */
function announcer(now: () => { order: Order; titles: Map<string, string> }) {
  const place = (manager: DragDropManager, id: unknown) => {
    const { order, titles } = now();
    const spot = spotOf(order, String(id));
    const text = String(manager.dragOperation.source?.data?.text ?? id);
    if (!spot) {
      return text;
    }
    const count = order[spot.section].length;
    return `${text}, ${spot.index + 1} of ${count} in ${titles.get(spot.section) ?? spot.section}`;
  };
  return {
    dragend: (event: DragEndEvent, manager: DragDropManager) =>
      event.operation.source
        ? event.canceled
          ? `Move cancelled: ${place(manager, event.operation.source.id)}.`
          : `Dropped: ${place(manager, event.operation.source.id)}.`
        : undefined,
    dragover: (event: DragOverEvent, manager: DragDropManager) =>
      event.operation.source ? `Moved: ${place(manager, event.operation.source.id)}.` : undefined,
    dragstart: (event: DragStartEvent, manager: DragDropManager) =>
      event.operation.source
        ? `Picked up ${place(manager, event.operation.source.id)}.`
        : undefined,
  };
}

/**
 * The sensors of a drag, from anywhere on a card: a mouse or a pen after 5 px of a press, so a
 * shorter press stays a click; a touch after half a second, with 5 px of tolerance. A press on a
 * button of the card other than its own, such as its `…`, never starts one.
 */
export const SENSORS = [
  PointerSensor.configure({
    // Anywhere on the card, not on its hidden handle (see `Card`).
    activationConstraints: (event) =>
      event.pointerType === "touch"
        ? [new PointerActivationConstraints.Delay({ tolerance: 5, value: 500 })]
        : [new PointerActivationConstraints.Distance({ value: 5 })],
    activatorElements: (source) => [source.element],
    preventActivation: (event) => {
      // The card's own button, the one that opens it, is the card: only another one, as `…`, is not.
      const button = (event.target as Element | null)?.closest("button");
      return button != null && button.closest("[data-row-link]") === null;
    },
  }),
];

/** dnd-kit's plugins, as the provider takes them: a function of its defaults. */
type PluginsOf = Extract<
  ComponentProps<typeof DragDropProvider>["plugins"],
  (...args: never) => unknown
>;

/** dnd-kit's plugins, with what a screen reader hears of a drag. */
function plugins(announcements: ReturnType<typeof announcer>): PluginsOf {
  return (defaults) => [
    ...defaults.filter((plugin) => plugin !== Accessibility),
    Accessibility.configure({
      announcements,
      // The keyboard moves a line from its card's menu: a card has no keyboard drag to explain.
      screenReaderInstructions: { draggable: "" },
    }),
  ];
}

/**
 * A drag of a row: the sections as the drag found them, held until its move is written, each
 * section's keys in the order dragged, and the provider's props. A drop calls the `onMove` of the
 * sections it started from, so the move is written over the version the drag saw.
 */
export function useDragOrder<Section extends DragSection>(
  live: ReadonlyArray<Section>,
  onMove: OnMove | undefined,
) {
  const [held, setHeld] = useState<ReadonlyArray<Section>>();
  const [dragged, setDragged] = useState<Order>();
  const before = useRef<{ onMove?: OnMove; order: Order }>(undefined);
  const after = useRef<Order>(undefined);
  const sections = held ?? live;
  const order = dragged ?? orderOf(sections);

  const release = () => {
    before.current = undefined;
    after.current = undefined;
    setDragged(undefined);
    setHeld(undefined);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const start = before.current;
    const key = event.operation.source?.id;
    const to =
      start && key !== undefined && !event.canceled && after.current
        ? dropMove(start.order, after.current, String(key))
        : undefined;
    if (start?.onMove && to) {
      await start.onMove(String(key), to.section, to.index);
    }
    release();
  };

  const onDragOver = (event: DragOverEvent) => {
    if (!after.current) {
      return;
    }
    after.current = move(after.current, event);
    setDragged(after.current);
  };

  const onDragStart = () => {
    const found = orderOf(live);
    before.current = { onMove, order: found };
    after.current = found;
    setHeld(live);
    setDragged(found);
  };

  const titles = new Map(sections.map((section) => [section.id, section.title] as const));
  // oxlint-disable-next-line react/refs -- before the code quality decision: read by the announcer's callbacks during a drag, not while rendering
  const announcements = announcer(() => ({ order: after.current ?? order, titles }));
  return {
    order,
    provider: {
      onDragEnd: (event: DragEndEvent) => void onDragEnd(event),
      onDragOver,
      onDragStart,
      plugins: plugins(announcements),
      sensors: SENSORS,
    },
    sections,
  };
}
