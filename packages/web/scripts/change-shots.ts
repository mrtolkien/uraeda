/**
 * The screenshots' views of changes: a change's page with its agent at work, a change waiting on a
 * round, a change whose pull request is ready, and "New change" with a typed change. Each change is
 * started from "New change" once, on the first shot's page, then taken at every size and theme.
 * Taken last: its turns end the agent's current one.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import { git } from "uraeda-binding/test-utils";
import type { FakeAdapter } from "uraeda-server/testing";
import { type Each, here, settle, show, wait } from "./shots.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));

const CENTRED_TITLE = "Centre the x in failure circles";
const CENTRED_BODY = "In failures the x sits low in its circle.";
const LOGO_TITLE = "A home logo in the header";

/** A round of one question, waiting on the human. */
const ROUND = `---
status: awaiting-human
---

# Clarifications, round 01: ${LOGO_TITLE}

> [!IMPORTANT]
>
> 1 question on the header, about 5 minutes.
>
> - Verdict: worth building as proposed.

## Context

### Goal

The [proposal](proposal.md) asks for a logo in the header.

### Today

The header shows the repository's name, and no logo.

### Scope

The header, at every width.

### Sources

- The proposal, and the header's layout at 402 px.

## Q1: Does the logo replace the repository's name at 402 px?

Why it matters: the header has no room for both.

- **A (recommended). The logo replaces the name.**
  - [pro] it fits.
- **B. The name stays, without a logo.**
  - [con] no logo on phones.

**Answer:**

## Settled without the human

### Under the hood

- **The logo is an SVG** in the header's component, sized by the header's height.

**Notes:**
`;

/** The record of the finished change, its pull request #31. */
const RECORD = `---
kind: change
finished: 2026-10-16
pull-request: https://github.com/o/r/pull/31
---

# Record: ${CENTRED_TITLE}

> [!NOTE]
>
> The record of a merged change, not instructions to follow.

## What and why

The x sat low in its circle.

## Behaviour

- The x is centred.

## Design

The glyph is centred on its box.
`;

/** A turn's end, its work done. */
const result = { denials: [], errors: [], interrupted: false, ok: true, type: "result" as const };

/** "New change", with a change typed, and the core's slug proposed for it: `proposed`, if given. */
async function typeChange(page: Page, text: string, proposed?: string) {
  await show(page, "/changes/new", "Describe the bug or the change.");
  await page.getByRole("textbox", { name: "Message Claude Code" }).fill(text);
  const slug = page.getByRole("textbox", { name: "Slug" });
  for (let value = ""; !value || (proposed && value !== proposed);) {
    await wait(50);
    value = await slug.inputValue();
  }
}

/**
 * Starts a change from "New change", as the human does, under `slug`: the server sends its first
 * run, which the agent accepts. Its folder, once its page opens.
 */
async function startChange(adapter: FakeAdapter, page: Page, text: string, slug: string) {
  await typeChange(page, text);
  await page.getByRole("textbox", { name: "Slug" }).fill(slug);
  const sent = adapter.sent.length;
  await page.getByRole("button", { name: "Start the change" }).click();
  while (adapter.sent.length === sent) {
    await wait(50);
  }
  adapter.emit({ id: adapter.sent.at(-1)!.id, type: "accepted" });
  // Its session, which a change's first run opens (R21 of the feature redesign).
  await page.waitForURL(new RegExp(`/f/\\d{4}-\\d{2}-\\d{2}-${slug}/session$`));
  return here(page).slice("/f/".length, -"/session".length);
}

/** Writes files in a change's worktree, which starting it made, and commits them. */
function commit(
  repo: string,
  folder: string,
  files: Record<string, string | null>,
  message: string,
) {
  const worktree = join(repo, ".worktrees", folder);
  for (const [path, text] of Object.entries(files)) {
    if (text === null) {
      rmSync(join(worktree, path), { force: true });
      continue;
    }
    mkdirSync(dirname(join(worktree, path)), { recursive: true });
    writeFileSync(join(worktree, path), text);
  }
  git(worktree, "add", "--all");
  git(worktree, "commit", "--quiet", "--no-verify", "--message", message);
}

/** A file of `count` lines. */
const code = (count: number) =>
  Array.from({ length: count }, (_, index) => `// line ${index + 1}`).join("\n");

/**
 * A change's session, its column's first section shown on the desktop, and its progress line on
 * the phone, at the top of the page unless the transcript's latest is wanted.
 */
