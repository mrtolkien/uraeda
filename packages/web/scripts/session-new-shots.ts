/**
 * The views of the session in the terminal look, as its mockups draw them: a feature's session at
 * its implementation, its chat cut into recap lines beside the column split in its Activity and its
 * Changes, with the plan's progress at its foot; its Sub-agents tab while two run; a chat of the
 * main checkout, with no progress; the phone's sheet of the column; the session in a document's
 * column; the session at a semi-wide window (C2); and the New page's three cards (C3).
 *
 * The feature's session is the feature page's working feature's, which `takeFeaturePage` started:
 * taken after it, its turn ended here, then a run that thought, read, searched, fetched, edited and
 * ran a command, and a run still going, with two sub-agents and a read. Each chat is made once, on
 * the first shot's page, then taken at every size and theme. The calls and thoughts take real
 * seconds, as the runner times them with the clock.
 */
import type { Page } from "playwright";
import type { FakeAdapter } from "uraeda-server/testing";
import { FEATURE_PAGES } from "../samples/index.ts";
import { type Each, here, type Shot, settle, show, showNew, wait } from "./shots.ts";

/** A step of a scripted turn. */
type FakeStep = Parameters<FakeAdapter["script"]>[0][number];

/** A turn's end, its work done. */
const result = { denials: [], errors: [], interrupted: false, ok: true, type: "result" as const };

/** The working feature's session. */
const SESSION = `/f/${FEATURE_PAGES.working}/session`;

const ASKED =
  "Why does completing a repeating task not create the next one? Check the code and the library's docs before you change anything.";
const FOUND =
  'The next occurrence is only created in `complete.ts` when the task has a `repeat` rule. Your task stores the rule as `repeat: "weekly"`, a string, and the check expects an object.';
const CONFIRMED =
  "The library's docs confirm that `rrule` strings are valid input, so no migration is needed. I'll fix the check to accept both and add a test.";
const DONE =
  "Done: `complete.ts` reads both shapes, and a new test completes a weekly task and checks the next one is due a week later. `pnpm test` passes.";

/** A step that holds the turn for `ms`. */
const hold =
  (ms: number): FakeStep =>
  async () => {
    await wait(ms);
  };

/** A thinking block of `ms`, with its text. */
const thought = (ms: number, text: string): Array<FakeStep> => [
  { activity: { kind: "thinking" }, type: "activity" },
  hold(ms),
  { text, type: "thought" },
];

/** A call of `kind` on `target`, which lasts `ms`, and fails when `failed`. */
function call(
  id: string,
  [name, kind]: readonly [string, "read" | "edit" | "search" | "fetch" | "execute"],
  target: string,
  ms = 400,
  failed = false,
): Array<FakeStep> {
  return [
    { id, input: {}, kind, name, target, type: "toolStart" },
    hold(ms),
    { id, isError: failed, output: failed ? "Exit code 1" : "…", type: "toolEnd" },
  ];
}

const READ = ["Read", "read"] as const;
const EDIT = ["Edit", "edit"] as const;

/** The first run: thoughts, three reads, a search, a fetch, the findings, two edits, the tests. */
const FIRST_RUN: Array<FakeStep> = [
  ...thought(3000, "The repeat rule decides whether a next occurrence is made."),
  ...call("r1", READ, "src/tasks/complete.ts"),
  ...call("r2", READ, "src/tasks/repeat.ts"),
  ...call("r3", READ, "src/tasks/repeat.test.ts"),
  ...call("s1", ["Grep", "search"], '"rrule next occurrence"', 600),
  ...call("f1", ["WebFetch", "fetch"], "github.com/jkbrzt/rrule#usage", 1500),
  ...thought(2000, "A string rule is valid rrule input."),
  { text: FOUND, type: "text" },
  { text: CONFIRMED, type: "text" },
  ...call("e1", EDIT, "src/tasks/complete.ts"),
  ...call("e2", EDIT, "src/tasks/complete.ts"),
  ...call("e3", EDIT, "src/tasks/complete.test.ts"),
  ...call("t1", ["Bash", "execute"], "pnpm test", 2000),
  { text: DONE, type: "text" },
];

/** Sends a message from the composer, as the human does, and waits for the agent to be sent it. */
async function send(adapter: FakeAdapter, page: Page, text: string) {
  const sent = adapter.sent.length;
  await page.getByRole("textbox", { name: "Message Claude Code" }).fill(text);
  await page.getByRole("button", { name: "Send" }).first().click();
  while (adapter.sent.length === sent) {
    await wait(50);
  }
  return adapter.sent.at(-1)!.id;
}

/** A call's start, by the main agent or the sub-agent `parent`, left running. */
function start(
  adapter: FakeAdapter,
  id: string,
  [name, kind]: readonly [string, "read" | "search" | "fetch"],
  target: string,
  parent?: string,
) {
  adapter.emit({
    id,
    input: {},
    kind,
    name,
    ...(parent ? { parent } : {}),
    target,
    type: "toolStart",
  });
}

const FETCH = ["WebFetch", "fetch"] as const;
const GREP = ["Grep", "search"] as const;

