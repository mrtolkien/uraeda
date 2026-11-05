// The Git page beside its detail, as lazygit lays it out: a narrow column of one-line rows, a
// commit's row naming its hash alone, its age in the commit's detail, Merge beside the title and
// the sync buttons under the branch's line, and a detail's title on one line, a path's name kept.
// The phone's head line keeps a commit's age.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { DetailTitle } from "../git/DetailTitle.tsx";
import { atWidth, fixtureRepo, git, renderPage } from "./helpers.tsx";

/** Whether `b` comes after `a` in the page's order. */
const after = (a: Node, b: Node) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/** The row of the newest commit, by its subject. */
async function newestRow(repo: string) {
  const subject = git(repo, "log", "-1", "--format=%s").trim();
  const link = await screen.findByRole("link", { name: subject });
  return { row: link.closest("[data-row]") as HTMLElement, subject };
}

// Break: show the age in a commit's row beside the detail, or drop the detail's hash and age.
test("beside the detail, a commit's row names its hash alone, and its detail its age", async () => {
  atWidth(1440);
  const repo = fixtureRepo();
  await renderPage("/git", repo);
  const { row, subject } = await newestRow(repo);
  const short = git(repo, "log", "-1", "--format=%h").trim();

  expect(row.textContent).toContain(short);
  expect(row.textContent).not.toMatch(/·/);
  const detail = screen.getByRole("region", { name: "Detail" });
  await waitFor(() =>
    expect(detail.querySelector("[data-detail-title]")?.textContent).toBe(subject),
  );
  await waitFor(() =>
    expect(detail.textContent).toMatch(new RegExp(`${short.slice(0, 7)} · .+ ago`)),
  );
});

// Break: drop the age on the phone, whose head line has the room.
test("on the phone, a commit's row keeps its age", async () => {
  atWidth(402);
  const repo = fixtureRepo();
  await renderPage("/git", repo);
  const { row } = await newestRow(repo);

  expect(row.textContent).toMatch(/· \d+ (min|h|d|w)/);
});

// Break: put the sync buttons beside the title again, where the narrow column breaks its word, or
// Merge under the line, where it takes a line of its own.
test("Merge sits beside the title, and the sync buttons under the branch's line", async () => {
  atWidth(1440);
  const repo = fixtureRepo();
  const bare = mkdtempSync(join(tmpdir(), "uraeda-origin-"));
  git(repo, "clone", "--quiet", "--bare", repo, bare);
  git(repo, "remote", "add", "origin", bare);
  await renderPage("/git", repo);
  const merge = await screen.findByRole("button", { name: /^Merge into / });
  const fetch = await screen.findByRole("button", { name: "Fetch" });
  const line = screen.getByText(/^main · /);

  expect(after(merge, line)).toBe(true);
  expect(after(line, fetch)).toBe(true);
  expect(after(screen.getByRole("heading", { level: 1, name: "Git" }), merge)).toBe(true);
});

// Break: cut a path at its end, losing its file's name, or split it elsewhere than its last slash.
test("a detail's path title keeps its file's name apart from its folders", () => {
  render(<DetailTitle isPath text="docs/deep/folder/name.md" />);
  const title = document.querySelector("[data-detail-title]") as HTMLElement;

  expect([...title.children].map((part) => part.textContent)).toEqual([
    "docs/deep/folder",
    "/name.md",
  ]);
});

// Break: split a subject as if it were a path.
test("a commit's subject is one part, cut at its end", () => {
  render(<DetailTitle text="fix(git): a/b paths" />);
  const title = document.querySelector("[data-detail-title]") as HTMLElement;

  expect([...title.children].map((part) => part.textContent)).toEqual(["fix(git): a/b paths"]);
});
