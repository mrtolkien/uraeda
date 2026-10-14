/**
 * The screenshots' chats and sessions: a chat replied to, one whose action auto mode blocked, a new
 * chat, and a feature's session at work, with its feature's agent section. Each is set up once, on
 * the first shot's page, then taken at every size and theme.
 */
import type { Page } from "playwright";
import type { FakeAdapter } from "uraeda-server/testing";
import { type Each, here, show, wait } from "./shots.ts";

/** A feature waiting on the agent: the fixture's CLI TUIs. */
export const AGENT = "/f/2026-10-12-cli-tuis";
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
