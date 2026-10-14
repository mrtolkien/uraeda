// US1 scenarios 1 to 3 and 8, the edge cases of drops, and SC-002: images dropped anywhere on the
// editor's page, pasted, or picked with "Add image", saved by the core, and linked at the cursor.
// Files come from `fixtures/images/`, dropped and pasted through an in-page `DataTransfer`.
import { screen } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** A fixture image as the file the human gives, under a name of their own. */
async function image(fixture: string, name = fixture) {
  const bytes = Uint8Array.from(atob(await commands.fixtureImage(fixture)), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: TYPES[name.split(".").at(-1)!] ?? "" });
}

/** Files carried by a drag or a paste. */
function carrying(files: File[]) {
  const data = new DataTransfer();
  for (const file of files) {
    data.items.add(file);
  }
  return data;
}

/** Drags files over the page and drops them on an element: returns the drop's event. */
function drop(files: File[], on: Element = document.body) {
  const dataTransfer = carrying(files);
  const init = { bubbles: true, cancelable: true, dataTransfer };
  on.dispatchEvent(new DragEvent("dragenter", init));
  on.dispatchEvent(new DragEvent("dragover", init));
  const event = new DragEvent("drop", init);
  on.dispatchEvent(event);
  return event;
}

/** Pastes files into an element, as from the clipboard. */
function paste(files: File[], on: Element) {
  on.dispatchEvent(
    new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: carrying(files),
    }),
  );
}

/** The elements showing a text on the page, not in the screen reader's announcements. */
function shown(text: string) {
  return screen
    .queryAllByText(text)
    .filter((element) => !element.closest("[data-astryx-live-region]"));
}

const SVG_REFUSED = "Only PNG, JPEG, GIF, and WebP images can be added: diagram.svg is not one.";

/** The address a request goes to. */
const urlOf = (input: RequestInfo | URL) =>
  input instanceof Request ? input.url : input.toString();

const realFetch = globalThis.fetch;

/** Holds the page's uploads until the test lets each one through: what happens during one. */
function holdUploads() {
  const waiting: Array<() => void> = [];
  globalThis.fetch = async (input, init) => {
    if (urlOf(input).startsWith("/attach")) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    return realFetch(input, init);
  };
  return {
    waiting,
    /** Lets the next upload through, once it waits. */
    async release() {
      await expect.poll(() => waiting.length).toBeGreaterThan(0);
      waiting.shift()!();
    },
  };
}

// The editor of a draft the fixture lacks leaves before its repository goes: its live view, still
// listening as the next test's repository replaces this one, would read a draft no longer there.
afterEach(async () => {
  globalThis.fetch = realFetch;
  await show("/", "Priorities");
});

const PROPOSAL = "specs/drafts/login-banner/proposal.md";
const LEAD = "When the password is wrong, the banner covers the login button:";
const TEXT = `# Login error banner\n\n## What\n\n${LEAD}\n\n## Why\n\nUsers miss the button.\n`;

/** The login banner's proposal, a folder draft, open in the editor: its text field. */
async function editProposal() {
  await commands.writeRepo(TEXT, PROPOSAL);
  await show(`/edit/${PROPOSAL}`, "Login error banner");
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  return screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement;
}

/**
 * Waits for the proposal to hold a text, saved as typed text is: a test ends once its page's
 * writes are done, before the next test's repository replaces its own.
 */
async function saved(text: string | RegExp) {
  await expect.poll(() => commands.readRepo(PROPOSAL), { timeout: 10_000 }).toMatch(text);
}

/** Puts the cursor in a field, at a position. */
function cursorAt(field: HTMLTextAreaElement, at: number) {
  field.focus();
  field.setSelectionRange(at, at);
}

/** The text selected in a field. */
function selected(field: HTMLTextAreaElement) {
  return field.value.slice(field.selectionStart, field.selectionEnd);
}

