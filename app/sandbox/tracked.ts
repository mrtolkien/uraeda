// What the sandbox's picker knows of the views on screen. Native Shell has no inspector, so the
// picker follows the components as they draw: in a development run every component is registered
// for hot reload with its file and its name (`__nsh_hot.component`), and this wraps that
// registration, once, before any other module of the app runs. Each component's call is then
// noted with the view it returned, the component that called it, and its props, which is what a
// pick says of a view. Outside a development run there is no registration, and nothing is noted.

/**
 * A component's call: its name, its file, the call it was made in, and `at`, its turn among every
 * call: what a layer holds is called after the layer, the page under it before.
 */
export type Frame = {
  at: number;
  module: string;
  name: string;
  parent: Frame | undefined;
  props: Record<string, unknown> | undefined;
};

/** A view a component returned, as Native Shell hands it: it says where it is drawn. */
type Node = {
  measure(): Promise<{
    bounds: { size: { height: number; width: number } };
    pagePosition: { x: number; y: number };
  } | null>;
};

/** A component that returned a noted view, and the props it was called with. */
export type Call = { frame: Frame; props: Record<string, unknown> | undefined };

/**
 * What a noted view was drawn by: the component that made it first, then each that returned it
 * as its own, a library's `Surface`, then the screen's card around it.
 */
export type Drawn = { calls: Array<Call> };

/** A noted view where it is on screen. */
export type Placed = Drawn & { height: number; width: number; x: number; y: number };

type Component = (...args: Array<unknown>) => unknown;
type Hot = {
  component(module: string, name: string, fn: Component, signature: string): unknown;
};

const drawn = new WeakMap<object, Drawn>();
let nodes: Array<WeakRef<object>> = [];
/** The size of `nodes` at which the views that left are dropped from it. */
let full = 4096;
let running: Frame | undefined;
let calls = 0;

const isNode = (value: unknown): value is Node & object =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { measure?: unknown }).measure === "function";

function note(value: unknown, call: Call) {
  if (Array.isArray(value)) {
    for (const one of value) note(one, call);
    return;
  }
  if (!isNode(value)) return;
  const known = drawn.get(value);
  if (known !== undefined) {
    known.calls.push(call);
    return;
  }
  drawn.set(value, { calls: [call] });
  nodes.push(new WeakRef(value));
  if (nodes.length >= full) {
    nodes = nodes.filter((one) => one.deref() !== undefined);
    full = Math.max(4096, nodes.length * 2);
  }
}

const wrap =
  (module: string, name: string, fn: Component): Component =>
  (...args) => {
    calls += 1;
    const props = args[0] as Record<string, unknown> | undefined;
    const frame: Frame = { at: calls, module, name, parent: running, props };
    const before = running;
    running = frame;
    let made: unknown;
    try {
      made = fn(...args);
    } finally {
      running = before;
    }
    note(made, { frame, props });
    return made;
  };

/** The hot runtime's global, which Native Shell makes in a development run. */
const hot = (globalThis as Record<string, unknown>)["__nsh_hot"] as Hot | undefined;

/** Whether the components are followed: in a development run alone. */
export const followed = hot !== undefined;

if (hot !== undefined) {
  const register = hot.component.bind(hot);
  hot.component = (module, name, fn, signature) =>
    // The picker's own views are not the app's.
    register(module, name, module.includes("sandbox/") ? fn : wrap(module, name, fn), signature);
}

/** Every noted view that is on screen now, with its place in the window. */
export async function placed(): Promise<Array<Placed>> {
  const live = nodes.flatMap((one) => one.deref() ?? []);
  const places = await Promise.all(live.map((node) => (node as Node).measure().catch(() => null)));
  const found: Array<Placed> = [];
  for (const [at, place] of places.entries()) {
    const entry = drawn.get(live[at]!);
    if (place === null || entry === undefined) continue;
    const { height, width } = place.bounds.size;
    if (height <= 0 || width <= 0) continue;
    found.push({ ...entry, height, width, x: place.pagePosition.x, y: place.pagePosition.y });
  }
  return found;
}
