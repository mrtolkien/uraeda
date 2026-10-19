/**
 * The screenshots' chats and sessions: a chat replied to, one whose action auto mode blocked, a new
 * chat, and a feature's session at work, with its feature's agent section. Each is set up once, on
 * the first shot's page, then taken at every size and theme.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Page } from "playwright";
import { ELEVEN, git, planText } from "uraeda-binding/test-utils";
import type { FakeAdapter } from "uraeda-server/testing";
import { type Each, here, settle, show, wait } from "./shots.ts";

/** A feature waiting on the agent: the fixture's CLI TUIs. */
export const AGENT = "/f/2026-10-12-cli-tuis";
const FOLDER = "2026-10-12-cli-tuis";
const LONG = "specs/2026-10-12-cli-tuis/clarifications-01.md";

/** A turn's end, its work done. */
const result = { denials: [], errors: [], interrupted: false, ok: true, type: "result" as const };

/** Sends a message from the composer, as the human does, and gives the message's ID. */
async function send(adapter: FakeAdapter, page: Page, text: string) {
  const sent = adapter.sent.length;
  await page.getByRole("textbox", { name: "Message Claude Code" }).fill(text);
  await page.getByRole("button", { name: "Send" }).first().click();
  while (adapter.sent.length === sent) {
    await wait(50);
  }
  return adapter.sent.at(-1)!.id;
}

/** The chats, then a feature's session at work. */
export async function takeSessions(each: Each, first: Page, adapter: FakeAdapter) {
  await takeChats(each, first, adapter);
  await takeWorking(each, first, adapter);
}

/** The phone's progress line, and the sidebar's progress row, of the feature at Task 7 of 11. */
const LINE = "Implementation · 7/11 · Session column";
const PROGRESS = /7\/11 · Session column/;

/** The session's page at its feature's implementation, its column shown. */
async function implementation(page: Page) {
  // Shown again, if an earlier view hid it: a page not opened yet has nothing kept.
  if (page.url().startsWith("http")) {
    await page.evaluate(() => window.localStorage.removeItem("uraeda.sessionAside"));
  }
  await show(page, `${AGENT}/session`, PROGRESS);
  if (page.viewportSize()!.width >= 768) {
    await page.getByText("Task 7 of 11").waitFor();
    await settle(page);
  }
}

/** A file of `count` lines, for the branch's changes. */
const code = (count: number) =>
  Array.from({ length: count }, (_, index) => `// line ${index + 1}`).join("\n");

/**
 * The session at work, once its feature has a plan at Task 7 of 11 and files changed on its
 * branch: its column, the column hidden with the page scrolled up, the phone's progress line
 * open, and the sidebar's progress row. Taken last: the plan moves the feature on.
 */
export async function takeImplementation(each: Each, adapter: FakeAdapter, repo: string) {
  // Committed in the feature's worktree, which its session made.
  const worktree = join(repo, ".worktrees", FOLDER);
  const files: Record<string, string> = {
    [`specs/${FOLDER}/plan.md`]: planText(ELEVEN),
    "crates/core/src/files/plan.rs": code(31),
    "crates/core/src/git.rs": code(38),
    "packages/web/src/__browser__/columns.test.tsx": code(45),
    "packages/web/src/SessionAside.tsx": code(148),
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(worktree, path)), { recursive: true });
    writeFileSync(join(worktree, path), text);
  }
  git(worktree, "add", "--all");
  git(worktree, "commit", "--quiet", "--no-verify", "--message", "Task 7: Session column");
  for (let step = 1; step <= 14; step++) {
    adapter.emit({
      text: `Step ${step} of Task 7: the column beside the transcript reads the plan's tasks and the branch's changed files, and folds away with "Hide progress".`,
      type: "text",
    });
  }
  adapter.emit({
    id: "test",
    input: { command: "vp test session-place" },
    kind: "execute",
    name: "Bash",
    target: "vp test --project desktop session-place",
    type: "toolStart",
  });
  await wait(1000);
  await each("session-implementation", ({ page }) => implementation(page));
  await each("session-hidden", async ({ page, size }) => {
    await implementation(page);
    if (size === "desktop") {
      await page.getByRole("button", { name: "Hide progress" }).click();
      await page.getByRole("button", { name: "Show progress" }).waitFor();
    }
    // Scrolled up; on the phone, to the top, where its progress line shows closed.
    await page.evaluate(() =>
      window.innerWidth < 768 ? window.scrollTo(0, 0) : window.scrollBy(0, -400),
    );
    await page.getByRole("button", { name: "Jump to the latest" }).waitFor();
    await settle(page);
  });
  await each(
    "session-phone-open",
    async ({ page }) => {
      await implementation(page);
      await page.getByRole("button", { name: LINE }).click();
      await page
        .getByRole("region", { name: "Progress" })
        .getByText("Changed on the branch")
        .waitFor();
      await settle(page);
    },
    "phone",
  );
  await each("sidebar-progress", async ({ page, size }) => {
    await implementation(page);
    if (size === "phone") {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.getByRole("link", { name: /Task 7 of 11, Session column/ }).waitFor();
    }
    await settle(page);
  });
}

