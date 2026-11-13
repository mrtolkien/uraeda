// The text of a pick, copied to paste to the agent working on the checkout: where the app is, the
// view picked, the component that drew it and the file that wrote it, its words, and the window.
import type { Call, Frame, Placed } from "./tracked";

/** Where the app is when a view is picked. */
export type PickPlace = {
  address: string;
  height: number;
  mode: string;
  page: string;
  panes: ReadonlyArray<string>;
  repo: string | undefined;
  server: string;
  theme: string;
  width: number;
  widthClass: string;
};

/** The most of the picked view's words the text holds. */
const TEXT_MAX = 200;

/** The props that name a view, the first that holds words. */
const NAMES = ["label", "title", "children", "placeholder", "name", "testID"] as const;

/** The library's components that say nothing of where a view was written. */
const PRIMITIVES = new Set(["Icon", "Surface", "Text", "Words"]);

/** The props that hold words a view shows. */
const WORDS = ["children", "label", "title", "placeholder", "value"] as const;

/** The library's components whose children are their words, never views of the app's. */
const WORDED = new Set(["Heading", "Text", "Words"]);

/**
 * A prop's words, when it is words. A prop whose value changes is a getter, and the getter of
 * `children` draws what it holds: read here, it would draw a pane's views a second time, outside
 * their pane. So children are read where they are a plain value, or a text component's, alone.
 */