test("US1.1: a screenshot dropped anywhere on the page is linked at the cursor", async () => {
  const field = await editProposal();
  cursorAt(field, TEXT.indexOf(LEAD) + LEAD.length);

  drop([await image("desktop.png", "Screenshot 2026-10-14 at 10.35.12.png")]);

  const link =
    "![Screenshot 2026-10-14 at 10.35.12](images/screenshot-2026-10-14-at-10-35-12.webp)";
  await expect.poll(() => field.value).toBe(TEXT.replace(`${LEAD}\n\n`, `${LEAD}\n\n${link}\n\n`));
  expect(selected(field)).toBe("Screenshot 2026-10-14 at 10.35.12");
  expect(
    await commands.repoFileSize(
      "specs/drafts/login-banner/images/screenshot-2026-10-14-at-10-35-12.webp",
    ),
  ).toBeGreaterThan(0);
  expect(
    (await screen.findAllByText("Added screenshot-2026-10-14-at-10-35-12.webp")).length,
  ).toBeGreaterThan(0);
  // The text with its link is saved, as typed text is.
  await saved(link);
});

test("US1.1: a drop on the preview opens the text, linked at its end", async () => {
  await commands.writeRepo(TEXT, PROPOSAL);
  await show(`/edit/${PROPOSAL}`, "Login error banner");
  expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();

  drop([await image("phone.png", "login.png")]);

  const field = (await screen.findByRole("textbox", { name: "Text" })) as HTMLTextAreaElement;
  await expect.poll(() => field.value).toBe(`${TEXT}\n![login](images/login.webp)\n`);
  expect(selected(field)).toBe("login");
  await saved("![login](images/login.webp)");
});

test('US1.2: a pasted image is linked as "pasted image"', async () => {
  const field = await editProposal();
  cursorAt(field, TEXT.indexOf(LEAD) + LEAD.length);

  paste([await image("phone.png", "image.png")], field);

  await expect
    .poll(() => field.value)
    .toMatch(/!\[pasted image\]\(images\/pasted-\d{8}-\d{6}\.webp\)/);
  expect(selected(field)).toBe("pasted image");
  await saved("![pasted image]");
});

test('US1.3: "Add image" picks a file', async () => {
  const field = await editProposal();
  cursorAt(field, TEXT.indexOf(LEAD) + LEAD.length);
  expect(screen.getByRole("button", { name: "Add image" })).toBeTruthy();

  await userEvent.upload(
    screen.getByLabelText("Add image", { selector: "input" }),
    await image("phone.png", "login.png"),
  );

  await expect.poll(() => field.value).toContain(`${LEAD}\n\n![login](images/login.webp)\n\n`);
  expect(
    await commands.repoFileSize("specs/drafts/login-banner/images/login.webp"),
  ).toBeGreaterThan(0);
  await saved("![login](images/login.webp)");
});

test("US1.8: an SVG is refused under the field", async () => {
  const field = await editProposal();

  drop([await image("drawing.svg", "diagram.svg")]);

  expect(
    (
      await screen.findAllByText(
        "Only PNG, JPEG, GIF, and WebP images can be added: diagram.svg is not one.",
      )
    ).length,
  ).toBeGreaterThan(0);
  expect(field.value).toBe(TEXT);
  expect(await commands.repoFileSize("specs/drafts/login-banner/images/diagram.webp")).toBe(-1);
});

test("the link goes where the cursor was at the drop, and what is typed meanwhile is kept", async () => {
  const field = await editProposal();
  const at = TEXT.indexOf(LEAD) + LEAD.length;
  cursorAt(field, at);

  // A photo takes the encoder longer than a screenshot: the typing happens during its upload.
  drop([await image("photo.jpg", "photo.jpg")]);
  cursorAt(field, 0);
  await userEvent.keyboard("Hi ");
  cursorAt(field, field.value.length);
  await userEvent.keyboard("Bye");

  const link = "![photo](images/photo.webp)";
  // Encoding a 6-megapixel photo takes seconds on a busy machine.
  await expect
    .poll(() => field.value, { timeout: 20_000 })
    .toBe(`Hi ${TEXT.slice(0, at)}\n\n${link}${TEXT.slice(at)}Bye`);
  expect(selected(field)).toBe("photo");
  await saved(`Hi ${TEXT.slice(0, at)}\n\n${link}${TEXT.slice(at)}Bye`);
});

test("several images are linked one per line", async () => {
  const field = await editProposal();
  cursorAt(field, TEXT.indexOf(LEAD) + LEAD.length);

  drop([await image("phone.png", "one.png"), await image("still.gif", "two.gif")]);

  await expect
    .poll(() => field.value)
    .toContain(`${LEAD}\n\n![one](images/one.webp)\n![two](images/two.webp)\n\n## Why`);
  expect(selected(field)).toBe("one");
  await saved("![two](images/two.webp)");
});

