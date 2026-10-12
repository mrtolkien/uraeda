// US3 scenario 5: on a wide screen, the task view opens in a pane beside home, which stays usable;
// Back closes it.
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { show } from "./helpers.tsx";

test("on a wide screen, the task view opens beside home (US3 5)", async () => {
  if (window.innerWidth < 768) {
    return;
  }
  await show("/", "Claude Code runner");
  await act(async () => {
    fireEvent.click(screen.getByRole("link", { name: /Claude Code runner/ }));
  });
  expect(window.location.pathname).toBe("/priorities/claude-code-runner-triggered-manually");
  expect(await screen.findByRole("radio", { name: "Next", checked: true })).toBeTruthy();
  // Home stays beside it.
  expect(screen.getByRole("link", { name: /Git listener process/ })).toBeTruthy();
  await act(async () => window.history.back());
  await waitFor(() => expect(screen.queryByRole("radio", { name: "Next" })).toBeNull());
  expect(window.location.pathname).toBe("/");
});
