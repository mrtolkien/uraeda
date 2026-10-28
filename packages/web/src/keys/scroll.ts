// The scroll fallback of the base keymap: on a page with no rows to move through, the vertical keys
// scroll, as a registry default that no page copies. It runs only where no binding of the page
// handled the key (a list that declared `j` moves its selection and nothing scrolls), on the area
// holding the focus, else the page, gliding as a browser's arrow keys do. The scrolling is what a
// page does anyway, so it has no hint.
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

/** How fast a glide closes on its target, in ms: the distance left shrinks by `1/e` in each. */
const GLIDE_MS = 90;

/** A glide of an area: where it heads, where it left the area, and its next frame, if any. */
type Glide = { frame: number; last: number; placed: number; target: number };

const glides = new WeakMap<Element, Glide>();

/** Whether the human asked the system for less motion. */
const wantsLess = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Moves the area by `distance` px, gliding as a browser's arrow keys do: each key adds to where the
 * area is heading, so quick presses and a held key run on in one smooth motion rather than each
 * starting over. A scroll by anything else, a wheel or a drag, ends the glide.
 */
function glideBy(area: Area, distance: number) {
  const element = area ?? document.scrollingElement ?? document.documentElement;
  const farthest = element.scrollHeight - element.clientHeight;
  const clamp = (top: number) => Math.min(Math.max(top, 0), Math.max(farthest, 0));
  if (wantsLess()) {
    element.scrollTop = clamp(element.scrollTop + distance);
    return;
  }
  const glide = glides.get(element) ?? { frame: 0, last: 0, placed: 0, target: 0 };
  glides.set(element, glide);
  const isRunning = glide.frame !== 0;
  glide.target = clamp((isRunning ? glide.target : element.scrollTop) + distance);
  if (isRunning) {
    return;
  }
  glide.last = performance.now();
  glide.placed = element.scrollTop;
  const tick = (now: number) => {
    const elapsed = now - glide.last;
    glide.last = now;
    // Moved by something else since the last frame: it takes over.
    if (Math.abs(element.scrollTop - glide.placed) > 2) {
      glide.frame = 0;
      return;
    }
    const left = glide.target - element.scrollTop;
    const move = left * (1 - Math.exp(-elapsed / GLIDE_MS));
    // At least a pixel, which a scroll position can hold, and never past the target.
    const by = Math.abs(move) < 1 ? Math.sign(left) : move;
    element.scrollTop += Math.abs(by) >= Math.abs(left) ? left : by;
    glide.placed = element.scrollTop;
    if (Math.abs(glide.target - element.scrollTop) < 0.5) {
      glide.frame = 0;
      return;
    }
    glide.frame = requestAnimationFrame(tick);
  };
  glide.frame = requestAnimationFrame(tick);
}

/** Scrolls the area a few lines, `direction` 1 for down and -1 for up, gliding. */
function step(event: KeyboardEvent, direction: 1 | -1) {
  const area = areaOf(event.target);
  glideBy(area, direction * LINES * lineOf(area));
}

/**
 * Scrolls the area half its height, `direction` 1 for down and -1 for up, gliding, as Vim's do.
 * Only with Control: Command+D and Command+U, which `mod+` names too, stay the browser's on a Mac.
 */
function half(event: KeyboardEvent, direction: 1 | -1) {
  if (!event.ctrlKey || event.metaKey) {
    return false;
  }
  const area = areaOf(event.target);
  const height = area === null ? window.innerHeight : area.clientHeight;
  glideBy(area, (direction * height) / 2);
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

/**
 * The bindings of the fallback: `j k`, the arrows, `+ -`, Ctrl+D and Ctrl+U half a screen, `Home
 * End`, and `G`.
 */
const SCROLL: ReadonlyArray<Binding> = [
  ...["j", "ArrowDown", "+"].map((keys) => fallback(keys, "Scroll down", (e) => step(e, 1))),
  ...["k", "ArrowUp", "-"].map((keys) => fallback(keys, "Scroll up", (e) => step(e, -1))),
  fallback("mod+d", "Scroll half a screen down", (event) => half(event, 1)),
  fallback("mod+u", "Scroll half a screen up", (event) => half(event, -1)),
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
