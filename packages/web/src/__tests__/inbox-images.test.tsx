// A note's images in the inbox (the inbox-images record): the add form takes them pasted, a note's
// field edited in place takes them pasted, its text saved first, and the page takes them dropped,
// for the selected note, or, with none, for a new note in the add form. The selected note shows its
// images under its row, each with Remove.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { navigate } from "../routes.tsx";
import {
  atRepo,
  atWidth,
  click,
  fixture,
  fixtureRepo,
  read,
  renderPage,
  type,
} from "./helpers.tsx";

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

/** The images drawn under a note's row, if any. */
const imagesOf = (note: string) =>
  within(rowOf(note)).queryByRole("group", { name: "The note's images" });

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

/** The note file the line of `note` links in `INBOX.md`, from the repository's top level. */
function fileOf(repo: string, note: string) {
  const line = read(repo, PATH)
    .split("\n")
    .find((one) => one.includes(note));
  const target = line?.match(/\]\(([^)]+)\)/)?.[1];
  expect(target, `${note} links a note file: ${line}`).toBeDefined();
  return join("specs", target!).replace(/\/$/, "");
}

/** The note file folder's file names, its images' folder included. */
function filesOf(repo: string, file: string) {
  const folder = join(repo, file.endsWith(".md") ? join(file, "..") : file);
  return {
    images: readdirSync(join(folder, "images")),
    text: readFileSync(file.endsWith(".md") ? join(repo, file) : join(folder, "note.md"), "utf8"),
  };
}

test("the add form takes a pasted image, and adds the note as a file holding it", async () => {
  const { link, repo } = await onNote("Idea two");
  await press("a", link);
  const field = await screen.findByPlaceholderText("What did you notice?");
  await type(field, "Headings are flat");

  await paste(field, [png("headings.png")]);

  const form = within(screen.getByRole("dialog", { name: "Add a note" }));
  expect(await form.findByRole("button", { name: /^Remove/ })).toBeTruthy();
  await click(form.getByRole("button", { name: "Add as a file" }));
  // The image is encoded before the note is written: a while, under a loaded machine.
  await waitFor(() => expect(read(repo, PATH)).toMatch(/\[Headings are flat\]\(/), {
    timeout: 10_000,
  });
  const { images, text } = filesOf(repo, fileOf(repo, "Headings are flat"));
  expect(images).toHaveLength(1);
  expect(text).toContain(`](images/${images[0]})`);
});

test("an image pasted in a note's field saves its text first, then gives it a file holding it", async () => {
  const { link, repo } = await onNote("Idea two");
  await press("i", link);
  const field = await screen.findByRole("textbox", { name: "Edit the note" });
  await type(field, "Idea deux");

  await paste(field, [png("")]);

  await waitFor(() => expect(read(repo, PATH)).toMatch(/- \[Idea deux\]\(/));
  const { images, text } = filesOf(repo, fileOf(repo, "Idea deux"));
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
  expect(filesOf(repo, fileOf(repo, "Idea one")).images).toHaveLength(1);
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
  expect(form.getByRole("button", { name: "Add as a file" })).toBeTruthy();
  expect(read(repo, PATH)).toBe(INBOX);
});

test("the selected note shows its images under its row, and Remove takes one out of its file", async () => {
  const { repo } = await onNote("Idea two");
  await selectIdeaOne();
  await drop([png("dropped.png")]);
  await waitFor(() => expect(read(repo, PATH)).toMatch(/- \[Idea one\]\(/));
  const file = fileOf(repo, "Idea one");
  const [image] = filesOf(repo, file).images;

  // Another row selected: the note's images are not drawn, and its row says it has one.
  act(() => controlOf("Idea one").focus());
  await press("j", controlOf("Idea one"));
  await waitFor(() => expect(rowOf("Idea two").getAttribute("aria-current")).toBe("true"));
  expect(imagesOf("Idea one")).toBeNull();
  expect(imagesOf("Idea two")).toBeNull();
  // The row counts the image once the inbox is read again after the drop.
  await waitFor(() => expect(rowOf("Idea one").textContent).toContain("1 image"));

  // Selected by the keys: its images show under it, as they would to a tap.
  await selectIdeaOne();
  const shown = within(await waitFor(() => imagesOf("Idea one")!));
  expect(shown.getByRole("img", { name: image })).toBeTruthy();

  // The keys reach Remove: Enter on it is the button's, not the list's, which would edit the row.
  const remove = shown.getByRole("button", { name: `Remove ${image}` });
  act(() => remove.focus());
  await press("Enter", remove);
  expect(screen.queryByRole("textbox", { name: "Edit the note" })).toBeNull();

  const before = filesOf(repo, file).text;
  await click(remove);

  await waitFor(() => expect(filesOf(repo, file).text).not.toContain(`images/${image}`));
  expect(await screen.findByText(`Removed ${image} from the note's file`)).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "Edit the note" })).toBeNull();
  // The image's file stays, for `ura inbox clean` or a commit to delete.
  expect(filesOf(repo, file).images).toEqual([image]);
  // Undo puts the link back where it was, the file as it was before.
  await click(await screen.findByRole("button", { name: /^Undo/ }));
  await waitFor(() => expect(filesOf(repo, file).text).toBe(before));
});

