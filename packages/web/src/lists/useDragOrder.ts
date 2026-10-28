// The dragging of the shared list: dnd-kit's sensors and announcements, and the order of each
// section's rows while a drag goes on. A row drags with the rows nested under it, which leave the
// list until it is dropped; where the list nests, how far it is dragged sideways sets the depth it
// lands at, which it shows as it goes. The list as the drag found it is held until its move is
// written: a live update waits for the drag's end.
import { move } from "@dnd-kit/helpers";
import {
  type DragDropManager,
  type DragDropProvider,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
} from "@dnd-kit/react";
import { Accessibility, PointerActivationConstraints } from "@dnd-kit/dom";
import { type ComponentProps, useRef, useState } from "react";
import { type Order, spotOf } from "../drop.ts";

/**
 * A row as a drag sees it: its depth and its line, none for a line, and whether nothing nests
 * under it.
 */
type DragRow = { depth?: number; isFixed?: boolean; key: string; parent?: string; text: string };

/**
 * What a drag needs of a section: its id, its title, its rows, nested ones after their line, and
 * whether it stays.
 */
export interface DragSection {
  id: string;
  isFixed?: boolean;
  rows: ReadonlyArray<DragRow>;
  title: string;
}

/**
 * Moves a row: to `section`, at `index` among that section's rows on screen once the row is taken
 * out of them, `Number.MAX_SAFE_INTEGER` for its end. Resolves once the move is written, `false`
 * when it was refused.
 */
export type OnMove = (
  row: string,
  section: string,
  index: number,
) => Promise<boolean | void> | boolean | void;

/**
 * Where a drop puts a row: in `section`, at `depth`, 0 for a line; under the row `parent` at a depth
 * past 0. `index` is its place among the lines, or among `parent`'s own rows, once it left them.
 */
export type Dropped = { depth: number; index: number; parent?: string; section: string };

/** A drop: resolves once written, `false` when it was refused. */
export type OnDrop = (row: string, to: Dropped) => Promise<boolean | void> | boolean | void;

/** How far a depth is tabbed in: a nested row's padding (see `Card`), in rem. */
const INDENT_REM = 1.5;

/** How far a depth is tabbed in, in pixels, at the page's font size. */
const tabOf = () => parseFloat(getComputedStyle(document.documentElement).fontSize) * INDENT_REM;

/**
 * Where a drop placed a row until the file has it: its depth, and its line, for a nested row.
 * `parent` is absent for a line.
 */
export type Placed = { depth: number; parent?: string };

/** The rows of each section that moves, by key, in order: what a drag reorders. */
function orderOf(sections: ReadonlyArray<DragSection>): Order {
  return Object.fromEntries(
    sections
      .filter((section) => !section.isFixed)
      .map((section) => [section.id, section.rows.map((row) => row.key)]),
  );
}

/** The keys after `key` in `keys` that are nested under it: deeper, up to the next that is not. */
function nestedAfter(keys: ReadonlyArray<string>, key: string, depthOf: (key: string) => number) {
  const at = keys.indexOf(key);
  const depth = depthOf(key);
  const end = keys.findIndex((other, index) => index > at && depthOf(other) <= depth);
  return keys.slice(at + 1, end === -1 ? undefined : end);
}

/**
 * Where `key` lands in `order` at `depth`: its section, and its place among the lines, or among
 * the rows of the row it goes under, the nearest one above it a level less deep. `undefined` when
 * it is in no section, or there is none to go under.
 */
export function droppedAt(
  order: Order,
  key: string,
  depth: number,
  depthOf: (key: string) => number,
): Dropped | undefined {
  const spot = spotOf(order, key);
  if (!spot) {
    return undefined;
  }
  const keys = order[spot.section];
  const before = keys.slice(0, spot.index);
  if (depth === 0) {
    const index = before.filter((other) => depthOf(other) === 0).length;
    return { depth, index, section: spot.section };
  }
  const at = before.findLastIndex((other) => depthOf(other) === depth - 1);
  if (at === -1) {
    return undefined;
  }
  const index = before.slice(at + 1).filter((other) => depthOf(other) === depth).length;
  return { depth, index, parent: keys[at], section: spot.section };
}

