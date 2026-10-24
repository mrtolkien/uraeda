// US3 of the spec page: a story or an HTML mockup draws in a live window, titled "live" with its
// name, its width, and its scale. A desktop width is scaled to the window's room, a phone's shown
// at 100% wherever it fits, and full screen shows it at 100% (Review focus 7), where the browser
// has no full screen too, as an overlay. An HTML mockup loads live at its link's width, with its
// query and anchor, which never reach the served path (Review focus 6), and one that fails to load
// says so, with a link to its page. At 390 px, the windows fit the screen (SC-006), and a window's
// title wraps under its buttons, never under them.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atRepo, atSize, checkPage, commands, show } from "./helpers.tsx";

const FEATURE = "2026-10-17-spec-page";
const SPEC = `specs/${FEATURE}/spec.md`;
const PAGE = `/f/${FEATURE}/spec.md`;
const STORY = "Repeat menu, open";
const HTML = "Title with a repeat phrase";
/** How long the fake preview may take to start and its story to load, on a loaded machine. */
const READY = { interval: 100, timeout: 20_000 };

/** A live window, a region named "live · <label>". */
const live = (label: string) => screen.getByRole("region", { name: `live · ${label}` });

/** The window's title, as it reads: "live · <label> · <width> px · <scale>%". */
const titleOf = (label: string) =>
  within(live(label)).getAllByRole("heading")[0]!.textContent ?? "";

/** The width and the scale the window's title says. */
function sizeOf(label: string) {
  const [, width, scale] = /(\d+) px · (\d+)%/.exec(titleOf(label)) ?? [];
  return { scale: Number(scale), width: Number(width) };
}

/** Shows the spec page, the window scrolled into view, once its frame shows its page. */
async function showWindow(label: string, frame: string, text: string) {
  await show(PAGE, "Recurring tasks");
  live(label).scrollIntoView({ block: "center" });
  await expect.poll(() => commands.frameText(frame), READY).toContain(text);
}

/**
 * Adds a paragraph after US4's mockup, committed on the feature's branch, whose commit a spec
 * waiting for review draws, and on disk in its worktree.
 */
async function addToSpec(text: string) {
  const path = `.worktrees/${FEATURE}/${SPEC}`;
  const link = `[${HTML}](mockups/title.html)`;
  const spec = (await commands.readRepo(path)).replace(link, `${link}\n\n${text}`);
  await commands.writeRepo(spec, path);
  await commands.commitOnBranch(FEATURE, { [SPEC]: spec });
}

describe("on a desktop", () => {
  atSize("desktop");

  test("a story's window says live, its size, and its scale (US3 1, more 1)", async () => {
    await commands.addSpecFeature({ stories: true });
    await showWindow(STORY, `${STORY}, desktop`, "Open");

    expect(titleOf(STORY)).toMatch(/^live · Repeat menu, open/);
    await expect.poll(() => sizeOf(STORY).width).toBe(1440);
    expect(sizeOf(STORY).scale).toBeGreaterThan(0);
    expect(sizeOf(STORY).scale).toBeLessThan(100);

    await userEvent.click(within(live(STORY)).getByRole("radio", { name: "Phone" }));

    await expect.poll(() => titleOf(STORY)).toContain("402 px · 100%");
    const frame = within(live(STORY)).getByTitle(`${STORY}, phone`);
    expect(frame.getBoundingClientRect().width).toBe(402);
  });

  test("an HTML mockup draws live, in the same window (US3 2)", async () => {
    await commands.addSpecFeature({ stories: true });
    await showWindow(HTML, `${HTML}, 1440 px`, "every monday");

    expect(sizeOf(HTML).width).toBe(1440);
    expect(sizeOf(HTML).scale).toBeLessThan(100);
    const frame = within(live(HTML)).getByTitle(`${HTML}, 1440 px`);
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(screen.queryByRole("link", { name: HTML })).toBeNull();
  });

  test("the query sets the width, and loads with the anchor (Review focus 6)", async () => {
    await commands.addSpecFeature({ stories: true });
    await addToSpec("[Narrow title](mockups/title.html?w=390&doc=plan#x)");
    await showWindow("Narrow title", "Narrow title, 390 px", "every monday");

    expect(titleOf("Narrow title")).toContain("390 px · 100%");
    const frame = within(live("Narrow title")).getByTitle("Narrow title, 390 px");
    expect(frame.getBoundingClientRect().width).toBe(390);
    const src = new URL(frame.getAttribute("src")!, window.location.href);
    expect(src.pathname).toBe(atRepo(`/mockups/specs/${FEATURE}/mockups/title.html`));
    expect(src.search).toBe("?w=390&doc=plan");
    expect(src.hash).toBe("#x");
  });

  test("a missing mockup says so, with a link to its page", async () => {
    await commands.addSpecFeature({ stories: true });
    await addToSpec("[Gone](mockups/gone.html)");
    await show(PAGE, "Recurring tasks");

    const gone = live("Gone");
    // Checked once its window is on screen.
    gone.scrollIntoView({ block: "center" });
    expect(
      await within(gone).findByText("This mockup could not be loaded.", {}, READY),
    ).toBeTruthy();
    const link = within(gone).getByRole("link", { name: "Open the mockup's page" });
    expect(link.getAttribute("href")).toBe(atRepo(`/f/${FEATURE}/mockups/gone.html`));
  });
});

