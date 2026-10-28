// A category's delete asks in the app's one confirmation (`fields/Confirm.tsx`), with a third
// answer: Cancel first and focused, then "No, keep the notes", then the destructive "Yes, delete
// the notes". Each button and each key, `c`, `n`, and `y`, resolves the question with its answer,
// once the question's history entry is gone.
import { Button } from "@astryxdesign/core/Button";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { ConfirmHost, useConfirm } from "../fields/Confirm.tsx";
import { deleteCategory } from "../lists/CategoryPane.tsx";
import { atWidth } from "./helpers.tsx";

const TITLE = "Delete the category UI";

beforeEach(() => {
  atWidth(1440);
});

/** A button that asks the category UI's delete, holding three notes, and keeps what it answered. */
function Asker({ onAnswer }: { onAnswer: (answer: boolean | "keep") => void }) {
  const confirm = useConfirm();
  return (
    <Button
      label="Delete UI"
      onClick={() => void confirm(deleteCategory("UI", 3)).then(onAnswer)}
    />
  );
}

/** Opens the question, and returns its dialog and the answers it resolves with. */
async function ask() {
  const answers: Array<boolean | "keep"> = [];
  render(
    <ConfirmHost>
      <Asker onAnswer={(answer) => answers.push(answer)} />
      {/* What a destructive button looks like, to compare Yes with. */}
      <Button label="Reference" variant="destructive" />
    </ConfirmHost>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Delete UI" }));
  });
  return { answers, dialog: await screen.findByRole("dialog", { name: TITLE }) };
}

/** The dialog's answer buttons, in their order, by their words without their key. */
function answerButtons(dialog: HTMLElement) {
  return within(dialog)
    .getAllByRole("button")
    .filter((button) => !/close/i.test(button.getAttribute("aria-label") ?? button.textContent!));
}

test("the question asks about the notes, its answers Cancel, No, then a destructive Yes", async () => {
  const { dialog } = await ask();
  expect(within(dialog).getByText("Delete the 3 notes too?")).toBeTruthy();
  expect(
    within(dialog).getByText("No keeps the notes, in their order, under No category."),
  ).toBeTruthy();
  const buttons = answerButtons(dialog);
  expect(buttons.map((button) => button.textContent)).toEqual([
    "Cancelc",
    "No, keep the notesn",
    "Yes, delete the notesy",
  ]);
  // Cancel opens focused: Enter changes nothing.
  expect(buttons[0]!.hasAttribute("data-autofocus")).toBe(true);
  await waitFor(() => expect(document.activeElement).toBe(buttons[0]));
  // Yes is drawn as a destructive button is.
  const reference = screen.getByRole("button", { name: "Reference" });
  expect(buttons[2]!.className).toBe(reference.className);
  expect(buttons[0]!.className).not.toBe(reference.className);
});

test.each([
  ["Cancel", false],
  ["No, keep the notes", "keep"],
  ["Yes, delete the notes", true],
] as const)("%s answers %s", async (words, answer) => {
  const { answers, dialog } = await ask();
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(`^${words}`) }));
  });
  await waitFor(() => expect(answers).toEqual([answer]));
  expect(screen.queryByRole("dialog", { name: TITLE })).toBeNull();
});

test.each([
  ["c", false],
  ["n", "keep"],
  ["y", true],
] as const)("the key %s answers %s", async (key, answer) => {
  const { answers } = await ask();
  await act(async () => {
    fireEvent.keyDown(document.body, { key });
  });
  await waitFor(() => expect(answers).toEqual([answer]));
});