/** Opens the editor of the note file `file`, a file or a folder's `note.md`, and gives its field. */
async function editorField(file: string) {
  const path = file.endsWith(".md") ? file : `${file}/note.md`;
  await act(async () => navigate(atRepo(`/edit/${path}`)));
  return (await screen.findByRole("textbox", { name: "Text" })) as HTMLTextAreaElement;
}

/** Opens the editor of the note file `file` and gives its text. */
async function editorText(file: string) {
  return (await editorField(file)).value;
}

/** Idea one with a dropped image, its row selected and its image shown under it. */
async function ideaOneWithImage() {
  const { repo } = await onNote("Idea two");
  await selectIdeaOne();
  await drop([png("dropped.png")]);
  await waitFor(() => expect(read(repo, PATH)).toMatch(/- \[Idea one\]\(/));
  const file = fileOf(repo, "Idea one");
  const [image] = filesOf(repo, file).images;
  await waitFor(() => expect(rowOf("Idea one").textContent).toContain("1 image"));
  const shown = within(await waitFor(() => imagesOf("Idea one")!));
  return { file, image: image!, repo, shown };
}

test("a note file opened after one of its images is removed shows it without the image", async () => {
  const { file, image, shown } = await ideaOneWithImage();

  await click(shown.getByRole("button", { name: `Remove ${image}` }));
  await screen.findByText(`Removed ${image} from the note's file`);

  const text = await editorText(file);
  expect(text).toContain("Idea one");
  expect(text).not.toContain(`images/${image}`);
});

test("a note file opened after an image's removal is undone shows the image again", async () => {
  const { file, image, repo, shown } = await ideaOneWithImage();
  const before = filesOf(repo, file).text;
  await click(shown.getByRole("button", { name: `Remove ${image}` }));
  await screen.findByText(`Removed ${image} from the note's file`);

  await click(await screen.findByRole("button", { name: /^Undo/ }));
  await waitFor(() => expect(filesOf(repo, file).text).toBe(before));

  const field = await editorField(file);
  // The note file is read again once the write ends, after it is written: the editor follows it.
  await waitFor(() => expect(field.value).toContain(`images/${image}`));
});

test("a note file opened after a second image is dropped on its note shows both", async () => {
  const { file, image, repo } = await ideaOneWithImage();
  // The editor reads the note file as it is with one image.
  expect(await editorText(file)).toContain(`images/${image}`);
  await act(async () => navigate(atRepo("/inbox")));
  await screen.findByRole("heading", { name: "Ideas · 2" });
  await selectIdeaOne();

  await drop([png("second.png")]);
  await waitFor(() => expect(filesOf(repo, file).images).toHaveLength(2));

  const field = await editorField(file);
  for (const one of filesOf(repo, file).images) {
    await waitFor(() => expect(field.value).toContain(`images/${one}`));
  }
});

test("a drop goes to the inbox, not to the add form once it closed", async () => {
  const { link, repo } = await onNote("Idea two");
  await press("a", link);
  const field = await screen.findByPlaceholderText("What did you notice?");
  await press("Escape", field);
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a note" })).toBeNull());
  act(() => (document.activeElement as HTMLElement | null)?.blur());

  await drop([png("dropped.png")]);

  const form = within(await screen.findByRole("dialog", { name: "Add a note" }));
  expect(await form.findByRole("button", { name: /^Remove dropped\.png/ })).toBeTruthy();
  expect(read(repo, PATH)).toBe(INBOX);
});
