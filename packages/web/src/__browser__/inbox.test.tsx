// US1 and SC-001 of the inbox at both sizes: a note added from the sidebar's ＋ with the text and
// Enter, in a dialog on wide screens and a bottom sheet on narrow ones (the UI layout decision); and
// the inbox page, full and empty, passing the layout checks of the UI checks decision.
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atRepo, atSize, carrying, checkLayout, drawn, image, show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

const PATH = "specs/INBOX.md";
const narrow = () => window.innerWidth < 768;

atSize("both");

// The toasts' tests fake the page's clock: the next test has the real one.
afterEach(() => {
  vi.useRealTimers();
});

/**
 * Taps ＋ next to Inbox: in the navigation beside the page, or, on the phone, in its drawer, opened
 * from the menu first. Returns the form once drawn.
 */
async function openForm() {
  if (narrow()) {
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  }
  await userEvent.click(await screen.findByRole("button", { name: "Add a note to the inbox" }));
  const form = await screen.findByRole("dialog", { name: "Add a note" });
  await drawn();
  return form;
}

/** SC-001, on a wide screen, and US1 1: one tap on ＋, the text, and Enter. */
test("a note is added with ＋, its text, and Enter", async () => {
  await show("/inbox", "10 notes");
  const form = await openForm();
  // The phone's sheet takes the focus itself, as the keyboard would cover it: a tap on the field.
  if (narrow()) {
    await userEvent.click(within(form).getByPlaceholderText("What did you notice?"));
  }

  await userEvent.keyboard("The plan's task list scrolls under the top bar");
  await userEvent.keyboard("{Enter}");

  await expect
    .poll(() => commands.readRepo(PATH))
    .toContain("- We need a home icon\n- The plan's task list scrolls under the top bar\n");
  await expect.poll(() => screen.queryByRole("dialog", { name: "Add a note" })).toBeNull();
  const none = within(screen.getByRole("list", { name: "No category" }));
  expect(await none.findByText("The plan's task list scrolls under the top bar")).toBeTruthy();
  expect(await screen.findByText("11 notes")).toBeTruthy();
});

/** The UI layout decision: a short form is a dialog on wide screens, a bottom sheet on narrow ones. */
test("the add form is a dialog on wide screens and a sheet on narrow ones", async () => {
  await show("/", "Waiting on you");
  const form = await openForm();

  await expect
    .poll(() => {
      const box = form.getBoundingClientRect();
      return narrow()
        ? Math.round(box.bottom) === window.innerHeight &&
            Math.round(box.width) === window.innerWidth
        : box.width > 0 &&
            box.width < window.innerWidth / 2 &&
            Math.abs((box.top + box.bottom) / 2 - window.innerHeight / 2) < 2;
    })
    .toBe(true);
  expect(within(form).getByRole("button", { name: "Close" })).toBeTruthy();
  expect(within(form).getByRole("combobox", { name: "Category" }).textContent).toContain(
    "No category",
  );
  await checkLayout(form);
});

test("the inbox page passes the layout checks", async () => {
  await show("/inbox", "10 notes");
  await checkLayout();
});

test("the empty inbox passes the layout checks", async () => {
  await commands.writeRepo("# Inbox\n", PATH);
  await show("/inbox", "The inbox is empty.");
  await checkLayout();
});

/**
 * SC-003, and the UI layout decision: three taps from the inbox page move a note to Next: the note,
 * Move to priorities, the section. On wide screens the note opens in the pane beside the inbox, at
 * its own URL; on narrow screens, as its own page.
 */
test("three taps from the inbox move a note to Next", async () => {
  await show("/inbox", "10 notes");

  await userEvent.click(screen.getByRole("link", { name: /Draft to proposal on mobile went 404/ }));
  await expect
    .poll(() => window.location.pathname)
    .toBe(atRepo("/inbox/draft-to-proposal-on-mobile-went-404"));
  expect(await screen.findByText("Note, in UI")).toBeTruthy();
  // Beside the inbox on wide screens; alone on narrow ones.
  expect(screen.queryByRole("heading", { level: 1, name: "Inbox" }) === null).toBe(narrow());
  await userEvent.click(screen.getByRole("button", { name: "Move to priorities" }));
  // A menu on wide screens; on narrow ones, a sheet of buttons.
  await userEvent.click(
    await screen.findByRole(narrow() ? "button" : "menuitem", { name: "Next" }),
  );

  await expect
    .poll(() => commands.readRepo("specs/PRIORITIES.md"))
    .toContain("- Draft to proposal on mobile went 404\n\n## Later");
  await expect.poll(() => commands.readRepo(PATH)).not.toContain("Draft to proposal");
  // The note gone, the inbox shows again: a test ending before would see its address change.
  await expect.poll(() => window.location.pathname).toBe(atRepo("/inbox"));
});

