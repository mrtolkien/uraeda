// US2 of the layout and look: the shell's column at its three widths. Wide, a column 14% of the
// window, resized from its edge between 220 and 480 px and kept; semi-wide, a 52 px rail that opens
// over the page under the pointer, to the keyboard's focus, or on a tap of its logo, and folds back
// as they leave; and crossing 1280 px, the open rail becomes the column.
import { screen, within } from "@testing-library/react";
import { page, userEvent } from "vite-plus/test/browser";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { atSize, commands, drawn, reload, show } from "./helpers.tsx";

/** The shell's navigation: the column, or the rail. */
const nav = () => screen.getByRole("navigation", { name: "Navigation" });

/** The navigation's width, as drawn. */
const width = () => Math.round(nav().getBoundingClientRect().width);

/** Where the page starts: the rail opens over it, and never moves it. */
const pageLeft = () => Math.round(screen.getByRole("main").getBoundingClientRect().left);

/** Drags the column's edge sideways by `dx` px, with the mouse, from just inside the edge. */
async function dragEdge(dx: number) {
  const box = nav().getBoundingClientRect();
  const x = box.right - 3;
  const y = box.top + box.height / 2;
  await commands.mouse([
    { type: "move", x, y },
    { type: "down" },
    { type: "move", x: x + dx / 2, y },
    { type: "move", x: x + dx, y },
    { type: "up" },
  ]);
}

describe("at semi-wide", () => {
  atSize("semi");

  /** US2 1, SC-003 */
  test("the rail is 52 px, and the pointer opens it over the page until it leaves", async () => {
    await show("/", "Needs you");
    expect(width()).toBe(52);
    const left = pageLeft();
    expect(left).toBe(52);

    await userEvent.hover(nav());
    await expect.poll(() => width()).toBe(256);
    // Over the page, which stays where it was.
    expect(pageLeft()).toBe(left);

    await userEvent.unhover(nav());
    await expect.poll(() => width()).toBe(52);
  });

  /** US2 1, US2 more 1, Review focus 3 */
  test("Tab opens the rail and reaches every row; focus leaving or Escape folds it", async () => {
    await show("/", "Needs you");
    expect(width()).toBe(52);

    // From the page's first control, back into the rail: its last row first.
    const enter = async () => {
      // The mouse away from where the rail opens: the keyboard alone holds it open.
      await commands.mouse([{ type: "move", x: 1100, y: 850 }]);
      screen
        .getByRole("main")
        .querySelector<HTMLElement>("a[href], button:not([disabled]), input, textarea")
        ?.focus();
      // One Shift+Tab: the rail opens, and the focus stays on the row it reached, drawn anew.
      await userEvent.tab({ shift: true });
      await expect.poll(() => width()).toBe(256);
      expect(document.activeElement).toBe(within(nav()).getByRole("link", { name: "Settings" }));
    };
    await enter();
    await expect.poll(() => width()).toBe(256);

    // Every row, one Tab after the other, the rail open all along.
    const reached: Array<string> = [];
    while (nav().contains(document.activeElement)) {
      reached.push(
        document.activeElement?.getAttribute("aria-label") ?? "",
        document.activeElement?.textContent ?? "",
      );
      expect(width()).toBe(256);
      await userEvent.tab({ shift: true });
    }
    for (const row of ["Home", "Inbox", "Priorities", "Decisions", "Settings", "New"]) {
      expect(
        reached.some((name) => name.startsWith(row)),
        row,
      ).toBe(true);
    }
    expect(reached.some((name) => name.startsWith("cli-tuis, "))).toBe(true);
    expect(reached.some((name) => name.startsWith("web-ui, "))).toBe(true);

    // Focus left it: it folds.
    await expect.poll(() => width()).toBe(52);

    // Back into it, then Escape.
    await enter();
    await expect.poll(() => width()).toBe(256);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => width()).toBe(52);
  });

  /** US2 1: Escape folds the rail a hover opened, wherever the focus is. */
  test("Escape folds the rail the pointer opened, with the focus outside it", async () => {
    await show("/", "Needs you");
    await userEvent.hover(nav());
    await expect.poll(() => width()).toBe(256);
    expect(nav().contains(document.activeElement)).toBe(false);

    await userEvent.keyboard("{Escape}");
    await expect.poll(() => width()).toBe(52);
  });

  /** Edge case: the window crosses 1280 px with the rail open. */
  test("crossing 1280 px with the rail open, the rail becomes the column", async () => {
    await show("/", "Needs you");
    await userEvent.hover(nav());
    await expect.poll(() => width()).toBe(256);

    await page.viewport(1440, 900);
    await expect.poll(() => window.innerWidth).toBe(1440);

    await expect.poll(() => pageLeft()).toBe(256);
    expect(width()).toBe(256);
    expect(screen.getByRole("separator", { name: "Resize navigation" })).toBeTruthy();
  });
});

