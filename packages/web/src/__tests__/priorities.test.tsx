import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { click, git, read, renderPage, type } from "./helpers.tsx";

const PATH = "specs/PRIORITIES.md";

/** The actions of a line, from its menu. */
async function menu(text: string) {
  const row = (await screen.findByText(text)).closest(".row") as HTMLElement;
  await click(within(row).getByRole("button", { name: `Actions for ${text}` }));
}

/** US7.1 */
test("＋ jots a line down at the end of Next", async () => {
  const { repo } = await renderPage("/");

  await click(await screen.findByRole("button", { name: "Add a priority" }));
  await type(
    await screen.findByLabelText("Priority"),
    "Show the agent's last commit on the feature page",
  );
  await click(screen.getByRole("button", { name: "Add" }));

  await waitFor(() =>
    expect(read(repo)).toContain(
      "- [Git listener process](drafts/git-listener.md)\n- Show the agent's last commit on the feature page\n",
    ),
  );
  expect(await screen.findByText("Added to Next, not committed")).toBeTruthy();
  expect(git(repo, "status", "--porcelain")).toContain("PRIORITIES.md");
});

/** US7.2 */
test("a line can go to Later instead", async () => {
  const { repo } = await renderPage("/");

  await click(await screen.findByRole("button", { name: "Add a priority" }));
  await type(await screen.findByLabelText("Priority"), "An idea");
  await click(screen.getByRole("radio", { name: "Later" }));
  await click(screen.getByRole("button", { name: "Add" }));

  await waitFor(() => expect(read(repo)).toContain("  - with a cache\n- An idea\n"));
});

/** US7.3 */
test("a line moves up, and the bar counts one change", async () => {
  const { repo } = await renderPage("/priorities");

  await menu("Git listener process");
  await click(await screen.findByRole("button", { name: "Move up" }));

  await waitFor(() =>
    expect(read(repo)).toContain(
      "## Next\n\n- [Git listener process](drafts/git-listener.md)\n- Claude Code runner (triggered manually)\n",
    ),
  );
  expect(await screen.findByText("1 change to commit")).toBeTruthy();
});

/** US7.4 */
test("a line moves to another section with its nested lines", async () => {
  const { repo } = await renderPage("/priorities");

  await menu("Nix + Docker based execution environments");
  await click(await screen.findByRole("button", { name: "Move to Next" }));

  await waitFor(() =>
    expect(read(repo)).toContain(
      "- [Git listener process](drafts/git-listener.md)\n- Nix + Docker based execution environments\n  - with a cache\n\n## Later\n",
    ),
  );
});

/** US7.5 */
test("a line is edited as its markdown, link included", async () => {
  const { repo } = await renderPage("/priorities");

  await menu("Git listener process");
  await click(await screen.findByRole("button", { name: "Edit" }));
  const field = screen.getByRole("textbox", { name: "Line" }) as HTMLTextAreaElement;
  expect(field.value).toBe("[Git listener process](drafts/git-listener.md)");
  await act(async () => {
    fireEvent.change(field, { target: { value: "[Git listener](drafts/git-listener.md), soon" } });
  });
  await click(screen.getByRole("button", { name: "Save line" }));

  await waitFor(() =>
    expect(read(repo)).toContain("- [Git listener](drafts/git-listener.md), soon\n"),
  );
});

/** US7.6 */
test("Commit makes one commit of the priorities alone", async () => {
  const { repo } = await renderPage("/priorities");
  writeFileSync(join(repo, "README.md"), "# Changed\n");
  await menu("Git listener process");
  await click(await screen.findByRole("button", { name: "Move up" }));
  await screen.findByText("1 change to commit");

  await click(screen.getByRole("button", { name: "Commit" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe(
      'chore: move "Git listener process" within Next',
    ),
  );
  expect(git(repo, "show", "--name-only", "--format=", "HEAD").trim()).toBe(PATH);
  await waitFor(() => expect(screen.queryByText("1 change to commit")).toBeNull());
});

/** US7.7 */
test("Discard brings the committed priorities back", async () => {
  const { repo } = await renderPage("/priorities");
  const before = read(repo);
  await menu("Git listener process");
  await click(await screen.findByRole("button", { name: "Delete" }));
  await screen.findByText("1 change to commit");

  await click(screen.getByRole("button", { name: "Discard" }));
  await click(screen.getByRole("button", { name: "Discard them" }));

  await waitFor(() => expect(read(repo)).toBe(before));
});

/** US7.8 */
test("from a feature branch's checkout, lines go to the default branch's worktree", async () => {
  const { repo } = await renderPage("/priorities");
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");

  await menu("Git listener process");
  await click(await screen.findByRole("button", { name: "Move up" }));

  await waitFor(() =>
    expect(readFileSync(join(repo, ".worktrees/main", PATH), "utf8")).toContain(
      "## Next\n\n- [Git listener process](drafts/git-listener.md)\n",
    ),
  );
  expect(git(repo, "branch", "--show-current").trim()).toBe("2026-10-11-web-ui");
});

test("an edit over a change made elsewhere is refused, and the list reads again", async () => {
  const { repo } = await renderPage("/priorities");
  await screen.findByText("Git listener process");
  writeFileSync(join(repo, PATH), read(repo).replace("Claude Code runner", "Claude runner"));

  await menu("Git listener process");
  await click(await screen.findByRole("button", { name: "Move up" }));

  expect(
    await screen.findByText("PRIORITIES.md changed on disk. Your change was not applied."),
  ).toBeTruthy();
  expect(await screen.findByText("Claude runner (triggered manually)")).toBeTruthy();
});

/** Review C3: nested lines show as text, from the core. */
test("nested lines show their text", async () => {
  await renderPage("/priorities");

  expect(await screen.findByText("with a cache")).toBeTruthy();
});
