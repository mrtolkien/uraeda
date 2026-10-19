// "A column that takes room from the main content is foldable and resizable" (the UI layout
// decision), and every action works by keyboard (the UI behaviour decision): the sidebar and the
// session's column fold from a button and from a key, and resize from their edge with the arrow
// keys, their width kept across a reload. Widths are compared with each other, never with a number
// of pixels. A column's drag is a mouse's, which the keys replace for everyone.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { agent, atSize, drawn, LIVE, opened, reload } from "./helpers.tsx";

atSize("desktop");

const CLI = "2026-10-12-cli-tuis";

const nav = () => screen.getByRole("navigation", { name: "Side navigation" });
const column = () => screen.getByRole("complementary", { name: "Progress" });
const widthOf = (element: Element) => Math.round(element.getBoundingClientRect().width);

/** Waits for the width of a column to have settled. */
async function settled(element: () => Element) {
  let last = Number.NaN;
  await expect
    .poll(
      () => {
        const same = widthOf(element()) === last;
        last = widthOf(element());
        return same;
      },
      { interval: 100 },
    )
    .toBe(true);
  return last;
}

const fold = () => within(nav()).getByRole("button", { name: /^(Collapse|Expand) sidebar$/ });
const folded = () => fold().getAttribute("aria-label") === "Expand sidebar";

/** The feature's session at its implementation, with its column. */
async function session() {
  await agent.addPlan(CLI);
  await opened(`/f/${CLI}/session`);
  await screen.findByRole("complementary", { name: "Progress" }, LIVE);
  await drawn();
}

describe("the sidebar", () => {
  test("folds to a rail from its button and from [, and unfolds back to its width", async () => {
    await opened("/");
    await expect
      .poll(() => screen.queryByRole("navigation", { name: "Side navigation" }))
      .not.toBeNull();
    const open = await settled(nav);

    await userEvent.click(fold());
    await expect.poll(folded).toBe(true);
    expect(await settled(nav)).toBeLessThan(open);
    await userEvent.click(fold());
    await expect.poll(folded).toBe(false);
    expect(await settled(nav)).toBe(open);

    await userEvent.keyboard("[[");
    await expect.poll(folded).toBe(true);
    await userEvent.keyboard("[[");
    await expect.poll(folded).toBe(false);
  });

  test("leaves [ to a text field that has the focus", async () => {
    await opened("/");
    const search = await screen.findByRole("searchbox");
    await userEvent.click(search);

    await userEvent.keyboard("[[");

    expect((search as HTMLInputElement).value).toBe("[");
    expect(folded()).toBe(false);
  });

  test("resizes from its edge with the arrow keys, its width kept after a reload", async () => {
    await opened("/");
    const handle = await screen.findByRole("separator", { name: /sidebar/i });
    handle.focus();

    await userEvent.keyboard("{End}");
    const widest = await settled(nav);
    await userEvent.keyboard("{Home}");
    const narrowest = await settled(nav);
    expect(narrowest).toBeLessThan(widest);
    for (let step = 0; step < 5; step++) {
      await userEvent.keyboard("{ArrowRight}");
    }
    const between = await settled(nav);
    expect(between).toBeGreaterThan(narrowest);
    expect(between).toBeLessThan(widest);

    await reload("");
    await screen.findByRole("navigation", { name: "Side navigation" });
    expect(await settled(nav)).toBe(between);
  });
});

describe("the session's column", () => {
  test("folds to a rail and unfolds from its button and from ]", async () => {
    await session();
    const open = await settled(column);

    await userEvent.hover(column());
    await userEvent.click(screen.getByRole("button", { name: /^Hide / }));
    expect(await settled(column)).toBeLessThan(open);
    await userEvent.click(screen.getByRole("button", { name: /^Show / }));
    expect(await settled(column)).toBe(open);

    await userEvent.keyboard("]");
    expect(await settled(column)).toBeLessThan(open);
    await userEvent.keyboard("]");
    expect(await settled(column)).toBe(open);
  });

  test("resizes from its edge with the arrow keys, its width kept after a reload", async () => {
    await session();
    const handle = screen.getByRole("separator", { name: /progress/i });
    handle.focus();

    await userEvent.keyboard("{End}");
    const widest = await settled(column);
    await userEvent.keyboard("{Home}");
    const narrowest = await settled(column);
    expect(narrowest).toBeLessThan(widest);
    for (let step = 0; step < 5; step++) {
      await userEvent.keyboard("{ArrowLeft}");
    }
    const between = await settled(column);
    expect(between).toBeGreaterThan(narrowest);

    await reload("");
    await screen.findByRole("complementary", { name: "Progress" }, LIVE);
    expect(await settled(column)).toBe(between);
  });
});
