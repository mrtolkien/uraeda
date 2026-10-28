// The rows of a list glide to their new places (see `lists/rowShifts.ts`), and their places are read
// only as something moved them: the rows' order or depths changed, or a row or the list changed
// size. happy-dom lays nothing out: each row is placed here by its section, its place in it, the
// heights of the rows above it, and its depth, and the list's sizes are reported by hand.
import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { useRowShifts } from "../lists/rowShifts.ts";

/** Each section's rows, each its key and its depth. */
type Sections = Array<Array<[key: string, depth: number]>>;

/** A row's height, by key, 20 px unless set. */
const heights = new Map<string, number>();
let listWidth = 600;
/** Each row's place read, by key. */
let reads: Array<string> = [];
/** Each glide started: its row's key and where it starts from. */
let glides: Array<[key: string, from: string]> = [];
/** What the list's sizes are reported to. */
let sized: (() => void) | undefined;

/** Where a row is: 100 px a section, the heights of the rows above it, and 24 px a depth. */
function boxOf(row: HTMLElement) {
  const section = row.parentElement!;
  const above = [...section.children].slice(0, [...section.children].indexOf(row));
  const top =
    [...section.parentElement!.children].indexOf(section) * 100 +
    above.reduce((sum, one) => sum + (heights.get((one as HTMLElement).dataset.rowKey!) ?? 20), 0);
  const left = Number(row.dataset.depth) * 24;
  return { height: 20, left, top, width: 300 } as DOMRect;
}

beforeEach(() => {
  heights.clear();
  listWidth = 600;
  reads = [];
  glides = [];
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.dataset.rowKey === undefined) {
      return { height: 400, left: 0, top: 0, width: listWidth } as DOMRect;
    }
    reads.push(this.dataset.rowKey);
    return boxOf(this);
  });
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value(this: HTMLElement, keyframes: { translate: Array<string> }) {
      glides.push([this.dataset.rowKey!, keyframes.translate[0]]);
      return { cancel: () => {}, playState: "finished" };
    },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        sized = callback;
      }
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, "animate");
});

/** A list of `sections`, its rows gliding as they move. */
function List({ isStill = false, sections }: { isStill?: boolean; sections: Sections }) {
  const ref = useRef<HTMLDivElement>(null);
  useRowShifts(ref, isStill, "stack", JSON.stringify(sections));
  return (
    <div ref={ref}>
      {sections.map((rows, at) => (
        <section key={at}>
          {rows.map(([key, depth]) => (
            <div data-depth={depth} data-row-key={key} key={key} />
          ))}
        </section>
      ))}
    </div>
  );
}

/** The list drawn with `sections`, and how to draw it again, its reads and glides from then on. */
function shown(sections: Sections) {
  const view = render(<List sections={sections} />);
  return (next: Sections, isStill = false) => {
    reads = [];
    glides = [];
    view.rerender(<List isStill={isStill} sections={next} />);
  };
}

test("a reorder glides each row that changed place from where it was", () => {
  const redraw = shown([
    [
      ["a", 0],
      ["b", 0],
      ["c", 0],
    ],
  ]);
  redraw([
    [
      ["b", 0],
      ["a", 0],
      ["c", 0],
    ],
  ]);
  expect(glides).toEqual([
    ["b", "0px 20px"],
    ["a", "0px -20px"],
  ]);
});

// Break: the rows' order read as one list, where `J` past a section's edge leaves it the same.
test("a row moved to the next section glides, though the rows run in the same order", () => {
  const redraw = shown([[["a", 0]], [["b", 0]]]);
  redraw([
    [
      ["a", 0],
      ["b", 0],
    ],
    [],
  ]);
  expect(glides).toEqual([["b", "0px 80px"]]);
});

// Break: the rows' depths left out of what is a move, where Tab moves a row sideways.
test("a row indented glides sideways", () => {
  const redraw = shown([
    [
      ["a", 0],
      ["b", 0],
    ],
  ]);
  redraw([
    [
      ["a", 0],
      ["b", 1],
    ],
  ]);
  expect(glides).toEqual([["b", "-24px 0px"]]);
});

// Break: every render reading every row's place, as the list did each time anything drew it.
test("a render that moves no row reads no row's place", () => {
  const sections: Sections = [
    [
      ["a", 0],
      ["b", 0],
    ],
  ];
  const redraw = shown(sections);
  redraw(structuredClone(sections));
  expect(reads).toEqual([]);
  expect(glides).toEqual([]);
});

test("during a drag, nothing glides", () => {
  const redraw = shown([
    [
      ["a", 0],
      ["b", 0],
    ],
  ]);
  redraw(
    [
      [
        ["b", 0],
        ["a", 0],
      ],
    ],
    true,
  );
  expect(glides).toEqual([]);
});

// Break: the places read only as the order changes, where a row's bar opening pushes the rows
// after it: they would jump, and the next move glide them from where they no longer are.
test("a row that grows glides the rows after it, and the next move starts from where they went", () => {
  const redraw = shown([
    [
      ["a", 0],
      ["b", 0],
      ["c", 0],
    ],
  ]);
  heights.set("a", 60);
  glides = [];
  sized?.();
  expect(glides).toEqual([
    ["b", "0px -40px"],
    ["c", "0px -40px"],
  ]);
  redraw([
    [
      ["a", 0],
      ["c", 0],
      ["b", 0],
    ],
  ]);
  expect(glides).toEqual([
    ["c", "0px 20px"],
    ["b", "0px -20px"],
  ]);
});

test("as the list's width changes, the rows' places are read again, and nothing glides", () => {
  const redraw = shown([
    [
      ["a", 0],
      ["b", 0],
    ],
  ]);
  listWidth = 400;
  heights.set("a", 40);
  glides = [];
  sized?.();
  expect(glides).toEqual([]);
  // Read again: the next move starts from where the rows are now.
  redraw([
    [
      ["b", 0],
      ["a", 0],
    ],
  ]);
  expect(glides).toEqual([
    ["b", "0px 40px"],
    ["a", "0px -20px"],
  ]);
});
