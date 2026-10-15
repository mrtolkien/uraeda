// US1 and SC-001 of the inbox at both sizes: a note added from the sidebar's ＋ with the text and
// Enter, in a dialog on wide screens and a bottom sheet on narrow ones (the UI layout decision); and
// the inbox page, full and empty, passing the layout checks of the UI checks decision.
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atSize, checkLayout, drawn, show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

const PATH = "specs/INBOX.md";
const narrow = () => window.innerWidth < 768;

atSize("both");

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
