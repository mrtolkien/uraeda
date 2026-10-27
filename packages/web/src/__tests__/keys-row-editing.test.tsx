// Fix pass C on the row keys `o i m` (R40, R80 to R83): a key acts on the card the focus is on even
// while another card is edited in place; `o` on a Blocked line opens the form in Next; after an
// in-card save the saved card is selected and focused; the task view still follows a renamed line,
// whatever its key's characters; `i` never drops an editor holding unsaved text; and the editor and
// the task view share what is typed.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { openDetail, PRIORITY } from "../pane/DetailOverlay.tsx";
import { atRepo, atWidth, click, fixtureRepo, read, renderPage, type } from "./helpers.tsx";

const PRIORITIES = `# Priorities

## Now

- Now line 1

## Next

- Nalpha
- Nbeta
- Ngamma

## Later

- Later line 1

## Blocked

- Blocked line 1
`;

const INBOX = `# Inbox

- Loose note

## Ideas

- Nalpha
- Nbeta
- Ngamma
`;

beforeEach(() => {
  atWidth(1440);
  forgetUnsaved();
});

/** The page over a repository holding `text` in `path`, once its heading `ready` is drawn. */
async function open(page: string, path: string, text: string, ready: string) {
  const repo = fixtureRepo();
  writeFileSync(join(repo, path), text);
  await renderPage(page, repo);
  await screen.findByRole("heading", { name: ready });
  return repo;
}

/** The link of a card's text. */
function linkOf(text: string) {
  return screen
    .getAllByRole("link", { name: new RegExp(text) })
    .find((one) => one.closest("[data-row]") !== null) as HTMLElement;
}

/** The card of a text. */
function cardOf(text: string) {
  return linkOf(text).closest("[data-row]") as HTMLElement;
}

/** Puts the focus on a card's link. */
function focus(text: string) {
  const link = linkOf(text);
  act(() => link.focus());
  return link;
}

/** Presses a key on an element, as a user's reaches the window; a capital is typed with Shift. */
async function press(key: string, target: Element = document.body) {
  await act(async () => {
    fireEvent.keyDown(target, { key, shiftKey: /^[A-Z]$/.test(key) });
  });
}

/** The editor of a card, once it shows. */
function editorOf(text: string) {
  return screen.findByRole("textbox", { name: `Edit ${text}` });
}

/** Types `text` in a field and presses Enter. */
async function save(field: HTMLElement, text: string) {
  await type(field, text);
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });
}

/** Checks that the open add form is set to `section`. */
async function expectSection(section: string) {
  const form = within(await screen.findByRole("dialog", { name: "New priority" }));
  await form.findByRole("textbox", { name: "Priority" });
  expect(form.getByRole("radio", { checked: true, name: section })).toBeTruthy();
}

/** The answer to the "Discard your changes?" question. */
async function answer(button: string) {
  await click(
    within(await screen.findByRole("dialog", { name: "Discard your changes?" })).getByRole(
      "button",
      { name: button },
    ),
  );
}

test("m opens the menu of the card the focus is on, while an earlier card is edited", async () => {
  const repo = await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  focus("Nalpha");
  await press("i", document.activeElement as Element);
  await editorOf("Nalpha");

  focus("Ngamma");
  await press("m", linkOf("Ngamma"));
  await click(await screen.findByRole("menuitem", { name: "Delete" }));

  await waitFor(() => {
    const text = read(repo);
    expect(text).not.toContain("Ngamma");
    expect(text).toContain("- Nbeta\n");
    expect(text).toContain("- Nalpha\n");
  });
});

test("o adds in the section of the card the focus is on, while another section's card is edited", async () => {
  await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  focus("Now line 1");
  await press("i", linkOf("Now line 1"));
  await editorOf("Now line 1");

  focus("Nalpha");
  await press("o", linkOf("Nalpha"));

  await expectSection("Next");
});

test("j moves the selection and the focus to the same card, while another is edited", async () => {
  await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  focus("Nalpha");
  await press("i", linkOf("Nalpha"));
  await editorOf("Nalpha");

  focus("Nbeta");
  await press("j", linkOf("Nbeta"));

  await waitFor(() => expect(document.activeElement).toBe(linkOf("Ngamma")));
  expect(cardOf("Ngamma").getAttribute("aria-current")).toBe("true");
  expect(cardOf("Nbeta").getAttribute("aria-current")).toBeNull();
});

test("m on a note opens the note's menu, while an earlier note is edited", async () => {
  const repo = await open("/inbox", "specs/INBOX.md", INBOX, "Ideas · 3");
  focus("Nalpha");
  await press("i", linkOf("Nalpha"));
  await editorOf("Nalpha");

  focus("Ngamma");
  await press("m", linkOf("Ngamma"));
  await click(await screen.findByRole("menuitem", { name: "Delete" }));

  // Read together: the file is read while the core may still be writing it, and a read between
  // the two writes sees no text at all.
  await waitFor(() => {
    const text = read(repo, "specs/INBOX.md");
    expect(text).not.toContain("Ngamma");
    expect(text).toContain("- Nbeta\n");
  });
});

test("o on a Blocked line opens the form in Next, the default place (R80)", async () => {
  await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Blocked · 1");
  const link = focus("Blocked line 1");

  await press("o", link);

  await expectSection("Next");
});

test("o on a running entry opens the form in the section it has in the file", async () => {
  await renderPage("/priorities");
  await screen.findByRole("heading", { name: "Ongoing · 4" });
  const link = focus("CLI TUIs");

  await press("o", link);

  await expectSection("Now");
});

