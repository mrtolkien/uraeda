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
import { type ComponentProps, type RefObject, useRef, useState } from "react";
import { type Order, spotOf } from "../drop.ts";
import { frameOf, landingOf, sidewaysOf, snapTo } from "./dragDepth.ts";
import { depthByKey, nestedEnd } from "./nesting.ts";

/**
 * A row as a drag sees it: its depth and its line, none for a line, and whether nothing nests
 * under it.
 */
type DragRow = {
  depth?: number;
  isFixed?: boolean;
  key: string;
  parent?: string;
  /** A line that lands as a line wherever it is dropped. */
  staysLine?: boolean;
  text: string;
};

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
 * button of the card other than its own, such as its bar's, never starts one.
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
      // The card's own button, the one that opens it, is the card: only another one, as its
      // bar's, is not.
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
      // The keyboard moves a line in its move mode, `m`: a card has no keyboard drag to explain.
      screenReaderInstructions: { draggable: "" },
    }),
  ];
}

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

/** The rows of the sections, by key. */
type Rows = ReadonlyMap<string, DragRow>;

/**
 * A drag of `key` as it starts in `live`, with the drop it calls and its `element`: the rows nested
 * under it go with it, out of the list until it is dropped.
 */
function startOf(
  live: ReadonlyArray<DragSection>,
  key: string,
  depthOf: (key: string) => number,
  onDrop: OnDrop | undefined,
  element: Element | undefined,
): Start {
  const found = orderOf(live);
  const spot = spotOf(found, key);
  // The keys after it nested under it: deeper, up to the next that is not.
  const keys = spot ? found[spot.section] : [];
  const at = keys.indexOf(key);
  const nested = keys.slice(at + 1, nestedEnd(keys, at, depthOf));
  const order = spot
    ? {
        ...found,
        [spot.section]: found[spot.section].filter((other) => !nested.includes(other)),
      }
    : found;
  const left = frameOf(element)?.getBoundingClientRect().left ?? 0;
  return { depth: depthOf(key), left, nested, onDrop, order };
}

/**
 * Where a drop at `to` put `key` until it is written, from the drag's `start` and the order `now`
 * it was dropped in: its nested rows back under it, each as deep as it is under it, under the line
 * it went to.
 */
function placedBy(start: Start, now: Order | undefined, key: string, to: Dropped, rows: Rows) {
  const depthOf = depthByKey(rows);
  const shift = to.depth - start.depth;
  const keys = now?.[to.section] ?? [];
  const at = keys.indexOf(key) + 1;
  const line = to.parent === undefined ? key : (rows.get(to.parent)?.parent ?? to.parent);
  return {
    order: { ...now, [to.section]: [...keys.slice(0, at), ...start.nested, ...keys.slice(at)] },
    placed: new Map<string, Placed>([
      [key, { depth: to.depth, ...(to.parent === undefined ? {} : { parent: line }) }],
      ...start.nested.map((one) => [one, { depth: depthOf(one) + shift, parent: line }] as const),
    ]),
  };
}

/**
 * The provider's handlers of the pointer during a drag of `rows`, by key, and the depth a row lands
 * at: over a new place, the order dragged, `after`, which it sets; sideways, the depth it asks for,
 * `wanted`, from how far it went, `sideways`, against where it started, `before`.
 */
function useDragPointer(
  {
    canNest,
    rows,
    setDragged,
  }: {
    canNest: boolean;
    rows: Rows;
    setDragged: (order: Order | undefined) => void;
  },
  {
    after,
    before,
    sideways,
    wanted,
  }: {
    after: RefObject<Order | undefined>;
    before: RefObject<Start | undefined>;
    sideways: RefObject<number>;
    wanted: RefObject<number>;
  },
) {
  /** The depth `key` lands at in `now` when dragged to `depth` (see `landingOf`). */
  const landing = (now: Order, key: string, depth: number) =>
    landingOf({ canNest, from: before.current?.depth, rows }, now, key, depth);
  /** Draws the dragged row tabbed to where it lands, under the pointer `by` sideways. */
  const snap = (element: Element | undefined, depth: number, by: number) =>
    snapTo(element, depth, by, before.current?.left, canNest);

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
    const pointer = sidewaysOf(event, manager, list, before.current?.left);
    sideways.current = pointer.sideways;
    wanted.current = pointer.wanted;
    const key = String(source?.id ?? "");
    snap(source?.element, landing(after.current, key, wanted.current), sideways.current);
  };

  return { landing, onDragMove, onDragOver };
}

/**
 * The provider's handlers of a drag of the `live` sections' rows, `rows` by key, with the state
 * they set: the sections held, the order dragged, and the depths a drop changed until written.
 * `after` is the order as the drag left it.
 */
function useDragEvents<Section extends DragSection>(
  {
    canNest,
    live,
    onDrop,
    rows,
  }: {
    canNest: boolean;
    live: ReadonlyArray<Section>;
    onDrop: OnDrop | undefined;
    rows: Rows;
  },
  {
    setDragged,
    setHeld,
    setPlaced,
  }: {
    setDragged: (order: Order | undefined) => void;
    setHeld: (sections: ReadonlyArray<Section> | undefined) => void;
    setPlaced: (placed: ReadonlyMap<string, Placed>) => void;
  },
) {
  const before = useRef<Start>(undefined);
  const after = useRef<Order>(undefined);
  // The depth the pointer asks for, sideways: the row lands at the nearest its neighbours allow.
  const wanted = useRef(0);
  // Which drag is the last one: a drag's end lets the list go only if no other started since.
  const drags = useRef(0);
  // How far sideways the pointer went, as last seen.
  const sideways = useRef(0);
  const depthOf = depthByKey(rows);
  const { landing, onDragMove, onDragOver } = useDragPointer(
    { canNest, rows, setDragged },
    { after, before, sideways, wanted },
  );

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
      const shown = placedBy(start, now, key, to, rows);
      setDragged(shown.order);
      setPlaced(shown.placed);
      // A write that throws lets the list go too: what it showed ahead of the file goes.
      await Promise.resolve(start.onDrop(key, to)).catch(() => undefined);
    }
    release(drag);
  };

  const onDragStart = (event: DragStartEvent) => {
    drags.current += 1;
    const key = String(event.operation.source?.id ?? "");
    const start = startOf(live, key, depthOf, onDrop, event.operation.source?.element);
    wanted.current = depthOf(key);
    sideways.current = 0;
    before.current = start;
    after.current = start.order;
    setHeld(live);
    setDragged(start.order);
  };

  return { after, onDragEnd, onDragMove, onDragOver, onDragStart };
}

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
  const sections = held ?? live;
  const order = dragged ?? orderOf(sections);
  const rows = new Map(sections.flatMap((section) => section.rows.map((row) => [row.key, row])));
  const { after, onDragEnd, onDragMove, onDragOver, onDragStart } = useDragEvents(
    { canNest, live, onDrop, rows },
    { setDragged, setHeld, setPlaced },
  );

  const titles = new Map(sections.map((section) => [section.id, section.title] as const));
  // Read by the announcer's callbacks during a drag, not while rendering.
  const announcements = announcer(() => ({ order: after.current ?? order, titles }));
  return {
    isDragging: dragged !== undefined,
    order,
    placed,
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
