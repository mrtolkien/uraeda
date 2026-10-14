import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import {
  click,
  fixture,
  fixtureRepo,
  git,
  refreshUntil,
  renderPage,
  today,
  type,
} from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const ROUND = `specs/${FOLDER}/clarifications-01.md`;
const LINK = "![login](images/login.webp)";

today("2026-10-11");

afterEach(() => {
  vi.useRealTimers();
});

/** A repository whose round is in the feature's worktree, its notes `notes`. */
function roundWith(notes = "") {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  if (notes) {
    setNotes(repo, notes);
  }
  return repo;
}

/** The round's file in the feature's worktree. */
const file = (repo: string) => join(repo, ".worktrees", FOLDER, ROUND);

/** The round's text on disk. */
const text = (repo: string) => readFileSync(file(repo), "utf8");

/** The notes on disk: what follows the `**Notes:**` marker, trimmed. */
function notesOnDisk(repo: string) {
  const all = text(repo);
  return all.slice(all.indexOf("**Notes:**") + "**Notes:**".length).trim();
}

/** Writes the notes on disk, as by hand. */
function setNotes(repo: string, notes: string) {
  const all = text(repo);
  writeFileSync(file(repo), `${all.slice(0, all.indexOf("**Notes:**"))}**Notes:** ${notes}\n`);
}

/** Writes Q1's answer on disk, as `ura answer` does: the round changes for another reason. */
function answerQ1(repo: string) {
  writeFileSync(file(repo), text(repo).replace(/\*\*Answer:\*\*\n/, "**Answer:** A\n"));
}

/** Q1's option A, pressed once the page read Q1's answer. */
function q1A() {
  return (document.getElementById("Q1") as HTMLElement).querySelector(
    "button[aria-pressed]",
  ) as HTMLElement;
}

const notesField = () => screen.getByLabelText("Notes") as HTMLTextAreaElement;
const saveNotes = () => screen.getByRole("button", { name: "Save notes" });

/** The page shown again, as after a reload: the store reads `localStorage` anew. */
async function reload(repo: string) {
  forgetUnsaved();
  await renderPage(PAGE, repo, { reload: true });
  return screen.findByLabelText("Notes") as Promise<HTMLTextAreaElement>;
}

/** The time the tests type at, which the restore notice says. */
function at1432() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 14, 32));
}

/** The keys of the unsaved text kept in the browser. */
function keptKeys() {
  return Object.keys(window.localStorage).filter((key) => key.startsWith("uraeda:unsaved:"));
}

/** US1 1, SC-003, review focus 8: the file read again never writes into the field. */
test("notes typed are kept while the file changes, and not saved", async () => {
  const repo = roundWith();
  await renderPage(PAGE, repo);
  await screen.findByLabelText("Notes");

  await type(notesField(), "Keep the undo ");
  answerQ1(repo);
  await refreshUntil(() => expect(q1A().getAttribute("aria-pressed")).toBe("true"));
  expect(notesField().value).toBe("Keep the undo ");
  await type(notesField(), "Keep the undo please");

  expect(notesField().value).toBe("Keep the undo please");
  expect(screen.getByText("Unsaved changes")).toBeTruthy();
  // Another read of the file, the notes still not saved.
  answerQ1(repo);
  await refreshUntil(() => expect(q1A().getAttribute("aria-pressed")).toBe("true"));
  expect(notesOnDisk(repo)).toBe("");
});

/** US1 2 */
test("Save notes writes the notes, and says saved", async () => {
  const repo = roundWith();
  await renderPage(PAGE, repo);
  await type(await screen.findByLabelText("Notes"), "Keep the undo please");

  await click(saveNotes());

  await waitFor(() => expect(text(repo)).toContain("**Notes:** Keep the undo please"));
  expect(await screen.findByText("saved ✓")).toBeTruthy();
  expect(notesField().value).toBe("Keep the undo please");
  expect(screen.queryByText("Unsaved changes")).toBeNull();
});

/** US1 3 */
test("unsaved notes stay as the round is answered elsewhere", async () => {
  const repo = roundWith();
  await renderPage(PAGE, repo);
  await type(await screen.findByLabelText("Notes"), "Draft one");

  answerQ1(repo);
  await refreshUntil(() => expect(q1A().getAttribute("aria-pressed")).toBe("true"));

  expect(notesField().value).toBe("Draft one");
});

/** US1 4 */
test("saved notes show once, in their field", async () => {
  await renderPage(PAGE, roundWith("Keep the undo please"));

  expect((await screen.findByLabelText<HTMLTextAreaElement>("Notes")).value).toBe(
    "Keep the undo please",
  );
  expect(
    screen.queryAllByText(/Keep the undo please/, { ignore: "textarea, script, style" }),
  ).toHaveLength(0);
});

