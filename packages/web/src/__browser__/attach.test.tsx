// US1 scenarios 1, 2 and 8, and the edge cases of drops: images dropped anywhere on the editor's
// page or pasted, saved by the core, and linked at the cursor. A chat's message not read yet has
// its images dimmed. US3 scenarios 1 and 2, US4 scenarios 1 and 2: review comments, answers, and
// notes take images too. On the phone: the drops and pastes do not depend on the layout.
// Files come from `fixtures/images/`, dropped and pasted through an in-page `DataTransfer`.
import { screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atRepo, atSize, carrying, drop, image, LIVE, paste, show, startTurn } from "./helpers.tsx";

atSize("phone");

const commands = browserCommands as unknown as RepoCommands;

/** The elements showing a text on the page, not in the screen reader's announcements. */
function shown(text: string) {
  return screen
    .queryAllByText(text)
    .filter((element) => !element.closest("[data-astryx-live-region]"));
}

const SVG_REFUSED = "Only PNG, JPEG, GIF, and WebP images can be added: diagram.svg is not one.";

/** The address a request goes to. */
const urlOf = (input: RequestInfo | URL) =>
  typeof input === "object" && "url" in input ? input.url : input.toString();

const realFetch = globalThis.fetch;

/**
 * Counts the uploads and the text saves the page sends; `hold` keeps each upload until the test lets
 * it through, to see what happens during one.
 */
function watchRequests({ hold }: { hold: boolean }) {
  const waiting: Array<() => void> = [];
  const sent = { saves: 0, uploads: 0 };
  globalThis.fetch = async (input, init) => {
    if (urlOf(input).includes("/attach?")) {
      sent.uploads += 1;
      if (hold) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
    } else if (typeof init?.body === "string" && init.body.includes('"text.save"')) {
      sent.saves += 1;
    }
    return realFetch(input, init);
  };
  return {
    sent,
    waiting,
    /** Lets the next upload through, once it waits. */
    async release() {
      await expect.poll(() => waiting.length).toBeGreaterThan(0);
      waiting.shift()!();
    },
  };
}

/** Holds the page's uploads until the test lets each one through: what happens during one. */
const holdUploads = () => watchRequests({ hold: true });

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
    .toBe(atRepo("/edit/specs/drafts/git-listener/proposal.md"));
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
  expect(window.location.pathname).toBe(atRepo("/f/2026-10-06-recurring-tasks"));
});

/** Review focus 8 and R44: typing at the cursor itself goes after the links. */
test("text typed at the cursor during an upload goes after the link, saved once it ends", async () => {
  const held = holdUploads();
  const field = await editProposal();
  const at = TEXT.indexOf(LEAD) + LEAD.length;
  cursorAt(field, at);

  drop([await image("phone.png", "login.png")]);
  await expect.poll(() => held.waiting.length).toBe(1);
  // The test sets the clock: a save would go out 400 ms after the typing stopped.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await userEvent.keyboard("Then");
    await vi.advanceTimersByTimeAsync(1000);
    // A save's request is sent a few promises after its timer: by the next frame.
    await new Promise((resolve) => requestAnimationFrame(resolve));
  } finally {
    vi.useRealTimers();
  }
  expect(held.sent.saves).toBe(0);
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
  const { sent } = watchRequests({ hold: false });
  const field = await editProposal();
  cursorAt(field, 0);
  const clipboardData = carrying([await image("phone.png", "image.png")]);
  clipboardData.setData("text/plain", "Copied cells");
  const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData });

  field.dispatchEvent(event);

  // The browser pastes the text unless the page cancels the paste.
  expect(event.defaultPrevented).toBe(false);
  // A paste of the image alone after it: its link shows once every upload before it was sent.
  paste([await image("phone.png", "image.png")], field);
  await expect.poll(() => field.value).toMatch(/^!\[pasted image\]/);
  expect(sent.uploads).toBe(1);
  await saved("![pasted image]");
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
    .toBe(atRepo("/edit/specs/drafts/git-listener/proposal.md"));
  // The page at the new path, whose field holds the link.
  await expect
    .poll(() => (screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement).value)
    .toContain("![one](images/one.webp)");
  expect(shown(SVG_REFUSED)).toHaveLength(1);
  await expect
    .poll(() => commands.readRepo("specs/drafts/git-listener/proposal.md"))
    .toContain("![one](images/one.webp)");
});

/** Waits for the composer's thumbnails, each saved: Send takes a message of images then. */
async function thumbnails(count: number) {
  await expect
    .poll(() => screen.queryAllByRole("button", { name: /^Remove / }).length, { timeout: 10_000 })
    .toBe(count);
  await expect
    .poll(() => screen.getByRole("button", { name: "Send" }).hasAttribute("disabled"), {
      timeout: 10_000,
    })
    .toBe(false);
}

const SESSION = "/f/2026-10-12-cli-tuis/session";