test("several images dropped on a single-file draft all go to its new folder", async () => {
  await show("/edit/specs/drafts/git-listener.md", "Git listener process");
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));

  drop([await image("phone.png", "one.png"), await image("still.gif", "two.gif")]);

  await expect
    .poll(() => window.location.pathname)
    .toBe("/edit/specs/drafts/git-listener/proposal.md");
  // The page at the new path replaces the one left, field included.
  await expect
    .poll(() => (screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement).value)
    .toContain("![one](images/one.webp)\n![two](images/two.webp)");
  expect(await commands.repoFileSize("specs/drafts/git-listener/images/two.webp")).toBeGreaterThan(
    0,
  );
  await expect
    .poll(() => commands.readRepo("specs/drafts/git-listener/proposal.md"))
    .toContain("![two](images/two.webp)");
});

test("a drop outside every field stays in the app", async () => {
  await show("/f/2026-10-06-recurring-tasks", "Recurring tasks");
  const dataTransfer = carrying([await image("phone.png")]);
  const init = { bubbles: true, cancelable: true, dataTransfer };
  document.body.dispatchEvent(new DragEvent("dragenter", init));
  const over = new DragEvent("dragover", init);
  document.body.dispatchEvent(over);

  // The browser drops a file only where `dragover` was cancelled. Its cursor, the drop effect, is
  // not set on a drag a script made: the page sets "none" here.
  expect(over.defaultPrevented).toBe(true);
  const event = new DragEvent("drop", init);
  document.body.dispatchEvent(event);

  // The browser opens a dropped file unless the page cancels the drop.
  expect(event.defaultPrevented).toBe(true);
  expect(window.location.pathname).toBe("/f/2026-10-06-recurring-tasks");
});

test("a file dragged over the editor shows it is taken", async () => {
  await editProposal();
  const dataTransfer = carrying([await image("phone.png")]);
  const init = { bubbles: true, cancelable: true, dataTransfer };
  document.body.dispatchEvent(new DragEvent("dragenter", init));
  const over = new DragEvent("dragover", init);
  document.body.dispatchEvent(over);

  expect(over.defaultPrevented).toBe(true);
  expect(await screen.findByText("Drop to add to proposal.md")).toBeTruthy();
  document.body.dispatchEvent(new DragEvent("dragleave", init));
});

test("SC-002: a 1440×900 screenshot is linked within a second of its drop", async () => {
  const field = await editProposal();
  cursorAt(field, TEXT.indexOf(LEAD) + LEAD.length);
  const file = await image("desktop.png", "desktop.png");

  const start = performance.now();
  drop([file]);
  await expect
    .poll(() => field.value.includes("![desktop](images/desktop.webp)"), { interval: 10 })
    .toBe(true);

  expect(performance.now() - start).toBeLessThan(1000);
  await saved("![desktop](images/desktop.webp)");
});

/** Review focus 8 and R44: typing at the cursor itself goes after the links. */
test("text typed at the cursor during an upload goes after the link, saved once it ends", async () => {
  const held = holdUploads();
  const field = await editProposal();
  const at = TEXT.indexOf(LEAD) + LEAD.length;
  cursorAt(field, at);

  drop([await image("phone.png", "login.png")]);
  await expect.poll(() => held.waiting.length).toBe(1);
  await userEvent.keyboard("Then");
  // A save would have gone out 400 ms after the typing stopped.
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  expect(await commands.readRepo(PROPOSAL)).toBe(TEXT);
  await held.release();

  const linked = TEXT.replace(`${LEAD}\n\n`, `${LEAD}\n\n![login](images/login.webp)\n\nThen\n\n`);
  await expect.poll(() => field.value).toBe(linked);
  await expect.poll(() => commands.readRepo(PROPOSAL), { timeout: 10_000 }).toBe(linked);
});

/** Review: a field drawn again has no cursor the human chose, as one never focused (R44). */
test("a drop after the preview goes to the end of the text", async () => {
  const field = await editProposal();
  cursorAt(field, TEXT.indexOf(LEAD) + LEAD.length);
  await userEvent.click(screen.getByRole("button", { name: "Preview" }));
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  const again = screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement;

  drop([await image("phone.png", "login.png")]);

  await expect.poll(() => again.value).toBe(`${TEXT}\n![login](images/login.webp)\n`);
  await saved("![login](images/login.webp)");
});

