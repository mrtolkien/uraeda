// The session's column, measured (US1 more 2, approval comment C2, review focus 4): a third of the
// window when wide, 300 px at a semi-wide 1000 px, where a document's column keeps its 400 px; the
// Changes part at most 40% of its height; resized from its edge, its width kept, and `]` folding
// it; and, on the phone, its split opened as a sheet from the status line, closed by Back. As the
// right bar's (`specs/done/2026-10-19-right-bar.md`): its edge dragged by the pointer along its
// full height, a click in its folded rail's space unfolding it, its fold eased over 200 ms, at once
// under reduced motion, and the page beside it kept as it folds.
import { screen, within } from "@testing-library/react";
import { page, userEvent } from "vite-plus/test/browser";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  agent,
  atRepo,
  atSize,
  checkLayout,
  drawn,
  LIVE,
  reducedMotion,
  reload,
  show,
  startTurn,
} from "./helpers.tsx";
import { COLUMN_KEY } from "../layout/documentColumnWidth.ts";

const CLI = "2026-10-12-cli-tuis";

/** The column's name, its landmark's. */
const NAME = "The session's column";

/** The column, shown or folded. */
const column = () => screen.getByRole("complementary", { name: NAME });

/** A landmark's width, as drawn. */
const widthOf = (element: Element) => Math.round(element.getBoundingClientRect().width);

/** The column's width, as drawn. */
const width = () => widthOf(column());

/** The rail's width, in px, as the left sidebar's: the column folded. */
const RAIL = 48;

/** The feature's session, at its implementation, with its column, or, on the phone, its parts. */
async function session() {
  await agent.addPlan(CLI);
  await show(`/f/${CLI}/session`, "CLI TUIs");
  if (window.innerWidth >= 768) {
    await screen.findByRole("complementary", { name: NAME }, LIVE);
  } else {
    await screen.findByRole("button", { name: "Activity" }, LIVE);
  }
  await drawn();
}

/** Runs `check` with the window `windowWidth` px wide, then widens it back. */
async function at(windowWidth: number, check: () => Promise<void>) {
  try {
    await page.viewport(windowWidth, 900);
    await expect.poll(() => window.innerWidth).toBe(windowWidth);
    await check();
  } finally {
    await page.viewport(1440, 900);
  }
}

/** Reads of `src/f<from>.rs` to before `src/f<to>.rs`, the last one still running. */
function reads(from: number, to: number) {
  return Array.from({ length: to - from }, (_, index) => {
    const id = `f${String(from + index).padStart(2, "0")}`;
    const start = { id, input: {}, kind: "read" as const, name: "Read", target: `src/${id}.rs` };
    return from + index === to - 1
      ? [{ ...start, type: "toolStart" as const }]
      : [
          { ...start, type: "toolStart" as const },
          { id, isError: false, output: "", type: "toolEnd" as const },
        ];
  }).flat();
}

/** Where a control is drawn, to the pixel. */
function placeOf(element: Element) {
  const { x, y } = element.getBoundingClientRect();
  return [Math.round(x), Math.round(y)];
}

/** Whether `element` shows whole inside the box `box` scrolls. */
function inView(element: Element, box: Element) {
  const row = element.getBoundingClientRect();
  const frame = box.getBoundingClientRect();
  return row.top >= frame.top - 1 && row.bottom <= frame.bottom + 1;
}

