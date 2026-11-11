// Run by `nsh test`, without a display. The layout's functions, as a table: each row a layout, a
// change, and what the human then sees, in one line. Then the frame itself, on the page of
// `__checks__/layout.tsx`, through real keys.
import { expect, open, test } from "nsh/test";
import {
  close,
  cross,
  fold,
  focus,
  type Layout,
  layoutOf,
  move,
  narrowed,
  type PaneRef,
  paneKey,
  type Place,
  reorder,
  reset,
  show,
  split,
  step,
  sync,
  zoom,
} from "./layout";
import { fitted } from "./Stack";

const pane = (kind: string, closes = true): PaneRef => ({
  args: {},
  closes,
  key: paneKey(kind, {}),
  kind,
});

/** A session's place: its transcript in main, three companions as tabs of side. */
const SESSION: Place = {
  main: [pane("transcript", false)],
  side: [pane("activity"), pane("changes"), pane("plan")],
};

/** A layout in one line: each stack's tabs, the shown one in brackets, the focused one starred. */
function seen(layout: Layout): string {
  const stack = (name: "main" | "side") => {
    const { panes, shown, split: isSplit } = layout[name];
    const tabs = panes.map(({ key }) => {
      const mark = key === layout.focus ? "*" : "";
      return !isSplit && key === shown ? `[${key}${mark}]` : `${key}${mark}`;
    });
    const how = isSplit ? " split" : "";
    const folded = name === "side" && layout.folded ? " folded" : "";
    return `${name}${how}${folded}: ${tabs.join(" ") || "-"}`;
  };
  const tabs = layout.onTabs ? " | on tabs" : "";
  const zoomed = layout.zoomed === null ? "" : ` | zoomed ${layout.zoomed}`;
  return `${stack("main")} | ${stack("side")}${tabs}${zoomed}`;
}

const start = layoutOf(SESSION);
const on = (key: string, from = start) => focus(from, key);

const ROWS: Array<[name: string, layout: Layout, sees: string]> = [
  ["a place opens on its default", start, "main: [transcript*] | side: [activity] changes plan"],
  // `l` and `h`.
  [
    "the focus crosses to the side stack's shown pane",
    cross(start, "side"),
    "main: [transcript] | side: [activity*] changes plan",
  ],
  [
    "crossing into a folded side stack unfolds it",
    cross(fold(start, true), "side"),
    "main: [transcript] | side: [activity*] changes plan",
  ],
  [
    "a tab pressed in the focused stack takes the focus",
    show(on("activity"), "plan"),
    "main: [transcript] | side: activity changes [plan*]",
  ],
  [
    "a tab pressed in the other stack leaves the focus",
    show(start, "changes"),
    "main: [transcript*] | side: activity [changes] plan",
  ],
  [
    "a step through the tabs keeps the focus on them",
    step({ ...on("activity"), onTabs: true }, 1) as Layout,
    "main: [transcript] | side: activity [changes*] plan | on tabs",
  ],
  // A move to the other stack.
  [
    "a pane moved to the other stack shows there, with the focus; the tab after it shows",
    move(on("changes"), "changes", "main"),
    "main: transcript [changes*] | side: activity [plan]",
  ],
  [
    "a pane moved at an index lands there",
    move(start, "plan", "main", 0),
    "main: [plan*] transcript | side: [activity] changes",
  ],
  [
    "a pane moved takes the focus: the human looks at what they moved",
    move(start, "activity", "main"),
    "main: transcript [activity*] | side: [changes] plan",
  ],
  // A move of a stack's last pane.
  [
    "the main stack's last pane stays: the subject keeps the centre",
    move(start, "transcript", "side"),
    "main: [transcript*] | side: [activity] changes plan",
  ],
  [
    "the side stack's last pane leaves it empty",
    move(move(move(start, "activity", "main"), "changes", "main"), "plan", "main"),
    "main: transcript activity changes [plan*] | side: -",
  ],
  // The focus after a pane goes.
  [
    "a closed pane gives the focus to the tab after it",
    close(on("activity"), "activity"),
    "main: [transcript] | side: [changes*] plan",
  ],
  [
    "the last tab closed gives the focus to the one before it",
    close(on("plan"), "plan"),
    "main: [transcript] | side: activity [changes*]",
  ],
  [
    "a stack's only pane closed gives the focus to the other stack",
    close(on("plan", move(move(start, "activity", "main"), "changes", "main")), "plan"),
    "main: transcript activity [changes*] | side: -",
  ],
  [
    "a pane the place requires does not close",
    close(start, "transcript"),
    "main: [transcript*] | side: [activity] changes plan",
  ],
  [
    "a pane the place no longer has goes, its focus to a neighbour, and a new one joins its stack",
    sync(on("changes"), { main: SESSION.main, side: [pane("activity"), pane("agents")] }),
    "main: [transcript] | side: [activity*] agents",
  ],
  [
    "a closed pane stays closed while the place still has it",
    sync(close(start, "plan"), SESSION),
    "main: [transcript*] | side: [activity] changes",
  ],
  // A fold with the focus inside.
  [
    "folding the side stack takes the focus out of it",
    fold(on("changes"), true),
    "main: [transcript*] | side folded: activity [changes] plan",
  ],
  [
    "unfolding leaves the focus where it is",
    fold(fold(on("changes"), true), false),
    "main: [transcript*] | side: activity [changes] plan",
  ],
  [
    "folding ends a zoom of a side pane",
    fold(zoom(on("plan"), true), true),
    "main: [transcript*] | side folded: activity changes [plan]",
  ],
  // Split, reorder, zoom, reset.
  [
    "a split stack shows every pane, and its focus stays",
    split(on("changes"), "side", true),
    "main: [transcript] | side split: activity changes* plan",
  ],
  [
    "a reorder moves a tab within its stack",
    reorder(start, "plan", 0),
    "main: [transcript*] | side: plan [activity] changes",
  ],
  [
    "a zoom is of the focused pane",
    zoom(on("plan"), true),
    "main: [transcript] | side: activity changes [plan*] | zoomed plan",
  ],
  [
    "reset gives the place's default, the fold kept",
    reset(fold(move(start, "plan", "main"), true), SESSION),
    "main: [transcript*] | side folded: [activity] changes plan",
  ],
];