test("a saved in-card line is selected and has the focus, though its key changed (R81)", async () => {
  const repo = await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  await press("i", focus("Nbeta"));

  await save(await editorOf("Nbeta"), "Nbeta renamed");

  await waitFor(() => expect(read(repo)).toContain("- Nbeta renamed\n"));
  await waitFor(() => expect(document.activeElement).toBe(linkOf("Nbeta renamed")));
  expect(cardOf("Nbeta renamed").getAttribute("aria-current")).toBe("true");
  expect(window.location.pathname).toBe(atRepo("/priorities"));
});

test("a saved in-card note is selected and has the focus, though its key changed (R81)", async () => {
  const repo = await open("/inbox", "specs/INBOX.md", INBOX, "Ideas · 3");
  await press("i", focus("Nbeta"));

  await save(await editorOf("Nbeta"), "Nbeta renamed");

  await waitFor(() => expect(read(repo, "specs/INBOX.md")).toContain("- Nbeta renamed\n"));
  await waitFor(() => expect(document.activeElement).toBe(linkOf("Nbeta renamed")));
  expect(cardOf("Nbeta renamed").getAttribute("aria-current")).toBe("true");
});

test("the task view follows a renamed line whose key has non-ASCII characters (R82)", async () => {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/PRIORITIES.md"), "# Priorities\n\n## Next\n\n- 日本語の行\n");
  await renderPage("/priorities/日本語の行", repo);

  await click(await screen.findByRole("button", { name: "Edit" }));
  await save(screen.getByRole("textbox", { name: "Line" }), "日本語の行二");

  await waitFor(() => expect(read(repo)).toContain("- 日本語の行二\n"));
  await waitFor(() =>
    expect(decodeURIComponent(window.location.pathname)).toBe(atRepo("/priorities/日本語の行二")),
  );
});

test("the note's view follows a renamed note whose key has non-ASCII characters (R82)", async () => {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/INBOX.md"), "# Inbox\n\n- 日本語の行\n");
  await renderPage("/inbox/日本語の行", repo);

  await click(await screen.findByRole("button", { name: "Edit" }));
  await save(screen.getByRole("textbox", { name: "Note" }), "日本語の行二");

  await waitFor(() => expect(read(repo, "specs/INBOX.md")).toContain("- 日本語の行二\n"));
  await waitFor(() =>
    expect(decodeURIComponent(window.location.pathname)).toBe(atRepo("/inbox/日本語の行二")),
  );
});

test("i on another card while an editor holds unsaved text does nothing (R83)", async () => {
  await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  await press("i", focus("Nalpha"));
  await type(await editorOf("Nalpha"), "Nalpha, changed");

  await press("i", focus("Nbeta"));

  const fields = screen.getAllByRole("textbox", { name: /^Edit / });
  expect(fields).toHaveLength(1);
  expect((fields[0] as HTMLInputElement).value).toBe("Nalpha, changed");
});

test("i on another card while an editor is unchanged moves the editor there", async () => {
  await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  await press("i", focus("Nalpha"));
  await editorOf("Nalpha");

  await press("i", focus("Nbeta"));

  expect(await editorOf("Nbeta")).toBeTruthy();
  expect(screen.getAllByRole("textbox", { name: /^Edit / })).toHaveLength(1);
});

test("Escape on a changed editor asks, and Keep editing leaves it open with its text", async () => {
  const repo = await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  await press("i", focus("Nalpha"));
  const field = await editorOf("Nalpha");
  await type(field, "Nalpha, changed");

  await press("Escape", field);
  await answer("Keep editing");

  expect((await editorOf("Nalpha")) as HTMLInputElement).toHaveProperty("value", "Nalpha, changed");
  await press("Escape", field);
  await answer("Discard");
  await waitFor(() => expect(screen.queryByRole("textbox", { name: /^Edit / })).toBeNull());
  expect(read(repo)).toBe(PRIORITIES);
});

test("m and the … button are one menu", async () => {
  await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  await press("m", focus("Nbeta"));
  await screen.findByRole("menuitem", { name: "Move to Later" });

  expect(screen.getAllByRole("menu")).toHaveLength(1);
  const button = screen.getByRole("button", { name: "Actions of Nbeta" });
  expect(button.getAttribute("aria-expanded")).toBe("true");
  await click(button);
  await waitFor(() => expect(screen.queryByRole("menuitem")).toBeNull());
});

test("the task view restores what the card's editor holds unsaved, under the shared key", async () => {
  await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  await press("i", focus("Nbeta"));
  await type(await editorOf("Nbeta"), "Nbeta, by hand");

  await act(async () => openDetail(atRepo("/priorities/nbeta"), PRIORITY));

  const line = await screen.findByRole("textbox", { name: "Line" });
  expect((line as HTMLInputElement).value).toBe("Nbeta, by hand");
});

test("the card's editor restores what the task view holds unsaved", async () => {
  await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  await click(linkOf("Nbeta"));
  const pane = within(await screen.findByRole("dialog", { name: "Priority" }));
  await click(await pane.findByRole("button", { name: "Edit" }));
  await type(screen.getByRole("textbox", { name: "Line" }), "Nbeta, by hand");
  // Another row of the pane, then the pane closed: the unsaved text stays in the store.
  await click(pane.getByRole("button", { name: "Next ›" }));
  await waitFor(() => expect(pane.queryByRole("textbox", { name: "Line" })).toBeNull());
  await click(pane.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Priority" })).toBeNull());

  await press("i", focus("Nbeta"));

  const field = await screen.findByRole("textbox", { name: /^Edit / });
  expect((field as HTMLInputElement).value).toBe("Nbeta, by hand");
});