describe("on a desktop", () => {
  atSize("desktop");

  afterEach(async () => {
    await page.viewport(1440, 900);
  });

  /** US2 2 */
  test("the column is 14% of the window, between 256 and 340 px", async () => {
    await page.viewport(1900, 900);
    await expect.poll(() => window.innerWidth).toBe(1900);
    await show("/", "Needs you");
    expect(width()).toBe(266);
    expect(pageLeft()).toBe(266);

    // 14% of 1440 is 202 px: the column keeps 256.
    await page.viewport(1440, 900);
    await expect.poll(() => width()).toBe(256);
    await page.viewport(2600, 900);
    await expect.poll(() => width()).toBe(340);
  });

  /** US2 2 */
  test("a drag of its edge to 320 px stays after a reload", async () => {
    await show("/", "Needs you");
    expect(width()).toBe(256);

    await dragEdge(64);

    await expect.poll(() => width()).toBe(320);
    await reload("Needs you");
    await drawn();
    expect(width()).toBe(320);
    // Kept, it no longer follows the window.
    await page.viewport(1900, 900);
    await expect.poll(() => window.innerWidth).toBe(1900);
    expect(width()).toBe(320);
  });

  /** Edge case: the column dragged past its limits. */
  test("a drag past its limits stops at 220 and 480 px", async () => {
    await show("/", "Needs you");

    await dragEdge(-400);
    await expect.poll(() => width()).toBe(220);
    await dragEdge(600);
    await expect.poll(() => width()).toBe(480);
  });

  /** Review focus 4: Astryx's old key, read once and clamped. */
  test("a width Astryx kept under its old key is kept, within the limits", async () => {
    window.localStorage.setItem(
      "astryx-resizable:uraeda.nav",
      JSON.stringify({ isCollapsed: false, size: 300 }),
    );
    await show("/", "Needs you");
    expect(width()).toBe(300);

    window.localStorage.removeItem("uraeda.nav");
    window.localStorage.setItem(
      "astryx-resizable:uraeda.nav",
      JSON.stringify({ isCollapsed: false, size: 900 }),
    );
    await reload("Needs you");
    expect(width()).toBe(480);
  });

  /** R16: the fold Astryx kept under its old key stays, with its width. */
  test("a column Astryx kept folded stays folded, and unfolds to its kept width", async () => {
    window.localStorage.setItem(
      "astryx-resizable:uraeda.nav",
      JSON.stringify({ isCollapsed: true, size: 300 }),
    );
    await show("/", "Needs you");
    expect(width()).toBe(52);

    await userEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
    await expect.poll(() => width()).toBe(300);
  });
});

describe("on a touch screen at semi-wide", () => {
  atSize("phone");

  afterEach(async () => {
    await page.viewport(402, 874);
  });

  /** Edge case: the rail on a touch screen, which has no pointer to hover with. */
  test("a tap on the logo opens the rail, and a tap outside folds it", async () => {
    await page.viewport(1205, 900);
    await expect.poll(() => window.innerWidth).toBe(1205);
    await show("/", "Needs you");
    expect(width()).toBe(52);

    const logo = screen.getByRole("button", { name: "Open navigation" }).getBoundingClientRect();
    await commands.tap(logo.left + logo.width / 2, logo.top + logo.height / 2);
    await expect.poll(() => width()).toBe(256);

    // On the page, past the open rail.
    await commands.tap(900, 850);
    await expect.poll(() => width()).toBe(52);
  });
});

describe("on the phone", () => {
  atSize("phone");

  /** US2 3: a tab's count sits at its icon's top end corner, never over its glyph. */
  test("a tab's count leaves its icon's glyph uncovered", async () => {
    await show("/", "Needs you");
    const tab = await screen.findByRole("link", { name: /^Inbox, \d+ notes$/ });
    const icon = tab.querySelector("svg")!.getBoundingClientRect();
    // The badge's whole box: its count's outermost element beside the icon.
    let count = within(tab).getByText(/^\d+$/);
    while (!count.parentElement!.contains(tab.querySelector("svg"))) {
      count = count.parentElement!;
    }
    const badge = count.getBoundingClientRect();
    const x = icon.left + icon.width / 2;
    const y = icon.top + icon.height / 2;
    const covers = x >= badge.left && x <= badge.right && y >= badge.top && y <= badge.bottom;
    expect(covers).toBe(false);
    // At the top end corner: past the glyph's centre, and over it.
    expect(badge.left).toBeGreaterThan(x);
    expect(badge.top).toBeLessThan(y);
  });
});