describe("on a desktop", () => {
  atSize("desktop");

  test("wide: the column is a third of the window; semi-wide: 300 px at 1000 px (C2)", async () => {
    await session();
    expect(width()).toBe(480);

    await at(1000, async () => {
      await expect.poll(() => width(), LIVE).toBe(300);
      // The chat keeps the rest: the column takes less than a third of the page beside it.
      const log = screen.getByRole("log", { name: "Conversation" });
      expect(widthOf(log)).toBeGreaterThan(2 * width());
    });
  });

  test("review focus 4: at 1000 px a document's column stays 400 px", async () => {
    await at(1000, async () => {
      await show(`/f/${CLI}/spec.md`, "CLI TUIs");
      const spec = await screen.findByRole("complementary", { name: "The spec's column" }, LIVE);
      await expect.poll(() => widthOf(spec), LIVE).toBe(400);

      await show(`/f/${CLI}/session`, "CLI TUIs");
      await screen.findByRole("complementary", { name: NAME }, LIVE);
      await expect.poll(() => width(), LIVE).toBe(300);
    });
  });

  test("the Changes part takes at most 40% of the column's height, and scrolls", async () => {
    await agent.commitOnBranch(
      CLI,
      Object.fromEntries(
        Array.from({ length: 40 }, (_, index) => [
          `src/f${String(index).padStart(2, "0")}.rs`,
          "fn f() {}\n",
        ]),
      ),
    );
    await session();
    const changes = within(column()).getByRole("region", { name: "Changes" });
    await userEvent.click(
      await within(changes).findByRole("button", { name: "38 more files" }, LIVE),
    );
    await within(changes).findByText("src/f39.rs", undefined, LIVE);
    await drawn();

    const height = column().getBoundingClientRect().height;
    expect(changes.getBoundingClientRect().height).toBeLessThanOrEqual(height * 0.4 + 1);
    expect(changes.scrollHeight).toBeGreaterThan(changes.clientHeight);
    // The Activity above keeps the rest of the room.
    const activity = within(column()).getByRole("region", { name: "Activity" });
    expect(activity.getBoundingClientRect().height).toBeGreaterThan(height * 0.3);
  });

  test("the column resizes, its width kept after a reload; ] folds it", async () => {
    await session();
    const handle = screen.getByRole("separator", { name: "Resize the session's column" });

    handle.focus();
    await userEvent.keyboard("{End}");
    await expect.poll(() => width()).toBe(720);
    await userEvent.keyboard("{Home}");
    await expect.poll(() => width()).toBe(300);
    for (let step = 0; step < 4; step++) {
      await userEvent.keyboard("{ArrowLeft}");
    }
    const dragged = width();
    expect(dragged).toBeGreaterThan(300);

    await reload("CLI TUIs");
    await screen.findByRole("complementary", { name: NAME }, LIVE);
    await expect.poll(() => width()).toBe(dragged);

    document.body.focus();
    await userEvent.keyboard("]");
    await expect.poll(() => width()).toBe(RAIL);
    expect(within(column()).getByRole("img", { name: "Activity" })).toBeTruthy();
    await userEvent.keyboard("]");
    await expect.poll(() => width()).toBe(dragged);
  });
});

describe("on a desktop, the Activity", () => {
  atSize("desktop");

  test("US1 key 3: the Activity opens at its latest call, marked live, and follows the calls that arrive", async () => {
    await agent.addPlan(CLI);
    await startTurn("Read the sources.", reads(0, 40), `/f/${CLI}/session`);
    await screen.findAllByText("src/f39.rs", undefined, LIVE);
    // Opened again, its calls already there.
    await reload("CLI TUIs");
    await screen.findByRole("complementary", { name: NAME }, LIVE);
    const activity = within(column()).getByRole("region", { name: "Activity" });
    await within(activity).findByText("src/f39.rs", undefined, LIVE);
    await drawn();
    // More rows than the Activity shows: its start is out of view, its latest call in it.
    expect(activity.scrollHeight).toBeGreaterThan(activity.clientHeight);
    await expect.poll(() => inView(within(activity).getByText("src/f39.rs"), activity)).toBe(true);
    expect(inView(within(activity).getByText("src/f00.rs"), activity)).toBe(false);

    await agent.agentEmit([
      { id: "f39", isError: false, output: "", type: "toolEnd" },
      ...reads(40, 50),
    ]);
    await within(activity).findByText("src/f49.rs", undefined, LIVE);
    await drawn();
    await expect.poll(() => inView(within(activity).getByText("src/f49.rs"), activity)).toBe(true);
  });

  test("the Activity keeps its latest call in view as its part shrinks", async () => {
    await agent.addPlan(CLI);
    await startTurn("Read the sources.", reads(0, 40), `/f/${CLI}/session`);
    const activity = within(column()).getByRole("region", { name: "Activity" });
    await within(activity).findByText("src/f39.rs", undefined, LIVE);
    await drawn();
    await expect.poll(() => inView(within(activity).getByText("src/f39.rs"), activity)).toBe(true);
    try {
      // A shorter window, as the Changes drawn under it after it opened.
      await page.viewport(1440, 600);
      await expect.poll(() => window.innerHeight).toBe(600);
      await expect
        .poll(() => inView(within(activity).getByText("src/f39.rs"), activity))
        .toBe(true);
    } finally {
      await page.viewport(1440, 900);
    }
  });

  test("C2: at 1000 px a sub-agent's row gives its description more room than its word", async () => {
    await at(1000, async () => {
      await agent.addPlan(CLI);
      await startTurn(
        "Find the callers.",
        [
          {
            id: "task",
            input: {},
            kind: "other",
            name: "Task",
            subagent: { description: "Find every caller of complete()" },
            type: "toolStart",
          },
          { id: "g", input: {}, kind: "search", name: "Grep", parent: "task", type: "toolStart" },
        ],
        `/f/${CLI}/session`,
      );
      const activity = within(column()).getByRole("region", { name: "Activity" });
      const label = await within(activity).findByText(
        "Find every caller of complete()",
        undefined,
        LIVE,
      );
      await drawn();
      // The row's word, "sub-agent · 1 call", its parts unbroken.
      const word = within(activity).getByText("· 1 call").parentElement!;
      expect(word.textContent).toBe("sub-agent · 1 call");
      expect(widthOf(label)).toBeGreaterThan(widthOf(word));
    });
  });
});

