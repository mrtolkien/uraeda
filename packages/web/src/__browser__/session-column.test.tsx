// The session's column, measured (US1 more 2, approval comment C2, review focus 4): a third of the
// window when wide, 300 px at a semi-wide 1000 px, where a document's column keeps its 400 px; the
// Changes part at most 40% of its height; resized from its edge, its width kept, and `]` folding
// it; and, on the phone, its split opened as a sheet from the status line, closed by Back.
import { screen, within } from "@testing-library/react";
import { page, userEvent } from "vite-plus/test/browser";
import { describe, expect, test } from "vite-plus/test";
import { agent, atRepo, atSize, drawn, LIVE, reload, show } from "./helpers.tsx";

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

  test("Changes counts the session's files, and opens the same sheet", async () => {
    await session();
    const line = within(screen.getByRole("contentinfo", { name: "Status line" }));

    await userEvent.click(
      await line.findByRole("button", { name: "Changes 0 · 0 files edited" }, LIVE),
    );

    expect(await screen.findByRole("dialog", { name: "Activity" }, LIVE)).toBeTruthy();
  });
});
