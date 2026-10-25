// US4 and review focus 1, 2, 3: a card's line opens in an overlay over its page, which stays
// mounted: its selection and its scroll survive. Back closes the overlay in one press, and Previous
// and Next add no history entry, whichever way the overlay was opened: a click, an address, a
// reload. Each test takes the repository in turn, on a fresh copy of the fixture; the history is
// read as a user sees it, `history.length` and what one Back leads to.
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { commands as browserCommands, page, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import {
  atRepo,
  atSize,
  charactersAcross,
  checkPage,
  drawn,
  nowHoldsNext,
  reload,
  show,
  watchFor,
} from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

const NEXT = "Claude Code runner";
const AFTER = "Git listener process";

/** A card's link, by its text: the sidebar may name the same line. */
function card(text: string) {
  const links = screen
    .getAllByRole("link", { name: new RegExp(text) })
    .filter((link) => link.closest("[data-row]") !== null);
  expect(links).toHaveLength(1);
  return links[0];
}

/** The priority's overlay, once it shows. */
function overlay() {
  return screen.findByRole("dialog", { name: "Priority" });
}

/** The card of a text is the page's selected one, and has the focus. */
async function isSelected(text: string) {
  await expect.poll(() => document.activeElement).toBe(card(text));
  expect(card(text).closest("[data-row]")?.getAttribute("aria-current")).toBe("true");
  expect(document.querySelectorAll('[data-row][aria-current="true"]')).toHaveLength(1);
}

/** Presses Back once, as the user does. */
function back() {
  window.history.back();
}

/** Polls the location's path. */
function located() {
  return expect.poll(() => window.location.pathname);
}

async function nextIsLine() {
  await commands.writeRepo(nowHoldsNext(await commands.readRepo()));
}

describe("on the desktop", () => {
  atSize("desktop");

  test("Enter on a selected card opens the line at its address, the columns drawn behind", async () => {
    await show("/priorities", NEXT);
    await userEvent.keyboard("j");
    const first = document.activeElement as HTMLAnchorElement;
    expect(first.closest("[data-row]")).not.toBeNull();
    const address = new URL(first.href).pathname;
    await userEvent.keyboard("{Enter}");

    expect(await overlay()).toBeTruthy();
    await located().toBe(address);
    // The columns are still drawn behind it.
    for (const name of ["Now", "Next", "Later"]) {
      expect(screen.getByRole("region", { hidden: true, name })).toBeTruthy();
    }
  });

  test("the overlay is 108 characters wide and 60% of the window tall", async () => {
    await show("/priorities", NEXT);
    await userEvent.click(card(NEXT));
    const dialog = await overlay();
    await drawn();
    expect(charactersAcross(dialog)).toBeGreaterThanOrEqual(105);
    expect(charactersAcross(dialog)).toBeLessThanOrEqual(111);
    const tall = dialog.getBoundingClientRect().height / window.innerHeight;
    expect(tall).toBeGreaterThan(0.57);
    expect(tall).toBeLessThan(0.63);
  });

  test("after Next, Close leaves the last line selected and focused", async () => {
    await show("/priorities", NEXT);
    await userEvent.click(card(NEXT));
    const dialog = within(await overlay());
    await userEvent.click(dialog.getByRole("button", { name: "Next ›" }));
    await located().toMatch(/\/priorities\/git-listener$/);
    await drawn();
    await userEvent.click(dialog.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await isSelected(AFTER);
  });

  test("Escape closes the overlay, and the card is still selected and focused", async () => {
    await show("/priorities", NEXT);
    await userEvent.click(card(NEXT));
    await overlay();
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.location.pathname).toBe(atRepo("/priorities"));
    await isSelected(NEXT);
  });

  test("Escape closes the overlay after Next stepped it onto the last line", async () => {
    await show("/priorities", NEXT);
    await userEvent.click(card(NEXT));
    const dialog = within(await overlay());
    await userEvent.click(dialog.getByRole("button", { name: "Next ›" }));
    await located().toMatch(/\/priorities\/git-listener$/);
    await drawn();
    // The last line of Next: its Next is disabled, and the button that stepped goes with the focus.
    expect(dialog.getByRole("button", { name: "Next ›" }).hasAttribute("disabled")).toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.location.pathname).toBe(atRepo("/priorities"));
  });

  test("Back closes it in one press", async () => {
    await show("/priorities", NEXT);
    await userEvent.click(card(NEXT));
    await overlay();
    // One Back reaches the list: the click left one entry for it to go over. (The history's own
    // length stops at 100 entries in a long run, so it is not counted.)

    back();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.location.pathname).toBe(atRepo("/priorities"));
    await isSelected(NEXT);
  });

  test("Next steps to the next line and adds no history entry", async () => {
    await show("/priorities", NEXT);
    await userEvent.click(card(NEXT));
    const dialog = within(await overlay());
    const opened = window.history.length;

    await userEvent.click(dialog.getByRole("button", { name: "Next ›" }));

    await located().toMatch(/\/priorities\/git-listener$/);
    expect(await dialog.findByText(/Git listener process/)).toBeTruthy();
    expect(window.history.length).toBe(opened);
    // One Back still closes it.
    back();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.location.pathname).toBe(atRepo("/priorities"));
  });
});

