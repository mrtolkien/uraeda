// `p` on a note of the inbox opens its promote picker: the priorities' levels, every proposal, and
// the proposal files. A note with a note file never nests, its file found by its link: its picker
// offers the levels, where it becomes a proposal, its file moved to the proposals in the proposal
// template's shape, and every proposal's file, whose Notes take its file's text, its file gone; a
// proposal without a file gets its file first.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { navigate } from "../routes.tsx";
import { atRepo, atWidth, fixtureRepo, read, renderPage } from "./helpers.tsx";

const INBOX = `# Inbox

- Loose note
- [Dark mode](notes/dark-mode.md)
- [Night mode](notes/night-mode/note.md)
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
  writeFileSync(join(repo, "specs/notes/dark-mode.md"), "# Dark mode\n\nThe dark.\n");
  mkdirSync(join(repo, "specs/notes/night-mode/images"), { recursive: true });
  writeFileSync(
    join(repo, "specs/notes/night-mode/note.md"),
    "# Night mode\n\nThe night.\n\n![moon](images/moon.webp)\n",
  );
  writeFileSync(join(repo, "specs/notes/night-mode/images/moon.webp"), "moon");
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

test("p on a note with a note file offers every proposal, and a level moves its file as a proposal's", async () => {
  const repo = await promoting("Dark mode");

  const titles = offered();
  for (const title of [
    "Now",
    "Next",
    "Later",
    "Git listener",
    "Claude Code runner",
    "Nix + Docker",
    "Benchmarks",
  ]) {
    expect(
      titles.some((one) => one.includes(title)),
      title,
    ).toBe(true);
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
  expect(read(repo, "specs/proposals/dark-mode.md")).toContain(
    "# Dark mode\n\n## What\n\nDark mode\n\nThe dark.\n\n## Why\n\n## Notes\n",
  );
  expect(existsSync(join(repo, "specs/notes/dark-mode.md"))).toBe(false);
  // The move ends on its toast, once its line is read back: the test ends after it.
  await screen.findByText(/Moved to Later/);
});

test("a note with a note file added to a proposal's file goes into its Notes, and Undo puts it back", async () => {
  const repo = await promoting("Dark mode");
  const listener = "specs/proposals/git-listener.md";
  const before = read(repo, listener);

  const proposal = screen
    .getAllByRole("option")
    .find((option) => option.textContent?.includes("Git listener"));
  await act(async () => {
    fireEvent.click(proposal!);
  });

  await waitFor(() =>
    expect(read(repo, listener)).toBe(`${before}\n## Notes\n\n### Dark mode\n\nThe dark.\n`),
  );
  expect(existsSync(join(repo, "specs/notes/dark-mode.md"))).toBe(false);
  expect(read(repo, "specs/INBOX.md")).not.toContain("Dark mode");

  await act(async () => {
    fireEvent.click(await screen.findByRole("button", { name: /^Undo/ }));
  });

  await waitFor(() => expect(read(repo, listener)).toBe(before));
  expect(read(repo, "specs/notes/dark-mode.md")).toBe("# Dark mode\n\nThe dark.\n");
  expect(read(repo, "specs/INBOX.md")).toContain("- [Dark mode](notes/dark-mode.md)\n");
});

test("a note with images added to a single proposal file opens it as the folder it became, and Undo makes it a file again", async () => {
  const repo = await promoting("Night mode");
  const listener = "specs/proposals/git-listener.md";
  const folder = "specs/proposals/git-listener";
  const before = read(repo, listener);

  const proposal = screen
    .getAllByRole("option")
    .find((option) => option.textContent?.includes("Git listener"));
  await act(async () => {
    fireEvent.click(proposal!);
  });

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/edit/${folder}/proposal.md`)));
  expect(read(repo, `${folder}/proposal.md`)).toBe(
    `${before}\n## Notes\n\n### Night mode\n\nThe night.\n\n![moon](images/moon.webp)\n`,
  );
  expect(read(repo, `${folder}/images/moon.webp`)).toBe("moon");
  expect(existsSync(join(repo, "specs/notes/night-mode"))).toBe(false);

  await act(async () => {
    fireEvent.click(await screen.findByRole("button", { name: /^Undo/ }));
  });

  await waitFor(() => expect(existsSync(join(repo, listener))).toBe(true));
  expect(read(repo, listener)).toBe(before);
  expect(read(repo, "specs/notes/night-mode/images/moon.webp")).toBe("moon");
  // The editor left open on the folder's file writes nothing back there.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 500)));
  expect(existsSync(join(repo, folder))).toBe(false);
});

test("a note with a note file added to a proposal without a file gives it its file, and Undo takes it all back", async () => {
  const repo = await promoting("Night mode");
  const priorities = read(repo);
  const folder = "specs/proposals/claude-code-runner-triggered-manually";

  const line = screen
    .getAllByRole("option")
    .find((option) => option.textContent?.includes("Claude Code runner"));
  await act(async () => {
    fireEvent.click(line!);
  });

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/edit/${folder}/proposal.md`)));
  expect(read(repo, `${folder}/proposal.md`)).toContain(
    "# Claude Code runner (triggered manually)\n\n## What\n\n" +
      "Claude Code runner (triggered manually)\n\n## Why\n\n## Notes\n\n" +
      "### Night mode\n\nThe night.\n\n![moon](images/moon.webp)\n",
  );
  expect(read(repo)).toContain(
    "- [Claude Code runner (triggered manually)]" +
      "(proposals/claude-code-runner-triggered-manually/proposal.md)\n",
  );
  expect(existsSync(join(repo, "specs/notes/night-mode"))).toBe(false);

  await act(async () => {
    fireEvent.click(await screen.findByRole("button", { name: /^Undo/ }));
  });

  await waitFor(() => expect(read(repo)).toBe(priorities));
  expect(read(repo, "specs/notes/night-mode/note.md")).toBe(
    "# Night mode\n\nThe night.\n\n![moon](images/moon.webp)\n",
  );
  expect(read(repo, "specs/INBOX.md")).toContain("- [Night mode](notes/night-mode/note.md)\n");
  // The editor left open on the new file writes nothing back there.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 500)));
  expect(existsSync(join(repo, folder))).toBe(false);
});

test("a note added to a proposal whose editor was open before shows in its editor", async () => {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/INBOX.md"), INBOX);
  // The proposal's editor, read once as it was before.
  await renderPage("/edit/specs/proposals/git-listener.md", repo);
  const before = (await screen.findByRole("textbox", { name: "Text" })) as HTMLTextAreaElement;
  expect(before.value).not.toContain("Loose note");
  await act(async () => navigate(atRepo("/inbox")));
  const link = (await screen.findAllByRole("button", { name: /Loose note/ })).find(
    (one) => one.closest("[data-row-link]") !== null,
  ) as HTMLElement;
  act(() => link.focus());
  await act(async () => {
    fireEvent.keyDown(link, { key: "p" });
  });
  await screen.findByRole("combobox", { name: "Promote the note" });

  const proposal = screen
    .getAllByRole("option")
    .find((option) => option.textContent?.includes("Git listener"));
  await act(async () => {
    fireEvent.click(proposal!);
  });

  await waitFor(() =>
    expect(read(repo, "specs/proposals/git-listener.md")).toContain("Loose note"),
  );
  const field = (await screen.findByRole("textbox", { name: "Text" })) as HTMLTextAreaElement;
  await waitFor(() => expect(field.value).toContain("Loose note"));
});
