// US6: "Uraeda" goes home, and ＋ shows on home and the priorities page only, its result confirmed
// by a toast with Undo.
import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { click, read, renderPage, type } from "./helpers.tsx";

test("Uraeda goes home (US6 4)", async () => {
  await renderPage("/priorities");
  await click((await screen.findAllByRole("link", { name: /Uraeda/ }))[0]!);
  expect(window.location.pathname).toBe("/");
});

test("＋ adds to Later with a toast and Undo, and the bar does not change (US6 5)", async () => {
  const { repo } = await renderPage("/");
  await click(await screen.findByRole("button", { name: "Add a priority" }));
  await type(await screen.findByLabelText("Priority"), "Show the agent's last commit");
  await click(screen.getByRole("radio", { name: "Later" }));
  await click(screen.getByRole("button", { name: "Add" }));
  await waitFor(() =>
    expect(read(repo)).toContain("  - with a cache\n- Show the agent's last commit\n"),
  );
  expect(await screen.findByText("Added to Later, not committed")).toBeTruthy();
  // The bar holds what it held before: the toast alone says where the line went.
  expect(screen.getAllByText("Added to Later, not committed")).toHaveLength(1);
  await click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(read(repo)).not.toContain("Show the agent's last commit"));
});

test("no ＋ on a round or a review (US6 6)", async () => {
  await renderPage("/f/2026-10-11-web-ui/clarifications-01.md");
  await screen.findByText("How does your iPhone reach the server?");
  expect(screen.queryByRole("button", { name: "Add a priority" })).toBeNull();
});

test("no ＋ on a review (US6 6)", async () => {
  await renderPage("/f/2026-10-06-recurring-tasks/spec.md");
  await screen.findAllByText(/Complete a repeating task/);
  expect(screen.queryByRole("button", { name: "Add a priority" })).toBeNull();
});
