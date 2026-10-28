// A note's images in the inbox (the inbox-images record): the add form takes them pasted, a note's
// field edited in place takes them pasted, its text saved first, and the page takes them dropped,
// for the selected note, or, with none, for a new note in the add form. The selected note shows its
// images under its row, each with Remove.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { atWidth, click, fixture, fixtureRepo, read, renderPage, type } from "./helpers.tsx";

const PATH = "specs/INBOX.md";

const INBOX = `# Inbox

## Ideas

- Idea one
- Idea two
`;

/** A PNG, as the clipboard or a drop gives it. */
const png = (name: string) =>
  new File([readFileSync(fixture("images/phone.png"))], name, { type: "image/png" });

beforeEach(() => {
  atWidth(1440);
  forgetUnsaved();
});

/** The control of a note's text, not the buttons of the row's bar under it. */
function controlOf(note: string) {
  return screen
    .getAllByRole("button", { name: new RegExp(note) })
    .find((one) => one.closest("[data-row-link]") !== null) as HTMLElement;
}

/** The row of a note. */
const rowOf = (note: string) => controlOf(note).closest("[data-row]") as HTMLElement;

/** The page over a repository holding `INBOX`, with the focus on the row of `note`. */
async function onNote(note: string) {
  const repo = fixtureRepo();
  writeFileSync(join(repo, PATH), INBOX);
  await renderPage("/inbox", repo);
  await screen.findByRole("heading", { name: "Ideas · 2" });
  const link = controlOf(note);
  act(() => link.focus());
  return { link, repo };
}

/** Presses a key on an element, as a user's reaches the window. */
async function press(key: string, target: Element) {
  await act(async () => {
    fireEvent.keyDown(target, { key });
  });
}

/** Pastes `files` in a field, as the clipboard gives a screenshot: files, and no text. */
async function paste(field: Element, files: Array<File>) {
  await act(async () => {
    fireEvent.paste(field, { clipboardData: { files, getData: () => "" } });
  });
}

/** Selects "Idea one" as the keys do, from the note under it: `k`. */
async function selectIdeaOne() {
  const below = controlOf("Idea two");
  act(() => below.focus());
  await press("k", below);
  await waitFor(() => expect(rowOf("Idea one").getAttribute("aria-current")).toBe("true"));
}

/** Drops `files` on the page, as a file manager does. */
async function drop(files: Array<File>) {
  const dataTransfer = { dropEffect: "none", files, types: ["Files"] };
  await act(async () => {
    fireEvent.dragEnter(document.body, { dataTransfer });
    fireEvent.drop(document.body, { dataTransfer });
  });
}

/** The draft the line of `note` links in `INBOX.md`, from the repository's top level. */
function draftOf(repo: string, note: string) {
  const line = read(repo, PATH)
    .split("\n")
    .find((one) => one.includes(note));
  const target = line?.match(/\]\(([^)]+)\)/)?.[1];
  expect(target, `${note} links a draft: ${line}`).toBeDefined();
  return join("specs", target!).replace(/\/$/, "");
}

/** The draft folder's file names, its images' folder included. */
function filesOf(repo: string, draft: string) {
  const folder = join(repo, draft.endsWith(".md") ? join(draft, "..") : draft);
  return {
    images: readdirSync(join(folder, "images")),
    text: readFileSync(
      draft.endsWith(".md") ? join(repo, draft) : join(folder, "proposal.md"),
      "utf8",
    ),
  };
}

test("the add form takes a pasted image, and adds the note as a draft holding it", async () => {
  const { link, repo } = await onNote("Idea two");
  await press("a", link);
  const field = await screen.findByPlaceholderText("What did you notice?");
  await type(field, "Headings are flat");

  await paste(field, [png("headings.png")]);

  const form = within(screen.getByRole("dialog", { name: "Add a note" }));
  expect(await form.findByRole("button", { name: /^Remove/ })).toBeTruthy();
  await click(form.getByRole("button", { name: "Add as a draft" }));
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await waitFor(() => expect(read(repo, PATH)).toMatch(/\[Headings are flat\]\(/));
  const { images, text } = filesOf(repo, draftOf(repo, "Headings are flat"));
  expect(images).toHaveLength(1);
  expect(text).toContain(`](images/${images[0]})`);
});

test("an image pasted in a note's field saves its text first, then makes it a draft holding it", async () => {
  const { link, repo } = await onNote("Idea two");
  await press("i", link);
  const field = await screen.findByRole("textbox", { name: "Edit the note" });
  await type(field, "Idea deux");

  await paste(field, [png("")]);

  await waitFor(() => expect(read(repo, PATH)).toMatch(/- \[Idea deux\]\(/));
  const { images, text } = filesOf(repo, draftOf(repo, "Idea deux"));
  expect(images).toHaveLength(1);
  expect(text).toContain("Idea deux");
  expect(text).toContain(`](images/${images[0]})`);
  expect(read(repo, PATH)).toContain("- Idea one\n");
});

test("an image dropped on the page goes to the selected note", async () => {
  const { repo } = await onNote("Idea two");
  await selectIdeaOne();

  await drop([png("dropped.png")]);

  await waitFor(() => expect(read(repo, PATH)).toMatch(/- \[Idea one\]\(/));
  expect(filesOf(repo, draftOf(repo, "Idea one")).images).toHaveLength(1);
  expect(read(repo, PATH)).toContain("- Idea two\n");
});

test("an image dropped with no note selected opens the add form holding it", async () => {
  const repo = fixtureRepo();
  writeFileSync(join(repo, PATH), INBOX);
  await renderPage("/inbox", repo);
  await screen.findByRole("heading", { name: "Ideas · 2" });

  await drop([png("dropped.png")]);

  const form = within(await screen.findByRole("dialog", { name: "Add a note" }));
  expect(await form.findByRole("button", { name: /^Remove dropped\.png/ })).toBeTruthy();
  expect(form.getByRole("button", { name: "Add as a draft" })).toBeTruthy();
  expect(read(repo, PATH)).toBe(INBOX);
});

test("the selected note shows its images under its row, and Remove takes one out of its draft", async () => {
  const { repo } = await onNote("Idea two");
  await selectIdeaOne();
  await drop([png("dropped.png")]);
  await waitFor(() => expect(read(repo, PATH)).toMatch(/- \[Idea one\]\(/));
  const draft = draftOf(repo, "Idea one");
  const [image] = filesOf(repo, draft).images;

  const imagesOf = (note: string) =>
    within(rowOf(note)).queryByRole("group", { name: "The note's images" });
  // Another row selected: the note's images are not drawn, and its row says it has one.
  act(() => controlOf("Idea one").focus());
  await press("j", controlOf("Idea one"));
  await waitFor(() => expect(rowOf("Idea two").getAttribute("aria-current")).toBe("true"));
  expect(imagesOf("Idea one")).toBeNull();
  expect(imagesOf("Idea two")).toBeNull();
  expect(rowOf("Idea one").textContent).toContain("1 image");

  // Selected by the keys: its images show under it, as they would to a tap.
  await selectIdeaOne();
  const shown = within(await waitFor(() => imagesOf("Idea one")!));
  expect(shown.getByRole("img", { name: image })).toBeTruthy();

  await click(shown.getByRole("button", { name: `Remove ${image}` }));

  await waitFor(() => expect(filesOf(repo, draft).text).not.toContain(`images/${image}`));
  expect(await screen.findByText(`Removed ${image} from the note's draft`)).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "Edit the note" })).toBeNull();
});
