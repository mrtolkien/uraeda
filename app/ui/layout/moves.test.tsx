// Run by `nsh test`, without a display. The moves as a table, as `layout.test.ts` has the layout's
// functions: each row a layout, a move, and what the human then sees. Then the frame, on the page
// of `__checks__/moves.tsx`, through the keys of `Space w`: what a move must not lose, what a
// restart must bring back, and what a reset gives.
import { type App, expect, open, test } from "nsh/test";
import { arranged, arrangementOf } from "./arrangement";
import {
  close,
  focus,
  type Layout,
  layoutOf,
  type PaneRef,
  paneKey,
  type Place,
  zoom,
} from "./layout";
import {
  join,
  nudge,
  placeBeside,
  part,
  reopen,
  send,
  swap,
  toggleJoin,
  toggleSplit,
} from "./moves";
import { seen } from "./__checks__/seen";

const pane = (kind: string, closes = true, args: Record<string, string> = {}): PaneRef => ({
  args,
  closes,
  key: paneKey(kind, args),
  kind,
});

/** A session's place: its transcript in main, three companions as tabs of side. */
const SESSION: Place = {
  main: [pane("transcript", false)],
  side: [pane("activity"), pane("changes"), pane("plan")],
};
/** The same kind of place for another session: its panes have other arguments. */
const OTHER: Place = {
  main: [pane("transcript", false, { id: "2" })],
  side: [
    pane("activity", true, { id: "2" }),
    pane("changes", true, { id: "2" }),
    pane("plan", true, { id: "2" }),
  ],
};

const start = layoutOf(SESSION);
const on = (key: string, from = start) => focus(from, key);
const DIFF = pane("diff", true, { path: "a.ts" });

const ROWS: Array<[name: string, layout: Layout | null, sees: string]> = [
  [
    "the focused pane is sent to the other stack, with the focus",
    send(on("changes")),
    "main: transcript [changes*] | side: activity [plan]",
  ],
  [
    "the main stack's last pane is not sent: the subject keeps the centre",
    send(start),
    "main: [transcript*] | side: [activity] changes plan",
  ],
  [
    "a side pane made the main one swaps places with the pane main shows",
    swap(on("changes")),
    "main: [changes*] | side: activity [transcript] plan",
  ],
  [
    "a tab moved right keeps the focus",
    nudge(on("activity"), 1),
    "main: [transcript] | side: changes [activity*] plan",
  ],
  ["a tab moved past its stack's end goes nowhere", nudge(on("plan"), 1), "null"],
  [
    "on a narrow window, the main stack's last tab moves on into the side stack's",
    nudge(send(on("plan")), 1, true),
    "main: [transcript] | side: [plan*] activity changes",
  ],
  [
    "a stack shown split, and its focus stays",
    toggleSplit(on("changes")),
    "main: [transcript] | side split: activity changes* plan",
  ],
  [
    "the side stack joins the main one as tabs, the focus where it was",
    join(on("changes")),
    "main: transcript activity [changes*] plan | side: -",
  ],
  [
    "and parts again, each pane back in the side stack",
    part(join(on("changes"))),
    "main: [transcript] | side: activity [changes*] plan",
  ],
  [
    "a side stack built again after a join is no joined one",
    toggleJoin(send(join(on("plan")))),
    "main: transcript activity changes [plan*] | side: -",
  ],
  [
    "a pane opened beside goes in the other stack of the pane that named it, after its shown tab",
    placeBeside(on("changes"), DIFF),
    'main: transcript [diff:[["path","a.ts"]]*] | side: activity [changes] plan',
  ],
  [
    "a pane opened beside that is there already is focused where it is",
    placeBeside(start, pane("plan")),
    "main: [transcript] | side: activity changes [plan*]",
  ],
  [
    "a closed pane comes back in its stack, with the focus",
    reopen(close(on("changes"), "changes"), SESSION),
    "main: [transcript] | side: activity plan [changes*]",
  ],
  [
    "an arrangement opens another place of its kind as the last was left",
    arranged(OTHER, arrangementOf(zoom(swap(on("changes")), true))),
    'main: [changes:[["id","2"]]*] | side: activity:[["id","2"]] [transcript:[["id","2"]]] plan:[["id","2"]] | zoomed changes:[["id","2"]]',
  ],
  [
    "a pane opened beside is not part of the arrangement",
    arranged(OTHER, arrangementOf(placeBeside(on("changes"), DIFF))),
    'main: [transcript:[["id","2"]]*] | side: activity:[["id","2"]] [changes:[["id","2"]]] plan:[["id","2"]]',
  ],
  [
    "a kind closed stays closed in the next place of the kind",
    arranged(OTHER, arrangementOf(close(on("plan"), "plan"))),
    'main: [transcript:[["id","2"]]*] | side: activity:[["id","2"]] [changes:[["id","2"]]]',
  ],
];

