// Shared by the browser tests: rendering a page against the test server, and the layout checks of
// the UI checks decision. The browser tests run at a phone's and a desktop's size (see
// `vite.browser.config.ts`): a test declares the size its scenario is about with `atSize`, and one
// at both sizes reads `window.innerWidth` for what differs between them.
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "../theme/built/uraeda.css";
import axe from "axe-core";
import { createRoot, type Root } from "react-dom/client";
import { configure, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, TestRunner } from "vite-plus/test";
import { commands as browserCommands, server, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { App } from "../App.tsx";
import { fateClients } from "../clients.ts";

// CI's WebKit draws without a GPU: what it shows takes longer to appear than on a desktop. A
// wait's bound is no duration check, and 10 s fails no loaded machine (R9, R14 of the testing
// review); the 30 s test timeout still stops a hang.
configure({ asyncUtilTimeout: 10_000 });

const commands = browserCommands as unknown as RepoCommands;

let root: Root | undefined;

// Every test has a repository of its own, a fresh copy of the fixture under its own name: the
// phone's and the desktop's tests run at the same time, and one that changes it would change what
// another shows. The turn is the shared fake agent's.
let turn: number | undefined;
/** The name of the test's repository: its pages are under `/r/<name>/`. */
let name = "";

/** The name of the test's repository in the test server's list. */
export function repository(): string {
  return name;
}

/** A path of the UI, `/priorities` for one, in the test's repository. */
export function atRepo(path: string): string {
  return `/r/${encodeURIComponent(name)}${path}`;
}

/** The instance's size: the phone's under 768 px wide, as the UI's narrow layout. */
const size = server.config.browser.viewport.width < 768 ? "phone" : "desktop";

/**
 * Declares the size a file's or a `describe` block's tests are about, called at its top: at the other
 * size, every test declared after it in that scope is skipped, as `test.skip` would, so no hook runs
 * for it and it takes no repository. A call after a test of its scope, or inside a test, throws: it
 * could not skip the tests already declared.
 */
export function atSize(only: "phone" | "desktop" | "both") {
  const scope = TestRunner.getCurrentSuite();
  // Checked at both sizes: a misplaced call fails at the size it would not skip at too.
  if (TestRunner.getCurrentTest() !== undefined || scope.tasks.length > 0) {
    throw new Error(
      "atSize was called after a test was declared, or inside one: call atSize before the tests of its file or describe block",
    );
  }
  if (only !== "both" && only !== size) {
    // The options the scope's tests and blocks are declared with: `skip` makes each a `test.skip`.
    scope.options = { ...scope.options, skip: true };
  }
}

/** Sets the system's colour scheme, which the UI's theme follows (R5). */
export async function colorScheme(mode: "light" | "dark") {
  await (
    browserCommands as unknown as { setColorScheme(mode: "light" | "dark"): Promise<void> }
  ).setColorScheme(mode);
}

/** Sets whether the system asks for reduced motion. */
export async function reducedMotion(reduce: boolean) {
  await (
    browserCommands as unknown as { setReducedMotion(reduce: boolean): Promise<void> }
  ).setReducedMotion(reduce);
}

beforeEach(async () => {
  // What a page remembers, like the question a round was left at, is another test's.
  window.localStorage.clear();
  // The banner that asks to notify shows above every page until dismissed: a test of its own shows it.
  window.localStorage.setItem("uraeda.notifications", "dismissed");
  await colorScheme("light");
  ({ name, token: turn } = await commands.takeRepo());
});

afterEach(async () => {
  root?.unmount();
  document.body.innerHTML = "";
  if (turn !== undefined) {
    await commands.releaseRepo(turn);
    turn = undefined;
  }
});

/**
 * Renders the UI at a path of the test's repository, `/priorities` for one, against the test
 * server's own fate endpoints, and waits for a text.
 */
export async function show(path: string, text: string) {
  // A history entry of its own: the test files share the frame's history, and Back must not reach an
  // entry another test left.
  window.history.pushState(null, "", atRepo(path));
  // A page shown before in the test leaves, as the browser's own would.
  root?.unmount();
  document.body.innerHTML = "";
  await mount(text);
}

/**
 * Renders the UI at a path of the test's repository and waits until the page has drawn its data: a
 * heading, and no "Loading…". The page checks and flows name no text of the product to wait for.
 */
export async function opened(path: string) {
  await show(path, "");
  await expect
    .poll(
      () =>
        document.querySelector("h1, h2, h3") !== null &&
        !document.body.textContent?.includes("Loading…"),
    )
    .toBe(true);
  await grown();
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
  root.render(<App clientFor={fateClients()} />);
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
  observer.observe(document.body, { characterData: true, childList: true, subtree: true });
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

/**
 * Waits for the page to stop growing, as the sections of an opened line draw one by one: the same
 * height over 200 ms, then drawn.
 */
export async function grown() {
  let last = Number.NaN;
  await expect
    .poll(
      () => {
        const height = document.documentElement.scrollHeight;
        const same = height === last;
        last = height;
        return same;
      },
      { interval: 100, timeout: 10_000 },
    )
    .toBe(true);
  await drawn();
}

/**
 * Whether an element sits inside one that scrolls sideways, as a table or code may: one that only
 * scrolls down, like a pane or the navigation, does not excuse the text it cuts.
 */
function scrolls(element: Element) {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowX;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollWidth > node.clientWidth + 1) {
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
    // A chat's title in the navigation is cut by an ellipsis on purpose.
    if (scrolls(element) || element.closest('nav a[href*="/chats/"]')) {
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
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight);
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
      Number.parseFloat(getComputedStyle(paragraph).fontSize),
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
  const lines = new Map<string, { block: Element; left: number; right: number }>();
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
        block,
        left: Math.min(seen?.left ?? rect.left, rect.left),
        right: Math.max(seen?.right ?? rect.right, rect.right),
      });
    }
  }
  return Math.max(
    0,
    ...[...lines.values()].map(({ block, left, right }) =>
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
 * No line of reading text holds more than about 110 characters, the theme's reading measure (the UI
 * layout decision): paragraphs, and the toggles that hold text of their own, like a review's
 * blocks and a question's option cards.
 */
export function checkMeasure(root?: Element, limit = 115) {
  const main = region(root);
  const toggles = [...main.querySelectorAll("[aria-pressed], .astryx-selectable-card")].filter(
    (toggle) => toggle.textContent?.trim() && toggle.getBoundingClientRect().width > 4,
  );
  for (const paragraph of [...paragraphs(root), ...toggles]) {
    expect(longestLine(paragraph), paragraph.textContent?.slice(0, 60)).toBeLessThanOrEqual(limit);
  }
}

/** Whether an element is in an item of an ordered list drawn as a row, like a stepper's stage. */
function inRow(element: Element) {
  const list = element.closest("ol > li")?.parentElement;
  return list !== null && list !== undefined && getComputedStyle(list).flexDirection === "row";
}

/**
 * Text is left-aligned, never centred or justified (the UI layout decision): every run of text of
 * three words or more outside a control, whose own label a control may centre, and outside the
 * steps of a row, each step's caption centred under its own mark (R101).
 */
export function checkAlignment(root?: Element) {
  const main = region(root);
  for (const element of main.querySelectorAll("*")) {
    const own = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join("")
      .trim();
    if (own.split(/\s+/).length < 3 || element.closest(CONTROLS) || inRow(element)) {
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
 * it (SC-004, US6 2). Text sets its own size: a link in a line of text or a table's cell, and a block of document
 * text tappable as a whole, as a review's blocks are; a read-only box only shows a state.
 */
export function checkControlHeights() {
  if (!window.matchMedia("(pointer: coarse)").matches) {
    return;
  }
  const short: Array<string> = [];
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
    // A link in a table's cell is text of the table, sized by its columns as text is.
    const inCell = control.matches("a[href]") && control.closest("td, th") !== null;
    if (inText || textBlock || readOnly || inCell) {
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
 * axe-core's WCAG 2.1 A and AA rules, on the whole document:
 * the page checks' accessibility rules, which hold no size of our own.
 */
export async function checkAccessible() {
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

/** The agent of the test server, which the tests drive as Claude Code would print. */
export const agent = commands;

/** The test server's commands: the repository's files, the test feature, and the page's frames. */
export { commands };

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
 * the test ends its turn. With `path`, the page at that path is shown first.
 */
export async function startTurn(
  text: string,
  events: Parameters<RepoCommands["agentEmit"]>[0],
  path?: string,
) {
  if (path !== undefined) {
    await show(path, "");
  }
  await sendMessage(text);
  await commands.agentAccept();
  await commands.agentEmit(events);
  // The composer's Stop.
  await screen.findByRole("button", { name: "Stop" }, LIVE);
}

const TYPES: Record<string, string> = {
  gif: "image/gif",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

/** A fixture image as the file the human gives, under a name of their own. */
export async function image(fixture: string, name = fixture) {
  const bytes = Uint8Array.from(atob(await commands.fixtureImage(fixture)), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: TYPES[name.split(".").at(-1)!] ?? "" });
}

/** Files carried by a drag or a paste. */
export function carrying(files: Array<File>) {
  const data = new DataTransfer();
  for (const file of files) {
    data.items.add(file);
  }
  return data;
}

/** Drags files over the page and drops them on an element: returns the drop's event. */
export function drop(files: Array<File>, on: Element = document.body) {
  const dataTransfer = carrying(files);
  const init = { bubbles: true, cancelable: true, dataTransfer };
  on.dispatchEvent(new DragEvent("dragenter", init));
  on.dispatchEvent(new DragEvent("dragover", init));
  const event = new DragEvent("drop", init);
  on.dispatchEvent(event);
  return event;
}

/** Pastes files into an element, as from the clipboard. */
export function paste(files: Array<File>, on: Element) {
  on.dispatchEvent(
    new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: carrying(files),
    }),
  );
}

/** Drags files over an element and holds them there, as before a drop: the drop hint shows. */
export function dragOver(files: Array<File>, on: Element = document.body) {
  const init = { bubbles: true, cancelable: true, dataTransfer: carrying(files) };
  on.dispatchEvent(new DragEvent("dragenter", init));
  on.dispatchEvent(new DragEvent("dragover", init));
}

/** Ends a drag held over the page, as a drag cancelled by Escape. */
export function dragEnd() {
  window.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
}

/** Saves an image next to a markdown file of the repository, as "Add image" does: its link. */
export async function attached(path: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  const query = `path=${encodeURIComponent(path)}&name=${encodeURIComponent(file.name)}`;
  const response = await fetch(atRepo(`/attach?${query}`), { body, method: "POST" });
  const answer = (await response.json()) as { error?: string; link?: string };
  if (!answer.link) {
    throw new Error(answer.error ?? `HTTP ${response.status}`);
  }
  return answer.link;
}
