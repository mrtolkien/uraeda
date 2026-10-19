// Flow: the session's composer offers the one message the workflow recommends, inserted unsent;
// what the human typed stays with it; a message that is sent ends the run's mark; a feature that
// waits on the human recommends nothing, and a typed message can always be sent as a chat.
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { click, quiet, startApp, type } from "./harness.tsx";
import { composer, composerText, resetAgent } from "./session-helpers.tsx";

const WEB_UI = "2026-10-11-web-ui";
const CLI = "2026-10-12-cli-tuis";

const app = startApp({ agent: true });

beforeEach(() => resetAgent(app));

/** The button inserting the recommended message, once the server's recommendation is read. */
function insert() {
  return screen.findByRole("button", { name: /^Insert: / });
}

test("the composer inserts the step's message unsent, moves the focus to the field, and keeps what was typed", async () => {
  await app.open(`/f/${CLI}/session`);
  await type(await composer(), "Why A in Q6?");

  await click(await insert());

  await waitFor(() => expect(composerText()).toMatch(/^\/uraeda /));
  expect(composerText()).toMatch(/\nWhy A in Q6\?$/);
  await waitFor(async () => expect(document.activeElement).toBe(await composer()));
  // Every request the click made is answered: none sent the message.
  await quiet();
  expect(app.agent.sent).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Start the agent" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Insert: / })).toBeNull();
});

test("emptying the composer drops the inserted message: Send is back", async () => {
  await app.open(`/f/${CLI}/session`);
  await click(await insert());
  await waitFor(() => expect(composerText()).toMatch(/^\/uraeda /));

  await type(await composer(), "");

  expect(await insert()).toBeTruthy();
  expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Start the agent" })).toBeNull();
});

test("a feature that waits on the human recommends nothing, and a typed message is sent as a chat", async () => {
  await app.open(`/f/${WEB_UI}/session`);
  await composer();
  expect(screen.queryByRole("button", { name: /^Insert: / })).toBeNull();

  await type(await composer(), "Why this order?");
  await click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  // A chat: the agent reads the chat's opening, not a step's message.
  expect(app.agent.sent[0].text.startsWith("/uraeda ")).toBe(false);
  expect(app.agent.sent[0].text).toContain("Why this order?");
});

test("the message sent clears the mark of its run: the composer is empty and Send is back", async () => {
  app.agent.script([]);
  await app.open(`/f/${CLI}/session`);
  await click(await insert());
  await waitFor(() => expect(composerText()).toMatch(/^\/uraeda /));

  await click(screen.getByRole("button", { name: "Start the agent" }));

  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  expect(app.agent.sent[0].text.startsWith("/uraeda ")).toBe(true);
  await waitFor(() => expect(composerText()).toBe(""));
  expect(await screen.findByRole("button", { name: "Send" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Start the agent" })).toBeNull();
});
