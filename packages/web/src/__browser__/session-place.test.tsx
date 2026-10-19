// A session's reading place (the UI behaviour decision: Back and reload keep the human's place and
// what they were reading): it follows its end only while the human is at the end, Jump to the
// latest brings the end back, Back and a reload return to the position read, and showing earlier
// messages leaves the message read where it is. Positions are compared with each other, never with
// a size.
import { act, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { navigate } from "../routes.tsx";
import { agent, atRepo, drawn, LIVE, opened, reload, startTurn } from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

/** Rounded, as the browser reports it. */
const scrolled = () => Math.round(window.scrollY);

/** Lines of the agent's text, numbered. */
function lines(count: number, prefix = "Line") {
  return Array.from({ length: count }, (_, index) => ({
    text: `${prefix} ${index + 1}.`,
    type: "text" as const,
  }));
}

/** What scrolls the transcript: the window, the session being a page of its own. */
const scroller = () => document.scrollingElement!;
const composer = () => screen.getByRole("textbox", { name: "Message Claude Code" });
/** Whether an element's bottom shows above the composer. */
const inView = (element: Element) =>
  element.getBoundingClientRect().bottom <= composer().getBoundingClientRect().top + 1;

/** Opens the session and starts a turn that writes `count` lines. */
async function working(count: number) {
  await opened(`/f/${CLI}/session`);
  await startTurn("Plan the CLI.", lines(count));
  const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await within(log).findByText(`Line ${count}.`, undefined, LIVE);
  await drawn();
  return log;
}

/** Ends the agent's turn, and waits for the composer's Stop to go. */
async function ended() {
  await agent.agentEmit([
    { denials: [], errors: [], interrupted: false, ok: true, type: "result" },
  ]);
  await expect.poll(() => screen.queryByRole("button", { name: "Stop" }), LIVE).toBeNull();
}

describe("a session", () => {
  test("follows its end while the human is there, and stays put once they scroll up", async () => {
    const log = await working(40);
    const box = scroller();
    box.scrollTo(0, box.scrollHeight);
    await drawn();

    await agent.agentEmit([{ text: "The newest line.", type: "text" }]);
    await expect.poll(() => inView(within(log).getByText("The newest line.")), LIVE).toBe(true);

    const middle = Math.round((box.scrollHeight - box.clientHeight) / 2);
    box.scrollTo(0, middle);
    await drawn();
    const position = box.scrollTop;
    expect(position).toBeGreaterThan(0);
    await agent.agentEmit(lines(30, "Later line"));
    await within(log).findByText("Later line 30.", undefined, LIVE);
    await drawn();
    expect(box.scrollTop).toBe(position);
  });

  test("Jump to the latest brings the end back, and the page follows it again", async () => {
    const log = await working(40);
    const box = scroller();
    box.scrollTo(0, box.scrollHeight);
    await drawn();
    // At the end, nothing to jump to.
    expect(screen.queryByRole("button", { name: /^Jump to/ })).toBeNull();

    box.scrollTo(0, box.scrollTop - 400);
    await drawn();
    const jump = await screen.findByRole("button", { name: /^Jump to/ }, LIVE);
    await agent.agentEmit(lines(5, "Later line"));
    const latest = await within(log).findByText("Later line 5.", undefined, LIVE);
    expect(inView(latest)).toBe(false);

    await userEvent.click(jump);

    await expect.poll(() => inView(latest), LIVE).toBe(true);
    await expect.poll(() => screen.queryByRole("button", { name: /^Jump to/ }), LIVE).toBeNull();
    await agent.agentEmit([{ text: "A line after the jump.", type: "text" }]);
    await expect
      .poll(() => inView(within(log).getByText("A line after the jump.")), LIVE)
      .toBe(true);
  });

  test("Back and a reload return to the position read", async () => {
    await working(40);
    await ended();
    const box = scroller();
    box.scrollTo(0, Math.round((box.scrollHeight - box.clientHeight) / 2));
    await drawn();
    const position = scrolled();
    expect(position).toBeGreaterThan(0);
    // The page saves its position in the history entry as the human scrolls, not at once.
    await expect
      .poll(() => Math.round((window.history.state as { scroll?: number } | null)?.scroll ?? -1))
      .toBe(position);

    await act(async () => navigate(atRepo(`/f/${CLI}`)));
    await expect.poll(() => window.location.pathname).toBe(atRepo(`/f/${CLI}`));
    await drawn();
    await act(async () => window.history.back());
    await expect.poll(() => window.location.pathname).toBe(atRepo(`/f/${CLI}/session`));
    await screen.findByRole("log", { name: "Conversation" }, LIVE);
    await expect.poll(scrolled, LIVE).toBe(position);

    await reload("");
    await screen.findByRole("log", { name: "Conversation" }, LIVE);
    await expect.poll(scrolled, LIVE).toBe(position);
  });

  test("showing earlier messages leaves the message read where it is", async () => {
    await opened(`/f/${CLI}/session`);
    await startTurn("Plan the CLI.", lines(60, "Tail"));
    const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
    await within(log).findByText("Tail 60.", undefined, LIVE);
    await ended();
    await drawn();
    const drawnLines = () => within(log).queryAllByText(/^Tail \d+\.$/);
    const before = drawnLines().length;
    const button = within(log).getByRole("button", { name: /earlier/i });
    // Read at the button, in the middle of the window: pressing it scrolls nothing itself.
    button.scrollIntoView({ block: "center" });
    await drawn();
    const reading = drawnLines()[0]!;
    const top = reading.getBoundingClientRect().top;

    await userEvent.click(button);

    await expect.poll(() => drawnLines().length, LIVE).toBeGreaterThan(before);
    await drawn();
    expect(reading.isConnected).toBe(true);
    expect(Math.abs(reading.getBoundingClientRect().top - top)).toBeLessThanOrEqual(1);
  });
});
