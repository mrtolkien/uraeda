// US3 scenario 5: on a wide screen, the task view opens in a pane beside home, which stays usable;
// Back closes it.
import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { show } from "./helpers.tsx";

test("on a wide screen, the task view opens beside home (US3 5)", async () => {
  if (window.innerWidth < 768) {
    return;
  }
  await show("/", "Claude Code runner");
  // A real click: WebKit skips, on Back, an entry that added another without a user's gesture.
  await userEvent.click(screen.getByRole("link", { name: /Claude Code runner/ }));
  await expect
    .poll(() => window.location.pathname)
    .toBe("/priorities/claude-code-runner-triggered-manually");
  expect(await screen.findByRole("radio", { name: "Next", checked: true })).toBeTruthy();
  // Home stays beside it.
  expect(screen.getByRole("link", { name: /Git listener process/ })).toBeTruthy();
  await act(async () => window.history.back());
  await waitFor(() => expect(screen.queryByRole("radio", { name: "Next" })).toBeNull());
  expect(window.location.pathname).toBe("/");
});

test("on a wide screen, a second line tapped in home's list keeps home beside it", async () => {
  if (window.innerWidth < 768) {
    return;
  }
  await show("/", "Claude Code runner");
  await userEvent.click(screen.getByRole("link", { name: /Claude Code runner/ }));
  expect(await screen.findByRole("radio", { name: "Next", checked: true })).toBeTruthy();

  await userEvent.click(screen.getByRole("link", { name: /Git listener process/ }));

  await expect.poll(() => window.location.pathname).toBe("/priorities/git-listener");
  expect(await screen.findByRole("heading", { name: "What" })).toBeTruthy();
  // Home's list is still there, its own link to the priorities included, and Home is selected.
  expect(screen.getByRole("link", { name: "All priorities" })).toBeTruthy();
  const nav = screen.getByRole("navigation", { name: "Side navigation" });
  expect(within(nav).getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
});
