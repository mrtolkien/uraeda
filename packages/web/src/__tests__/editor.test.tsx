import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, expect, test } from "vite-plus/test";
import { fixtureRepo, git, renderPage } from "./helpers.tsx";

beforeAll(() => {
  process.env.URA_TODAY = "2026-10-12";
});

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function type(element: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(element, { target: { value } });
  });
}

/** US4.1 */
test("Draft turns a line into a draft, linked, and opens its editor", async () => {
  const { repo } = await renderPage("/");
  const main = within(await screen.findByRole("main"));
  const row = (await main.findByText("Claude Code runner (triggered manually)")).closest(".row");

  await click(within(row as HTMLElement).getByRole("button", { name: "Draft" }));

  const path = "specs/drafts/claude-code-runner-triggered-manually.md";
  await waitFor(() => expect(window.location.pathname).toBe(`/edit/${path}`));
  expect(readFileSync(join(repo, path), "utf8")).toMatch(
    /^# Claude Code runner \(triggered manually\)\n/,
  );
  expect(readFileSync(join(repo, "specs/PRIORITIES.md"), "utf8")).toContain(
    "- [Claude Code runner (triggered manually)](drafts/claude-code-runner-triggered-manually.md)",
  );
  expect(git(repo, "status", "--porcelain")).toContain("PRIORITIES.md");
  expect(await screen.findByRole("textbox", { name: "Text" })).toBeTruthy();
});

/** US4.2 */
test("a draft is saved as typed, byte for byte", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await screen.findByRole("textbox", { name: "Text" });

  const typed = "# Git listener process\n\n## What\n\nRun  the next step,\twith tabs.\n";
  await type(field, typed);

  await waitFor(() =>
    expect(readFileSync(join(repo, "specs/drafts/git-listener.md"), "utf8")).toBe(typed),
  );
});

/** US4.3 */
test("a draft is committed with the priorities it changed", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    readFileSync(join(repo, "specs/PRIORITIES.md"), "utf8").replace(
      "- Claude Code",
      "- Claude Code!",
    ),
  );
  writeFileSync(
    join(repo, "specs/drafts/git-listener.md"),
    "# Git listener process\n\n## What\n\nMore.\n",
  );
  await renderPage("/edit/specs/drafts/git-listener.md", repo);

  expect(await screen.findByText("Your 1 priority change is committed with it.")).toBeTruthy();
  await click(screen.getByRole("button", { name: "Commit" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe("chore: draft Git listener process"),
  );
  expect(git(repo, "show", "--name-only", "--format=", "HEAD").trim().split("\n").sort()).toEqual([
    "specs/PRIORITIES.md",
    "specs/drafts/git-listener.md",
  ]);
});

/** US4.4 */
test("Start turns a draft into a feature in its own worktree", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  await type(await screen.findByLabelText("Slug"), "git-listener");

  await click(screen.getByRole("button", { name: "Start the feature" }));

  await waitFor(() => expect(window.location.pathname).toBe("/f/2026-10-12-git-listener"));
  expect(
    existsSync(
      join(repo, ".worktrees/2026-10-12-git-listener/specs/2026-10-12-git-listener/proposal.md"),
    ),
  ).toBe(true);
  expect(git(repo, "branch", "--show-current").trim()).toBe("main");
  expect(git(repo, "show", "main:specs/PRIORITIES.md")).toContain(
    "- [Git listener process](/specs/2026-10-12-git-listener/proposal.md)",
  );
});

/** US4.5 */
test("a feature's proposal not committed is edited and committed", async () => {
  const repo = fixtureRepo();
  git(repo, "branch", "2026-10-14-runner", "main");
  git(repo, "worktree", "add", "--quiet", ".worktrees/2026-10-14-runner", "2026-10-14-runner");
  const proposal = join(repo, ".worktrees/2026-10-14-runner/specs/2026-10-14-runner/proposal.md");
  (await import("node:fs")).mkdirSync(join(proposal, ".."), { recursive: true });
  writeFileSync(proposal, "# Runner\n\n## What\n\nRun.\n\n## Why\n\nSpeed.\n");
  await renderPage("/f/2026-10-14-runner", repo);

  await click(await screen.findByRole("button", { name: "Write" }));
  await type(
    await screen.findByRole("textbox", { name: "Text" }),
    "# Runner\n\n## What\n\nRun agents.\n\n## Why\n\nSpeed.\n",
  );
  await click(screen.getByRole("button", { name: "Commit" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s", "2026-10-14-runner").trim()).toBe(
      "chore(runner): proposal",
    ),
  );
  expect(readFileSync(proposal, "utf8")).toContain("Run agents.");
});

/** US4.6 */
test("starting a draft with the template's placeholders is refused", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/drafts/git-listener.md"),
    "# Git listener process\n\n## What\n\n[What the feature does, from the user's point of view.]\n\n## Why\n\n[The problem it solves, and for whom.]\n",
  );
  await renderPage("/edit/specs/drafts/git-listener.md", repo);

  await click(await screen.findByRole("button", { name: "Start the feature" }));

  expect(
    await screen.findByText(
      "specs/drafts/git-listener.md still holds the template's placeholders: write it first",
    ),
  ).toBeTruthy();
  expect(git(repo, "branch", "--list", "2026-10-12-git-listener").trim()).toBe("");
});

test("a save over a change made elsewhere keeps the text, and offers the new version", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await screen.findByRole("textbox", { name: "Text" });
  writeFileSync(join(repo, "specs/drafts/git-listener.md"), "# Changed elsewhere\n");

  await type(field, "# Mine\n");

  expect(
    await screen.findByText(
      "git-listener.md changed on disk since you opened it. Your text was not saved.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy my text" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Load the new version" })).toBeTruthy();
  expect(readFileSync(join(repo, "specs/drafts/git-listener.md"), "utf8")).toBe(
    "# Changed elsewhere\n",
  );
});

/** Review C1: the new version replaces the text, and a later save does not undo it. */
test("Load the new version loads it", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await screen.findByRole("textbox", { name: "Text" });
  writeFileSync(join(repo, "specs/drafts/git-listener.md"), "# Changed elsewhere\n");
  await type(field, "# Mine\n");
  await screen.findByRole("button", { name: "Load the new version" });

  await click(screen.getByRole("button", { name: "Load the new version" }));

  await waitFor(() =>
    expect((screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement).value).toBe(
      "# Changed elsewhere\n",
    ),
  );
  await type(screen.getByRole("textbox", { name: "Text" }), "# Changed elsewhere\n\nMore.\n");
  await waitFor(() =>
    expect(readFileSync(join(repo, "specs/drafts/git-listener.md"), "utf8")).toBe(
      "# Changed elsewhere\n\nMore.\n",
    ),
  );
});
