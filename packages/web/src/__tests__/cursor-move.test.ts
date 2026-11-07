// Where the cursor's keys take it, and how far the page scrolls: it starts from the topmost stop on
// screen, scrolls only when a stop comes within 100 px of the top bar or the status line, reads a
// stop taller than the screen to its end before leaving it, shows a pane it enters whole inside the
// margins when it fits, and passes the stops nested in a stop it leaves forward. The geometry
// alone, in window pixels: a page lays nothing out in the tests.
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
  // Stops from -200: those at -200, -140, -80 and -20 end above the top bar; the one at 40 only
  // peeks under it, to 80, and the one at 100 is the topmost whose top is on screen, as after a
  // scroll by Ctrl+D.
  const stops = column(-200, 20);
  const rows: Array<[string, number | null, 1 | -1, number]> = [
    ["j with no cursor", null, 1, 5],
    ["k with no cursor", null, -1, 5],
    ["j with the cursor scrolled off above", 1, 1, 5],
    ["k with the cursor scrolled off below", 19, -1, 5],
  ];
  for (const [row, current, direction, focus] of rows) {
    expect(cursorStep(stops, current, direction, VIEW)?.focus, row).toBe(focus);
  }
  expect(cursorStep(stops, null, 1, VIEW), "it scrolls into the margins").toEqual({
    focus: 5,
    scrollBy: 100 - (60 + 100),
  });
  // A stop whose top is above the view but which reaches into it, with none under it on screen.
  const tall = [{ bottom: 2000, top: -500 }];
  expect(cursorStep(tall, null, 1, VIEW), "none whose top is on screen").toEqual({
    focus: 0,
    scrollBy: -500 - (60 + 100),
  });
  // A pane that fits inside the margins, its stop inside them: the pane shows whole, its end 100 px
  // above the status line, as a move into it.
  const pane = { bottom: 1170, id: 1, top: 690 };
  expect(cursorStep([{ bottom: 740, pane, top: 700 }], null, 1, VIEW), "into a pane").toEqual({
    focus: 0,
    scrollBy: 1170 - (860 - 100),
  });
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
  // margins. Its end is 800 px past the bottom margin, no more than the screen's 800: the first j
  // shows it, as what was at the screen's bottom edge comes to its top, nothing passed by.
  expect(cursorStep(card(160), 0, 1, VIEW), "the first j").toEqual({ focus: 0, scrollBy: 800 });
  // Its end at the margin: the next j leaves it, for the stop under it, which ends 100 px above
  // the status line.
  expect(cursorStep(card(-640), 0, 1, VIEW), "the second j").toEqual({ focus: 1, scrollBy: 60 });
  // Its end a fraction of a pixel past the margin, as a layout of fractional heights leaves it:
  // read, as a scroll cannot move by less than a pixel.
  const fraction = [{ bottom: 760.03, top: -640 + 0.03 }, card(-640)[1]!];
  expect(cursorStep(fraction, 0, 1, VIEW)?.focus, "j with a fraction left").toBe(1);
  const below = [
    { bottom: 100, top: 40 },
    { bottom: 1560, top: 159.97 },
  ];
  expect(cursorStep(below, 1, -1, VIEW)?.focus, "k with a fraction left").toBe(0);
  // A card of 2,000 px is read a room at a time, then its rest in one step.
  const long = [{ bottom: 2160, top: 160 }];
  expect(cursorStep(long, 0, 1, VIEW), "a longer card's first j").toEqual({
    focus: 0,
    scrollBy: 600,
  });
  const rest = [{ bottom: 1560, top: -440 }];
  expect(cursorStep(rest, 0, 1, VIEW), "its second j").toEqual({ focus: 0, scrollBy: 800 });
  // Back up, `k` reads it to its top before leaving it, in one step as `j` did.
  const above = [{ bottom: 100, top: 40 }, ...card(-640).slice(0, 1)];
  expect(cursorStep(above, 1, -1, VIEW), "k at its end").toEqual({ focus: 1, scrollBy: -800 });
  // Moved onto from below, a tall stop shows its end, 100 px above the status line, as `j` shows
  // its top: the next `k` reads up through its body.
  const onto = [...card(-1000).slice(0, 1), { bottom: 600, top: 560 }];
  expect(cursorStep(onto, 1, -1, VIEW), "k onto it").toEqual({ focus: 0, scrollBy: -360 });
  const read = [...card(-640).slice(0, 1), { bottom: 960, top: 920 }];
  expect(cursorStep(read, 0, -1, VIEW), "the k after").toEqual({ focus: 0, scrollBy: -800 });
});