describe("on the desktop, the history", () => {
  atSize("desktop");

  test("a reload on the address opens it again, and Back closes it in one press", async () => {
    await show("/priorities", NEXT);
    await userEvent.click(card(NEXT));
    await overlay();
    const opened = window.history.length;

    await reload("Claude Code runner");

    expect(await overlay()).toBeTruthy();
    expect(window.history.length).toBe(opened);
    back();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.location.pathname).toBe(atRepo("/priorities"));
  });

  test("an address typed or followed opens it, taking its entry once", async () => {
    await show("/priorities/git-listener", "Now");
    expect(await overlay()).toBeTruthy();
    // The columns are drawn behind it.
    expect(screen.getByRole("region", { hidden: true, name: "Next" })).toBeTruthy();

    back();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await located().toBe(atRepo("/priorities"));
  });

  test("the next line starts at its top, not where the last was read", async () => {
    const children = Array.from({ length: 40 }, (_, at) => `  - Detail ${at + 1}\n`).join("");
    const original = await commands.readRepo();
    await commands.writeRepo(
      original.replace(
        /## Now\n\n[^#]*## Next/,
        `## Now\n\n${["Tall one", "Tall two"].map((line) => `- ${line}\n${children}`).join("")}\n## Next`,
      ),
    );
    await show("/priorities", "Tall two");
    await userEvent.click(card("Tall one"));
    const dialog = within(await overlay());
    // What scrolls the overlay: the nearest ancestor of its buttons that does.
    let scrolling: HTMLElement | null = dialog.getByRole("button", { name: "Next ›" });
    while (
      scrolling &&
      !(
        /auto|scroll/.test(getComputedStyle(scrolling).overflowY) &&
        scrolling.scrollHeight > scrolling.clientHeight + 1
      )
    ) {
      scrolling = scrolling.parentElement;
    }
    expect(scrolling).not.toBeNull();
    scrolling!.scrollTop = scrolling!.scrollHeight;
    await expect.poll(() => scrolling!.scrollTop).toBeGreaterThan(0);

    await userEvent.click(dialog.getByRole("button", { name: "Next ›" }));

    await expect.poll(() => window.location.pathname).toMatch(/\/priorities\/tall-two$/);
    await expect.poll(() => scrolling!.scrollTop).toBe(0);
  });

  test("opening and closing keep the list's scroll", async () => {
    await page.viewport(1150, 300);
    await show("/priorities", NEXT);
    const row = screen.getByRole("region", { name: "Columns" });
    row.scrollLeft = 150;
    window.scrollTo(0, 40);
    await drawn();
    const place = { left: row.scrollLeft, top: window.scrollY };
    expect(place.left).toBeGreaterThan(0);
    expect(place.top).toBeGreaterThan(0);

    await userEvent.click(card(AFTER));
    await overlay();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await drawn();

    // The same elements, scrolled where they were: the list was never drawn again.
    expect(screen.getByRole("region", { name: "Columns" })).toBe(row);
    expect(row.scrollLeft).toBe(place.left);
    expect(window.scrollY).toBe(place.top);
  });
});

describe("on the desktop, a line that goes", () => {
  atSize("desktop");

  test("deleting from the overlay closes it and offers Undo", async () => {
    await show("/priorities", NEXT);
    await userEvent.click(card(NEXT));
    const dialog = within(await overlay());
    const opened = window.history.length;
    const gone = watchFor("That line is gone.");

    await userEvent.click(dialog.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText(/Deleted "Claude Code runner/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    expect(window.location.pathname).toBe(atRepo("/priorities"));
    expect(window.history.length).toBe(opened);
    expect(gone.stop()).toBe(false);
  });

  test("a gone line shows the page, no overlay, and That line is gone.", async () => {
    await show("/priorities/no-such-line", "Now");

    expect(await screen.findByText("That line is gone.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("region", { name: "Next" })).toBeTruthy();
    // The address is the list's, so a reload says nothing.
    await located().toBe(atRepo("/priorities"));
  });

  test("a priority opened from home opens over home, and Back returns to it", async () => {
    await nextIsLine();
    await show("/", NEXT);
    const before = window.history.length;
    await userEvent.click(screen.getByRole("link", { name: new RegExp(NEXT) }));

    expect(await overlay()).toBeTruthy();
    await located().toMatch(/\/priorities\/claude-code-runner-triggered-manually$/);
    // Home stays behind it, selected in the navigation.
    expect(screen.getByRole("link", { hidden: true, name: "Open priorities" })).toBeTruthy();
    const nav = screen.getByRole("navigation", { hidden: true, name: "Navigation" });
    expect(
      within(nav).getByRole("link", { hidden: true, name: "Home" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(window.history.length).toBeLessThanOrEqual(before + 2);

    back();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await located().toBe(atRepo("/"));
    expect(screen.getByRole("link", { name: "Open priorities" })).toBeTruthy();
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("a tap on a card opens a bottom sheet with a visible Close", async () => {
    await show("/priorities", NEXT);
    await userEvent.click(card(NEXT));

    const sheet = within(await overlay());
    await located().toMatch(/\/priorities\/claude-code-runner-triggered-manually$/);
    const close = sheet.getByRole("button", { name: "Close" });
    const box = close.getBoundingClientRect();
    expect(box.width).toBeGreaterThan(0);
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);

    await userEvent.click(close);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.location.pathname).toBe(atRepo("/priorities"));
    await isSelected(NEXT);
  });

  test("a drafted priority's sheet cuts none of its words", async () => {
    await show("/priorities", AFTER);
    await userEvent.click(card(AFTER));

    const sheet = await overlay();
    await within(sheet).findByRole("button", { name: "Start a change from this draft" });
    checkPage(sheet);
  });
});
