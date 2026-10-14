// The review's C1: a feature's mockups show inside the UI, and take comments while the spec waits
// for review, on the spec's line that links them, or as a general comment.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { addMockup, atRepo, click, fixtureRepo, git, renderPage, today, type } from "./helpers.tsx";

const FOLDER = "2026-10-06-recurring-tasks";
const SPEC = `specs/${FOLDER}/spec.md`;
const WORKTREE = join(".worktrees", FOLDER);

today("2026-10-11");

/** The spec's review, as written in the feature's worktree. */
function review(repo: string) {
  const path = join(repo, WORKTREE, `specs/${FOLDER}/spec-review.md`);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

/** The recurring tasks' spec, whose Mockups section links `mockups/repeat.html`, with the file. */
function specWithMockup() {
  const repo = fixtureRepo();
  addMockup(repo, FOLDER, "repeat.html");
  return repo;
}

async function comment(text: string) {
  await click(await screen.findByRole("button", { name: "Comment" }));
  await type(await screen.findByRole("textbox", { name: "Comment text" }), text);
  await click(screen.getByRole("button", { name: "Add comment" }));
}

test("a mockup shows in the UI, and a comment lands on the line that links it (C1)", async () => {
  const repo = specWithMockup();
  await renderPage(`/f/${FOLDER}/mockups/repeat.html`, repo);
  expect((await screen.findByTitle("repeat.html")).getAttribute("src")).toBe(
    atRepo(`/mockups/specs/${FOLDER}/mockups/repeat.html`),
  );
  expect(screen.getByRole("link", { name: "Open in a new tab" }).getAttribute("target")).toBe(
    "_blank",
  );

  await comment("The menu needs a Never option");

  await waitFor(() =>
    expect(review(repo)).toMatch(
      /## C1: Lines? [\d–]+, under "Mockups"\n\n> - \[Repeat\]\(mockups\/repeat\.html\)/,
    ),
  );
  expect(review(repo)).toContain("\nThe menu needs a Never option\n");
});

/** Review focus 5 */
test("a mockup no line links gets a general comment (review focus 5)", async () => {
  const repo = specWithMockup();
  addMockup(repo, FOLDER, "extra.html");
  await renderPage(`/f/${FOLDER}/mockups/extra.html`, repo);

  await comment("Too dense");

  await waitFor(() =>
    expect(review(repo)).toContain("## C1: General\n\nMockup extra.html: Too dense"),
  );
});

test("no Comment once the spec is approved", async () => {
  const repo = specWithMockup();
  git(repo, "worktree", "add", "--quiet", WORKTREE, FOLDER);
  const path = join(repo, WORKTREE, SPEC);
  writeFileSync(
    path,
    readFileSync(path, "utf8").replace("status: awaiting-human", "status: approved"),
  );
  git(join(repo, WORKTREE), "commit", "--quiet", "--no-verify", "--all", "--message", "approve");

  await renderPage(`/f/${FOLDER}/mockups/repeat.html`, repo);

  expect(await screen.findByTitle("repeat.html")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Comment" })).toBeNull();
});

/** The comment field of the mockup's overlay. */
const commentField = () =>
  screen.getByRole("textbox", { name: "Comment text" }) as HTMLTextAreaElement;

/** Answers "Discard your comment?" with one of its buttons. */
async function answer(button: "Discard" | "Keep editing") {
  const dialog = await screen.findByRole("dialog", { name: "Discard your comment?" });
  await click(within(dialog).getByRole("button", { name: button }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Discard your comment?" })).toBeNull(),
  );
}

/** US5 7 on the mockup page: Cancel asks first; "Keep editing" keeps the text, "Discard" drops it. */
test("Cancel on a mockup's comment typed asks first", async () => {
  await renderPage(`/f/${FOLDER}/mockups/repeat.html`, specWithMockup());
  await click(await screen.findByRole("button", { name: "Comment" }));
  await type(await screen.findByRole("textbox", { name: "Comment text" }), "Too dense");

  await click(screen.getByRole("button", { name: "Cancel" }));
  await answer("Keep editing");
  expect(commentField().value).toBe("Too dense");

  await click(screen.getByRole("button", { name: "Cancel" }));
  await answer("Discard");
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Comment text" })).toBeNull());
  await click(screen.getByRole("button", { name: "Comment" }));
  await screen.findByRole("textbox", { name: "Comment text" });
  expect(commentField().value).toBe("");
});

/** SC-004 on the mockup page: the comment typed comes back after a reload. */
test("a mockup's comment typed is restored after a reload", async () => {
  const repo = specWithMockup();
  const page = `/f/${FOLDER}/mockups/repeat.html`;
  await renderPage(page, repo);
  await click(await screen.findByRole("button", { name: "Comment" }));
  await type(await screen.findByRole("textbox", { name: "Comment text" }), "Too dense");

  forgetUnsaved();
  await renderPage(page, repo, { reload: true });

  await click(await screen.findByRole("button", { name: "Comment" }));
  expect(
    ((await screen.findByRole("textbox", { name: "Comment text" })) as HTMLTextAreaElement).value,
  ).toBe("Too dense");
  expect(screen.getByText("Unsaved text restored from", { exact: false })).toBeTruthy();
});
