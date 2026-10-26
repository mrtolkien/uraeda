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
import { atWidth, click, fixtureRepo, read, renderPage } from "./helpers.tsx";

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

/** Checks that the open add form is set to `section`. */
async function expectSection(section: string) {
  const form = within(await screen.findByRole("dialog", { name: "New priority" }));
  await form.findByRole("textbox", { name: "Priority" });
  expect(form.getByRole("radio", { checked: true, name: section })).toBeTruthy();
}

test("m opens the menu of the card the focus is on, while an earlier card is edited", async () => {
  const repo = await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Next · 3");
  focus("Nalpha");
  await press("i", document.activeElement as Element);
  await editorOf("Nalpha");

  focus("Ngamma");
  await press("m", linkOf("Ngamma"));
  await click(await screen.findByRole("menuitem", { name: "Delete" }));

  await waitFor(() => expect(read(repo)).not.toContain("Ngamma"));
  expect(read(repo)).toContain("- Nbeta\n");
  expect(read(repo)).toContain("- Nalpha\n");
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

  await waitFor(() => expect(read(repo, "specs/INBOX.md")).not.toContain("Ngamma"));
  expect(read(repo, "specs/INBOX.md")).toContain("- Nbeta\n");
});

test("o on a Blocked line opens the form in Next, the default place (R80)", async () => {
  await open("/priorities", "specs/PRIORITIES.md", PRIORITIES, "Blocked · 1");
  const link = focus("Blocked line 1");

  await press("o", link);

  await expectSection("Next");
});
