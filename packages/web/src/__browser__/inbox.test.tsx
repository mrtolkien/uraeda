// US1 and SC-001 of the inbox at both sizes: a note added from the sidebar's ＋ with the text and
// Enter, in a dialog on wide screens and a bottom sheet on narrow ones (the UI layout decision); and
// the inbox page, full and empty, passing the layout checks of the UI checks decision.
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atRepo, atSize, checkLayout, drawn, show } from "./helpers.tsx";

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
