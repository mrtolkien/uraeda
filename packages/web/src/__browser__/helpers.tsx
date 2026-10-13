// Shared by the browser tests: rendering a page against the test server, and the layout checks of
// the UI checks decision. Every browser test runs at a phone's and a desktop's size (see
// `vite.browser.config.ts`): a test reads `window.innerWidth` for what differs between them.
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "../theme/built/uraeda.css";
import axe from "axe-core";
import { createRoot, type Root } from "react-dom/client";
import { createFateClient } from "react-fate/client";
import { configure, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { App } from "../App.tsx";

// CI's WebKit draws without a GPU: what it shows takes longer to appear than on a desktop.
configure({ asyncUtilTimeout: 5_000 });

const commands = browserCommands as unknown as RepoCommands;

let root: Root | undefined;

// Every test has the repository to itself, a fresh copy of the fixture: the phone's and the
// desktop's tests run at the same time, and one that changes it would change what another shows.
let turn: number | undefined;

beforeEach(async () => {
  // What a page remembers, like the question a round was left at, is another test's.
  window.localStorage.clear();
  turn = await commands.takeRepo();
});

afterEach(async () => {
  root?.unmount();
  document.body.innerHTML = "";
  if (turn !== undefined) {
    await commands.releaseRepo(turn);
    turn = undefined;
  }
});

/** Renders the UI at a path, against the test server's own `/fate`, and waits for a text. */
export async function show(path: string, text: string) {
  // A history entry of its own: the test files share the frame's history, and Back must not reach an
  // entry another test left.
  window.history.pushState(null, "", path);
  // A page shown before in the test leaves, as the browser's own would.
  root?.unmount();
  document.body.innerHTML = "";
  await mount(text);
}

/**
 * Renders the UI again on the current history entry, as a reload does, and waits for a text: the
 * entry's state, like its saved position, is kept.
 */
export async function reload(text: string) {
  root?.unmount();
  document.body.innerHTML = "";
  await mount(text);
}

async function mount(text: string) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  root.render(<App client={createFateClient({ url: "/fate" })} />);
  await expect
    .poll(() => document.body.textContent?.includes(text), { timeout: 15_000 })
    .toBe(true);
  await drawn();
}

/**
 * Waits for the fonts to load, the layout they change to be drawn, and the transitions under way to
 * end, as a button's colours fading in: the checks measure the page at rest.
 */
export async function drawn() {
  await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await Promise.all(
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => undefined)),
  );
}

/**
 * Watches the page for a text from now on, as "Loading…" that must never show: `stop` ends the
 * watch and says whether the text showed.
 */
