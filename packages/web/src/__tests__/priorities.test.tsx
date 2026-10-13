// US4: the priorities page, groomed in place; ＋ from the web UI's spec. Review C3: a line opens its
// task view, with no ⋯ menu and no editing in place on the list; moving a line between sections,
// editing its text, and deleting it are the task view's (task.test.tsx); dragging is tested in the
// browser (__browser__/priorities.test.tsx), with committing closing the toasts.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { click, git, read, renderPage, type } from "./helpers.tsx";

const PATH = "specs/PRIORITIES.md";

/** Opens a section's Add row, types a line, and presses Enter. */
async function add(section: string, text: string) {
  await click(await screen.findByRole("button", { name: `Add to ${section}` }));
  const field = screen.getByRole("textbox", { name: `Add to ${section}` });
  await type(field, text);
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });
}

/** A toast's text, not its announcement to screen readers, which repeats it a moment later. */
function toast(text: string) {
  return screen.findByText(text, { ignore: "script, style, [aria-live]" });
}

test("sections show their counts, and end with an Add row (US4 1)", async () => {
  await renderPage("/priorities");
  expect(await screen.findByRole("heading", { name: "Now · 4" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Next · 2" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add to Later" })).toBeTruthy();
});

test("tapping a line opens its task view, with no menu on the list (C3)", async () => {
  await renderPage("/priorities");
  const line = await screen.findByRole("link", { name: /Claude Code runner/ });
  expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull();
  await click(line);
  expect(window.location.pathname).toBe("/priorities/claude-code-runner-triggered-manually");
});

test("an Add row adds and stays ready (US4 4)", async () => {
  const { repo } = await renderPage("/priorities");
  await add("Later", "Ship a TUI");
  await waitFor(() => expect(read(repo)).toContain("  - with a cache\n- Ship a TUI\n"));
  // Emptied once the save's answer comes back, after the file is written.
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Add to Later" })).toHaveProperty("value", ""),
  );
});

/** US7.1 */
test("＋ jots a line down at the end of Next", async () => {
  const { repo } = await renderPage("/");

  await click(await screen.findByRole("button", { name: "Add a priority" }));
  await type(
    await screen.findByLabelText("Priority"),
    "Show the agent's last commit on the feature page",
  );
  await click(screen.getByRole("button", { name: "Add" }));

  // Shown once the line is written.
  expect(await toast("Added to Next, not committed")).toBeTruthy();
  expect(read(repo)).toContain(
    "- [Git listener process](drafts/git-listener.md)\n- Show the agent's last commit on the feature page\n",
  );
  expect(git(repo, "status", "--porcelain")).toContain("PRIORITIES.md");
});

/** US7.2 */
test("a line can go to Later instead", async () => {
  const { repo } = await renderPage("/");

  await click(await screen.findByRole("button", { name: "Add a priority" }));
  await type(await screen.findByLabelText("Priority"), "An idea");
  await click(screen.getByRole("radio", { name: "Later" }));
  await click(screen.getByRole("button", { name: "Add" }));

  expect(await toast("Added to Later, not committed")).toBeTruthy();
  expect(read(repo)).toContain("  - with a cache\n- An idea\n");
});

/** US7.6 */
test("Commit makes one commit of the priorities alone", async () => {
  const { repo } = await renderPage("/priorities");
  writeFileSync(join(repo, "README.md"), "# Changed\n");
  await add("Later", "Ship a TUI");
  await screen.findByText("1 change to commit");

  await click(screen.getByRole("button", { name: "Commit" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe('chore: add "Ship a TUI" to Later'),
  );
  expect(git(repo, "show", "--name-only", "--format=", "HEAD").trim()).toBe(PATH);
  await waitFor(() => expect(screen.queryByText("1 change to commit")).toBeNull());
});

/** US7.7 */
test("Discard brings the committed priorities back", async () => {
  const { repo } = await renderPage("/priorities");
  const before = read(repo);
  await add("Later", "Ship a TUI");
  await screen.findByText("1 change to commit");

  await click(screen.getByRole("button", { name: "Discard" }));
  await click(screen.getByRole("button", { name: "Discard them" }));

  await waitFor(() => expect(screen.queryByText("1 change to commit")).toBeNull());
  expect(read(repo)).toBe(before);
  expect(screen.queryByText("Ship a TUI")).toBeNull();
});

/** US7.8 */
test("from a feature branch's checkout, lines go to the default branch's worktree", async () => {
  const { repo } = await renderPage("/priorities");
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");

  await add("Later", "Ship a TUI");

  await waitFor(() =>
    expect(readFileSync(join(repo, ".worktrees/main", PATH), "utf8")).toContain(
      "  - with a cache\n- Ship a TUI\n",
    ),
  );
  expect(git(repo, "branch", "--show-current").trim()).toBe("2026-10-11-web-ui");
});

/** Edge case and error handling: a change made elsewhere is refused, and the typed text kept. */
test("an add over a change made elsewhere is refused, and the list reads again", async () => {
  const { repo } = await renderPage("/priorities");
  await screen.findByText("Git listener process");
  writeFileSync(join(repo, PATH), read(repo).replace("Claude Code runner", "Claude runner"));

  await add("Later", "Ship a TUI");

  expect(
    await screen.findByText("PRIORITIES.md changed on disk. Your change was not applied."),
  ).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Add to Later" })).toHaveProperty(
    "value",
    "Ship a TUI",
  );
  expect(await screen.findByText(/Claude runner \(triggered manually\)/)).toBeTruthy();
  expect(read(repo)).not.toContain("Ship a TUI");
});

/** Review C3: nested lines show as text, from the core. */
test("nested lines show their text", async () => {
  await renderPage("/priorities");

  expect(await screen.findByText("with a cache")).toBeTruthy();
});
