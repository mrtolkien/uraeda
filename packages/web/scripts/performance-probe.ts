/**
 * How the benchmark times what the human waits for, in the page itself: from the press, the
 * `pointerdown` or `keydown` the browser stamps, to the first frame that draws the result, or to
 * the end of the app's own `navigate <path>` timing (`src/slow.ts`), which ends after the frame
 * that draws the page. A reload is timed from the navigation's start to the first frame drawing
 * the page without "Loading…". The server's `Server-Timing` of each `/fate` request answered
 * meanwhile says how much of the time the server took.
 */
import type { Page, Response } from "playwright";

/** What the result of a press is, once drawn. Each is named, and timed on its own. */
export type Condition = { name: string } &
  // The app's `navigate <path>` timing, of a path `pattern` matches whole: see `pagePattern`.
  (
    | { kind: "navigate"; pattern: string }
    | { kind: "text"; selector?: string; text: string }
    | { kind: "selector"; selector: string }
    | { kind: "filled"; selector: string }
  );

/** A condition's time from the press, in milliseconds, or null when it never showed. */
export type Times = Record<string, number | null>;

/**
 * A measure: each condition's time, whether "Loading…" showed, the server's share, and how long
 * the page's own long tasks kept its main thread busy meanwhile, in milliseconds.
 */
export type Measured = { busy: number; loading: boolean; server: string; times: Times };

/** The page's main content: the shell draws it as a `main` landmark. */
export const MAIN = 'main, [role="main"]';

/** The pattern of a navigate condition that matches `path` alone. */
export const pagePattern = (path: string) =>
  path.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/** How long a result may take before the benchmark gives up on it. */
const GIVE_UP_MS = 10_000;

type Perf = {
  armed: number;
  /** When a reload first drew its page's content, "Loading…" still shown or not. */
  drawn?: number;
  loaded?: number;
  loading: boolean;
  /** The main thread's long tasks, each its start and duration. */
  long: Array<[number, number]>;
  press?: number;
  results: Record<string, { at: number; wall: number }>;
  token: number;
};

declare global {
  interface Window {
    __perf: Perf;
  }
}

/**
 * The script each document of the page runs first: it notes the first press after each arming,
 * and the frame that first draws a page without "Loading…", for a reload's time.
 */
