// The scroll fallback of the base keymap: on a page with no rows to move through, the vertical keys
// scroll, as a registry default that no page copies. It runs only where no binding of the page
// handled the key (a list that declared `j` moves its selection and nothing scrolls), on the area
// holding the focus, else the page. The scrolling is what a page does anyway, so it has no hint.
import { useKeys } from "./registry.tsx";
import type { Binding } from "./store.ts";

/** A step of the vertical keys, in lines of the page's text. */
const LINES = 3;

/** What a line is when the page's own is `normal`: the usual ratio to the font's size. */
const NORMAL_LINE = 1.5;

/** What a line is where nothing says, in px. */
const FALLBACK_LINE = 24;

/** The area a key scrolls: the focus's nearest ancestor that scrolls, else the page's window. */
type Area = Element | null;

/** Whether an element holds more than it shows, and lets its reader scroll to the rest. */
function scrolls(element: Element) {
  const { overflowY } = getComputedStyle(element);
  return (
    (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
    element.scrollHeight > element.clientHeight
  );
}

/** The nearest ancestor of `target`, itself included, that scrolls: `null` for the page. */
function areaOf(target: EventTarget | null): Area {
  // An element, as the registry reads its target: a node of type 1.
  let element = (target as Node | null)?.nodeType === 1 ? (target as Element) : null;
  while (element !== null && element !== document.body && element !== document.documentElement) {
    if (scrolls(element)) {
      return element;
    }
    element = element.parentElement;
  }
  return null;
}

/** A line of the page's text, in px. */
function lineOf(area: Area) {
  const style = getComputedStyle(area ?? document.body);
  const line = Number.parseFloat(style.lineHeight);
  const font = Number.parseFloat(style.fontSize);
  if (Number.isFinite(line)) {
    return line;
  }
  return Number.isFinite(font) ? font * NORMAL_LINE : FALLBACK_LINE;
}

/** Scrolls the area a few lines, `direction` 1 for down and -1 for up, with no animation. */
function step(event: KeyboardEvent, direction: 1 | -1) {
  const area = areaOf(event.target);
  const options = { behavior: "instant", top: direction * LINES * lineOf(area) } as const;
  if (area === null) {
    window.scrollBy(options);
  } else {
    area.scrollBy(options);
  }
}

/** Scrolls the area to its top or its bottom, with no animation: `g g` is the top too. */
export function edge(event: KeyboardEvent, to: "bottom" | "top") {
  const area = areaOf(event.target);
  const height = (area ?? document.documentElement).scrollHeight;
  const options = { behavior: "instant", top: to === "top" ? 0 : height } as const;
  if (area === null) {
    window.scrollTo(options);
  } else {
    area.scrollTo(options);
  }
}

const fallback = (keys: string, label: string, run: (event: KeyboardEvent) => void): Binding => ({
  fallback: true,
  keys,
  label,
  run,
});

/** The bindings of the fallback: `j k`, the arrows, `+ -`, `Home End`, and `G`. */
const SCROLL: ReadonlyArray<Binding> = [
  ...["j", "ArrowDown", "+"].map((keys) => fallback(keys, "Scroll down", (e) => step(e, 1))),
  ...["k", "ArrowUp", "-"].map((keys) => fallback(keys, "Scroll up", (e) => step(e, -1))),
  fallback("Home", "Scroll to the top", (event) => edge(event, "top")),
  ...["End", "G"].map((keys) => fallback(keys, "Scroll to the bottom", (e) => edge(e, "bottom"))),
];

/** Declares the scroll fallback, for as long as the caller is mounted: the shell's. */
export function useScrollKeys() {
  useKeys(SCROLL, "shell");
}

/** The shell's mount of `useScrollKeys`, which draws nothing. */
export function ScrollKeys() {
  useScrollKeys();
  return null;
}
