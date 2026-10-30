// How long the human waits, as user timings the benchmark reads: `navigate <path>`, from a route
// change to the frame that draws its page, and `interaction <name>`, for each click or key the
// browser times. A development build warns in the console when an interaction passes 100 ms.
import { useLayoutEffect } from "react";
import { subscribeLocation } from "./routes.tsx";

/** The time past which a development build warns, in milliseconds. */
const SLOW = 100;

/**
 * The smallest duration the browser times an event from, in milliseconds: an interaction quicker
 * than this gets no timing, and is well within the target.
 */
const SMALLEST = 16;

/** The events that start a click or a key's interaction: the others share their interaction. */
const INTERACTIONS = new Set(["click", "keydown"]);

/** What an interaction's target is named by: the element a human means, which carries the name. */
const NAMED = "a, button, input, select, summary, textarea, [aria-label], [role], [tabindex]";

/** The path a route change left for, and when, until the frame that draws it. */
let pending: { path: string; start: number } | undefined;

/** The path of the page drawn last. */
let drawn = window.location.pathname;

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
    element.textContent ??
    "";
  const text = name.replaceAll(/\s+/g, " ").trim();
  return text.length > 60 ? `${text.slice(0, 59)}…` : text;
}

/** Times each click and key, and warns of a slow one in development. */
function observeInteractions() {
  if (!PerformanceObserver.supportedEntryTypes?.includes("event")) {
    return;
  }
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as Array<PerformanceEventTiming>) {
      if (entry.interactionId === 0 || !INTERACTIONS.has(entry.name)) {
        continue;
      }
      const target = accessibleName(entry.target);
      const name = target === "" ? entry.name : `${entry.name} on ${target}`;
      performance.measure(`interaction ${name}`, {
        duration: entry.duration,
        start: entry.startTime,
      });
      if (import.meta.env.DEV && entry.duration > SLOW) {
        console.warn(`[uraeda] ${name} took ${Math.round(entry.duration)} ms`);
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
    setTimeout(() =>
      performance.measure(`navigate ${pathname}`, { end: performance.now(), start }),
    ),
  );
}

/** Ends the timing of the route change to `pathname`, the path of the page drawn, once drawn. */
export function useNavigationTiming(pathname: string) {
  useLayoutEffect(() => drew(pathname), [pathname]);
}
