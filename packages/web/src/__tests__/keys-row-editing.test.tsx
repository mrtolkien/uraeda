// Fix pass C on the row keys `o i m d` (R40, R80 to R83), on the outliners: a key acts on the row
// the focus is on, not on the one edited before it, whose field closes as the focus leaves it; `o`
// opens a new row beside the line, a Blocked one's too, and none beside a running entry, which
// stays as it is; after an in-place save the saved row is selected and focused; the task view still
// follows a renamed line, and a note's address selects the note, whatever its key's characters;
// the text of a field is never dropped unseen as `i` moves to another row, and Escape asks before
// it drops a change; `m` and the bar's "m move" are one move mode.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
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

/** The field of a line edited in place, and of a note: their labels name no row. */
const LINE = "Edit the line";
const NOTE = "Edit the note";

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

/**
 * The control of a row's text: a button, as the list opens its rows itself, not the buttons of the
 * row's bar under it.
 */
function controlOf(text: string) {
  return screen
    .getAllByRole("button", { name: new RegExp(text) })
    .find((one) => one.closest("[data-row-link]") !== null) as HTMLElement;
}

/** The row of a text, with its bar once it shows. */
function cardOf(text: string) {
  return controlOf(text).closest("[data-row]") as HTMLElement;
}

/**
 * Whether the focus is on a row's control. A write's row is focused by the selector
 * `:is([data-row-link] button, a[href])`, which happy-dom matches on the button's wrapper, not on
 * the button a browser matches: either one is the row's control here.
 */
function hasFocus(text: string) {
  const control = controlOf(text);
  const active = document.activeElement;
  return active === control || active === control.closest("[data-row-link]");
}

/** Puts the focus on a row's control. */
function focus(text: string) {
  const link = controlOf(text);
  act(() => link.focus());
  return link;
}

/** Presses a key on an element, as a user's reaches the window; a capital is typed with Shift. */
async function press(key: string, target: Element = document.body) {
  await act(async () => {
    fireEvent.keyDown(target, { key, shiftKey: /^[A-Z]$/.test(key) });
  });
}

/** The field of the row edited in place, once it shows with the text `value`. */
async function editorOf(label: string, value: string) {
  const field = (await screen.findByRole("textbox", { name: label })) as HTMLTextAreaElement;
  expect(field.value).toBe(value);
  return field;
}

/** Types `text` in a field and presses Enter. */
async function save(field: HTMLElement, text: string) {
  await type(field, text);
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });
}

/** Answers yes to the delete's question with `d` again, as `d d` deletes. */
async function confirmDelete() {
  await screen.findByRole("dialog", { name: "Delete this line?" });
  await press("d");
}

test("d deletes the line the focus is on, not the one edited before it", async () => {
  const repo = await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  focus("Nalpha");
  await press("i", document.activeElement as Element);
  await editorOf(LINE, "Nalpha");

  // The focus leaves the field, unchanged, which closes.
  focus("Ngamma");
  await press("d", controlOf("Ngamma"));
  await confirmDelete();

  await waitFor(() => {
    const text = read(repo);
    expect(text).not.toContain("Ngamma");
    expect(text).toContain("- Nbeta\n");
    expect(text).toContain("- Nalpha\n");
  });
});

test("o adds in the section of the line the focus is on, while another section's line is edited", async () => {
  const repo = await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  focus("Now line 1");
  await press("i", controlOf("Now line 1"));
  await editorOf(LINE, "Now line 1");

  focus("Nalpha");
  await press("o", controlOf("Nalpha"));

  const next = screen.getByRole("list", { name: "Next lines" });
  await save(await within(next).findByRole("textbox", { name: "New line" }), "Ndelta");
  await waitFor(() => expect(read(repo)).toContain("## Next\n\n- Nalpha\n- Ndelta\n- Nbeta\n"));
});

test("j moves the selection and the focus to the same line, while another is edited", async () => {
  await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  focus("Nalpha");
  await press("i", controlOf("Nalpha"));
  await editorOf(LINE, "Nalpha");

  focus("Nbeta");
  await press("j", controlOf("Nbeta"));

  await waitFor(() => expect(document.activeElement).toBe(controlOf("Ngamma")));
  expect(cardOf("Ngamma").getAttribute("aria-current")).toBe("true");
  expect(cardOf("Nbeta").getAttribute("aria-current")).toBeNull();
});

test("d on a note deletes it, not the note edited before it", async () => {
  const repo = await open("/inbox", "specs/INBOX.md", INBOX, "Ideas · 3");
  focus("Nalpha");
  await press("i", controlOf("Nalpha"));
  await editorOf(NOTE, "Nalpha");

  focus("Ngamma");
  await press("d", controlOf("Ngamma"));
  await confirmDelete();

  // Read together: the file is read while the core may still be writing it, and a read between
  // the two writes sees no text at all.
  await waitFor(() => {
    const text = read(repo, "specs/INBOX.md");
    expect(text).not.toContain("Ngamma");
    expect(text).toContain("- Nbeta\n");
    expect(text).toContain("- Nalpha\n");
  });
});