async function takeChats(each: Each, first: Page, adapter: FakeAdapter) {
  // Two chats: one replied to, one whose action auto mode blocked.
  await show(first, "/chats/new", "New chat");
  let id = await send(adapter, first, "Why is CI slow on WebKit?");
  adapter.emit({ id, type: "accepted" });
  adapter.emit({
    text: "WebKit draws without a GPU on CI: its animations take longer.",
    type: "text",
  });
  adapter.emit(result);
  await first.waitForURL(/\/chats\/(?!new)/);
  const replied = here(first);
  await each("chat", ({ page }) => show(page, replied, "draws without a GPU"));
  await show(first, "/chats/new", "New chat");
  id = await send(adapter, first, "Tag v0.3.0 and push the tag.");
  adapter.emit({ id, type: "accepted" });
  adapter.emit({
    id: "tag",
    input: { command: "git tag v0.3.0" },
    kind: "execute",
    name: "Bash",
    target: "git tag v0.3.0",
    type: "toolStart",
  });
  adapter.emit({ id: "tag", isError: false, output: "", type: "toolEnd" });
  adapter.emit({
    text: "I created the tag `v0.3.0`, but pushing it was blocked. Allow the push and I'll retry.",
    type: "text",
  });
  adapter.emit({
    ...result,
    denials: [{ input: { command: "git push origin v0.3.0" }, tool: "Bash" }],
  });
  await first.waitForURL(/\/chats\/(?!new)/);
  const chat = here(first);
  await each("chat-blocked", ({ page }) => show(page, chat, "Allow and retry"));
  await each("chat-new", ({ page }) => show(page, "/chats/new", "New chat"));
}

async function takeWorking(each: Each, first: Page, adapter: FakeAdapter) {
  // A feature's session at work: a sub-agent's tools, a reply streaming, and a steered message.
  await show(first, `${AGENT}/session`, "CLI TUIs");
  const id = await send(adapter, first, "Plan the CLI.");
  adapter.emit({ id, type: "accepted" });
  adapter.emit({
    fiveHour: { percentUsed: 43, resetsAt: new Date(Date.now() + 3_600_000).toISOString() },
    type: "usage",
  });
  adapter.emit({ text: `Reading **the answers** of round 01 in \`${LONG}\`.`, type: "text" });
  adapter.emit({
    id: "a",
    input: { file_path: LONG },
    kind: "read",
    name: "Read",
    target: LONG,
    type: "toolStart",
  });
  adapter.emit({ id: "a", isError: false, output: "…", type: "toolEnd" });
  adapter.emit({
    id: "task",
    input: {},
    kind: "other",
    name: "Task",
    subagent: { description: "Map the runner code" },
    type: "toolStart",
  });
  adapter.emit({
    id: "b",
    input: {},
    kind: "search",
    name: "Grep",
    parent: "task",
    target: '"sessions" packages/server/src/runner/',
    type: "toolStart",
  });
  adapter.emit({
    text: "The runner already keeps one cache per repository. I'll key sessions by their own ID",
    type: "textDelta",
  });
  await first.getByRole("button", { name: "Stop" }).first().waitFor();
  await send(adapter, first, "Use the existing helper for the cache's paths.");
  await wait(500);
  await each("session-working", async ({ page }) => {
    await show(page, `${AGENT}/session`, "Not read yet");
  });
  await each("agent-section", async ({ page }) => {
    await show(page, AGENT, "Open the session");
    // The section at the top, below the phone's top bar.
    await page
      .getByRole("region", { name: "Agent" })
      .evaluate((element) =>
        window.scrollBy(
          0,
          element.getBoundingClientRect().top - (window.innerWidth < 768 ? 64 : 16),
        ),
      );
    await wait(300);
  });
}
