/**
 * The session redesign's views, as its mockups draw them: a chat read, with its latest messages
 * and the button for the earlier ones; a chat with two actions blocked, with "Allow all" beside
 * Send; and a chat scrolled above its end, with "Jump to the latest". Each chat is made once, on the
 * first shot's page, then taken at every size and theme.
 */
import type { Page } from "playwright";
import type { FakeAdapter } from "uraeda-server/testing";
import { type Each, here, show, settle, wait } from "./shots.ts";

const result = { denials: [], errors: [], interrupted: false, ok: true, type: "result" as const };

/** Sends a message from the new chat's composer, and gives the chat's path once it is made. */
async function start(adapter: FakeAdapter, page: Page, text: string) {
  await show(page, "/chats/new", "New chat");
  const sent = adapter.sent.length;
  await page.getByRole("textbox", { name: "Message Claude Code" }).fill(text);
  await page.getByRole("button", { name: "Send" }).first().click();
  while (adapter.sent.length === sent) {
    await wait(50);
  }
  adapter.emit({ id: adapter.sent.at(-1)!.id, type: "accepted" });
  await page.waitForURL(/\/chats\/(?!new)/);
  return here(page);
}

/** A reply of the agent's, with a few tool calls before it. */
function reply(adapter: FakeAdapter) {
  for (const [id, name, kind, target] of [
    ["r1", "Read", "read", "src/store/tasks.ts"],
    ["r2", "Edit", "edit", "src/store/tasks.ts"],
    ["r3", "Bash", "execute", "pnpm test"],
  ] as const) {
    adapter.emit({ id, input: {}, kind, name, target, type: "toolStart" });
    adapter.emit({ id, isError: false, output: "", type: "toolEnd" });
  }
  adapter.emit({
    text: [
      "The recurring-task store keeps one row per task, so completing a task moves its due date.",
      "",
      "- `src/store/tasks.ts` owns the move.",
      "- The undo puts the previous date back.",
      "",
      "I ran the tests and **all 41 pass**.",
    ].join("\n"),
    type: "text",
  });
}

/** The three views: a long chat read, one blocked twice, and the long one scrolled up. */
export async function takeSessionLook(each: Each, first: Page, adapter: FakeAdapter) {
  const reading = await start(
    adapter,
    first,
    "Make completing a repeating task move its due date.",
  );
  for (let step = 1; step <= 24; step++) {
    adapter.emit({
      text: `Step ${step}: reading how the store keeps its due dates.`,
      type: "text",
    });
  }
  reply(adapter);
  adapter.emit(result);
  await first.getByText("all 41 pass").first().waitFor();
  await each("session-reading", ({ page }) => show(page, reading, "all 41 pass"));
  await each("session-scrolled", async ({ page }) => {
    await show(page, reading, "all 41 pass");
    await page.evaluate(() => window.scrollBy(0, -300));
    await page.getByRole("button", { name: "Jump to the latest" }).waitFor();
    await settle(page);
  });

  const blocked = await start(adapter, first, "Clean the build and fix the task store.");
  reply(adapter);
  adapter.emit({
    ...result,
    denials: [
      { input: { command: "rm -rf dist" }, tool: "Bash" },
      { input: { file_path: "src/store/tasks.ts" }, tool: "Edit" },
    ],
  });
  await each("session-blocking", ({ page }) => show(page, blocked, "Allow all (2)"));
}