/** US1 5 */
test("Ctrl+Enter in the notes saves them", async () => {
  const repo = roundWith();
  await renderPage(PAGE, repo);
  await type(await screen.findByLabelText("Notes"), "Line one");

  await act(async () => {
    fireEvent.keyDown(notesField(), { ctrlKey: true, key: "Enter" });
  });

  await waitFor(() => expect(notesOnDisk(repo)).toBe("Line one"));
});

/** US2 8 */
test("with nothing changed, Save notes is disabled and nothing is unsaved", async () => {
  await renderPage(PAGE, roundWith("Fine"));
  await screen.findByLabelText("Notes");

  expect(saveNotes().hasAttribute("disabled")).toBe(true);
  expect(screen.queryByText("Unsaved changes")).toBeNull();
});

/** US5 1 and 2 */
test("unsaved notes are restored after a reload, until discarded", async () => {
  at1432();
  const repo = roundWith();
  await renderPage(PAGE, repo);
  await type(await screen.findByLabelText("Notes"), "Bigger icon");

  const restored = await reload(repo);

  expect(restored.value).toBe("Bigger icon");
  expect(screen.getByText("Unsaved text restored from 14:32.")).toBeTruthy();
  expect(screen.getByText("Unsaved changes")).toBeTruthy();
  await click(screen.getByRole("button", { name: "Discard" }));
  expect(notesField().value).toBe("");
  expect(screen.queryByText(/Unsaved text restored/)).toBeNull();

  expect((await reload(repo)).value).toBe("");
  expect(screen.queryByText(/Unsaved text restored/)).toBeNull();
});

/** US5 3 */
test("notes restored over notes changed since say so", async () => {
  at1432();
  const repo = roundWith("Fine");
  await renderPage(PAGE, repo);
  await type(await screen.findByLabelText("Notes"), "Bigger icon");
  setNotes(repo, "Fine, thanks");

  expect((await reload(repo)).value).toBe("Bigger icon");

  expect(
    screen.getByText(
      "Unsaved text restored from 14:32. The notes changed since: saving replaces them.",
    ),
  ).toBeTruthy();
});

/** Review focus 1: an image saves the notes as typed, and leaves nothing unsaved. */
test("an image added to unsaved notes saves them, and nothing is restored", async () => {
  const repo = roundWith();
  await renderPage(PAGE, repo);
  await type(await screen.findByLabelText("Notes"), "Typed");

  const input = screen.getByLabelText("Add image to the notes", { selector: "input" });
  const png = new File([readFileSync(fixture("images/phone.png"))], "login.png", {
    type: "image/png",
  });
  await act(async () => {
    fireEvent.change(input, { target: { files: [png] } });
  });

  await waitFor(() => expect(notesOnDisk(repo)).toBe(`Typed\n\n${LINK}`));
  await waitFor(() => expect(keptKeys()).toEqual([]));
  await reload(repo);
  expect(screen.queryByText(/Unsaved text restored/)).toBeNull();
});

/** Review focus 2: a refused save keeps the unsaved text. */
test("notes whose save is refused are restored after a reload", async () => {
  const repo = roundWith();
  await renderPage(PAGE, repo);
  await type(await screen.findByLabelText("Notes"), "mine");
  // The notes change on disk, unread by the page.
  setNotes(repo, "theirs");

  await click(saveNotes());

  expect(await screen.findByText(/^Not saved:/)).toBeTruthy();
  expect(notesOnDisk(repo)).toBe("theirs");
  expect((await reload(repo)).value).toBe("mine");
  expect(screen.getByText(/^Unsaved text restored from/)).toBeTruthy();
});

/** Review focus 3: spaces and line breaks at the ends are not changes. */
test("notes differing only by spaces at their ends are not unsaved", async () => {
  const repo = roundWith("Fine");
  await renderPage(PAGE, repo);
  await screen.findByLabelText("Notes");

  await type(notesField(), "Fine \n");

  expect(notesField().value).toBe("Fine \n");
  expect(screen.queryByText("Unsaved changes")).toBeNull();
  expect(saveNotes().hasAttribute("disabled")).toBe(true);
  expect(keptKeys()).toEqual([]);
});

/** Review focus 4: the round answered elsewhere keeps the unsaved notes, and says so. */
test("unsaved notes of a round answered elsewhere stay, with the notice", async () => {
  at1432();
  const repo = roundWith();
  await renderPage(PAGE, repo);
  await type(await screen.findByLabelText("Notes"), "Too late");

  writeFileSync(file(repo), text(repo).replace("status: awaiting-human", "status: answered"));
  await refreshUntil(() =>
    expect(screen.queryByRole("button", { name: "Submit answers" })).toBeNull(),
  );

  expect(
    screen.getByText("Unsaved text restored from 14:32. The round was answered."),
  ).toBeTruthy();
  expect(keptKeys()).toHaveLength(1);
  await click(screen.getByRole("button", { name: "Discard" }));
  expect(keptKeys()).toEqual([]);
});
