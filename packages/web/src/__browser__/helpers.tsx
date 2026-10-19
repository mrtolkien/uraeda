// Shared by the browser tests: rendering a page against the test server, and the page checks of the
// UI checks decision. The browser tests run at a phone's and a desktop's size (see
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
 * server's own fate endpoints, and waits for a text, which an empty one does not.
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
 * end, as a button's colours fading in: the checks read the page at rest.
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
 * height over 100 ms, then drawn.
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

/** The region a check reads: the main region by default, or another, like an overlay. */
function region(root?: Element) {
  return root ?? document.querySelector('[role="main"]') ?? document.body;
}

/**
 * Text stays readable at each width (the UI layout decision): nothing scrolls the page sideways, no
 * line is clamped, no text is cut where an element clips it, and nothing reaches past the screen's
 * edge. No size of ours is asserted: only that nothing is cut.
 */
export function checkPage(root?: Element) {
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  for (const element of region(root).querySelectorAll("*")) {
    const style = getComputedStyle(element);
    const name = element.outerHTML.slice(0, 120);
    expect(style.getPropertyValue("-webkit-line-clamp") || "none", name).toBe("none");
    // A chat's title in the navigation is cut by an ellipsis on purpose.
    if (scrolls(element) || element.closest('nav a[href*="/chats/"]')) {
      continue;
    }
    // Visually hidden elements, a few pixels wide, are for screen readers.
    const clips =
      style.textOverflow === "ellipsis" ||
      style.overflowX === "hidden" ||
      style.overflowX === "clip";
    if (clips && element.clientWidth > 4) {
      expect(element.scrollWidth, name).toBeLessThanOrEqual(element.clientWidth + 1);
    }
    const box = element.getBoundingClientRect();
    if (box.width > 4) {
      expect(box.right, name).toBeLessThanOrEqual(window.innerWidth + 1);
    }
  }
}

/** axe-core's WCAG 2.1 A and AA rules, on the whole document. */
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

/** How long a session's live updates may take to arrive, throttled by the server, on a busy machine. */
export const LIVE = { timeout: 10_000 };

/** The agent of the test server, which the tests drive as Claude Code would print. */
export const agent = commands;

/** The test server's commands: the repository's files, the test features, and the agent. */
export { commands };

/** Types a message in the composer and presses Send, as the human does. */
async function sendMessage(text: string) {
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
  // The composer's Stop.
  await screen.findByRole("button", { name: "Stop" }, LIVE);
}