describe("full screen, on a desktop", () => {
  atSize("desktop");

  test("full screen shows the mockup at 100% (US3 3, Review focus 7)", async () => {
    await commands.addSpecFeature({ stories: true });
    await showWindow(STORY, `${STORY}, desktop`, "Open");
    expect(sizeOf(STORY).scale).toBeLessThan(100);

    await userEvent.click(within(live(STORY)).getByRole("button", { name: "Full screen" }));

    await expect.poll(() => sizeOf(STORY).scale).toBe(100);
    const frame = within(live(STORY)).getByTitle(`${STORY}, desktop`);
    expect(frame.getBoundingClientRect().width).toBe(1440);
    await userEvent.click(within(live(STORY)).getByRole("button", { name: "Leave full screen" }));
    await expect.poll(() => sizeOf(STORY).scale).toBeLessThan(100);
  });

  test("without the browser's full screen, as on an iPhone, the window covers the screen at 100%", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
    try {
      await commands.addSpecFeature({ stories: true });
      await showWindow(STORY, `${STORY}, desktop`, "Open");

      await userEvent.click(within(live(STORY)).getByRole("button", { name: "Full screen" }));

      await expect.poll(() => sizeOf(STORY).scale).toBe(100);
      const frame = within(live(STORY)).getByTitle(`${STORY}, desktop`);
      expect(frame.getBoundingClientRect().width).toBe(1440);
      expect(document.fullscreenElement).toBeNull();
      const figure = screen.getByRole("figure", { name: STORY });
      const box = figure.getBoundingClientRect();
      expect([box.top, box.left, box.width]).toEqual([0, 0, window.innerWidth]);
      expect(figure.contains(document.elementFromPoint(window.innerWidth / 2, 4))).toBe(true);

      await userEvent.keyboard("{Escape}");
      await expect.poll(() => sizeOf(STORY).scale).toBeLessThan(100);
      expect(figure.getBoundingClientRect().width).toBeLessThan(window.innerWidth);

      await userEvent.click(within(live(STORY)).getByRole("button", { name: "Full screen" }));
      await expect.poll(() => sizeOf(STORY).scale).toBe(100);
      window.history.back();
      await expect.poll(() => sizeOf(STORY).scale).toBeLessThan(100);
    } finally {
      delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled;
    }
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("at 390 px, a desktop story is scaled to the screen, its title clear of its buttons (US3 more 2, SC-006)", async () => {
    await commands.addSpecFeature({ stories: true });
    await showWindow(STORY, `${STORY}, phone`, "Open");
    // The phone's width first, on the phone.
    await expect.poll(() => sizeOf(STORY).width).toBe(402);

    await userEvent.click(within(live(STORY)).getByRole("radio", { name: "Desktop" }));

    await expect.poll(() => sizeOf(STORY).width).toBe(1440);
    expect(sizeOf(STORY).scale).toBeLessThan(50);
    // The title's every line, clear of every button in the window's top border.
    const heading = within(live(STORY)).getAllByRole("heading")[0]!;
    const range = document.createRange();
    range.selectNodeContents(heading);
    const lines = [...range.getClientRects()].filter((line) => line.width > 0);
    const buttons = [
      ...within(live(STORY)).queryAllByRole("button"),
      ...within(live(STORY)).queryAllByRole("radio"),
      ...within(live(STORY)).queryAllByRole("link"),
    ]
      .map((button) => button.getBoundingClientRect())
      .filter((box) => box.width > 0);
    expect(buttons.length).toBeGreaterThan(0);
    for (const line of lines) {
      for (const box of buttons) {
        const overlaps =
          line.left < box.right &&
          box.left < line.right &&
          line.top < box.bottom &&
          box.top < line.bottom;
        expect(overlaps, `${heading.textContent} under a button`).toBe(false);
      }
    }
    checkPage();
  });
});
