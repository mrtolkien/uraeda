// How long the human waits, as user timings the benchmark reads: `navigate <path>`, from a route
// change to the frame that draws its page, and `interaction <name>`, for each click or key the
// browser times. A development build warns in the console when either passes 100 ms.
import { useLayoutEffect } from "react";
import { subscribeLocation } from "./routes.tsx";

/** The time past which a development build warns, in milliseconds. */
const SLOW = 100;

/**
 * The smallest duration the browser times an event from, in milliseconds: an interaction quicker
 * than this gets no timing, and is well within the target.
 */
const SMALLEST = 16;

/** The events that name a click or a key's interaction: the others share their interaction. */
const NAMING = new Set(["click", "keydown"]);

/** What an interaction's target is named by: the element a human means, which carries the name. */
const NAMED = "a, button, input, select, summary, textarea, [aria-label], [role], [tabindex]";

/** The longest name an interaction carries, in characters. */
const NAME_LENGTH = 60;

/** The path a route change left for, and when, until the frame that draws it. */
let pending: { path: string; start: number } | undefined;

/** The path of the page drawn last. */
let drawn = window.location.pathname;

/**
 * The text of `element`, read up to a little past `NAME_LENGTH`: a container's whole text, on
 * every timed click, would cost more than the click.
 */
function shortText(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let text = "";
  for (let node = walker.nextNode(); node && text.length <= NAME_LENGTH; node = walker.nextNode()) {
    text += node.nodeValue ?? "";
  }
  return text;
}

/** The accessible name of an event's target, shortened, or "" when it has none or is gone. */
function accessibleName(target: Node | null): string {
  const node = target?.nodeType === Node.ELEMENT_NODE ? (target as Element) : target?.parentElement;
  const element = node?.closest(NAMED) ?? node;
  if (!element) {
    return "";
  }
  const labelledBy = element.getAttribute("aria-labelledby");
  const name =
    element.getAttribute("aria-label") ??
    (labelledBy === null
      ? null
      : labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")) ??
    element.getAttribute("title") ??
    shortText(element);
  const text = name.replaceAll(/\s+/g, " ").trim();
  return text.length > NAME_LENGTH ? `${text.slice(0, NAME_LENGTH - 1)}…` : text;
}

/** The interactions measured already, by id, the latest last: a later entry of one is not timed. */
const measured = new Set<number>();

/** How many measured interactions `measured` remembers. */
const REMEMBERED = 100;

/**
 * Times an interaction from its entries: a click is a pointerdown, a pointerup, and a click, a key
 * a keydown and a keyup, and the human waits for the longest. It is named by its click or keydown.
 */
function measure(entries: ReadonlyArray<PerformanceEventTiming>) {
  const longest = entries.reduce((a, b) => (b.duration > a.duration ? b : a));
  const naming = entries.find((entry) => NAMING.has(entry.name)) ?? longest;
  const target = accessibleName(naming.target);
  const name = target === "" ? naming.name : `${naming.name} on ${target}`;
  performance.measure(`interaction ${name}`, {
    duration: longest.duration,
    start: longest.startTime,
  });
  if (import.meta.env.DEV && longest.duration > SLOW) {
    console.warn(`[uraeda] ${name} took ${Math.round(longest.duration)} ms`);
  }
}

/** Times each click and key, and warns of a slow one in development. */
function observeInteractions() {
  if (!PerformanceObserver.supportedEntryTypes?.includes("event")) {
    return;
  }
  const observer = new PerformanceObserver((list) => {
    // The browser reports an interaction's entries together, once its id is known at its end.
    const interactions = new Map<number, Array<PerformanceEventTiming>>();
    for (const entry of list.getEntries() as Array<PerformanceEventTiming>) {
      if (entry.interactionId === 0 || measured.has(entry.interactionId)) {
        continue;
      }
      interactions.set(entry.interactionId, [
        ...(interactions.get(entry.interactionId) ?? []),
        entry,
      ]);
    }
    for (const [id, entries] of interactions) {
      measure(entries);
      measured.add(id);
      if (measured.size > REMEMBERED) {
        measured.delete(measured.values().next().value ?? id);
      }
    }
  });
  // TypeScript's DOM types lack the event timing's own option.
  const options: PerformanceObserverInit & { durationThreshold: number } = {
    buffered: true,
    durationThreshold: SMALLEST,
    type: "event",
  };
  observer.observe(options);
}

/** Notes when the location leaves for another path: its timing ends once its page draws. */
function observeNavigations() {
  subscribeLocation(() => {
    const path = window.location.pathname;
    // Back to the page drawn before it drew another: nothing to time.
    pending = path === drawn ? undefined : { path, start: pending?.start ?? performance.now() };
  });
}

/** Starts the app's timings, once, from its entry. */
export function observeTimings() {
  observeNavigations();
  observeInteractions();
}

/**
 * Notes that the page of `pathname` was drawn, and ends the timing of the route change to it at the
 * frame that draws it: after the browser's next paint.
 */
function drew(pathname: string) {
  drawn = pathname;
  if (pending?.path !== pathname) {
    return;
  }
  const { start } = pending;
  pending = undefined;
  requestAnimationFrame(() =>
    setTimeout(() => {
      const { duration } = performance.measure(`navigate ${pathname}`, {
        end: performance.now(),
        start,
      });
      if (import.meta.env.DEV && duration > SLOW) {
        console.warn(`[uraeda] navigate ${pathname} took ${Math.round(duration)} ms`);
      }
    }),
  );
}

/** Ends the timing of the route change to `pathname`, the path of the page drawn, once drawn. */
export function useNavigationTiming(pathname: string) {
  useLayoutEffect(() => drew(pathname), [pathname]);
}