/** The second run, still going: two sub-agents at work, and the main agent reading. */
async function secondRun(adapter: FakeAdapter, page: Page) {
  const id = await send(adapter, page, "Now make undo put the previous occurrence back.");
  adapter.emit({ id, type: "accepted" });
  for (const [agent, description] of [
    ["agent-a", "Research rrule's undo of an occurrence"],
    ["agent-b", "Find every caller of complete()"],
  ] as const) {
    adapter.emit({
      id: agent,
      input: {},
      kind: "other",
      name: "Task",
      subagent: { description },
      type: "toolStart",
    });
  }
  // Each sub-agent's calls, its last one running.
  const done = [
    ["a1", FETCH, "rrule.js.org", "agent-a"],
    ["a2", FETCH, "github.com/jkbrzt/rrule#usage", "agent-a"],
    ["a3", FETCH, "github.com/jkbrzt/rrule/issues/388", "agent-a"],
    ["b1", GREP, '"complete(" src/', "agent-b"],
  ] as const;
  for (const [call, tool, target, parent] of done) {
    start(adapter, call, tool, target, parent);
    adapter.emit({ id: call, isError: false, output: "…", type: "toolEnd" });
  }
  start(adapter, "a4", FETCH, "github.com/jkbrzt/rrule/issues/412", "agent-a");
  start(adapter, "b2", GREP, '"complete(" packages/', "agent-b");
  start(adapter, "live", READ, "src/tasks/undo.ts");
}

/** The feature's session: its last turn ended, a run done, and a run still going. */
async function featureSession(adapter: FakeAdapter, first: Page) {
  await show(first, SESSION, "Building task 7");
  adapter.script(FIRST_RUN);
  await send(adapter, first, ASKED);
  await first.getByText("a new test completes a weekly task").first().waitFor({ timeout: 60_000 });
  await first.getByRole("button", { name: "Stop" }).first().waitFor({ state: "detached" });
  await secondRun(adapter, first);
  await first
    .getByText(/reading src\/tasks\/undo\.ts/)
    .first()
    .waitFor();
  // Left, so its shots open the session anew, at its end, not at the place the human left it.
  await first.goto("about:blank");
}

/** A chat in the main checkout: a run that read, searched, and thought, ended. */
async function plainChat(adapter: FakeAdapter, first: Page) {
  await showNew(first);
  adapter.script([
    ...thought(2000, "The run time is in the browser step."),
    ...call("p1", READ, ".github/workflows/ci.yml"),
    ...call("p2", READ, "packages/web/vite.browser.config.ts"),
    ...call("p3", ["Grep", "search"], '"webkit" .github/', 500),
    { text: "WebKit draws without a GPU on CI: its animations take longer.", type: "text" },
    ...call("p4", ["Bash", "execute"], "vp test --project desktop", 1500, true),
    {
      text: "The browser tests fail on one flaky drag: the rest pass in 3 minutes.",
      type: "text",
    },
  ]);
  await send(adapter, first, "Why is CI slow on WebKit?");
  await first.waitForURL(/\/sessions\//);
  await first.getByText("one flaky drag").first().waitFor({ timeout: 30_000 });
  const path = here(first);
  await first.goto("about:blank");
  return path;
}

/** The session's page, its column drawn on a wide screen. */
async function session(page: Page, path: string, text: string | RegExp) {
  await show(page, path, text);
  if (page.viewportSize()!.width >= 768) {
    await page.getByRole("region", { name: "Changes" }).first().waitFor();
  }
  await settle(page);
}

/** The views of the session in the terminal look, and of New. */
export async function takeSessionNew(each: Each, shots: Array<Shot>, adapter: FakeAdapter) {
  const first = shots[0]!.page;
  // The feature page's turn, still running, ends: its process is the agent's last.
  adapter.emit(result);
  for (const kind of ["session", "change", "feature"] as const) {
    await each(`new-${kind}`, ({ page }) => showNew(page, kind));
  }

  await featureSession(adapter, first);
  const live = /reading src\/tasks\/undo\.ts/;
  await each("session", ({ page }) => session(page, SESSION, live));
  await each("session-subagents", async ({ page }) => {
    await show(page, `${SESSION}?tab=subagents`, live);
    await page.getByRole("list", { name: "The session's sub-agents" }).first().waitFor();
    await settle(page);
  });
  await each(
    "session-sheet",
    async ({ page }) => {
      await show(page, SESSION, live);
      await page
        .getByRole("contentinfo", { name: "Status line" })
        .getByRole("button", { name: "Activity" })
        .click();
      await page.getByRole("dialog", { name: "Activity" }).waitFor();
      await settle(page);
    },
    "phone",
  );
  // A document's column shows on a wider screen only.
  await each(
    "embedded-session",
    async ({ page }) => {
      await show(page, `/f/${FEATURE_PAGES.working}/plan.md?tab=session`, live);
      await settle(page);
    },
    "desktop",
  );
  const plain = await plainChat(adapter, first);
  await each("session-plain", ({ page }) => session(page, plain, "one flaky drag"));

  // At 1000 px, a semi-wide window: the chat clearly weighs more than the column (C2).
  await each(
    "session-semi",
    async ({ page }) => {
      await page.setViewportSize({ height: 900, width: 1000 });
      await session(page, SESSION, live);
    },
    "desktop",
  );
  for (const { page, size } of shots) {
    if (size === "desktop") {
      await page.setViewportSize({ height: 900, width: 1440 });
    }
  }
}