test("a note's view passes the layout checks", async () => {
  await show("/inbox/in-failures-the-x-is-not-centered-in-the-circle", "Note, in UI");
  await checkLayout();
});

const NOTE = "The spec page's headings are body-sized";
/** `slug::from_text`'s rule, as `ura draft` names drafts: the apostrophe is a hyphen. */
const SLUG = "the-spec-page-s-headings-are-body-sized";
const DRAFT = `specs/drafts/${SLUG}/proposal.md`;

/** Picks an image with "Attach an image", as the system's picker gives it. */
function attachImage(form: HTMLElement, file: File) {
  const input = within(form).getByLabelText("Attach an image", {
    selector: "input",
  }) as HTMLInputElement;
  input.files = carrying([file]).files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Types a note in the open form, tapping its field first, as the phone's sheet asks. */
async function typeNote(form: HTMLElement, text: string) {
  await userEvent.click(within(form).getByPlaceholderText("What did you notice?"));
  await userEvent.keyboard(text);
}

/**
 * US6 1 and 2, and the attachments decision: with an image, the button says the note becomes a
 * draft; the draft holds the note and the image, re-encoded in its `images/`, and the inbox links
 * it under UI.
 */
test("a note with an image is added as a draft that holds it, linked from the inbox", async () => {
  await show("/inbox", "10 notes");
  const form = await openForm();
  await typeNote(form, NOTE);
  await userEvent.click(within(form).getByRole("combobox", { name: "Category" }));
  await userEvent.click(await screen.findByRole("option", { name: "UI" }));

  attachImage(form, await image("phone.png", "spec-headings.png"));

  expect(await within(form).findByText("spec-headings.png")).toBeTruthy();
  expect(
    within(form).getByText("With an image, the note is saved as a draft, linked from the inbox."),
  ).toBeTruthy();
  expect(within(form).queryByRole("button", { name: "Add" })).toBeNull();
  await checkLayout(form);
  await userEvent.click(within(form).getByRole("button", { name: "Add as a draft" }));

  expect(await screen.findByText("Added to the inbox as a draft, not committed")).toBeTruthy();
  await expect
    .poll(() => commands.readRepo(DRAFT))
    .toContain(`## What\n\n${NOTE}\n\n![spec-headings](images/spec-headings.webp)\n\n## Why`);
  expect(
    await commands.repoFileSize(`specs/drafts/${SLUG}/images/spec-headings.webp`),
  ).toBeGreaterThan(0);
  expect(await commands.readRepo(PATH)).toContain(
    `- Text input feels laggy on the sessions page\n- [${NOTE}](drafts/${SLUG}/proposal.md)\n\n## CLI`,
  );
  await expect.poll(() => screen.queryByRole("dialog", { name: "Add a note" })).toBeNull();
});

/** US6 3: the linked note, moved to Next, keeps its link there, as an entry linking a draft does. */
test("a note linking a draft keeps its link once moved to Next", async () => {
  const inbox = await commands.readRepo(PATH);
  await commands.writeRepo(`# ${NOTE}\n\n## What\n\n${NOTE}\n`, DRAFT);
  const laggy = "- Text input feels laggy on the sessions page\n";
  await commands.writeRepo(
    inbox.replace(laggy, `${laggy}- [${NOTE}](drafts/${SLUG}/proposal.md)\n`),
    PATH,
  );
  await show("/inbox", "11 notes");

  // The row is the note's one link: its draft's link does not nest in it.
  await userEvent.click(screen.getByRole("link", { name: new RegExp(NOTE) }));
  await userEvent.click(await screen.findByRole("button", { name: "Move to priorities" }));
  await userEvent.click(
    await screen.findByRole(narrow() ? "button" : "menuitem", { name: "Next" }),
  );

  await expect
    .poll(() => commands.readRepo("specs/PRIORITIES.md"))
    .toContain(`- [${NOTE}](drafts/${SLUG}/proposal.md)\n\n## Later`);
  await expect.poll(() => window.location.pathname).toBe(atRepo("/inbox"));
});

/**
 * An image the core refuses: the form shows the core's message, as image attachments do, and the
 * note keeps its text; nothing is left in the inbox or the drafts.
 */
test("an image the core refuses shows its message, and the note keeps its text", async () => {
  const inbox = await commands.readRepo(PATH);
  await show("/inbox", "10 notes");
  const form = await openForm();
  await typeNote(form, "Headings are flat");

  attachImage(form, await image("drawing.svg", "diagram.svg"));
  await userEvent.click(within(form).getByRole("button", { name: "Add as a draft" }));

  expect(
    await within(form).findByText(
      "Only PNG, JPEG, GIF, and WebP images can be added: diagram.svg is not one.",
    ),
  ).toBeTruthy();
  expect(within(form).getByPlaceholderText("What did you notice?")).toHaveProperty(
    "value",
    "Headings are flat",
  );
  await expect.poll(() => commands.readRepo(PATH)).toBe(inbox);
  // The core takes the note out, then its draft.
  await expect.poll(() => commands.repoFileSize("specs/drafts/headings-are-flat.md")).toBe(-1);
  expect(await commands.repoFileSize("specs/drafts/headings-are-flat")).toBe(-1);
});

/**
 * Ruling R21 and the UI behaviour decision: Remove drops the image, and Add is back; Cancel with
 * only an image asks first.
 */
test("Remove drops the image, and Cancel asks first with only an image", async () => {
  await show("/inbox", "10 notes");
  const form = await openForm();
  attachImage(form, await image("phone.png", "spec-headings.png"));

  await userEvent.click(
    await within(form).findByRole("button", { name: "Remove spec-headings.png" }),
  );

  expect(within(form).queryByText("spec-headings.png")).toBeNull();
  expect(within(form).getByRole("button", { name: "Add" })).toBeTruthy();
  attachImage(form, await image("phone.png", "spec-headings.png"));
  await within(form).findByText("spec-headings.png");
  await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));
  const confirm = await screen.findByRole("dialog", { name: "Discard your changes?" });
  await userEvent.click(within(confirm).getByRole("button", { name: "Discard" }));
  await expect.poll(() => screen.queryByRole("dialog", { name: "Add a note" })).toBeNull();
});