export function watchFor(text: string) {
  let seen = document.body.textContent?.includes(text) ?? false;
  const observer = new MutationObserver(() => {
    seen ||= document.body.textContent?.includes(text) ?? false;
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return {
    stop() {
      observer.disconnect();
      return seen;
    },
  };
}

/**
 * Waits for the page to stop scrolling: the same position over 200 ms. Call it once a scroll has
 * started, as after a poll for where a jump goes.
 */
export async function scrollStopped() {
  let last = Number.NaN;
  await expect
    .poll(
      () => {
        const same = window.scrollY === last;
        last = window.scrollY;
        return same;
      },
      { interval: 200 },
    )
    .toBe(true);
}

/** Whether an element sits inside one meant to scroll sideways: a table or code. */
function scrolls(element: Element) {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowX;
    if (overflow === "auto" || overflow === "scroll") {
      return true;
    }
  }
  return false;
}

/** The left edge of an element's text. */
function textLeft(element: Element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  return Math.min(...[...range.getClientRects()].map((rect) => rect.left));
}

/** The region a check reads: the main region by default, or another, like the navigation. */
function region(root?: Element) {
  return root ?? document.querySelector('[role="main"]') ?? document.body;
}

export function checkPage(root?: Element) {
  // Nothing scrolls the page sideways.
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  const main = region(root);
  for (const element of main.querySelectorAll("*")) {
    const style = getComputedStyle(element);
    const name = element.outerHTML.slice(0, 120);
    expect(style.getPropertyValue("-webkit-line-clamp") || "none", name).toBe("none");
    if (scrolls(element)) {
      continue;
    }
    // No text is cut where an element clips it, by an ellipsis or not; visually hidden elements,
    // a few pixels wide, are for screen readers.
    const clips =
      style.textOverflow === "ellipsis" ||
      style.overflowX === "hidden" ||
      style.overflowX === "clip";
    if (clips && element.clientWidth > 4) {
      expect(element.scrollWidth, name).toBeLessThanOrEqual(element.clientWidth + 1);
    }
    // An ellipsis shows for any overflow, a fraction of a pixel too, which the rounded widths
    // above miss: the text's own width must fit inside the box.
    if (style.textOverflow === "ellipsis" && element.clientWidth > 4) {
      const range = document.createRange();
      range.selectNodeContents(element);
      const inner =
        element.getBoundingClientRect().width -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      expect(range.getBoundingClientRect().width, name).toBeLessThanOrEqual(inner);
    }
    // Nothing reaches past the screen's edge.
    const box = element.getBoundingClientRect();
    if (box.width > 4) {
      expect(box.right, name).toBeLessThanOrEqual(window.innerWidth + 1);
    }
  }
}

/** The region's paragraphs that show. */
function paragraphs(root?: Element) {
  const main = region(root);
  return [...main.querySelectorAll("p")].filter((p) => p.getBoundingClientRect().width > 4);
}

/**
 * The UI layout decision's text sizes (SC-004, US6 1, 2): paragraphs are 17 px under 1024 px wide,
 * 19 px from 1024 px.
 */
export function checkTextSizes(root?: Element) {
  const size = window.innerWidth >= 1024 ? 19 : 17;
  for (const paragraph of paragraphs(root)) {
    expect(
      parseFloat(getComputedStyle(paragraph).fontSize),
      paragraph.textContent?.slice(0, 60),
    ).toBe(size);
  }
}

/** Ordinary lowercase text, spaces included, whose width gives a font's average character. */
const SAMPLE =
  "the reading measure holds about a hundred characters of ordinary text on each line ";

/**
 * How many average characters of its own font the longest line of an element holds: its width over
 * the width of an average character, so the count does not depend on the text, nor on the fonts a
 * machine has.
 */
function longestLine(element: Element) {
  // Lines by the block that holds them and their bottom: a toggle's letter or badge beside its text
  // is not part of its text's lines.
  const lines = new Map<string, { left: number; right: number; block: Element }>();
  const blocks = new Map<Element, number>();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let block = node.parentElement!;
    while (block !== element && getComputedStyle(block).display.startsWith("inline")) {
      block = block.parentElement!;
    }
    if (!blocks.has(block)) {
      blocks.set(block, blocks.size);
    }
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (rect.width === 0) {
        continue;
      }
      const key = `${blocks.get(block)}:${Math.round(rect.bottom)}`;
      const seen = lines.get(key);
      lines.set(key, {
        left: Math.min(seen?.left ?? rect.left, rect.left),
        right: Math.max(seen?.right ?? rect.right, rect.right),
        block,
      });
    }
  }
  return Math.max(
    0,
    ...[...lines.values()].map(({ left, right, block }) =>
      Math.round((right - left) / averageCharacter(block)),
    ),
  );
}

/** The width of an average character of an element's font. */
function averageCharacter(element: Element) {
  const style = getComputedStyle(element);
  const context = document.createElement("canvas").getContext("2d")!;
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return context.measureText(SAMPLE).width / SAMPLE.length;
}

/**
 * No line of reading text holds more than about 125 characters (the UI layout decision): paragraphs, and the
 * toggles that hold text of their own, like a question's options.
 */
export function checkMeasure(root?: Element) {
  const main = region(root);
  const toggles = [...main.querySelectorAll("[aria-pressed]")].filter(
    (toggle) => toggle.textContent?.trim() && toggle.getBoundingClientRect().width > 4,
  );
  for (const paragraph of [...paragraphs(root), ...toggles]) {
    expect(longestLine(paragraph), paragraph.textContent?.slice(0, 60)).toBeLessThanOrEqual(125);
  }
}

/**
 * Text is left-aligned, never centred or justified (the UI layout decision): every run of text of
 * three words or more outside a control, whose own label a control may centre.
 */
export function checkAlignment(root?: Element) {
  const main = region(root);
  for (const element of main.querySelectorAll("*")) {
    const own = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join("")
      .trim();
    if (own.split(/\s+/).length < 3 || element.closest(CONTROLS)) {
      continue;
    }
    expect(getComputedStyle(element).textAlign, own.slice(0, 60)).toMatch(
      /^(start|left|-webkit-auto)$/,
    );
  }
}

/** What a tap or a key acts on: buttons, fields, links set apart from text, and widgets. */
const CONTROLS = [
  "button",
  "input",
  "textarea",
  "select",
  "a[href]",
  '[role="button"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
].join(", ");

/**
 * Where a tap reaches a control: the control with its labels, which a tap also activates, or the
 * largest box around them that shows a pointer, like a row tappable as a whole around its link.
 */
