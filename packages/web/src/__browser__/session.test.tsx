// US1 and its edge case "Back from a session view": a feature's session opens beside its feature
// page on a wide screen and as a page of its own on a narrow one, its transcript follows its end
// while the human is at the end, and Back returns to the same position. The session view passes the
// layout checks at both sizes, in light and dark (SC-004).
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { agent, checkLayout, LIVE, settle, show, startTurn } from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

afterEach(() => {
  window.localStorage.removeItem("uraeda.theme");
});

/** What scrolls the transcript: the pane beside the feature page, or the window. */
function scroller() {
  const pane = document.querySelector<HTMLElement>('section[aria-label="Detail"]');
  return pane ?? document.scrollingElement!;
}

/** Whether an element's bottom shows above the composer, which stays at the bottom. */
function inView(element: Element) {
  const composer = screen.getByRole("textbox", { name: "Message Claude Code" });
  return element.getBoundingClientRect().bottom <= composer.getBoundingClientRect().top + 1;
}

/** Lines of the agent's text, numbered. */
function lines(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    type: "text" as const,
    text: `${prefix} ${index + 1}.`,
  }));
}

/** Opens the feature's session from its page, and starts a turn that writes 40 lines. */
async function openWorkingSession() {
  await show(`/f/${CLI}`, "Open the session");
  await userEvent.click(screen.getByRole("link", { name: "Open the session" }));
  await expect.poll(() => window.location.pathname).toBe(`/f/${CLI}/session`);
  await startTurn("Plan the CLI.", lines(40, "Line"));
  const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await within(log).findByText("Line 40.", undefined, LIVE);
  await settle();
  return log;
}

test("a working session: beside the feature page or a page, following its end (US1)", async () => {
  const log = await openWorkingSession();
  const wide = window.innerWidth >= 768;
  // On a wide screen, the feature page stays beside the session, usable; on a narrow one, the
  // session is the page.
  expect(Boolean(screen.queryByRole("list", { name: "Files" }))).toBe(wide);
  await checkLayout();

  // At the end, a new line comes into view.
  const box = scroller();
  box.scrollTo(0, box.scrollHeight);
  await settle();
  await agent.agentEmit([{ type: "text", text: "The newest line." }]);
  const newest = await within(log).findByText("The newest line.", undefined, LIVE);
  await expect.poll(() => inView(newest), LIVE).toBe(true);

  // Scrolled up, the view stays where it is, even as the turn grows past a page of 100 items.
  const middle = Math.round((box.scrollHeight - box.clientHeight) / 2);
  box.scrollTo(0, middle);
  await settle();
  const position = box.scrollTop;
  expect(position).toBeGreaterThan(0);
  await agent.agentEmit(lines(70, "Later line"));
  await within(log).findByText("Later line 70.", undefined, LIVE);
  await settle();
  expect(log.isConnected).toBe(true);
  expect(box.scrollTop).toBe(position);

  if (wide) {
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("region", { name: "Detail" })).getByRole("button", {
          name: "Close",
        }),
      );
    });
    await waitFor(() => expect(window.location.pathname).toBe(`/f/${CLI}`));
    expect(screen.queryByRole("log", { name: "Conversation" })).toBeNull();
  }
});

test("a working session, with a sub-agent and a steered message, in dark (SC-004)", async () => {
  window.localStorage.setItem("uraeda.theme", "dark");
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await startTurn("Plan the CLI.", [
    { type: "text", text: "Reading **the answers**." },
    {
      type: "toolStart",
      id: "a",
      name: "Read",
      kind: "read",
      input: { file_path: "spec.md" },
      target: "specs/2026-10-12-cli-tuis/spec.md",
    },
    { type: "toolEnd", id: "a", isError: false, output: "# Spec" },
    {
      type: "toolStart",
      id: "task",
      name: "Task",
      kind: "other",
      input: {},
      subagent: { description: "Map the runner code" },
    },
    {
      type: "toolStart",
      id: "b",
      name: "Grep",
      kind: "search",
      input: {},
      target: '"sessions" packages/server/src/runner/',
      parent: "task",
    },
    { type: "textDelta", text: "The runner already keeps one cache per repository." },
  ]);
  const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await within(log).findByText(/keeps one cache/, undefined, LIVE);
  await userEvent.fill(
    screen.getByRole("textbox", { name: "Message Claude Code" }),
    "Use the existing helper for the cache's paths.",
  );
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  await within(log).findByText("Not read yet", undefined, LIVE);
  await settle();
  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  await checkLayout();
});