describe("on a desktop, at 1000 px", () => {
  atSize("desktop");

  test("ui-layout: at 1000 px, with two sub-agents running, the column's tabs read whole", async () => {
    await at(1000, async () => {
      await agent.addPlan(CLI);
      await startTurn(
        "Explore.",
        ["one", "two"].map((id) => ({
          id,
          input: {},
          kind: "other" as const,
          name: "Task",
          subagent: { description: `Explore ${id}` },
          type: "toolStart" as const,
        })),
        `/f/${CLI}/session`,
      );
      await within(column()).findByRole("tab", { name: /Sub-agents/ }, LIVE);
      await drawn();

      // No tab scrolled out of the strip, or cut: each reads whole in the strip's box.
      const tabs = within(column()).getAllByRole("tab");
      const strip = tabs[0]!.parentElement!.getBoundingClientRect();
      for (const tab of tabs) {
        const box = tab.getBoundingClientRect();
        expect(box.left, tab.textContent!).toBeGreaterThanOrEqual(strip.left - 0.5);
        expect(box.right, tab.textContent!).toBeLessThanOrEqual(strip.right + 0.5);
      }
      await checkLayout(column());
    });
  });

  test("the plan's progress stacks its task's title under its label, side by side when wide", async () => {
    await session();
    // The link's first words, whole: the bar under it says them again, hidden.
    const words = /^Implementation · task \d+ of \d+$/;
    const whole = (_: string, element: Element | null) =>
      words.test(element?.textContent ?? "") &&
      ![...element!.children].some((child) => words.test(child.textContent ?? ""));
    const label = () => within(column()).getAllByText(whole)[0]!;
    const title = () => label().nextElementSibling!;
    await within(column()).findAllByText(whole, undefined, LIVE);
    expect(title().getBoundingClientRect().left).toBeGreaterThan(
      label().getBoundingClientRect().right,
    );

    await at(1000, async () => {
      await expect.poll(() => width(), LIVE).toBe(300);
      const below = title().getBoundingClientRect();
      expect(below.top).toBeGreaterThanOrEqual(label().getBoundingClientRect().bottom);
      expect(Math.round(below.left)).toBe(Math.round(label().getBoundingClientRect().left));
      // The label wraps before its count, never inside it: "task 7 of 11" on one line.
      const walker = document.createTreeWalker(label(), NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.textContent!.indexOf("task");
        if (at >= 0) {
          range.setStart(node, at);
          range.setEnd(node, node.textContent!.length);
        }
      }
      expect(new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size).toBe(1);
    });
  });

  test("a long path in the Activity breaks after its slashes, never inside a name", async () => {
    const path = "src/recurring/tasks/complete/next-occurrence/complete.ts";
    await at(1000, async () => {
      await agent.addPlan(CLI);
      await startTurn(
        "Read it.",
        [{ id: "r", input: {}, kind: "read", name: "Read", target: path, type: "toolStart" }],
        `/f/${CLI}/session`,
      );
      const activity = within(column()).getByRole("region", { name: "Activity" });
      const row = await within(activity).findByText(path, undefined, LIVE);
      await drawn();
      // Each of its names on one line, the path on several.
      const lines = new Set<number>();
      for (const name of path.split("/")) {
        const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const at = node.textContent!.indexOf(name);
          if (at >= 0) {
            range.setStart(node, at);
            range.setEnd(node, at + name.length);
            break;
          }
        }
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
        expect(new Set(rects.map((rect) => Math.round(rect.top))).size, name).toBe(1);
        lines.add(Math.round(rects[0]!.top));
      }
      expect(lines.size).toBeGreaterThan(1);
    });
  });
});

