// The Git page beside its detail, as lazygit lays it out: a narrow column of one-line rows, a
// commit's row naming its hash alone, its age in the commit's detail, and the title's buttons under
// the branch's line. The phone's head line keeps a commit's age.
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atWidth, fixtureRepo, git, renderPage } from "./helpers.tsx";

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
  await within(detail).findByText(subject);
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

// Break: put the title's buttons beside it again, where the narrow column breaks its word.
test("the title's buttons sit under the branch's line", async () => {
  atWidth(1440);
  await renderPage("/git", fixtureRepo());
  const merge = await screen.findByRole("button", { name: /^Merge into / });
  const line = screen.getByText(/^main · /);

  expect(line.compareDocumentPosition(merge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
