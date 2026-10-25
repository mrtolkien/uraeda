// US3 scenario 5, with the overlay: on a wide screen, the task view opens in the overlay over home,
// which stays drawn under it; Back closes it.
import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atRepo, atSize, commands as browserCommands, nowHoldsNext, show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

atSize("desktop");

/**
 * Home, with the fixture's lines not started, Next's, moved to Now: home's Priorities now lists
 * them, each opening its task view.
 */
async function showNext() {
  await commands.writeRepo(nowHoldsNext(await commands.readRepo()));
  await show("/", "Claude Code runner");
}

/** The line's overlay, once it shows. */
async function detail() {
  return within(await screen.findByRole("dialog", { name: "Priority" }));
}

test("on a wide screen, the task view opens over home (US3 5)", async () => {
  await showNext();
  // A real click: WebKit skips, on Back, an entry that added another without a user's gesture.
  await userEvent.click(screen.getByRole("link", { name: /Claude Code runner/ }));
  await expect
    .poll(() => window.location.pathname)
    .toBe(atRepo("/priorities/claude-code-runner-triggered-manually"));
  expect(await (await detail()).findByRole("radio", { checked: true, name: "Now" })).toBeTruthy();
  // Home stays under it.
  expect(screen.getByRole("link", { hidden: true, name: /Git listener process/ })).toBeTruthy();
  await act(async () => window.history.back());
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(window.location.pathname).toBe(atRepo("/"));
});

test("on a wide screen, the next line of the overlay keeps home under it", async () => {
  await showNext();
  await userEvent.click(screen.getByRole("link", { name: /Claude Code runner/ }));
  expect(await (await detail()).findByRole("radio", { checked: true, name: "Now" })).toBeTruthy();

  await userEvent.click((await detail()).getByRole("button", { name: "Next ›" }));

  await expect.poll(() => window.location.pathname).toBe(atRepo("/priorities/git-listener"));
  expect(await (await detail()).findByRole("heading", { name: "What" })).toBeTruthy();
  // Home's list is still there, its own link to the priorities included, and Home is selected.
  expect(screen.getByRole("link", { hidden: true, name: "Open priorities" })).toBeTruthy();
  const nav = screen.getByRole("navigation", { hidden: true, name: "Navigation" });
  expect(
    within(nav).getByRole("link", { hidden: true, name: "Home" }).getAttribute("aria-current"),
  ).toBe("page");
});