test("the moves", () => {
  const failed = ROWS.flatMap(([name, layout, sees]) => {
    const got = layout === null ? "null" : seen(layout);
    return got === sees ? [] : [`${name}:\n  expected ${sees}\n  got      ${got}`];
  });
  expect(failed.join("\n")).toBe("");
});

/** The frame's page, at a desktop's width, its device holding `storage`. */
const page = (storage?: Record<string, string>) =>
  open("./__checks__/moves.tsx", {
    clock: {},
    height: 800,
    platform: "linux",
    storage: storage ?? {},
    width: 1400,
  });

/** The layout the frame draws, in one line. */
const line = (app: App) => app.texts().find((text) => text.startsWith("main")) ?? "";

/** Presses the keys of a sequence, one after the other: `space w L`. */
function keys(app: App, sequence: string) {
  return sequence
    .split(" ")
    .reduce<Promise<void>>(
      (done, key) =>
        done.then(() =>
          app.keyboard.press(/^[A-Z]$/.test(key) ? `shift+${key.toLowerCase()}` : key),
        ),
      Promise.resolve(),
    );
}

const DEFAULT = "main: [check-list*] check-notes | side: [check-activity] check-changes check-plan";

test("a pane sent to the other stack keeps its scroll and its text", async () => {
  const app = await page();
  expect(line(app)).toBe(DEFAULT);
  // Notes typed, then sent to the side stack.
  await app.press("id:tab-check-notes");
  await app.type("id:notes-field", "half a thought");
  await app.keyboard.press("Escape");
  await keys(app, "space w L");
  expect(line(app)).toBe(
    "main: [check-list] | side: check-activity check-changes check-plan [check-notes*]",
  );
  expect(app.texts()).toContain("half a thought");
  // The list scrolled, then swapped into the side stack, the notes into main.
  await app.keyboard.press("h");
  await app.scroll("id:pane-scroll-list", 600);
  await app.wait(100);
  const at = app.texts().find((text) => text.startsWith("List at "));
  expect(at).not.toBe("List at 0");
  await app.keyboard.press("l");
  await keys(app, "space w m");
  expect(line(app)).toBe(
    "main: [check-notes*] | side: check-activity check-changes check-plan [check-list]",
  );
  await app.wait(100);
  expect(app.texts()).toContain(at);
  expect(app.texts()).toContain("half a thought");
});

test("a layout comes back after a restart", async () => {
  const app = await page();
  await app.keyboard.press("l");
  await keys(app, "space w m");
  await keys(app, "space w z");
  const left = line(app);
  expect(left).toBe(
    "main: [check-activity*] check-notes | side: [check-list] check-changes check-plan | zoomed check-activity",
  );
  await app.waitUntil(() => app.storage().layouts !== undefined);
  const again = await page(app.storage());
  expect(line(again)).toBe(left);
});

test("reset gives the place's default", async () => {
  const app = await page();
  await keys(app, "space w o");
  await app.press("id:tab-check-plan");
  await keys(app, "space w q");
  expect(line(app)).not.toBe(DEFAULT);
  await keys(app, "space w r");
  expect(line(app)).toBe(DEFAULT);
  await app.waitUntil(() => !(app.storage().layouts ?? "").includes("check-list"));
  const again = await page(app.storage());
  expect(line(again)).toBe(DEFAULT);
});

test("the side stack joins the main one, and comes back", async () => {
  const app = await page();
  await app.keyboard.press("l");
  await keys(app, "space w o");
  expect(line(app)).toBe(
    "main: check-list check-notes [check-activity*] check-changes check-plan | side: -",
  );
  // A row named in the Activity, now in main, opens beside it, in a side stack again; closed, the
  // side stack is empty, and the stacks part.
  await app.keyboard.press("shift+Enter");
  expect(app.texts()).toContain("Detail of a");
  expect(line(app)).toBe(
    'main: check-list check-notes [check-activity] check-changes check-plan | side: [check-detail:[["row","a"]]*]',
  );
  await keys(app, "space w q");
  await keys(app, "space w o");
  expect(line(app)).toBe(
    "main: [check-list] check-notes | side: [check-activity*] check-changes check-plan",
  );
});

test("a pane's menu holds the moves that make sense there, with their keys", async () => {
  const app = await page();
  await app.longPress("id:tab-check-changes");
  const menu = () => app.texts().join(" | ");
  await app.waitUntil(() => menu().includes("Make it the main pane"));
  expect(menu()).toContain("Send to the main stack");
  expect(menu()).not.toContain("Send to the side stack");
  expect(menu()).toContain("Close the pane");
  await app.press("text:Make it the main pane");
  expect(line(app)).toBe(
    "main: [check-changes*] check-notes | side: check-activity [check-list] check-plan",
  );
});

test("a tab dragged onto the other stack moves there", async () => {
  const app = await page();
  await app.drag("id:tab-check-plan", { x: -700, y: 300 });
  await app.waitUntil(() => line(app).startsWith("main: check-list check-notes [check-plan*]"));
});
