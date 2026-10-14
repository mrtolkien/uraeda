// US3: a task view for every priority line; US4 scenario 9: Delete, with Undo, in the task view.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atRepo, click, fixtureRepo, read, renderPage, serverFetch, type } from "./helpers.tsx";

/** Types a line's new text in its field, and presses a key. */
async function edit(text: string, key: string) {
  const field = screen.getByRole("textbox", { name: "Line" });
  await type(field, text);
  await act(async () => {
    fireEvent.keyDown(field, { key });
  });
}

/**
 * The Undo of the toast a Delete shows once the line is gone from the file. The toast hides by
 * itself after 5 seconds: a test takes its Undo at once, not after a wait.
 */
async function deleted() {
  await screen.findByText('Deleted "Nix + Docker based execution environments"', {
    ignore: "script, style, [aria-live]",
  });
  return screen.getByRole("button", { name: "Undo" });
}

test("a line without a draft opens its task view (US3 1)", async () => {
  await renderPage("/");
  await click(await screen.findByRole("link", { name: /Claude Code runner/ }));
  expect(window.location.pathname).toBe(
    atRepo("/priorities/claude-code-runner-triggered-manually"),
  );
  expect(await screen.findByRole("radio", { name: "Next", checked: true })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Draft" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Move up" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Move down" })).toBeNull();
});

test("a line with a draft shows it drawn (US3 2)", async () => {
  await renderPage("/priorities/git-listener");
  expect(await screen.findByRole("heading", { name: "What" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Start the feature" })).toBeTruthy();
  // The only field is the slug, two words of the draft's name, for the human to change.
  expect(screen.getByRole("textbox", { name: "Slug" })).toHaveProperty("value", "git-listener");
});

test("editing the line in place moves the address (US3 3)", async () => {
  const { repo } = await renderPage("/priorities/claude-code-runner-triggered-manually");
  await click(await screen.findByRole("button", { name: /^Claude Code runner/ }));
  await edit("Claude Code runner", "Enter");
  await waitFor(() => expect(read(repo)).toContain("- Claude Code runner\n"));
  await waitFor(() =>
    expect(window.location.pathname).toBe(atRepo("/priorities/claude-code-runner")),
  );
  expect(await screen.findByRole("button", { name: /^Claude Code runner$/ })).toBeTruthy();
});

test("Escape keeps the text, and an empty line is refused", async () => {
  const { repo } = await renderPage("/priorities/claude-code-runner-triggered-manually");
  const before = read(repo);
  await click(await screen.findByRole("button", { name: /^Claude Code runner/ }));
  await edit("Something else", "Escape");
  expect(screen.queryByRole("textbox", { name: "Line" })).toBeNull();
  expect(screen.getByRole("button", { name: /^Claude Code runner/ })).toBeTruthy();
  expect(read(repo)).toBe(before);

  await click(screen.getByRole("button", { name: /^Claude Code runner/ }));
  await edit("  ", "Enter");
  expect(screen.getAllByText("A priority cannot be empty.").length).toBeGreaterThan(0);
  expect(screen.getByRole("textbox", { name: "Line" })).toBeTruthy();
  expect(read(repo)).toBe(before);
});

test("the section moves the line (US3 4)", async () => {
  const { repo } = await renderPage("/priorities/claude-code-runner-triggered-manually");
  await click(await screen.findByRole("radio", { name: "Later" }));
  await waitFor(() =>
    expect(read(repo)).toContain(
      "  - with a cache\n- Claude Code runner (triggered manually)\n\n## Blocked",
    ),
  );
  expect(await screen.findByRole("radio", { name: "Later", checked: true })).toBeTruthy();
});

test("Next › walks the section, disabled on the last (US3 6)", async () => {
  await renderPage("/priorities/claude-code-runner-triggered-manually");
  expect((await screen.findByRole("button", { name: "‹ Previous" })).hasAttribute("disabled")).toBe(
    true,
  );
  await click(screen.getByRole("button", { name: "Next ›" }));
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/priorities/git-listener")));
  expect(await screen.findByRole("heading", { name: "What" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Next ›" }).hasAttribute("disabled")).toBe(true);
});

test("a reload shows the same line (US3 7)", async () => {
  const repo = fixtureRepo();
  await renderPage("/priorities/claude-code-runner-triggered-manually", repo);
  expect(await screen.findByRole("button", { name: /^Claude Code runner/ })).toBeTruthy();
  await renderPage(window.location.pathname, repo, { reload: true });
  expect(window.location.pathname).toBe(
    atRepo("/priorities/claude-code-runner-triggered-manually"),
  );
  expect(
    await screen.findByRole("button", { name: "Claude Code runner (triggered manually)" }),
  ).toBeTruthy();
});

test("a removed line says so", async () => {
  await renderPage("/priorities/nope");
  expect(await screen.findByText("This line is no longer in PRIORITIES.md.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open the priorities" })).toBeTruthy();
});

test("a refused Undo says so", async () => {
  const repo = fixtureRepo();
  const server = serverFetch(repo);
  // The file changes after the Undo read it, before its insert arrives: the core refuses it.
  const racing: typeof fetch = async (input, init) => {
    if (typeof init?.body === "string" && init.body.includes("priorities.insert")) {
      writeFileSync(join(repo, "specs/PRIORITIES.md"), `${read(repo)}\n- Added elsewhere\n`);
    }
    return server(input, init);
  };
  await renderPage("/priorities/nix-docker-based-execution-environments", repo, { fetch: racing });
  await click(await screen.findByRole("button", { name: "Delete" }));
  await click(await deleted());
  const message =
    'Could not restore "Nix + Docker based execution environments": PRIORITIES.md changed on disk.';
  // In the page, not a toast: the UI behaviour decision keeps errors out of toasts alone.
  const main = within(screen.getByRole("main"));
  await main.findByText(message);
  const banner = main.getAllByRole("alert").find((alert) => alert.textContent?.includes(message))!;
  expect(banner).toBeTruthy();
  expect(read(repo)).not.toContain("Nix + Docker");

  await click(within(banner).getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByText(message)).toBeNull();
});

test("Undo puts the line back at its place in the file as it is now (edge case)", async () => {
  const { repo } = await renderPage("/priorities/nix-docker-based-execution-environments");
  await click(await screen.findByRole("button", { name: "Delete" }));
  const undo = await deleted();
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace("## Later\n\n", "## Later\n\n- Added elsewhere\n"),
  );
  await click(undo);
  await waitFor(() =>
    expect(read(repo)).toContain(
      "- Nix + Docker based execution environments\n  - with a cache\n- Added elsewhere\n",
    ),
  );
});

test("Delete, then Undo, puts the line and its nested line back (US4 9)", async () => {
  const { repo } = await renderPage("/priorities/nix-docker-based-execution-environments");
  const before = read(repo);
  await click(await screen.findByRole("button", { name: "Delete" }));
  const undo = await deleted();
  expect(read(repo)).not.toContain("with a cache");
  expect(window.location.pathname).toBe(atRepo("/priorities"));
  await click(undo);
  await waitFor(() => expect(read(repo)).toBe(before));
});

test("Delete, then Undo, puts the line back exactly as written, marker and wrapping kept", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace(
      "- Nix + Docker based execution environments\n",
      "* Nix + Docker based\n  execution environments\n",
    ),
  );
  const before = read(repo);
  await renderPage("/priorities/nix-docker-based-execution-environments", repo);
  await click(await screen.findByRole("button", { name: "Delete" }));
  const undo = await deleted();
  expect(read(repo)).not.toContain("with a cache");
  await click(undo);
  await waitFor(() => expect(read(repo)).toBe(before));
});