/** The toast's Undo of a note added with an image takes the note out, with its draft. */
test("Undo of a note added with an image takes it out, with its draft", async () => {
  const inbox = await commands.readRepo(PATH);
  await show("/inbox", "10 notes");
  const form = await openForm();
  await typeNote(form, NOTE);
  attachImage(form, await image("phone.png", "spec-headings.png"));
  await userEvent.click(await within(form).findByRole("button", { name: "Add as a draft" }));
  await expect.poll(() => commands.repoFileSize(DRAFT)).toBeGreaterThan(0);

  await userEvent.click(await screen.findByRole("button", { name: "Undo" }));

  await expect.poll(() => commands.readRepo(PATH)).toBe(inbox);
  await expect.poll(() => commands.repoFileSize(`specs/drafts/${SLUG}`)).toBe(-1);
});

/**
 * A button once it shows, waited for by Vitest's own clock: Testing Library's `findBy` waits on the
 * page's `setTimeout`, which the toasts' tests fake.
 */
async function button(name: string) {
  await expect.poll(() => screen.queryByRole("button", { name })).not.toBeNull();
  return screen.getByRole("button", { name });
}

// Review focus 2. On the desktop: on the phone, the toast lies over Commit and Discard, and a click
// reaches them only once it has closed by itself.
describe("on the desktop, the inbox's toasts", () => {
  atSize("desktop");

  test("committing closes the toasts", async () => {
    await show("/inbox/draft-to-proposal-on-mobile-went-404", "Note, in UI");
    // The page's clock is the test's, never advanced: the toast cannot close by itself, after its 5
    // seconds, so only the commit can close it.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await button("Undo");

    await userEvent.click(await button("Commit"));

    await expect.poll(() => screen.queryByRole("button", { name: "Undo" })).toBeNull();
    await expect.poll(() => screen.queryByRole("button", { name: "Commit" })).toBeNull();
  });

  test("discarding closes the toasts", async () => {
    const original = await commands.readRepo(PATH);
    await show("/inbox/draft-to-proposal-on-mobile-went-404", "Note, in UI");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await button("Undo");

    await userEvent.click(await button("Discard"));
    await userEvent.click(await button("Discard them"));

    // Discarded: the note is back, and no Undo is left to insert it a second time.
    await expect.poll(() => commands.readRepo(PATH)).toBe(original);
    await expect.poll(() => screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });
});
