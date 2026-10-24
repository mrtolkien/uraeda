// The round's panes in WebKit, as ruling R3 opens them on the phone: only their titled top border,
// so their text takes the screen's width, the page's own text edge, with no side inset; a desktop
// keeps the pane's borders and its inset. Measured on the merge-chats round's Scope.
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { atSize, colorScheme, commands, drawn, repository, show } from "./helpers.tsx";

const FEATURE = "2026-10-11-web-ui";
const PAGE = `/f/${FEATURE}/clarifications-01.md`;
const FILE = `specs/${FEATURE}/clarifications-01.md`;
const SCOPE = /^Starting and listing chats and changes/;

/** The merge-chats round, as the web-ui feature's round, on its branch. */
async function mergeChats() {
  const round = await commands.fixtureText("round-merge-chats/clarifications-01.md");
  await commands.commitOnBranch(FEATURE, { [FILE]: round });
  await show(PAGE, "Who may move a chat up to a change, or a change up to a feature?");
  await drawn();
}

/** The left and right edges of the Scope pane, of its paragraph, and of the round's title. */
function edges() {
  const pane = screen.getByRole("region", { name: "Scope" }).getBoundingClientRect();
  const text = screen.getByText(SCOPE).getBoundingClientRect();
  const title = screen.getByRole("heading", { level: 1 }).getBoundingClientRect();
  return { pane, text, title };
}

describe("the round's panes on the phone", () => {
  atSize("phone");

  test("on the phone, the verdict's badge is as wide as its words, above its sentence", async () => {
    await mergeChats();

    // The badge's box: the first box around its words with a colour of its own.
    let badge: Element = screen.getByText("With changes");
    while (/transparent|rgba\(.*, 0\)$/.test(getComputedStyle(badge).backgroundColor)) {
      badge = badge.parentElement!;
    }
    const box = badge.getBoundingClientRect();
    const words = document.createRange();
    words.selectNodeContents(badge);
    const sentence = screen
      .getByText(/^a chat cannot become a change today/)
      .getBoundingClientRect();
    expect(box.width).toBeLessThan(words.getBoundingClientRect().width + 40);
    expect(box.bottom).toBeLessThanOrEqual(sentence.top + 1);
  });

  test("on the phone, a pane's text takes the screen's width, with no side inset", async () => {
    await mergeChats();

    const { pane, text, title } = edges();
    expect(Math.abs(text.left - pane.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(text.right - pane.right)).toBeLessThanOrEqual(1);
    // The pane is as wide as the page's text: the round's title starts at its edge.
    expect(Math.abs(pane.left - title.left)).toBeLessThanOrEqual(1);
    expect(pane.width).toBeGreaterThanOrEqual(window.innerWidth - 2 * 20);
  });
});

/** The widest line of text in an element, in px: its text's boxes, by the line they sit on. */
function longestLine(element: Element) {
  const lines = new Map<number, { left: number; right: number }>();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    // The pane's title, in its top border, is no line of its text.
    if (node.parentElement?.closest("h2, h3")) {
      continue;
    }
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (rect.width === 0) {
        continue;
      }
      const key = Math.round(rect.bottom);
      const line = lines.get(key) ?? { left: rect.left, right: rect.right };
      lines.set(key, {
        left: Math.min(line.left, rect.left),
        right: Math.max(line.right, rect.right),
      });
    }
  }
  return Math.max(0, ...[...lines.values()].map((line) => line.right - line.left));
}

/** The colour an element shows behind its text: its own background, or what it sits on. */
function paint(element: Element): string {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const colour = getComputedStyle(node).backgroundColor;
    if (colour !== "transparent" && !/^rgba\(.*, 0\)$/.test(colour)) {
      return colour;
    }
  }
  return getComputedStyle(document.documentElement).backgroundColor;
}

