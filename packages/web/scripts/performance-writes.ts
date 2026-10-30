/**
 * The benchmark's writes: each one's result from its press (SC-003), Start to its session
 * (SC-004), a commit made outside to its page (SC-005), and pages right after a start made its
 * worktree (SC-006).
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Locator } from "playwright";
import { clickColumn } from "./performance-pages.ts";
import { type Condition, MAIN, measure, pagePattern } from "./performance-probe.ts";
import type { Criterion, Run } from "./performance-report.ts";

/** Opens a page, not timed, and lets it settle. */
async function open(run: Run, path: string) {
  await run.page.goto(path);
  await run.page.waitForFunction(() => window.__perf.loaded);
  await run.page.waitForTimeout(500);
}

/** Marks an element, so a condition can find it in the page: `[data-bench="<mark>"]`. */
async function mark(element: Locator, name: string): Promise<string> {
  await element.evaluate((node, value) => node.setAttribute("data-bench", value), name);
  return `[data-bench="${name}"]`;
}

/** The text an option's card shows, from its box's name: "Option B: <text>". */
async function optionText(option: Locator): Promise<string> {
  const name = (await option.getAttribute("aria-label")) ?? "";
  return name.replace(/^Option [A-Z][^:]*: /, "").slice(0, 40);
}

/** Times `act` to `conditions`, and adds its row. */
async function timed(
  run: Run,
  criterion: Criterion,
  what: string,
  conditions: Array<Condition>,
  act: () => Promise<unknown>,
) {
  const measured = await measure(run.page, run.server, conditions, act);
  run.report.add(criterion, run.project, what, measured);
}

/** A question's answer picked, then its comment saved, on the round's page `round`. */
export async function answer(run: Run, round: string) {
  await open(run, round);
  const option = run.page.getByRole("checkbox", { name: /^Option B/ }).first();
  const picked = await mark(option, "pick");
  await timed(
    run,
    "SC-003",
    "an answer picked",
    [
      {
        kind: "selector",
        name: "picked",
        selector: `${picked}:is(:checked,[aria-checked="true"])`,
      },
    ],
    // The box itself is hidden under its card: the human clicks the option's text.
    async () =>
      run.page
        .getByText(await optionText(option))
        .first()
        .click(),
  );
  const field = run.page.getByRole("textbox", { name: /^Comment, or your own answer/ }).first();
  await field.fill("A comment the benchmark saves.");
  const button = run.page.getByRole("button", { exact: true, name: "Save comment" }).first();
  const save = await mark(button, "save");
  await timed(
    run,
    "SC-003",
    "a comment saved",
    [{ kind: "selector", name: "saved", selector: `${save}:disabled` }],
    () => button.click(),
  );
}

/** A note of the inbox moved to Now with `p`, timed from the pick to the priorities drawing it. */
export async function promote(run: Run, prefix: string, note: string) {
  await open(run, `${prefix}/inbox`);
  await run.page.getByRole("button", { name: note }).first().click();
  await run.page.keyboard.press("p");
  await run.page.waitForTimeout(500);
  await timed(
    run,
    "SC-003",
    "a note moved to Now with p",
    [
      { kind: "navigate", name: "priorities", pattern: pagePattern(`${prefix}/priorities`) },
      { kind: "text", name: "note", selector: MAIN, text: note },
    ],
    () => run.page.keyboard.press("Enter"),
  );
}

/**
 * A spec approved, while a pre-commit hook of a second keeps its commit landing: "Approved" on its
 * page, and the toast saying what still lands.
 */
export async function approve(run: Run, spec: string, repo: string) {
  await open(run, spec);
  const hooks = execFileSync("git", ["-C", repo, "rev-parse", "--git-path", "hooks"], {
    encoding: "utf8",
  }).trim();
  const hook = join(resolve(repo, hooks), "pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(hook, "#!/bin/sh\nsleep 1\n", { mode: 0o755 });
  try {
    await timed(
      run,
      "SC-003",
      "an approval's Approved, its hook running",
      [
        { kind: "text", name: "approved", selector: MAIN, text: "Approved on" },
        { kind: "text", name: "toast", text: "Approving the spec of" },
      ],
      () => run.page.getByRole("button", { exact: true, name: "Approve" }).click(),
    );
    // The commit lands before the hook goes.
    await run.page.waitForTimeout(2000);
  } finally {
    rmSync(hook, { force: true });
  }
}

/** The worktrees of `repo`, by `git worktree list`. */
function worktrees(repo: string): number {
  return execFileSync("git", ["-C", repo, "worktree", "list", "--porcelain"], { encoding: "utf8" })
    .split("\n")
    .filter((line) => line.startsWith("worktree ")).length;
}

/**
 * A feature written on New and started: the editor from its title, the session from Start with
 * its message, another page while its steps run (SC-004), then the pages once its worktree is
 * made (SC-006).
 */
export async function start(run: Run, prefix: string, repo: string) {
  await open(run, `${prefix}/new?kind=feature`);
  await run.page.getByRole("textbox", { name: "Write Proposal" }).fill("Benchmark start");
  await run.page.keyboard.press("Control+Enter");
  await run.page.getByRole("dialog").waitFor();
  await timed(
    run,
    "SC-003",
    "a proposal written: its editor",
    [{ kind: "navigate", name: "editor", pattern: `${pagePattern(prefix)}/edit/.+` }],
    () => run.page.keyboard.press("Enter"),
  );
  await run.page.waitForTimeout(500);
  const before = worktrees(repo);
  await timed(
    run,
    "SC-004",
    "Start: its session with its message",
    [
      { kind: "navigate", name: "session", pattern: `${pagePattern(prefix)}/f/[^/]+/session` },
      { kind: "filled", name: "message", selector: '[role="textbox"][aria-label^="Message"]' },
    ],
    () => run.page.getByRole("button", { name: "Start feature" }).click(),
  );
  const column = run.page.getByRole("navigation", { name: "Navigation" });
  const inbox = column.getByRole("link", { exact: true, name: "Inbox" });
  await timed(
    run,
    "SC-004",
    "another page while the start runs",
    [{ kind: "navigate", name: "page", pattern: pagePattern(`${prefix}/inbox`) }],
    () => inbox.click(),
  );
  const made = Date.now();
  while (worktrees(repo) === before && Date.now() - made < 20_000) {
    await run.page.waitForTimeout(50);
  }
  if (worktrees(repo) === before) {
    process.stdout.write("The start made no worktree within 20 seconds: SC-006 not measured.\n");
    return;
  }
  await clickColumn(run, "SC-006", 6);
}

/**
 * A note committed with `git` outside Uraeda, timed from the file's write to the inbox page
 * drawing it, without a reload.
 */
export async function outsideCommit(run: Run, prefix: string, repo: string, note: string) {
  await open(run, `${prefix}/inbox`);
  let written = 0;
  const conditions: Array<Condition> = [{ kind: "text", name: "note", selector: MAIN, text: note }];
  const measured = await measure(
    run.page,
    run.server,
    conditions,
    async () => {
      written = Date.now();
      appendFileSync(join(repo, "specs/INBOX.md"), `\n- ${note}\n`);
      execFileSync("git", ["-C", repo, "commit", "-qam", "docs: a note"]);
    },
    () => written,
  );
  run.report.add("SC-005", run.project, "a commit made with git, on its page", measured);
}