function tapArea(control: Element) {
  let area = control;
  for (const label of (control as HTMLInputElement).labels ?? []) {
    while (!area.contains(label) && area.parentElement) {
      area = area.parentElement;
    }
  }
  for (
    let node = area.parentElement;
    node && getComputedStyle(node).cursor === "pointer";
    node = node.parentElement
  ) {
    area = node;
  }
  return area;
}

/** The block an inline element's text runs in. */
function lineOf(element: Element) {
  let node = element.parentElement;
  while (node?.parentElement && /^(inline|contents)/.test(getComputedStyle(node).display)) {
    node = node.parentElement;
  }
  return node ?? element;
}

/**
 * Under a coarse pointer, every control the page shows is at least 44 px tall where a tap reaches
 * it (SC-004, US6 2). Text sets its own size: a link in a line of text, and a block of document
 * text tappable as a whole, as a review's blocks are; a read-only box only shows a state.
 */
export function checkControlHeights() {
  if (!window.matchMedia("(pointer: coarse)").matches) {
    return;
  }
  const short: string[] = [];
  for (const control of document.querySelectorAll(CONTROLS)) {
    const box = control.getBoundingClientRect();
    const style = getComputedStyle(control);
    // Hidden, or visually hidden for screen readers.
    if (box.width <= 4 || box.height <= 4 || style.visibility === "hidden") {
      continue;
    }
    const own = control.textContent?.trim().length ?? 0;
    const area = tapArea(control);
    const inText =
      control.matches("a[href]") &&
      style.display.startsWith("inline") &&
      (lineOf(control).textContent?.trim().length ?? 0) > own;
    const textBlock =
      own === 0 && area !== control && !(control as HTMLInputElement).labels?.length;
    const readOnly = control.matches('[readonly], [aria-readonly="true"]');
    if (inText || textBlock || readOnly) {
      continue;
    }
    const height = area.getBoundingClientRect().height;
    if (height < 44) {
      const label = control.getAttribute("aria-label") ?? control.textContent?.slice(0, 40);
      short.push(
        `${control.tagName} ${control.getAttribute("type") ?? ""} "${label}": ${height} px`,
      );
    }
  }
  expect(short).toEqual([]);
}

/** On the phone, the text of the elements starts within 50 px of the screen's left edge. */
export function checkInsets(selector: string) {
  if (window.innerWidth >= 768) {
    return;
  }
  const elements = [...document.querySelectorAll(selector)];
  expect(elements.length, selector).toBeGreaterThan(0);
  for (const element of elements) {
    expect(textLeft(element), element.textContent?.slice(0, 60)).toBeLessThanOrEqual(50);
  }
}

/** axe-core's WCAG 2.1 A and AA rules, on the whole document. */
export async function checkAccessibility() {
  const results = await axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  });
  const violations = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes
        .slice(0, 3)
        .map((node) => node.html.slice(0, 120))
        .join(" | ")}`,
  );
  expect(violations).toEqual([]);
}

/**
 * Every layout check of the UI checks decision on a region, the main one by default: no text cut,
 * no sideways scroll, the text sizes, control heights, measure, and alignment, then axe-core's
 * WCAG 2.1 A and AA rules on the whole document.
 */
export async function checkLayout(root?: Element) {
  checkPage(root);
  checkTextSizes(root);
  checkControlHeights();
  checkMeasure(root);
  checkAlignment(root);
  await checkAccessibility();
}

/** How long a session's live updates may take to arrive, throttled by the server, on a busy machine. */
export const LIVE = { timeout: 10_000 };

/** Waits for live updates and layout to settle. */
export const settle = () => new Promise((resolve) => setTimeout(resolve, 500));

/** The agent of the test server, which the tests drive as Claude Code would print. */
export const agent = commands;

/** Types a message in the composer and presses Send, as the human does. */
export async function sendMessage(text: string) {
  const sent = (await commands.agentSent()).length;
  const box = await screen.findByRole("textbox", { name: "Message Claude Code" }, LIVE);
  await userEvent.fill(box, text);
  await userEvent.click(await screen.findByRole("button", { name: "Send" }));
  await expect.poll(async () => (await commands.agentSent()).length, LIVE).toBe(sent + 1);
}

/**
 * Starts a turn with a message the agent reads, then sends `events` on it: the session works until
 * the test ends its turn.
 */
export async function startTurn(text: string, events: Parameters<RepoCommands["agentEmit"]>[0]) {
  await sendMessage(text);
  await commands.agentAccept();
  await commands.agentEmit(events);
  // The composer's Stop, and the agent section's beside it on a wide screen.
  await screen.findAllByRole("button", { name: "Stop" }, LIVE);
}