test("a move into another pane that fits inside the margins shows it whole, inside them", () => {
  const first = { bottom: 680, id: 1, top: 100 };
  const second = { bottom: 1270, id: 2, top: 690 };
  const stops: Array<Box> = [
    { bottom: 670, pane: first, top: 630 },
    { bottom: 740, pane: second, top: 700 },
    { bottom: 1260, pane: second, top: 1220 },
  ];
  // Its stop is inside the margins, yet the pane's end is 410 px under the status line: it ends
  // 100 px above it.
  expect(cursorStep(stops, 0, 1, VIEW), "into the next pane").toEqual({ focus: 1, scrollBy: 510 });
  // Up into a pane whose top is under the top bar: its top 100 px under it.
  const above = [
    { bottom: 200, pane: { bottom: 300, id: 4, top: 0 }, top: 150 },
    { bottom: 400, pane: first, top: 360 },
  ];
  expect(cursorStep(above, 1, -1, VIEW), "up into a pane").toEqual({ focus: 0, scrollBy: -160 });
  // Within one pane, the margins alone.
  const inside = stops.map((stop) => ({ ...stop, pane: second }));
  expect(cursorStep(inside, 0, 1, VIEW), "within a pane").toEqual({ focus: 1, scrollBy: 0 });
  // A pane of 700 px, which fits the screen but not inside the margins: the margins alone.
  const tall = { bottom: 1390, id: 3, top: 690 };
  const intoTall = [stops[0]!, { ...stops[1]!, pane: tall }];
  expect(cursorStep(intoTall, 0, 1, VIEW), "into a tall pane").toEqual({ focus: 1, scrollBy: 0 });
});

test("the stops nested in a stop are passed by forward, and lead to it backward", () => {
  // A question card from 100 to 700, an embed's two buttons inside it near its top, then the next
  // card. Each nested stop names the index of the stop holding it.
  const stops: Array<Box> = [
    { bottom: 700, top: 100 },
    { bottom: 180, parent: 0, top: 150 },
    { bottom: 240, parent: 0, top: 210 },
    { bottom: 800, top: 720 },
  ];
  expect(cursorStep(stops, 0, 1, VIEW)?.focus, "j from the card").toBe(3);
  expect(cursorStep(stops, 3, -1, VIEW)?.focus, "k onto the card from below").toBe(0);
  // Reached by Tab, a nested stop moves among its siblings, then out.
  expect(cursorStep(stops, 1, 1, VIEW)?.focus, "j from an embed's button").toBe(2);
  expect(cursorStep(stops, 2, 1, VIEW)?.focus, "j from the last button").toBe(3);
  expect(cursorStep(stops, 2, -1, VIEW)?.focus, "k from the second button").toBe(1);
  expect(cursorStep(stops, 1, -1, VIEW)?.focus, "k from the first button").toBe(0);
  // Nothing past the card but what it holds: the key goes on.
  expect(cursorStep(stops.slice(0, 3), 0, 1, VIEW), "j from the last card").toBeNull();
  // Nested two deep, as a fold inside an embed inside a card: k lands on the card.
  const deep: Array<Box> = [
    { bottom: 700, top: 100 },
    { bottom: 400, parent: 0, top: 150 },
    { bottom: 240, parent: 1, top: 210 },
    { bottom: 800, top: 720 },
  ];
  expect(cursorStep(deep, 3, -1, VIEW)?.focus, "k onto a card two deep").toBe(0);
  expect(cursorStep(deep, 0, 1, VIEW)?.focus, "j past two deep").toBe(3);
});
