// Shared by the browser tests: rendering a page against the test server, and the layout checks of
// the UI checks decision. Every browser test runs at a phone's and a desktop's size (see
// `vite.browser.config.ts`): a test reads `window.innerWidth` for what differs between them.
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "../theme/built/uraeda.css";
import { createRoot, type Root } from "react-dom/client";
import { createFateClient } from "react-fate/client";
import { afterEach, expect } from "vite-plus/test";
import { App } from "../App.tsx";

let root: Root | undefined;

afterEach(() => {
  root?.unmount();
  document.body.innerHTML = "";
});

/** Renders the UI at a path, against the test server's own `/fate`, and waits for a text. */
export async function show(path: string, text: string) {
  window.history.replaceState(null, "", path);
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
  // Fonts and layout settle.
  await new Promise((resolve) => setTimeout(resolve, 300));
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

export function checkPage() {
  // Nothing scrolls the page sideways.
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  const main = document.querySelector('[role="main"]') ?? document.body;
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

/** The main region's paragraphs that show. */
function paragraphs() {
  const main = document.querySelector('[role="main"]') ?? document.body;
  return [...main.querySelectorAll("p")].filter((p) => p.getBoundingClientRect().width > 4);
}

/**
 * The UI layout decision's text sizes (SC-004, US6 1, 2): paragraphs are 17 px under 1024 px wide,
 * 19 px from 1024 px.
 */
export function checkTextSizes() {
  const size = window.innerWidth >= 1024 ? 19 : 17;
  for (const paragraph of paragraphs()) {
    expect(
      parseFloat(getComputedStyle(paragraph).fontSize),
      paragraph.textContent?.slice(0, 60),
    ).toBe(size);
  }
}

/** The most characters on one line of an element's text. */
function longestLine(element: Element) {
  const lines = new Map<number, number>();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    for (let i = 0; i < text.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getClientRects()[0];
      if (rect && rect.width > 0) {
        const line = Math.round(rect.bottom);
        lines.set(line, (lines.get(line) ?? 0) + 1);
      }
    }
  }
  return Math.max(0, ...lines.values());
}

/** No line of a paragraph holds more than about 75 characters (US6 3). */
export function checkMeasure() {
  for (const paragraph of paragraphs()) {
    expect(longestLine(paragraph), paragraph.textContent?.slice(0, 60)).toBeLessThanOrEqual(75);
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
