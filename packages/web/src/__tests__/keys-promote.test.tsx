// `p` on a note of the inbox opens its promote picker: the priorities' levels, every proposal, and
// the proposal files. A note with a note file never nests, its file found by its link: its picker
// offers no proposal to go under, only the levels, where it becomes a proposal, its file moved to
// the proposals, and the proposal files.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { atWidth, fixtureRepo, read, renderPage } from "./helpers.tsx";

const INBOX = `# Inbox

- Loose note
- [Dark mode](notes/dark-mode.md)
`;

beforeEach(() => {
  atWidth(1440);
  forgetUnsaved();
});

/** The page over a repository holding `INBOX`, with `p` pressed on the row of `note`. */
async function promoting(note: string) {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/INBOX.md"), INBOX);
  mkdirSync(join(repo, "specs/notes"), { recursive: true });
  writeFileSync(join(repo, "specs/notes/dark-mode.md"), "# Dark mode\n\n## What\n\nThe dark.\n");
  await renderPage("/inbox", repo);
  const link = (await screen.findAllByRole("button", { name: new RegExp(note) })).find(
    (one) => one.closest("[data-row-link]") !== null,
  ) as HTMLElement;
  act(() => link.focus());
  await act(async () => {
    fireEvent.keyDown(link, { key: "p" });
  });
  await screen.findByRole("combobox", { name: "Promote the note" });
  return repo;
}

/** The titles of the picker's items. */
const offered = () => screen.getAllByRole("option").map((option) => option.textContent ?? "");

test("p on a note offers the levels, a proposal to go under, and a proposal's file", async () => {
  await promoting("Loose note");

  const titles = offered();
  for (const title of ["Now", "Next", "Later", "Claude Code runner", "Git listener"]) {
    expect(
      titles.some((one) => one.includes(title)),
      title,
    ).toBe(true);
  }
});

test("p on a note with a note file offers no proposal to go under, and a level moves its file", async () => {
  const repo = await promoting("Dark mode");

  const titles = offered();
  for (const title of ["Now", "Next", "Later", "Git listener"]) {
    expect(
      titles.some((one) => one.includes(title)),
      title,
    ).toBe(true);
  }
  for (const line of ["Claude Code runner", "Nix + Docker", "Benchmarks"]) {
    expect(
      titles.some((one) => one.includes(line)),
      line,
    ).toBe(false);
  }

  const later = screen.getAllByRole("option").find((option) => option.textContent === "Later");
  await act(async () => {
    fireEvent.click(later!);
  });
  await waitFor(() =>
    expect(read(repo)).toContain(
      "- Benchmarks: after the runner is ready\n- [Dark mode](proposals/dark-mode.md)\n",
    ),
  );
  expect(existsSync(join(repo, "specs/proposals/dark-mode.md"))).toBe(true);
  expect(existsSync(join(repo, "specs/notes/dark-mode.md"))).toBe(false);
});