test("the layout's functions", () => {
  const failed = ROWS.flatMap(([name, layout, sees]) => {
    const got = seen(layout);
    return got === sees ? [] : [`${name}:\n  expected ${sees}\n  got      ${got}`];
  });
  expect(failed.join("\n")).toBe("");
});

/** The narrow window's one stack in one line, the shown pane in brackets. */
function oneStack(layout: Layout) {
  const one = narrowed(layout);
  return one.panes.map(({ key }) => (key === one.shown ? `[${key}]` : key)).join(" ");
}

test("a narrow window's one stack, and back", () => {
  // Both stacks' panes, the main's first, the focused one shown.
  expect(oneStack(start)).toBe("[transcript] activity changes plan");
  // The narrow window's tabs step through both stacks, into the side's.
  const second = step(start, 1, true) as Layout;
  expect(oneStack(second)).toBe("transcript [activity] changes plan");
  expect(step(start, -1, true)).toBe(null);
  // Wide again, the layout is as the narrow window left it: the side stack shows the pane, focused.
  expect(seen(second)).toBe("main: [transcript] | side: [activity*] changes plan");
  // Folded on a wide window, the narrow one still holds every pane.
  expect(oneStack(fold(start, true))).toBe("[transcript] activity changes plan");
});

/** The frame's page, at a desktop's width. */
const page = (width = 1400) =>
  open("./__checks__/layout.tsx", { clock: {}, height: 800, platform: "linux", width });

/** A tab of a stack, with an icon. */
const tab = (title: string, current = false) => ({ current, icon: () => null, title });

test("a stack's tabs keep their titles while they fit, the shown one's nearest first", () => {
  const tabs = [tab("Activity"), tab("Changes", true), tab("Agents"), tab("Plan")];
  const titled = (room: number) =>
    fitted(tabs, room, 0)
      .filter((one) => one.compact !== true)
      .map((one) => one.title);
  expect(titled(0)).toEqual(["Activity", "Changes", "Agents", "Plan"]);
  expect(titled(560)).toEqual(["Activity", "Changes", "Agents", "Plan"]);
  expect(titled(420)).toEqual(["Activity", "Changes", "Agents"]);
  expect(titled(330)).toEqual(["Activity", "Changes"]);
  expect(titled(120)).toEqual(["Changes"]);
});

test("l crosses into the side stack and h comes back", async () => {
  const app = await page();
  expect(app.texts()).toContain("Focus: List");
  // `j` is the list's own while it has the focus.
  await app.keyboard.press("j");
  expect(app.texts()).toContain("List picked 1");
  await app.keyboard.press("l");
  expect(app.texts()).toContain("Focus: Activity");
  // The side stack's own `j` now, not the list's.
  await app.keyboard.press("j");
  expect(app.texts()).toContain("Activity picked 1");
  expect(app.texts()).toContain("List picked 1");
  await app.keyboard.press("h");
  expect(app.texts()).toContain("Focus: List");
  // Folded, the side stack is a rail of its panes, and `l` unfolds it on the way in.
  await app.keyboard.press("]");
  expect(app.shows("id:side-rail")).toBe(true);
  expect(app.texts()).toContain("Focus: List");
  await app.keyboard.press("l");
  expect(app.shows("id:side-rail")).toBe(false);
  expect(app.texts()).toContain("Focus: Activity");
  // `k` past the first row reaches the tabs, where `l` shows the next one, and `j` goes back in.
  await app.keyboard.press("k");
  expect(app.texts()).toContain("Activity picked 0");
  await app.keyboard.press("k");
  expect(app.texts()).not.toContain("Focus: Activity");
  expect(app.texts()).toContain("tab");
  await app.keyboard.press("l");
  expect(app.texts()).toContain("Changes picked 0");
  await app.keyboard.press("j");
  expect(app.texts()).toContain("Focus: Changes");
});

test("a pane whose tab shows again keeps its scroll", async () => {
  const app = await page();
  await app.scroll("id:pane-scroll-list", 600);
  await app.wait(100);
  const at = app.texts().find((text) => text.startsWith("List at "));
  expect(at).toBeDefined();
  await app.press("Notes");
  expect(app.shows("id:pane-scroll-list")).toBe(false);
  await app.press("List");
  await app.wait(100);
  expect(app.texts()).toContain(at);
});

test("a pane's scroll makes what it holds once", async () => {
  const app = await page();
  expect(app.texts()).toContain("Scroll made 1");
});