function probe() {
  const perf: Perf = { armed: 0, loading: false, long: [], results: {}, token: 0 };
  window.__perf = perf;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      perf.long.push([entry.startTime, entry.duration]);
    }
  }).observe({ buffered: true, type: "longtask" });
  const pressed = (event: Event) => {
    perf.press ??= event.timeStamp;
  };
  addEventListener("pointerdown", pressed, true);
  addEventListener("keydown", pressed, true);
  // Any element whose own text is "Loading…", as a page waiting for its data shows.
  const loadingText = "//*[normalize-space(text())='Loading…']";
  const loading = () =>
    document.evaluate(loadingText, document, null, XPathResult.BOOLEAN_TYPE, null).booleanValue;
  const tick = () => {
    const main = document.querySelector('main, [role="main"]');
    if ((main?.textContent ?? "").trim() !== "") {
      perf.drawn ??= performance.now();
    }
    if (perf.drawn !== undefined && !loading()) {
      perf.loaded = performance.now();
    } else {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

/**
 * Arms the page: the next press starts the time, and each frame from it checks the conditions.
 */
function arm({
  conditions,
  giveUp,
  outside,
}: {
  conditions: Array<Condition>;
  giveUp: number;
  outside: boolean;
}) {
  const perf = window.__perf;
  perf.armed = performance.now();
  // A change made outside the page has no press: the conditions are checked from now.
  perf.press = outside ? perf.armed : undefined;
  perf.results = {};
  perf.loading = false;
  perf.token += 1;
  const token = perf.token;
  // Any element whose own text is "Loading…", as a page waiting for its data shows.
  const loadingText = "//*[normalize-space(text())='Loading…']";
  const loading = () =>
    document.evaluate(loadingText, document, null, XPathResult.BOOLEAN_TYPE, null).booleanValue;
  /** When a condition showed, or undefined while it has not. */
  const shown = (condition: Condition, now: number): number | undefined => {
    switch (condition.kind) {
      case "navigate": {
        const pattern = new RegExp(`^navigate ${condition.pattern}$`);
        const entry = performance
          .getEntriesByType("measure")
          .find((one) => pattern.test(one.name) && one.startTime >= perf.armed);
        return entry === undefined ? undefined : entry.startTime + entry.duration;
      }
      case "text":
        return [...document.querySelectorAll(condition.selector ?? "body")].some((element) =>
          (element.textContent ?? "").includes(condition.text),
        )
          ? now
          : undefined;
      case "selector":
        return document.querySelector(condition.selector) === null ? undefined : now;
      case "filled":
        return [...document.querySelectorAll(condition.selector)].some(
          (element) =>
            ((element as HTMLTextAreaElement).value ?? element.textContent ?? "").trim() !== "",
        )
          ? now
          : undefined;
    }
  };
  const tick = () => {
    if (perf.token !== token) {
      return;
    }
    const now = performance.now();
    if (perf.press !== undefined) {
      perf.loading ||= loading();
      for (const condition of conditions) {
        const at = condition.name in perf.results ? undefined : shown(condition, now);
        if (at !== undefined) {
          perf.results[condition.name] = { at, wall: performance.timeOrigin + at };
        }
      }
    }
    if (conditions.every(({ name }) => name in perf.results) || now - perf.armed > giveUp) {
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** The `Server-Timing` durations of the `/fate` requests a page sent, from when it is listened. */
export class ServerTimes {
  #since = 0;
  #times: Array<{ at: number; dur: number; what: string }> = [];

  constructor(page: Page) {
    page.on("response", (response: Response) => {
      // The list's `/fate`, and each repository's, `/r/<name>/fate`; not their live streams.
      if (!/(^|\/)fate$/.test(new URL(response.url()).pathname)) {
        return;
      }
      const dur = /app;dur=([\d.]+)/.exec(response.headers()["server-timing"] ?? "")?.[1];
      if (dur !== undefined) {
        const what = operations(response.request().postData());
        this.#times.push({ at: Date.now(), dur: Number(dur), what });
      }
    });
  }

  /** Starts a measure: only the answers from now on count. */
  start() {
    this.#since = Date.now();
  }

  /** The answers since the start: "<count> req, <total> ms, max <ms> <what it read>". */
  summary(): string {
    const times = this.#times.filter(({ at }) => at >= this.#since);
    if (times.length === 0) {
      return "no request";
    }
    const total = Math.round(times.reduce((sum, { dur }) => sum + dur, 0));
    const slowest = times.reduce((a, b) => (b.dur > a.dur ? b : a));
    return `${times.length} req, ${total} ms, max ${Math.round(slowest.dur)} ${slowest.what}`;
  }
}

/** What a fate request asks for: its operations' types, or their mutations' names. */
function operations(body: string | null): string {
  try {
    const { operations } = JSON.parse(body ?? "") as {
      operations: Array<{ name?: string; type?: string }>;
    };
    return operations.map(({ name, type }) => name ?? type ?? "?").join("+");
  } catch {
    return "";
  }
}

/** Installs the probe in every document the page loads. */
export async function installProbe(page: Page) {
  await page.addInitScript(probe);
}

/**
 * Times `act`, a press, to each condition: from the press, or from `from`, a time of the
 * machine's clock, for a change made outside the page.
 */
export async function measure(
  page: Page,
  server: ServerTimes,
  conditions: Array<Condition>,
  act: () => Promise<unknown>,
  from?: () => number,
): Promise<Measured> {
  await page.evaluate(arm, { conditions, giveUp: GIVE_UP_MS, outside: from !== undefined });
  server.start();
  await act();
  const start = from?.();
  const names = conditions.map(({ name }) => name);
  await page
    .waitForFunction((all) => all.every((name) => name in window.__perf.results), names, {
      timeout: GIVE_UP_MS,
    })
    .catch(() => undefined);
  const { loading, long, press, results } = await page.evaluate(() => window.__perf);
  const times: Times = {};
  const ends = Object.values(results).map(({ at }) => at);
  for (const { name } of conditions) {
    const result = results[name];
    times[name] =
      result === undefined
        ? null
        : start === undefined
          ? press === undefined
            ? null
            : Math.round(result.at - press)
          : Math.round(result.wall - start);
  }
  const busy =
    press === undefined || ends.length === 0 ? 0 : longTasks(long, press, Math.max(...ends));
  return { busy, loading, server: server.summary(), times };
}

/** How long the main thread's long tasks kept it busy between `from` and `to`. */
function longTasks(long: Array<[number, number]>, from: number, to: number): number {
  const busy = long.map(([start, duration]) =>
    Math.max(0, Math.min(to, start + duration) - Math.max(from, start)),
  );
  return Math.round(busy.reduce((a, b) => a + b, 0));
}

/**
 * Reloads the page, and times it to its first frame drawing its content, and to the first one
 * without "Loading…" anywhere on it.
 */
export async function measureReload(page: Page, server: ServerTimes): Promise<Measured> {
  server.start();
  await page.reload();
  await page
    .waitForFunction(() => window.__perf.loaded, null, { timeout: GIVE_UP_MS })
    .catch(() => undefined);
  const { drawn, loaded, long } = await page.evaluate(() => window.__perf);
  return {
    busy: loaded === undefined ? 0 : longTasks(long, 0, loaded),
    loading: false,
    server: server.summary(),
    times: {
      drawn: drawn === undefined ? null : Math.round(drawn),
      "without Loading…": loaded === undefined ? null : Math.round(loaded),
    },
  };
}