/** Whether two drops put a row in the same place. */
const isSame = (one: Dropped | undefined, other: Dropped) =>
  one !== undefined &&
  one.section === other.section &&
  one.depth === other.depth &&
  one.parent === other.parent &&
  one.index === other.index;

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

/** The row of a dragged element, the frame it draws in: what is tabbed to the depth it would land at. */
const frameOf = (element: Element | undefined) =>
  element?.querySelector<HTMLElement>(":scope > [data-row-frame]") ?? undefined;

/**
 * A drag as it started: the drop it calls, the order it found, and the dragged row's depth, the
 * left of its text's frame on screen, and its nested rows.
 */
type Start = {
  depth: number;
  left: number;
  nested: ReadonlyArray<string>;
  onDrop?: OnDrop;
  order: Order;
};

/**
 * A drag of a row: the sections as the drag found them, held until its move is written, each
 * section's keys in the order dragged, the depths a drop changed until then, and the provider's
 * props. A drop calls the `onDrop` of the sections it started from, so the move is written over the
 * version the drag saw. With `canNest`, the row lands at the depth it is dragged to sideways.
 */
export function useDragOrder<Section extends DragSection>(
  live: ReadonlyArray<Section>,
  onDrop: OnDrop | undefined,
  canNest: boolean,
) {
  const [held, setHeld] = useState<ReadonlyArray<Section>>();
  const [dragged, setDragged] = useState<Order>();
  const [placed, setPlaced] = useState<ReadonlyMap<string, Placed>>(new Map());
  const before = useRef<Start>(undefined);
  const after = useRef<Order>(undefined);
  // The depth the pointer asks for, sideways: the row lands at the nearest its neighbours allow.
  const wanted = useRef(0);
  // Which drag is the last one: a drag's end lets the list go only if no other started since.
  const drags = useRef(0);
  const sections = held ?? live;
  const order = dragged ?? orderOf(sections);
  const rows = new Map(sections.flatMap((section) => section.rows.map((row) => [row.key, row])));
  const depthOf = (key: string) => rows.get(key)?.depth ?? 0;

  /**
   * The depth `key` lands at in `now` when dragged to `depth`: at most one deeper than the row
   * above it, never under a row that stays as it is, and at least as deep as the row below it.
   */
  const landing = (now: Order, key: string, depth: number) => {
    const spot = spotOf(now, key);
    if (!spot || !canNest) {
      return before.current?.depth ?? 0;
    }
    const keys = now[spot.section];
    const above = keys[spot.index - 1];
    const below = keys[spot.index + 1];
    const deepest = above === undefined ? 0 : depthOf(above) + (rows.get(above)?.isFixed ? 0 : 1);
    const least = below === undefined ? 0 : Math.min(depthOf(below), deepest);
    return Math.max(least, Math.min(deepest, depth));
  };

  /** Draws the dragged row tabbed to where it lands, under the pointer `by` sideways. */
  const snap = (element: Element | undefined, depth: number, by: number) => {
    const frame = frameOf(element);
    const list = document.querySelector("[data-dnd-placeholder]")?.closest("ul");
    if (!frame || !list || !canNest) {
      return;
    }
    const left = list.getBoundingClientRect().left;
    const at = (before.current?.left ?? left) + by;
    frame.style.translate = `${left + depth * tabOf() - at}px 0`;
  };
  // How far sideways the pointer went, as last seen.
  const sideways = useRef(0);

  const release = (drag: number) => {
    if (drag !== drags.current) {
      return;
    }
    before.current = undefined;
    after.current = undefined;
    setDragged(undefined);
    setHeld(undefined);
    setPlaced(new Map());
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const drag = drags.current;
    const start = before.current;
    const key = String(event.operation.source?.id ?? "");
    const frame = frameOf(event.operation.source?.element);
    if (frame) {
      frame.style.translate = "";
    }
    const now = after.current;
    const to =
      start && !event.canceled && now
        ? droppedAt(now, key, landing(now, key, wanted.current), depthOf)
        : undefined;
    if (start?.onDrop && to && !isSame(droppedAt(start.order, key, start.depth, depthOf), to)) {
      // Where it was dropped until written: its nested rows back under it, each as deep as it is
      // under it, under the line it went to.
      const shift = to.depth - start.depth;
      const keys = now?.[to.section] ?? [];
      const at = keys.indexOf(key) + 1;
      setDragged({ ...now, [to.section]: [...keys.slice(0, at), ...start.nested, ...keys.slice(at)] });
      const line = to.parent === undefined ? key : (rows.get(to.parent)?.parent ?? to.parent);
      setPlaced(
        new Map([
          [key, { depth: to.depth, ...(to.parent === undefined ? {} : { parent: line }) }],
          ...start.nested.map((one) => [one, { depth: depthOf(one) + shift, parent: line }] as const),
        ]),
      );
      // A write that throws lets the list go too: what it showed ahead of the file goes.
      await Promise.resolve(start.onDrop(key, to)).catch(() => undefined);
    }
    release(drag);
  };

  const onDragOver = (event: DragOverEvent, manager: DragDropManager) => {
    if (!after.current) {
      return;
    }
    after.current = move(after.current, event);
    setDragged(after.current);
    // New neighbours allow other depths: the row is drawn at the one it would land at now.
    const key = String(manager.dragOperation.source?.id ?? "");
    snap(
      manager.dragOperation.source?.element,
      landing(after.current, key, wanted.current),
      sideways.current,
    );
  };

  /**
   * The depth the row would land at, from where it is dragged sideways against its list: one tab
   * a level (see `landing`). Its row is drawn tabbed to it, under the pointer.
   */
  const onDragMove = (event: DragMoveEvent, manager: DragDropManager) => {
    const source = manager.dragOperation.source;
    const list = document.querySelector("[data-dnd-placeholder]")?.closest("ul");
    if (!canNest || !after.current || !list) {
      return;
    }
    // Where its row is: where it started, as far sideways as the pointer goes, which the operation
    // has not taken in yet.
    const { position } = manager.dragOperation;
    sideways.current = (event.to?.x ?? position.current.x) - position.initial.x;
    const left = list.getBoundingClientRect().left;
    const at = (before.current?.left ?? left) + sideways.current;
    wanted.current = Math.round((at - left) / tabOf());
    const key = String(source?.id ?? "");
    snap(source?.element, landing(after.current, key, wanted.current), sideways.current);
  };

  const onDragStart = (event: DragStartEvent) => {
    drags.current += 1;
    const key = String(event.operation.source?.id ?? "");
    const found = orderOf(live);
    const spot = spotOf(found, key);
    // The rows nested under it go with it: out of the list until it is dropped.
    const nested = spot ? nestedAfter(found[spot.section], key, depthOf) : [];
    const order = spot
      ? {
          ...found,
          [spot.section]: found[spot.section].filter((other) => !nested.includes(other)),
        }
      : found;
    wanted.current = depthOf(key);
    sideways.current = 0;
    const left = frameOf(event.operation.source?.element)?.getBoundingClientRect().left ?? 0;
    before.current = { depth: depthOf(key), left, nested, onDrop, order };
    after.current = order;
    setHeld(live);
    setDragged(order);
  };

  const titles = new Map(sections.map((section) => [section.id, section.title] as const));
  // oxlint-disable-next-line react/refs -- before the code quality decision: read by the announcer's callbacks during a drag, not while rendering
  const announcements = announcer(() => ({ order: after.current ?? order, titles }));
  return {
    isDragging: dragged !== undefined,
    placed,
    order,
    provider: {
      onDragEnd: (event: DragEndEvent) => void onDragEnd(event),
      onDragMove,
      onDragOver,
      onDragStart,
      plugins: plugins(announcements),
      sensors: SENSORS,
    },
    sections,
  };
}