async function changePage(page: Page, folder: string, title: string, section: string, top = true) {
  await show(page, `/f/${folder}/session`, title);
  if (page.viewportSize()!.width >= 768) {
    await page
      .getByRole("complementary", { name: "Progress" })
      .getByRole("heading", { exact: true, name: section })
      .waitFor();
  } else {
    await page.getByRole("button", { name: new RegExp(`^${section}`) }).waitFor();
    if (top) {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  }
  await settle(page);
}

/** header-logo, started: its agent asked one question, and the change waits on the human. */
async function waitingOnRound(adapter: FakeAdapter, first: Page, repo: string) {
  const folder = await startChange(
    adapter,
    first,
    `${LOGO_TITLE}\n\nThe header shows no logo.`,
    "header-logo",
  );
  commit(
    repo,
    folder,
    { [`specs/changes/${folder}/clarifications-01.md`]: ROUND },
    "clarify(header-logo): round 01",
  );
  adapter.emit({
    text: "One question before I go on: the header has no room for a logo at 402 px without dropping the repository's name. It's in `clarifications-01.md`.",
    type: "text",
  });
  adapter.emit(result);
  await first.getByRole("button", { name: "Stop" }).waitFor({ state: "detached" });
  return folder;
}

/** centred-x, started: its agent read, found the cause, and edits the mark. */
async function atWork(adapter: FakeAdapter, first: Page, repo: string) {
  const folder = await startChange(
    adapter,
    first,
    `${CENTRED_TITLE}\n\n${CENTRED_BODY}`,
    "centred-x",
  );
  commit(
    repo,
    folder,
    {
      "packages/web/src/__browser__/status-mark.test.tsx": code(18),
      "packages/web/src/StatusMark.tsx": code(40),
    },
    "fix(centred-x): the failure mark's x is centred",
  );
  for (const [id, path] of [
    ["r1", "packages/web/src/StatusMark.tsx"],
    ["r2", "packages/web/src/__browser__/sizes.test.tsx"],
  ] as const) {
    adapter.emit({
      id,
      input: { file_path: path },
      kind: "read",
      name: "Read",
      target: path,
      type: "toolStart",
    });
    adapter.emit({ id, isError: false, output: "…", type: "toolEnd" });
  }
  adapter.emit({
    text: "It's a bug: the failure mark's glyph sits on the text baseline, 2 px low in the 18 px circle, while the other marks are centred. I wrote a test that fails on its vertical offset at both widths, and now I'm fixing the mark.",
    type: "text",
  });
  adapter.emit({
    id: "e1",
    input: { file_path: "packages/web/src/StatusMark.tsx" },
    kind: "edit",
    name: "Edit",
    target: "packages/web/src/StatusMark.tsx",
    type: "toolStart",
  });
  await first.getByRole("button", { name: "Stop" }).first().waitFor();
  await wait(500);
  return folder;
}

/** centred-x's pull request is ready: the turn ends, and its folder becomes its record. */
async function finished(adapter: FakeAdapter, repo: string, folder: string) {
  adapter.emit({ id: "e1", isError: false, output: "", type: "toolEnd" });
  adapter.emit({ text: "The pull request is ready for review: #31.", type: "text" });
  adapter.emit(result);
  commit(
    repo,
    folder,
    {
      [`specs/changes/${folder}/proposal.md`]: null,
      [`specs/done/${folder}.md`]: RECORD,
    },
    "finish(centred-x): Centre the x in failure circles",
  );
  await wait(500);
}

/** The phone's views: the navigation, with the changes' tags, and the round's line open. */
async function phoneShots(each: Each, centred: string, logo: string) {
  await each(
    "change-sidebar",
    async ({ page }) => {
      await changePage(page, centred, CENTRED_TITLE, "Change", false);
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.getByRole("link", { name: /^centred-x, / }).waitFor();
      await settle(page);
    },
    "phone",
  );
  await each(
    "change-round-open",
    async ({ page }) => {
      await changePage(page, logo, LOGO_TITLE, "Answer questions");
      await page.getByRole("button", { name: "Answer questions · 1 question" }).click();
      await page.getByRole("link", { name: "Questions, round 01" }).waitFor();
      await settle(page);
    },
    "phone",
  );
}

/** "New change", the change typed with a screenshot, and its slug proposed. */
async function newChange(page: Page) {
  await typeChange(page, `${CENTRED_TITLE}\n\n${CENTRED_BODY}`, "centre-x");
  await page
    .locator('input[type="file"]')
    .setInputFiles(join(root, "fixtures/images", "desktop.png"));
  await page.getByRole("button", { name: /^Remove / }).waitFor();
  await settle(page);
}

/** The changes' views, their repository at `repo`. */
export async function takeChanges(each: Each, first: Page, adapter: FakeAdapter, repo: string) {
  const logo = await waitingOnRound(adapter, first, repo);
  const centred = await atWork(adapter, first, repo);
  await each("change-working", ({ page }) =>
    changePage(page, centred, CENTRED_TITLE, "Change", false),
  );
  await each("change-round", ({ page }) => changePage(page, logo, LOGO_TITLE, "Answer questions"));
  await phoneShots(each, centred, logo);
  await finished(adapter, repo, centred);
  await each("change-pull-request", ({ page }) =>
    changePage(page, centred, CENTRED_TITLE, "Pull request state unknown"),
  );
  await each("new-change", ({ page }) => newChange(page));
}
