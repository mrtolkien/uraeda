// Where the cursor's keys take it, and how far the page scrolls: it starts from the topmost stop on
// screen, scrolls only when a stop comes within 100 px of the top bar or the status line, reads a
// stop taller than the screen to its end before leaving it, and shows a pane it enters whole when
// it fits. The geometry alone, in window pixels: a page lays nothing out in the tests.
import { expect, test } from "vite-plus/test";
import { type Box, cursorStep } from "../cursor/move.ts";

// A top bar of 60 px, the status line at 860.
const VIEW = { bottom: 860, top: 60 };

/** Stops of `height` px, one after the other from `top`, `gap` px apart. */
function column(top: number, count: number, height = 40, gap = 20): Array<Box> {
  return Array.from({ length: count }, (_, index) => {
    const start = top + index * (height + gap);
    return { bottom: start + height, top: start };
  });
}

test("with no cursor, a key takes the topmost stop on screen", () => {
  // Stops from -200: those at -200, -140, -80 and -20 end above the top bar; the one at 40 ends
  // under it, at 80, the topmost on screen, as after a scroll by Ctrl+D.
  const stops = column(-200, 20);
  const rows: Array<[string, number | null, 1 | -1, number]> = [
    ["j with no cursor", null, 1, 4],
    ["k with no cursor", null, -1, 4],
    ["j with the cursor scrolled off above", 1, 1, 4],
    ["k with the cursor scrolled off below", 19, -1, 4],
  ];
  for (const [row, current, direction, focus] of rows) {
    expect(cursorStep(stops, current, direction, VIEW)?.focus, row).toBe(focus);
  }
  expect(cursorStep([], null, 1, VIEW), "no stop").toBeNull();
  expect(cursorStep(column(900, 3), null, 1, VIEW), "no stop on screen or under it").toEqual({
    focus: 0,
    scrollBy: 900 + 40 - (860 - 100),
  });
});

test("a move scrolls only within 100 px of an edge", () => {
  const rows: Array<[string, ReadonlyArray<Box>, number, 1 | -1, number, number]> = [
    ["j, the next stop well inside", column(240, 3), 0, 1, 1, 0],
    ["k, the previous stop well inside", column(240, 3), 1, -1, 0, 0],
    // The cursor 80 px above the status line: the next stop ends 100 px above it.
    [
      "j, past the bottom margin",
      [
        { bottom: 780, top: 740 },
        { bottom: 840, top: 800 },
      ],
      0,
      1,
      1,
      80,
    ],
    [
      "k, past the top margin",
      [
        { bottom: 140, top: 100 },
        { bottom: 200, top: 160 },
      ],
      1,
      -1,
      0,
      -60,
    ],
    // Under the status line, as a stop scrolled just out of sight.
    [
      "j, under the status line",
      [
        { bottom: 760, top: 700 },
        { bottom: 960, top: 900 },
      ],
      0,
      1,
      1,
      200,
    ],
  ];
  for (const [row, stops, current, direction, focus, scrollBy] of rows) {
    expect(cursorStep(stops, current, direction, VIEW), row).toEqual({ focus, scrollBy });
  }
  expect(cursorStep(column(240, 3), 2, 1, VIEW), "j on the last stop").toBeNull();
  expect(cursorStep(column(240, 3), 0, -1, VIEW), "k on the first stop").toBeNull();
});

/** A card of 1,400 px from `top`, then a stop under it. */
const card = (top: number) => [
  { bottom: top + 1400, top },
  { bottom: top + 1460, top: top + 1420 },
];

test("a stop taller than the room scrolls through before the next", () => {
  // The card's top 100 px under the top bar. The room is 800 - 200 = 600 px: a screen less the
  // margins.
  expect(cursorStep(card(160), 0, 1, VIEW), "the first j").toEqual({ focus: 0, scrollBy: 600 });
  // 600 px on, its end is 200 px past the bottom margin.
  expect(cursorStep(card(-440), 0, 1, VIEW), "the second j").toEqual({ focus: 0, scrollBy: 200 });
  // Its end at the margin: the next j leaves it, for the stop under it, which ends 100 px above
  // the status line.
  expect(cursorStep(card(-640), 0, 1, VIEW), "the third j").toEqual({ focus: 1, scrollBy: 60 });
  // Back up, `k` reads it to its top before leaving it.
  const above = [{ bottom: 100, top: 40 }, ...card(-640).slice(0, 1)];
  expect(cursorStep(above, 1, -1, VIEW), "k at its end").toEqual({ focus: 1, scrollBy: -600 });
  // Moved onto from below, a tall stop shows its top, 100 px under the top bar.
  const onto = [...card(-1000).slice(0, 1), { bottom: 600, top: 560 }];
  expect(cursorStep(onto, 1, -1, VIEW), "k onto it").toEqual({ focus: 0, scrollBy: -1160 });
});

test("a move into another pane that fits shows it whole", () => {
  const first = { bottom: 680, id: 1, top: 100 };
  const second = { bottom: 1270, id: 2, top: 690 };
  const stops: Array<Box> = [
    { bottom: 670, pane: first, top: 630 },
    { bottom: 740, pane: second, top: 700 },
    { bottom: 1260, pane: second, top: 1220 },
  ];
  // Its stop is inside the margins, yet the pane's end is 410 px under the status line.
  expect(cursorStep(stops, 0, 1, VIEW), "into the next pane").toEqual({ focus: 1, scrollBy: 410 });
  // Within one pane, the margins alone.
  const inside = stops.map((stop) => ({ ...stop, pane: second }));
  expect(cursorStep(inside, 0, 1, VIEW), "within a pane").toEqual({ focus: 1, scrollBy: 0 });
  // A pane taller than the screen: the margins alone.
  const tall = { bottom: 2000, id: 3, top: 690 };
  const intoTall = [stops[0]!, { ...stops[1]!, pane: tall }];
  expect(cursorStep(intoTall, 0, 1, VIEW), "into a tall pane").toEqual({ focus: 1, scrollBy: 0 });
});