function propWords(call: Call, prop: string): string | undefined {
  const { props } = call;
  if (props === undefined || props === null) return undefined;
  try {
    const drawn = Object.getOwnPropertyDescriptor(props, prop)?.get !== undefined;
    if (prop === "children" && drawn && !WORDED.has(call.frame.name)) return undefined;
    const value = props[prop];
    if (typeof value === "number") return String(value);
    return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** A prop's words in a view, from the component that says the most of it, the last to return it. */
function wordsOf(view: Placed, prop: string): string | undefined {
  for (const call of view.calls.toReversed()) {
    const words = propWords(call, prop);
    if (words !== undefined) return words;
  }
  return undefined;
}

/** The component a view is known by: the last that returned it, a screen's over the library's. */
const known = (view: Placed) => view.calls.at(-1)!.frame;

const oneLine = (text: string, max: number) => {
  const line = text.replaceAll(/\s*\n\s*/g, " ");
  return line.length > max ? `${line.slice(0, max)}…` : line;
};

const fileOf = (frame: Frame) => `app/${frame.module.replace(/^\.?\//, "")}`;

/** Whether a component is the app's library's, which a screen's file uses, not what to fix first. */
const isLibrary = (frame: Frame) => /^(\.?\/)?ui\//.test(frame.module);

const inside = (inner: Placed, outer: Placed) =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5 &&
  inner.y + inner.height <= outer.y + outer.height + 0.5;

/** When a view was first called for: the turn of the component that made it. */
const madeAt = (view: Placed) => Math.min(...view.calls.map((call) => call.frame.at));

/**
 * Whether a view is a layer's box, a menu's, a popover's, a dialog's, a toast's: the library's
 * `Float` draws each as a `Surface` at the overlay's height.
 */
const isLayer = (view: Placed) =>
  view.calls.some((call) => {
    try {
      return call.frame.name === "Surface" && call.props?.height === "overlay";
    } catch {
      return false;
    }
  });

/**
 * The views under a point, the smallest first: the view there, then what holds it. Under a layer,
 * only what the layer holds: the page it covers is not what the pointer is on.
 */
export function under(all: ReadonlyArray<Placed>, x: number, y: number): Array<Placed> {
  const there = all.filter(
    (one) => x >= one.x && y >= one.y && x <= one.x + one.width && y <= one.y + one.height,
  );
  const layer = there.filter(isLayer).toSorted((a, b) => madeAt(b) - madeAt(a))[0];
  const seen =
    layer === undefined
      ? there
      : there.filter((one) => inside(one, layer) && madeAt(one) >= madeAt(layer));
  return seen
    .map((one, at) => ({ at, one }))
    .toSorted((a, b) => a.one.width * a.one.height - b.one.width * b.one.height || b.at - a.at)
    .map(({ one }) => one);
}

/** Whether one of the components that returned a view was given `prop` as true. */
const marked = (view: Placed, prop: string) =>
  view.calls.some((call) => {
    try {
      return call.props?.[prop] === true;
    } catch {
      return false;
    }
  });

const area = (view: Placed) => view.width * view.height;

const smallest = (views: ReadonlyArray<Placed>) => views.toSorted((a, b) => area(a) - area(b))[0];

/** Whether a call was given `prop` as true. */
const given = (frame: Frame, prop: string) => {
  try {
    return frame.props?.[prop] === true;
  } catch {
    return false;
  }
};

/** The nearest call, a view's own or one it was made in, that was given the selection. */
function selectedBy(view: Placed): Frame | undefined {
  for (const call of view.calls) {
    for (let frame: Frame | undefined = call.frame; frame !== undefined; frame = frame.parent) {
      if (given(frame, "selected")) return frame;
    }
  }
  return undefined;
}

/**
 * The selected items, each as the box around the views its component drew: a card's own view is
 * not always one a component returned, but its title and its icon are made in its call.
 */
function selectedItems(all: ReadonlyArray<Placed>): Array<Placed> {
  const boxes = new Map<Frame, Placed>();
  for (const one of all) {
    const frame = selectedBy(one);
    if (frame === undefined) continue;
    const box = boxes.get(frame);
    if (box === undefined) {
      boxes.set(frame, { ...one, calls: [{ frame, props: frame.props }] });
      continue;
    }
    const right = Math.max(box.x + box.width, one.x + one.width);
    const bottom = Math.max(box.y + box.height, one.y + one.height);
    box.x = Math.min(box.x, one.x);
    box.y = Math.min(box.y, one.y);
    box.width = right - box.x;
    box.height = bottom - box.y;
  }
  return [...boxes.values()];
}

/**
 * What the keyboard is on, then what holds it: the row or the card selected in the pane with the
 * focus, else that pane. What a pick names when the pointer was not moved, as a hand on the keys
 * means the selection, not where the mouse was left.
 */
export function selection(all: ReadonlyArray<Placed>): Array<Placed> {
  const pane = smallest(all.filter((one) => marked(one, "focused")));
  const items = selectedItems(all);
  const view =
    (pane === undefined ? items : items.filter((one) => inside(one, pane))).toSorted(
      (a, b) => a.calls[0]!.frame.at - b.calls[0]!.frame.at,
    )[0] ?? pane;
  if (view === undefined) return [];
  const holders = all
    .filter((one) => inside(view, one) && !inside(one, view))
    .toSorted((a, b) => area(a) - area(b));
  return [view, ...holders];
}

/** The view as the bar says it: its component, and its name in quotes when it has one. */
export function elementOf(view: Placed): string {
  const name = NAMES.map((prop) => wordsOf(view, prop)).find((words) => words !== undefined);
  return name === undefined ? known(view).name : `${known(view).name} “${oneLine(name, 60)}”`;
}

/** The words the views inside `view` show, as they read: by line, then along it. */
function textOf(view: Placed, all: ReadonlyArray<Placed>): string {
  const seen = new Set<string>();
  const words: Array<string> = [];
  const held = all.filter((one) => inside(one, view)).toSorted((a, b) => a.y - b.y || a.x - b.x);
  for (const one of held) {
    for (const prop of WORDS) {
      const said = wordsOf(one, prop);
      if (said === undefined || seen.has(said)) continue;
      seen.add(said);
      words.push(said);
    }
  }
  return oneLine(words.join(" · "), TEXT_MAX);
}

/**
 * The file that wrote the view: the first component that is not the library's, among those that
 * called it, else among the views that hold it on screen (what an `If` draws later has no caller).
 */
function writtenIn(chain: ReadonlyArray<Placed>): Frame | undefined {
  const first = chain[0];
  for (
    let frame: Frame | undefined = first && known(first);
    frame !== undefined;
    frame = frame.parent
  ) {
    if (!isLibrary(frame)) return frame;
  }
  const calls = chain.flatMap((one) => one.calls);
  return (
    calls.find((call) => !isLibrary(call.frame)) ??
    // The library's own, as the rail's rows: the nearest component that is more than a primitive.
    calls.find((call) => !PRIMITIVES.has(call.frame.name)) ??
    calls[0]
  )?.frame;
}

/** The nearest test id, the view's or one of a view that holds it. */
function testIdOf(chain: ReadonlyArray<Placed>): string | undefined {
  for (const one of chain) {
    const id = wordsOf(one, "testID");
    if (id !== undefined) return id;
  }
  return undefined;
}

/** The pick's text, one field a line: `chain` is the view picked, then the views that hold it. */
export function pickText(
  chain: ReadonlyArray<Placed>,
  all: ReadonlyArray<Placed>,
  place: PickPlace,
): string {
  const view = chain[0]!;
  const source = writtenIn(chain);
  const names: Array<string> = [];
  for (const { frame } of chain.flatMap((one) => one.calls)) {
    const said = `${frame.name} (${fileOf(frame)})`;
    if (names.at(-1) !== said) names.push(said);
  }
  return [
    `Sandbox pick: ${place.address}`,
    `View: repository ${place.repo ?? "none"}, page ${place.page}, panes ${place.panes.join(", ") || "none"}`,
    `Element: ${elementOf(view)}`,
    `Source: ${source === undefined ? "unknown" : `${fileOf(source)}, in ${source.name}`}`,
    `Drawn by: ${names.slice(0, 10).join(" < ")}`,
    `Test id: ${testIdOf(chain) ?? "none"}`,
    `Text: ${textOf(view, all)}`,
    `At: ${Math.round(view.x)}, ${Math.round(view.y)}, ${Math.round(view.width)} × ${Math.round(view.height)}`,
    `Window: ${Math.round(place.width)} × ${Math.round(place.height)}, ${place.widthClass}, ${place.mode} (${place.theme})`,
    `Server: ${place.server}`,
  ].join("\n");
}