/** Review: the alt text is selected only in a field drawn, never later, when it shows again. */
test("a link added while the preview shows does not take the focus later", async () => {
  const held = holdUploads();
  const field = await editProposal();
  cursorAt(field, TEXT.indexOf(LEAD) + LEAD.length);

  drop([await image("phone.png", "login.png")]);
  await expect.poll(() => held.waiting.length).toBe(1);
  await userEvent.click(screen.getByRole("button", { name: "Preview" }));
  await held.release();
  await saved("![login](images/login.webp)");
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));

  expect(document.activeElement).not.toBe(screen.getByRole("textbox", { name: "Text" }));
});

/** Review: an office suite copies a picture of the text with the text, which is what is pasted. */
test("a paste of text with a picture of it is a paste of text", async () => {
  const field = await editProposal();
  cursorAt(field, 0);
  const clipboardData = carrying([await image("phone.png", "image.png")]);
  clipboardData.setData("text/plain", "Copied cells");
  const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData });

  field.dispatchEvent(event);

  // The browser pastes the text unless the page cancels the paste.
  expect(event.defaultPrevented).toBe(false);
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(screen.queryAllByText(/Adding pasted image/)).toEqual([]);
  expect(await commands.repoFileSize("specs/drafts/login-banner/images")).toBe(-1);
});

test("a paste of an image with markup holding only it is a paste of the image", async () => {
  const field = await editProposal();
  cursorAt(field, TEXT.indexOf(LEAD) + LEAD.length);
  const clipboardData = carrying([await image("phone.png", "image.png")]);
  clipboardData.setData("text/html", '<meta charset="utf-8"><img src="https://example.com/a.png">');

  field.dispatchEvent(
    new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }),
  );

  await expect
    .poll(() => field.value)
    .toMatch(/!\[pasted image\]\(images\/pasted-\d{8}-\d{6}\.webp\)/);
  await saved("![pasted image]");
});

/** Review: a field's text has LF line breaks, and its cursor counts them so. */
test("a drop in a file with CRLF line breaks is linked at the cursor", async () => {
  await commands.writeRepo(TEXT.replaceAll("\n", "\r\n"), PROPOSAL);
  await show(`/edit/${PROPOSAL}`, "Login error banner");
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  const field = screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement;
  cursorAt(field, TEXT.indexOf(LEAD) + LEAD.length);

  drop([await image("phone.png", "login.png")]);

  const linked = TEXT.replace(`${LEAD}\n\n`, `${LEAD}\n\n![login](images/login.webp)\n\n`);
  await expect.poll(() => field.value).toBe(linked);
  // Saved as the field holds it, with LF line breaks, as typing saves it (R50).
  await expect.poll(() => commands.readRepo(PROPOSAL), { timeout: 10_000 }).toBe(linked);
});

test("a refusal stays shown over the images added after it", async () => {
  const field = await editProposal();
  cursorAt(field, TEXT.indexOf(LEAD) + LEAD.length);

  drop([await image("drawing.svg", "diagram.svg"), await image("phone.png", "login.png")]);

  await expect.poll(() => field.value).toContain("![login](images/login.webp)");
  expect(shown(SVG_REFUSED)).toHaveLength(1);
  expect(shown("Added login.webp")).toEqual([]);
  await saved("![login](images/login.webp)");
});

/** Review: the page at a moved draft's new path shows the status its old page left. */
test("a refusal after a draft moved shows at its new path", async () => {
  await show("/edit/specs/drafts/git-listener.md", "Git listener process");
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));

  drop([await image("phone.png", "one.png"), await image("drawing.svg", "diagram.svg")]);

  await expect
    .poll(() => window.location.pathname)
    .toBe("/edit/specs/drafts/git-listener/proposal.md");
  // The page at the new path, whose field holds the link.
  await expect
    .poll(() => (screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement).value)
    .toContain("![one](images/one.webp)");
  expect(shown(SVG_REFUSED)).toHaveLength(1);
  await expect
    .poll(() => commands.readRepo("specs/drafts/git-listener/proposal.md"))
    .toContain("![one](images/one.webp)");
});
