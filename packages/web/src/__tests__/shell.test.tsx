// US6: "Uraeda" goes home, and ＋ shows on home and the priorities page only, its result confirmed
// by a toast with Undo.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { click, read, renderPage, type } from "./helpers.tsx";

test("Uraeda goes home (US6 4)", async () => {
  await renderPage("/priorities");
  await click((await screen.findAllByRole("link", { name: /Uraeda/ }))[0]!);
  expect(window.location.pathname).toBe("/");
});

/**
 * Adds a line to Later through ＋, and returns its toast's Undo. The toast shows once the line is
 * written, and hides by itself after 5 seconds: a test takes its Undo at once, not after a wait.
 */
async function addToLater(text: string) {
  await click(await screen.findByRole("button", { name: "Add a priority" }));
  await type(await screen.findByLabelText("Priority"), text);
  await click(screen.getByRole("radio", { name: "Later" }));
  await click(screen.getByRole("button", { name: "Add" }));
  return screen.findByRole("button", { name: "Undo" });
}

test("＋ adds to Later with a toast and Undo, and the bar does not change (US6 5)", async () => {
  const { repo } = await renderPage("/");
  // The bar: the link home, and the page's controls beside it.
  const bar = (await screen.findAllByRole("link", { name: /Uraeda/ }))[0]!.parentElement!;
  const before = bar.textContent;

  const undo = await addToLater("Show the agent's last commit");

  // The toast, not its announcement to screen readers, which repeats its text a moment later.
  expect(
    screen.getByText("Added to Later, not committed", { ignore: "script, style, [aria-live]" }),
  ).toBeTruthy();
  expect(read(repo)).toContain("  - with a cache\n- Show the agent's last commit\n");
  // The toast alone says where the line went: no count of changes or Commit shows in the bar.
  expect(bar.textContent).toBe(before);
  await click(undo);
  await waitFor(() => expect(read(repo)).not.toContain("Show the agent's last commit"));
});

test("＋'s Undo removes the line it added, wherever it is now (US6 5)", async () => {
  const { repo } = await renderPage("/");
  const undo = await addToLater("Show the agent's last commit");
  // Another line lands above it: the added line's place now holds another line.
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace("## Later\n\n", "## Later\n\n- Added elsewhere\n"),
  );
  await click(undo);
  await waitFor(() => expect(read(repo)).not.toContain("Show the agent's last commit"));
  expect(read(repo)).toContain(
    "- Added elsewhere\n- Nix + Docker based execution environments\n  - with a cache\n",
  );
});

test("＋'s Undo refuses once the line it added is gone", async () => {
  const { repo } = await renderPage("/");
  const undo = await addToLater("Show the agent's last commit");
  const edited = read(repo).replace("Show the agent's last commit", "Show the last commit");
  expect(edited).not.toBe(read(repo));
  writeFileSync(join(repo, "specs/PRIORITIES.md"), edited);
  await click(undo);
  expect(
    await screen.findByText(
      'Could not undo: "Show the agent\'s last commit" is no longer in PRIORITIES.md.',
    ),
  ).toBeTruthy();
  expect(read(repo)).toBe(edited);
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
