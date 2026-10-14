// US1 and its edge case "Back from a session view": a feature's session opens as a page of its own
// at both sizes, its transcript follows its end while the human is at the end, and Back returns to
// the same position. The session view passes the layout checks at both sizes, in light and dark
// (SC-004).
import { act, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atRepo, agent, checkLayout, drawn, LIVE, show, startTurn } from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

afterEach(() => {
  window.localStorage.removeItem("uraeda.theme");
});

/** What scrolls the transcript: the window, the session being a page of its own. */
function scroller() {
  return document.scrollingElement!;
}

/** Whether an element's bottom shows above the composer, which stays at the bottom. */
function inView(element: Element) {
  const composer = screen.getByRole("textbox", { name: "Message Claude Code" });
  return element.getBoundingClientRect().bottom <= composer.getBoundingClientRect().top + 1;
}

/** Lines of the agent's text, numbered. */
function lines(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    text: `${prefix} ${index + 1}.`,
    type: "text" as const,
  }));
}

/** Opens the feature's session from its page, and starts a turn that writes 40 lines. */
async function openWorkingSession() {
  await show(`/f/${CLI}`, "Open the session");
  await userEvent.click(screen.getByRole("link", { name: "Open the session" }));
  await expect.poll(() => window.location.pathname).toBe(atRepo(`/f/${CLI}/session`));
  await startTurn("Plan the CLI.", lines(40, "Line"));
  const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await within(log).findByText("Line 40.", undefined, LIVE);
  await drawn();
  return log;
}

test("a working session: a page of its own, following its end (US1)", async () => {
  const log = await openWorkingSession();
  expect(screen.queryByRole("list", { name: "Files" })).toBeNull();
  await checkLayout();

  // At the end, a new line comes into view.
  const box = scroller();
  box.scrollTo(0, box.scrollHeight);
  await drawn();
  await agent.agentEmit([{ text: "The newest line.", type: "text" }]);
  const newest = await within(log).findByText("The newest line.", undefined, LIVE);
  await expect.poll(() => inView(newest), LIVE).toBe(true);

  // Scrolled up, the view stays where it is, even as the turn grows past a page of 100 items.
  const middle = Math.round((box.scrollHeight - box.clientHeight) / 2);
  box.scrollTo(0, middle);
  await drawn();
  const position = box.scrollTop;
  expect(position).toBeGreaterThan(0);
  await agent.agentEmit(lines(70, "Later line"));
  await within(log).findByText("Later line 70.", undefined, LIVE);
  await drawn();
  expect(log.isConnected).toBe(true);
  expect(box.scrollTop).toBe(position);
});

// A session opened from a task view still opens at its end: the task view's pane keeps its own
// position in its history entry, which must not hold the session's page back.
test("a session opened from a task view's pane opens at its end", async () => {
  // Only the wide layout shows the task view in a pane.
  if (window.innerWidth < 768) {
    return;
  }
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await startTurn("Plan the CLI.", [
    {
      id: "task",
      input: {},
      kind: "other",
      name: "Task",
      subagent: { description: "Map the runner code" },
      type: "toolStart",
    },
    ...lines(40, "Line"),
  ]);
  await within(await screen.findByRole("log", { name: "Conversation" }, LIVE)).findByText(
    "Line 40.",
    undefined,
    LIVE,
  );
  await show("/priorities/claude-code-runner-triggered-manually", "Claude Code runner");
  // Scrolled, the pane has a position of its own for the task view's entry to keep.
  const pane = screen.getByRole("region", { name: "Detail" });
  pane.scrollTo(0, pane.scrollHeight);
  await drawn();

  await userEvent.click(
    await screen.findByRole("link", { name: "Map the runner code, Working" }, LIVE),
  );

  await expect.poll(() => window.location.pathname).toBe(atRepo(`/f/${CLI}/session`));
  const last = await within(
    await screen.findByRole("log", { name: "Conversation" }, LIVE),
  ).findByText("Line 40.", undefined, LIVE);
  await drawn();
  await expect.poll(() => inView(last), LIVE).toBe(true);
});