test("o on a Blocked line opens the new row in Blocked, beside it (R80)", async () => {
  const repo = await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Blocked · 1");
  const link = focus("Blocked line 1");

  await press("o", link);

  const blocked = screen.getByRole("list", { name: "Blocked lines" });
  await save(await within(blocked).findByRole("textbox", { name: "New line" }), "Blocked line 2");
  await waitFor(() =>
    expect(read(repo)).toContain("## Blocked\n\n- Blocked line 1\n- Blocked line 2\n"),
  );
});

test("o on a running entry opens no new row: it stays as it is", async () => {
  await renderPage("/priorities");
  await screen.findByRole("heading", { name: "Ongoing · 4" });
  const link = focus("CLI TUIs");

  await press("o", link);

  expect(screen.queryByRole("textbox", { name: "New line" })).toBeNull();
});

test("a saved in-place line is selected and has the focus, though its key changed (R81)", async () => {
  const repo = await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  await press("i", focus("Nbeta"));

  await save(await editorOf(LINE, "Nbeta"), "Nbeta renamed");

  await waitFor(() => expect(read(repo)).toContain("- Nbeta renamed\n"));
  await waitFor(() => expect(hasFocus("Nbeta renamed")).toBe(true));
  expect(cardOf("Nbeta renamed").getAttribute("aria-current")).toBe("true");
  expect(window.location.pathname).toBe(atRepo("/priorities"));
});

test("a saved in-place note is selected and has the focus, though its key changed (R81)", async () => {
  const repo = await open("/inbox", "specs/INBOX.md", INBOX, "Ideas · 3");
  await press("i", focus("Nbeta"));

  await save(await editorOf(NOTE, "Nbeta"), "Nbeta renamed");

  await waitFor(() => expect(read(repo, "specs/INBOX.md")).toContain("- Nbeta renamed\n"));
  await waitFor(() => expect(hasFocus("Nbeta renamed")).toBe(true));
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

test("a note's address with non-ASCII characters selects the note, which stays selected renamed (R82)", async () => {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/INBOX.md"), "# Inbox\n\n- 日本語の行\n");
  await renderPage("/inbox/日本語の行", repo);

  // A note has no view of its own: its address selects it in the inbox, which takes the address back.
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/inbox")));
  await waitFor(() => expect(cardOf("日本語の行").getAttribute("aria-current")).toBe("true"));
  await press("i", focus("日本語の行"));
  await save(await editorOf(NOTE, "日本語の行"), "日本語の行二");

  await waitFor(() => expect(read(repo, "specs/INBOX.md")).toContain("- 日本語の行二\n"));
  await waitFor(() => expect(hasFocus("日本語の行二")).toBe(true));
  expect(cardOf("日本語の行二").getAttribute("aria-current")).toBe("true");
});

test("i on another line saves the changed text of the field it leaves, then edits that line (R83)", async () => {
  const repo = await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  await press("i", focus("Nalpha"));
  await type(await editorOf(LINE, "Nalpha"), "Nalpha, changed");

  await press("i", focus("Nbeta"));

  await waitFor(() => expect(read(repo)).toContain("- Nalpha, changed\n"));
  await editorOf(LINE, "Nbeta");
  expect(screen.getAllByRole("textbox", { name: LINE })).toHaveLength(1);
});

test("i on another line while a field is unchanged moves the field there", async () => {
  const repo = await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  await press("i", focus("Nalpha"));
  await editorOf(LINE, "Nalpha");

  await press("i", focus("Nbeta"));

  await editorOf(LINE, "Nbeta");
  expect(screen.getAllByRole("textbox", { name: LINE })).toHaveLength(1);
  expect(read(repo)).toBe(PRIORITIES);
});

test("Escape on a changed field asks first: Keep editing keeps the text, Discard drops it", async () => {
  const repo = await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  await press("i", focus("Nalpha"));
  const field = await editorOf(LINE, "Nalpha");
  await type(field, "Nalpha, changed");

  await press("Escape", field);
  await click(
    within(await screen.findByRole("dialog", { name: "Discard your changes?" })).getByRole(
      "button",
      { name: /^Keep editing/ },
    ),
  );

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const kept = screen.getByRole("textbox", { name: LINE });
  expect((kept as HTMLTextAreaElement).value).toBe("Nalpha, changed");

  await press("Escape", kept);
  await click(
    within(await screen.findByRole("dialog", { name: "Discard your changes?" })).getByRole(
      "button",
      { name: /^Discard/ },
    ),
  );

  await waitFor(() => expect(screen.queryByRole("textbox", { name: LINE })).toBeNull());
  expect(read(repo)).toBe(PRIORITIES);
});

test("m and the bar's m move are one move mode, which m ends", async () => {
  await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  // A key's pick shows the row's bar.
  await press("j", focus("Nalpha"));
  await click(within(cardOf("Nbeta")).getByRole("button", { name: "m move" }));

  expect(within(cardOf("Nbeta")).getByRole("button", { name: "⏎ done" })).toBeTruthy();
  await press("m", focus("Nbeta"));
  await waitFor(() =>
    expect(within(cardOf("Nbeta")).queryByRole("button", { name: "⏎ done" })).toBeNull(),
  );
  expect(within(cardOf("Nbeta")).getByRole("button", { name: "m move" })).toBeTruthy();
});
