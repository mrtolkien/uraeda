// The UI behaviour decision: every sheet and dialog has a visible close button, and Back closes it;
// the UI layout decision: a confirmation is a dialog on wide screens and a sheet on the phone.
import { Button } from "@astryxdesign/core/Button";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { ConfirmHost, useConfirm } from "../fields/Confirm.tsx";
import { atWidth } from "./helpers.tsx";

const QUESTION = {
  body: "The text you typed is deleted.",
  cancel: "Keep editing",
  confirm: "Discard",
  title: "Discard your comment?",
};

/** A button that asks, and the answers it got, in order. */
function Asker({ answers }: { answers: Array<boolean> }) {
  const confirm = useConfirm();
  return (
    <Button label="Cancel" onClick={() => confirm(QUESTION).then((yes) => answers.push(yes))} />
  );
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

/** Opens the confirmation, at a width, and returns the answers it will get. */
async function ask(width: number): Promise<Array<boolean>> {
  atWidth(width);
  const answers: Array<boolean> = [];
  render(
    <ConfirmHost>
      <Asker answers={answers} />
    </ConfirmHost>,
  );
  await click(screen.getByRole("button", { name: "Cancel" }));
  await screen.findByRole("dialog", { name: QUESTION.title });
  return answers;
}

const gone = () =>
  waitFor(() => expect(screen.queryByRole("dialog", { name: QUESTION.title })).toBeNull());

test.each([
  ["on the phone", 402],
  ["on a wide screen", 1440],
])("a confirmation has a visible Close, which answers no, %s", async (_, width) => {
  const answers = await ask(width);
  await click(screen.getByRole("button", { name: "Close" }));
  await gone();
  await waitFor(() => expect(answers).toEqual([false]));
});

test("Back closes a confirmation, which answers no", async () => {
  const answers = await ask(1440);
  await act(async () => window.history.back());
  await gone();
  await waitFor(() => expect(answers).toEqual([false]));
});

test.each([
  ["Discard", true],
  ["Keep editing", false],
])("%s answers %s, and takes the confirmation's history entry", async (label, answer) => {
  const answers = await ask(402);
  await click(screen.getByRole("button", { name: label }));
  await gone();
  await waitFor(() => expect(answers).toEqual([answer]));
  expect((window.history.state as { overlay?: string } | null)?.overlay).toBeUndefined();
});
