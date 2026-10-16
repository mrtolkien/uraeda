// US3, US4, and US7 of the interface's redesign: the sidebar folds to its rail from one button that
// keeps its place (C3), and from `[`; it resizes from its edge, its width kept; the phone's top bar
// starts with Home; and the latest done items fill the room the rows above leave.
import { act, screen, within } from "@testing-library/react";
import { page, userEvent } from "vite-plus/test/browser";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { atRepo, atSize, drawn, reducedMotion, reload, show } from "./helpers.tsx";

/** The side navigation. */
const nav = () => screen.getByRole("navigation", { name: "Side navigation" });

/** Where a control is drawn, to the pixel. */
const at = (element: Element) => {
  const { x, y } = element.getBoundingClientRect();
  return [Math.round(x), Math.round(y)];
};

/** The fold button, by its name in either state. */
const foldButton = () => within(nav()).getByRole("button", { name: /^(Collapse|Expand) sidebar$/ });

/** The sidebar's width, as drawn. */
const width = () => Math.round(nav().getBoundingClientRect().width);

afterEach(async () => {
  await page.viewport(1440, 900);
  await reducedMotion(false);
});

describe("on a desktop, folding and resizing", () => {
  atSize("desktop");

  /** US3.1 */
  test("the fold button shows under the pointer, and is reached with Tab", async () => {
    await show("/", "Needs you");
    const button = within(nav()).getByRole("button", { name: "Collapse sidebar" });
    expect(getComputedStyle(button).opacity).toBe("0");

    await userEvent.hover(within(nav()).getByRole("link", { name: "Home" }));
    await expect.poll(() => getComputedStyle(button).opacity).toBe("1");

    await userEvent.unhover(nav());
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  /** US3.2, C3, review focus 6 */
  test("folding draws the rail, and the button stays where it was", async () => {
    await show("/", "Needs you");
    await userEvent.hover(nav());
    const before = at(foldButton());

    await userEvent.click(foldButton());

    await expect.poll(() => foldButton().getAttribute("aria-label")).toBe("Expand sidebar");
    await expect.poll(() => width()).toBeLessThan(80);
    expect(at(foldButton())).toEqual(before);
    // Each card in the rail: its step's icon, with its status.
    const card = within(nav()).getByRole("link", { name: /^cli-tuis, / });
    expect(within(card).getByRole("img", { name: "Idle" })).toBeTruthy();

    await userEvent.click(foldButton());
    await expect.poll(() => width()).toBeGreaterThan(150);
    expect(at(foldButton())).toEqual(before);
  });

  /** US3.3, US3.4 */
  test("[ folds and unfolds the sidebar, but not while a text field has the focus", async () => {
    await show("/", "Needs you");

    await userEvent.keyboard("[[");
    await expect.poll(() => foldButton().getAttribute("aria-label")).toBe("Expand sidebar");
    await userEvent.keyboard("[[");
    await expect.poll(() => foldButton().getAttribute("aria-label")).toBe("Collapse sidebar");

    const search = screen.getByRole("searchbox", { name: "Search sessions" });
    await userEvent.click(search);
    await userEvent.keyboard("[[");
    expect((search as HTMLInputElement).value).toBe("[");
    expect(foldButton().getAttribute("aria-label")).toBe("Collapse sidebar");
  });

  /** US3.5 */
  test("the sidebar resizes between 200 and 480 px, kept after a reload, and folds under 160", async () => {
    await show("/", "Needs you");
    // Beside the navigation, not inside it.
    const handle = screen.getByRole("separator", { name: "Resize sidebar" });

    handle.focus();
    await userEvent.keyboard("{End}");
    await expect.poll(() => width()).toBe(480);
    await userEvent.keyboard("{Home}");
    await expect.poll(() => width()).toBe(200);
    for (let step = 0; step < 20; step++) {
      await userEvent.keyboard("{ArrowRight}");
    }
    await expect.poll(() => width()).toBe(400);

    await reload("Needs you");
    await expect.poll(() => width()).toBe(400);

    // Dragged under 160 px, it folds.
    await userEvent.dragAndDrop(
      screen.getByRole("separator", { name: "Resize sidebar" }),
      foldButton(),
    );
    await expect.poll(() => foldButton().getAttribute("aria-label")).toBe("Expand sidebar");
  });

  /** US3.8 */
  test("the fold eases over 200 ms, and at once under reduced motion", async () => {
    await show("/", "Needs you");
    await userEvent.click(foldButton());
    expect(getComputedStyle(nav()).transitionDuration).toBe("0.2s");
    await userEvent.click(foldButton());
    await drawn();

    await reducedMotion(true);
    await userEvent.click(foldButton());
    expect(getComputedStyle(nav()).transitionDuration).toBe("0s");
  });
});

describe("on a desktop, the latest done items", () => {
  atSize("desktop");

  /** US7.1 to US7.3 */
  test("the latest done items fill the room the rows above leave, up to five", async () => {
    await page.viewport(1440, 2000);
    await show("/", "Needs you");
    const done = () => within(nav()).queryByRole("group", { name: "Done" });
    // The fixture has two done items: both fit in a tall window.
    await expect.poll(() => done()?.querySelectorAll("a").length).toBe(3);
    expect(
      within(done()!).getByRole("link", { name: "All done features and changes" }),
    ).toBeTruthy();

    await page.viewport(1440, 500);
    await expect.poll(() => done()).toBeNull();
    // Nothing above scrolls for it: the rows keep their own height.
    expect(within(nav()).getByRole("link", { name: "Home" })).toBeTruthy();
  });

  /** US7.4 */
  test("the Done area's … opens Home at its Done group", async () => {
    await page.viewport(1440, 2000);
    await show("/priorities", "Claude Code runner");
    const all = await within(nav()).findByRole("link", { name: "All done features and changes" });

    await userEvent.click(all);

    await expect.poll(() => window.location.pathname).toBe(atRepo("/"));
    expect(window.location.hash).toBe("#done");
  });
});

describe("on the phone", () => {
  atSize("phone");

  /** US4.1, US4.2 */
  test("the top bar starts with Home, the current page on home", async () => {
    await show("/f/2026-10-12-cli-tuis", "CLI TUIs");
    const bar = screen.getByRole("navigation", { name: "Mobile navigation" });
    const home = within(bar).getByRole("link", { name: "Home" });
    expect(within(bar).getAllByRole("link")[0]).toBe(home);

    // Clicked itself: the closed drawer's heading holds another link named Home, which a locator by
    // its name would find too.
    await act(async () => home.click());

    await expect.poll(() => window.location.pathname).toBe(atRepo("/"));
    await expect
      .poll(() => within(bar).getByRole("link", { name: "Home" }).getAttribute("aria-current"))
      .toBe("page");
  });
});