/** Pastes images in the composer and sends them with a text, once saved. */
async function sendImages(files: Array<File>, text: string) {
  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  const sent = (await commands.agentSent()).length;
  paste(files, box);
  await thumbnails(files.length);
  await userEvent.fill(box, text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  await expect.poll(async () => (await commands.agentSent()).length, LIVE).toBe(sent + 1);
}

test("a message not read yet has its images dimmed, as its text", async () => {
  await show(SESSION, "Message Claude Code");
  await startTurn("Plan the CLI.", [{ text: "Reading the plan.", type: "text" }]);

  await sendImages([await image("phone.png", "one.png")], "This one.");

  const log = await screen.findByRole("log", { name: "Conversation" });
  await within(log).findByText("Not read yet", undefined, LIVE);
  const link = within(log).getByRole("link", { name: "Image" });
  await expect.poll(() => Number(getComputedStyle(link.parentElement!).opacity)).toBeLessThan(1);
});

const REVIEWED = "2026-10-06-recurring-tasks";
/** The reviewed feature's folder, in the worktree its review writes to. */
const REVIEW_FOLDER = `.worktrees/${REVIEWED}/specs/${REVIEWED}`;

/** The spec of the recurring tasks, under review. */
async function reviewSpec() {
  await show(`/f/${REVIEWED}/spec.md`, "Complete a repeating task");
}

/** The comment form's text field, wherever the page shows it. */
async function commentField() {
  const form = await screen.findByRole("form", { name: "Comment" });
  return within(form).getByRole("textbox", { name: "Comment text" }) as HTMLTextAreaElement;
}

test("US3.1: a drop on the review page opens a general comment holding its link", async () => {
  await reviewSpec();

  drop([await image("phone.png", "shot.png")]);

  const field = await commentField();
  await expect.poll(() => field.value).toBe("![shot](images/shot.webp)\n");
  expect(screen.getByText("General")).toBeTruthy();
  expect(selected(field)).toBe("shot");
  expect(await commands.repoFileSize(`${REVIEW_FOLDER}/images/shot.webp`)).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Add image" })).toBeTruthy();
});

test("US3.2: a pasted image goes to the open line comment at its cursor", async () => {
  await reviewSpec();
  // The scenarios are folded: US2's open first.
  const scenarios = screen
    .getAllByRole("button", { name: "Scenarios (4)" })
    .find((b) => b.hasAttribute("aria-expanded")) as HTMLElement;
  await userEvent.click(scenarios);
  const block = screen
    .getAllByRole("button", { name: (name) => name.includes("Given a weekly task") })
    .find((b) => b.hasAttribute("aria-pressed")) as HTMLElement;
  await userEvent.click(block, { force: true });
  const field = await commentField();
  await userEvent.fill(field, "Before after");
  cursorAt(field, "Before".length);

  paste([await image("phone.png", "image.png")], field);

  await expect
    .poll(() => field.value)
    .toMatch(/^Before\n\n!\[pasted image\]\(images\/pasted-\d{8}-\d{6}\.webp\)\n\n after$/);
  expect(selected(field)).toBe("pasted image");
  expect(screen.getByText(/^Lines? \d+/)).toBeTruthy();
});

const ROUND = "2026-10-11-web-ui";
const ROUND_FILE = `.worktrees/${ROUND}/specs/${ROUND}/clarifications-01.md`;

/** The web UI's round of questions, awaiting answers. */
async function showRound() {
  await show(`/f/${ROUND}/clarifications-01.md`, "How does your iPhone reach the server?");
}

test("US4.1: a pasted image goes into the focused answer's comment", async () => {
  await showRound();
  const q3 = document.getElementById("Q3")!;
  const field = within(q3).getByRole("textbox", {
    name: "Comment, or your own answer instead of a letter",
  }) as HTMLTextAreaElement;
  await userEvent.click(field);

  paste([await image("phone.png", "image.png")], field);

  await expect
    .poll(() => field.value)
    .toMatch(/^!\[pasted image\]\(images\/pasted-\d{8}-\d{6}\.webp\)\n$/);
  // The answer holds its link at once, as an image added to a file does.
  await expect
    .poll(() => commands.readRepo(ROUND_FILE), { timeout: 10_000 })
    .toMatch(/## Q3[\s\S]*\*\*Answer:\*\* !\[pasted image\]\(images\/pasted-\d{8}-\d{6}\.webp\)/);
});

test("US4.2: a drop with no field focused goes to the end of the notes", async () => {
  await showRound();
  const notes = screen.getByRole("textbox", { name: "Notes" }) as HTMLTextAreaElement;

  drop([await image("phone.png", "shot.png")]);

  await expect.poll(() => notes.value).toBe("![shot](images/shot.webp)\n");
  expect(
    await commands.repoFileSize(`.worktrees/${ROUND}/specs/${ROUND}/images/shot.webp`),
  ).toBeGreaterThan(0);
  await expect
    .poll(() => commands.readRepo(ROUND_FILE), { timeout: 10_000 })
    .toContain("![shot](images/shot.webp)");
});