// The layout-look round, whose Q4 has an Example and a Why, over the page's background on the
// phone, with no band of another colour.
describe("the round's open panes on the phone, over the page", () => {
  atSize("phone");

  test.each(["light", "dark"] as const)(
    "in %s, a pane open on the phone shows the page's background, its title too",
    async (mode) => {
      await colorScheme(mode);
      const round = await commands.fixtureText("round-layout-look/clarifications-01.md");
      await commands.commitOnBranch(FEATURE, { [FILE]: round });
      await show(PAGE, "Where should the session open on the questions page?");
      await drawn();

      for (const name of ["Example", "Why it matters", "Scope"]) {
        const pane = screen.getAllByRole("region", { name })[0]!;
        const page = paint(pane.parentElement!);
        expect(paint(pane), name).toBe(page);
        expect(paint(pane.querySelector("h2, h3")!), `${name}'s title`).toBe(page);
      }
    },
  );
});

describe("the round's panes on the desktop", () => {
  atSize("desktop");

  test("on an answered round, the block's lines hold to the round's measure", async () => {
    const round = await commands.fixtureText("round-merge-chats/clarifications-01.md");
    await commands.commitOnBranch(FEATURE, {
      [FILE]: round.replace("status: awaiting-human", "status: answered"),
    });
    await show(PAGE, "Who may move a chat up to a change, or a change up to a feature?");
    await drawn();
    expect(window.innerWidth).toBe(1440);

    const pane = screen.getByRole("region", { name: /^7 questions and 1 follow-up/ });
    // The round's measure, in the reading font at its size, as the pane's text resolves it.
    const probe = document.createElement("div");
    probe.style.cssText =
      "font-family: var(--font-family-reading); font-size: var(--text-reading-size); width: var(--size-reading-measure)";
    pane.append(probe);
    const measure = probe.getBoundingClientRect().width;
    probe.remove();
    expect(measure).toBeGreaterThan(400);
    expect(longestLine(pane)).toBeLessThanOrEqual(measure + 1);
  });

  test("on the desktop, a pane keeps its inset", async () => {
    await mergeChats();

    const { pane, text } = edges();
    expect(text.left - pane.left).toBeGreaterThan(1);
  });
});

/** The first family of an element's computed font. */
const family = (element: Element) =>
  getComputedStyle(element).fontFamily.split(",")[0]!.replaceAll(/["']/g, "").trim();

/** The reading font, as the theme resolves it on the page. */
function readingFamily() {
  const probe = document.createElement("span");
  probe.style.fontFamily = "var(--font-family-reading)";
  document.body.append(probe);
  const name = family(probe);
  probe.remove();
  return name;
}

// The UI look decision's proportional font for long prose: a pane's paragraphs read as its lists do.
describe("the round's paragraphs", () => {
  atSize("both");

  test("the context's, a question's context's, and its Why's paragraphs are in the reading font", async () => {
    await mergeChats();

    const reading = readingFamily();
    expect(reading).toBe("Inter Variable");
    expect(family(screen.getByText(SCOPE))).toBe(reading);
    expect(family(screen.getByText(/^Starting a change or a feature is a human action/))).toBe(
      reading,
    );
    expect(family(screen.getByText(/^During an unattended run/))).toBe(reading);
    // "Why it matters", in its pane.
    expect(family(screen.getByText(/^This becomes a rule of the/))).toBe(reading);
  });
});

/** Whether an element draws a focus ring a person would see: an outline, or Astryx's ring shadow. */
function ringed(element: Element) {
  const style = getComputedStyle(element);
  const outline = style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
  return outline || style.boxShadow !== "none";
}

// A round reopened at the question it was left at gives that question's title the focus, for a
// screen reader, but no ring nobody asked for: no key was pressed.
describe("the round reopened at its question", () => {
  atSize("both");

  test("its title has the focus, without a ring", async () => {
    const round = await commands.fixtureText("round-merge-chats/clarifications-01.md");
    await commands.commitOnBranch(FEATURE, { [FILE]: round });
    window.localStorage.setItem(
      `uraeda.round.${repository()}/${FEATURE}/clarifications-01.md`,
      "Q3",
    );
    await show(PAGE, "Who may move a chat up to a change, or a change up to a feature?");
    await drawn();

    const title = document.activeElement!;
    expect(title.textContent).toBe("Does the chat's conversation become the change's session?");
    expect(ringed(title)).toBe(false);
  });
});
