// Shared by the browser tests: rendering a page against the test server, and the layout checks of
// the UI checks decision. Every browser test runs at a phone's and a desktop's size (see
// `vite.browser.config.ts`): a test reads `window.innerWidth` for what differs between them.
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "../theme/built/uraeda.css";
import "../styles.css";
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
    // Nothing reaches past the screen's edge.
    const box = element.getBoundingClientRect();
    if (box.width > 4) {
      expect(box.right, name).toBeLessThanOrEqual(window.innerWidth + 1);
    }
  }
  for (const paragraph of main.querySelectorAll(".page p:not(.small):not(.muted), .summary")) {
    expect(
      parseFloat(getComputedStyle(paragraph).fontSize),
      paragraph.outerHTML.slice(0, 160),
    ).toBeGreaterThanOrEqual(16);
  }
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