test("a working session, with a sub-agent and a steered message, in dark (SC-004)", async () => {
  window.localStorage.setItem("uraeda.theme", "dark");
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await startTurn("Plan the CLI.", [
    { text: "Reading **the answers**.", type: "text" },
    {
      id: "a",
      input: { file_path: "spec.md" },
      kind: "read",
      name: "Read",
      target: "specs/2026-10-12-cli-tuis/spec.md",
      type: "toolStart",
    },
    { id: "a", isError: false, output: "# Spec", type: "toolEnd" },
    {
      id: "task",
      input: {},
      kind: "other",
      name: "Task",
      subagent: { description: "Map the runner code" },
      type: "toolStart",
    },
    {
      id: "b",
      input: {},
      kind: "search",
      name: "Grep",
      parent: "task",
      target: '"sessions" packages/server/src/runner/',
      type: "toolStart",
    },
    { text: "The runner already keeps one cache per repository.", type: "textDelta" },
  ]);
  const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await within(log).findByText(/keeps one cache/, undefined, LIVE);
  await userEvent.fill(
    screen.getByRole("textbox", { name: "Message Claude Code" }),
    "Use the existing helper for the cache's paths.",
  );
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  await within(log).findByText("Not read yet", undefined, LIVE);
  await drawn();
  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  await checkLayout();
});

/**
 * Follows a link of the agent's reply, a real click as the human's, while it shows, then comes
 * back with Back once the page it opens is drawn in the session's place. Back before then is in
 * `routes.test.ts`.
 */
async function followAndComeBack(link: HTMLElement, path: string) {
  await userEvent.click(link);
  await expect.poll(() => window.location.pathname).toBe(atRepo(path));
  await expect.poll(() => link.isConnected, LIVE).toBe(false);
  await drawn();
  await act(async () => window.history.back());
  await expect.poll(() => window.location.pathname).toBe(atRepo(`/f/${CLI}/session`));
  await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await drawn();
}

test("Back from a session view returns to its position, following the end only from the end", async () => {
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await startTurn("Plan the CLI.", [
    ...lines(20, "Line"),
    { text: `As [the proposal](/f/${CLI}/proposal.md) asks.`, type: "text" },
    ...lines(20, "Next line"),
  ]);
  const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await within(log).findByText("Next line 20.", undefined, LIVE);
  await drawn();

  // Scrolled up to a link in the reply: Back returns there, and nothing moves as the turn grows.
  const box = scroller();
  const proposal = within(log).getByRole("link", { name: "the proposal" });
  box.scrollTo(
    0,
    Math.round(box.scrollTop + proposal.getBoundingClientRect().top - box.clientHeight / 2),
  );
  await drawn();
  const position = Math.round(box.scrollTop);
  expect(position).toBeGreaterThan(0);
  await followAndComeBack(proposal, `/f/${CLI}/proposal.md`);
  await expect.poll(() => Math.round(box.scrollTop), LIVE).toBe(position);
  await agent.agentEmit([{ text: "A line while scrolled up.", type: "text" }]);
  await screen.findByText("A line while scrolled up.", undefined, LIVE);
  await drawn();
  expect(Math.round(box.scrollTop)).toBe(position);

  // At the end: Back returns to the end, and the view follows it again.
  await agent.agentEmit([{ text: `Then [the spec](/f/${CLI}/spec.md).`, type: "text" }]);
  const spec = await screen.findByRole("link", { name: "the spec" }, LIVE);
  box.scrollTo(0, box.scrollHeight);
  await drawn();
  await followAndComeBack(spec, `/f/${CLI}/spec.md`);
  await agent.agentEmit([{ text: "A line after coming back.", type: "text" }]);
  const newest = await screen.findByText("A line after coming back.", undefined, LIVE);
  await expect.poll(() => inView(newest), LIVE).toBe(true);
});
