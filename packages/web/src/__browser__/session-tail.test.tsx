// US1.2 and its edge case "Back after pressing Show earlier messages twice": in WebKit, at both
// sizes, "Show earlier messages" keeps the message the human reads where it is on the screen, and
// Back draws as many messages as were shown, at the same scroll position.
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { act } from "react";
import { navigate } from "../routes.tsx";
import { agent, atRepo, drawn, LIVE, reload, show, startTurn } from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

const EARLIER = { name: "Show earlier messages" };

/** Lines of the agent's text, numbered. */
function lines(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    text: `Tail ${index + 1}.`,
    type: "text" as const,
  }));
}

/** The lines the transcript draws, in order. */
function drawnLines(log: HTMLElement) {
  return within(log).queryAllByText(/^Tail \d+\.$/);
}

/** Opens the feature's session with a turn of `count` lines of the agent, and ends the turn. */
async function openSessionOf(count: number) {
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await startTurn("Plan the CLI.", lines(count));
  const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await within(log).findByText(`Tail ${count}.`, undefined, LIVE);
  await agent.agentEmit([
    { denials: [], errors: [], interrupted: false, ok: true, type: "result" },
  ]);
  await expect.poll(() => screen.queryByRole("button", { name: "Stop" }), LIVE).toBeNull();
  await drawn();
  return log;
}

test("US1.2: Show earlier messages keeps the message read at the same place on the screen", async () => {
  const log = await openSessionOf(60);
  expect(drawnLines(log)).toHaveLength(20);
  const button = within(log).getByRole("button", EARLIER);

  // Read at the button, which is in the middle of the window: the press scrolls nothing itself.
  button.scrollIntoView({ block: "center" });
  await drawn();
  const reading = drawnLines(log)[0]!;
  const before = reading.getBoundingClientRect().top;
  await userEvent.click(button);
  await expect.poll(() => drawnLines(log).length, LIVE).toBe(40);
  await drawn();

  expect(drawnLines(log)[20]).toBe(reading);
  expect(Math.abs(reading.getBoundingClientRect().top - before)).toBeLessThanOrEqual(1);
  expect(within(log).getAllByRole("button", EARLIER)).toHaveLength(1);
});

/** Presses "Show earlier messages" twice, and reads message 30 of the 60 drawn, saved as the place. */
async function readFarBack() {
  const log = await openSessionOf(100);
  for (const count of [40, 60]) {
    const button = within(log).getByRole("button", EARLIER);
    button.scrollIntoView({ block: "center" });
    await drawn();
    await userEvent.click(button);
    await expect.poll(() => drawnLines(log).length, LIVE).toBe(count);
    await drawn();
  }
  const reading = drawnLines(log)[30]!;
  window.scrollTo(0, Math.round(window.scrollY + reading.getBoundingClientRect().top - 200));
  await drawn();
  // The page saves its position as the human scrolls, not at once.
  await new Promise((resolve) => setTimeout(resolve, 700));
  return Math.round(window.scrollY);
}

test("Back after two presses draws 60 messages again, at the same position", async () => {
  const position = await readFarBack();

  // The page opens from where it is read, as a link there would: the click on one scrolls first.
  await act(async () => navigate(atRepo(`/f/${CLI}`)));
  await expect.poll(() => window.location.pathname).toBe(atRepo(`/f/${CLI}`));
  await drawn();
  await act(async () => window.history.back());
  await expect.poll(() => window.location.pathname).toBe(atRepo(`/f/${CLI}/session`));
  const again = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await expect.poll(() => drawnLines(again).length, LIVE).toBe(60);
  await drawn();

  await expect.poll(() => Math.round(window.scrollY), LIVE).toBe(position);
});

test("a reload draws 60 messages again, at the same position", async () => {
  const position = await readFarBack();

  await reload("CLI TUIs");
  const again = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await expect.poll(() => drawnLines(again).length, LIVE).toBe(60);
  await drawn();

  await expect.poll(() => Math.round(window.scrollY), LIVE).toBe(position);
});