describe("on a desktop, its edge and its fold", () => {
  atSize("desktop");

  afterEach(async () => {
    await reducedMotion(false);
  });

  test("its edge runs the column's height above the status line, and a drag resizes it", async () => {
    await session();
    const handle = screen.getByRole("separator", { name: "Resize the session's column" });
    const box = handle.getBoundingClientRect();
    // As tall as the window above the shell's status line (layout-look R20).
    const line = screen.getByRole("contentinfo", { name: "Status line" }).getBoundingClientRect();
    expect(Math.round(box.height)).toBe(Math.round(line.top));
    expect(Math.round(column().getBoundingClientRect().height)).toBe(Math.round(line.top));
    expect(Math.round(box.x)).toBe(Math.round(column().getBoundingClientRect().x));

    await userEvent.dragAndDrop(handle, document.body, {
      sourcePosition: { x: 1, y: 100 },
      targetPosition: { x: box.x - 80, y: 100 },
    });

    await expect.poll(() => width()).toBeGreaterThan(520);
    const dragged = width();
    await reload("CLI TUIs");
    await screen.findByRole("complementary", { name: NAME }, LIVE);
    await expect.poll(() => width()).toBe(dragged);
  });

  test("one button folds and unfolds the column at the same spot, in view while folded", async () => {
    await session();
    await userEvent.hover(column());
    const hide = screen.getByRole("button", { name: "Hide the session's column" });
    await expect.poll(() => getComputedStyle(hide).opacity).toBe("1");
    const before = placeOf(hide);

    await userEvent.click(hide);

    await expect.poll(() => width()).toBe(RAIL);
    const shows = screen.getByRole("button", { name: "Show the session's column" });
    expect(placeOf(shows)).toEqual(before);
    expect(getComputedStyle(shows).opacity).toBe("1");
  });

  test("folded, a click in its rail's space unfolds it", async () => {
    await session();
    await userEvent.click(screen.getByRole("button", { name: "Hide the session's column" }));
    await expect.poll(() => width()).toBe(RAIL);
    expect(screen.queryByRole("separator", { name: "Resize the session's column" })).toBeNull();

    // Below the rail's icons, in its empty space.
    await userEvent.click(column(), { position: { x: 24, y: 400 } });

    await expect.poll(() => width()).toBe(480);
  });

  test("the fold eases over 200 ms, and at once under reduced motion", async () => {
    await session();
    await userEvent.keyboard("]");
    expect(getComputedStyle(column()).transitionDuration).toBe("0.2s");
    await expect.poll(() => width()).toBe(RAIL);
    await userEvent.keyboard("]");
    await drawn();

    await reducedMotion(true);
    await userEvent.keyboard("]");
    expect(getComputedStyle(column()).transitionDuration).toBe("0s");
  });

  test("hiding the column keeps the transcript, the focus, and what the composer holds", async () => {
    await session();
    await startTurn("Plan the CLI.", [{ text: "Investigating.", type: "text" }]);
    const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
    await within(log).findByText("Investigating.", undefined, LIVE);
    const field = screen.getByRole("textbox", { name: "Message Claude Code" });
    await userEvent.click(field);
    // Typed in a field, `]` is text.
    await userEvent.keyboard("A note]");
    expect(width()).toBe(480);

    const crumb = screen.getAllByRole("link", { name: "CLI TUIs" })[0];
    crumb.focus();
    await userEvent.keyboard("]");

    await expect.poll(() => width()).toBe(RAIL);
    expect(log.isConnected).toBe(true);
    expect(document.activeElement).toBe(crumb);
    expect(screen.getByRole("textbox", { name: "Message Claude Code" }).textContent).toContain(
      "A note]",
    );
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("US1 more 2: on the phone, Activity opens the column as a sheet, and Back closes it", async () => {
    await session();
    expect(screen.queryByRole("complementary", { name: NAME })).toBeNull();
    const line = within(screen.getByRole("contentinfo", { name: "Status line" }));
    const progress = await line.findByRole(
      "link",
      { name: "7 / 11 · Implementation · task 7 of 11" },
      LIVE,
    );
    expect(progress.textContent).toContain("7 / 11");
    await expect
      .poll(() => progress.getAttribute("href"), LIVE)
      .toBe(atRepo(`/f/${CLI}/plan.md#task-7-session-column`));

    await userEvent.click(line.getByRole("button", { name: "Activity" }));

    const sheet = await screen.findByRole("dialog", { name: "Activity" }, LIVE);
    expect(within(sheet).getByRole("region", { name: "Changes" })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("activity");
    window.history.back();

    await expect.poll(() => screen.queryByRole("dialog", { name: "Activity" }), LIVE).toBeNull();
    expect(window.location.search).toBe("");
    expect(screen.getByRole("log", { name: "Conversation" })).toBeTruthy();
  });

  test("the sheet holds the split: the Activity scrolls on its own, the Changes in view under it", async () => {
    await agent.addPlan(CLI);
    await startTurn("Read the sources.", reads(0, 40), `/f/${CLI}/session`);
    const line = within(screen.getByRole("contentinfo", { name: "Status line" }));
    await userEvent.click(line.getByRole("button", { name: "Activity" }));
    const sheet = await screen.findByRole("dialog", { name: "Activity" }, LIVE);
    const activity = within(sheet).getByRole("region", { name: "Activity" });
    await within(activity).findByText("src/f39.rs", undefined, LIVE);
    await drawn();

    expect(activity.scrollHeight).toBeGreaterThan(activity.clientHeight);
    const changes = within(sheet).getByRole("region", { name: "Changes" });
    expect(changes.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
    // The latest call in view, as in the column.
    await expect.poll(() => inView(within(activity).getByText("src/f39.rs"), activity)).toBe(true);
  });

  test("the sheet's tabs open the Sub-agents by a tap, and Back closes the sheet", async () => {
    await session();
    await startTurn("Plan the CLI.", [
      {
        id: "task",
        input: {},
        kind: "other",
        name: "Task",
        subagent: { description: "Map the runner code" },
        type: "toolStart",
      },
    ]);
    const line = within(screen.getByRole("contentinfo", { name: "Status line" }));
    await userEvent.click(line.getByRole("button", { name: "Activity" }));
    const sheet = await screen.findByRole("dialog", { name: "Activity" }, LIVE);

    await userEvent.click(await within(sheet).findByRole("tab", { name: /^Sub-agents/ }, LIVE));

    const list = await within(sheet).findByRole("list", { name: "The session's sub-agents" }, LIVE);
    await within(list).findByText("Map the runner code", undefined, LIVE);
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("subagents");
    window.history.back();

    await expect.poll(() => screen.queryByRole("dialog"), LIVE).toBeNull();
    expect(window.location.search).toBe("");
    expect(screen.getByRole("log", { name: "Conversation" })).toBeTruthy();
  });

  test("a recap line's address leaves the desktop's folded column folded", async () => {
    window.localStorage.setItem(COLUMN_KEY, JSON.stringify({ folded: true }));
    await agent.addPlan(CLI);
    await show(`/f/${CLI}/session?tab=activity&stretch=1:0`, "CLI TUIs");
    await screen.findByRole("dialog", { name: "Activity" }, LIVE);
    await drawn();

    expect(JSON.parse(window.localStorage.getItem(COLUMN_KEY)!)).toEqual({ folded: true });
  });

  test("Changes counts the session's files, and opens the same sheet", async () => {
    await session();
    const line = within(screen.getByRole("contentinfo", { name: "Status line" }));

    await userEvent.click(
      await line.findByRole("button", { name: "Changes 0 · 0 files edited" }, LIVE),
    );

    expect(await screen.findByRole("dialog", { name: "Activity" }, LIVE)).toBeTruthy();
  });
});
