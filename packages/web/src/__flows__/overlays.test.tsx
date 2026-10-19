// Flow: sheets and dialogs. Each has a visible Close and Back closes it, a confirmation answers no
// to either, and a yes or a no takes the confirmation's history entry with it. The confirmation is
// a dialog on wide screens and a sheet on the phone: both are asked for by role.
import { Button } from "@astryxdesign/core/Button";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vite-plus/test";
import { ConfirmHost, useConfirm } from "../fields/Confirm.tsx";
import { Overlay } from "../layout/Overlay.tsx";
import { atWidth, DESKTOP, PHONE } from "./harness.tsx";

afterEach(() => {
  cleanup();
  atWidth(DESKTOP);
});

const QUESTION = { body: "Typed text goes.", cancel: "Keep", confirm: "Discard", title: "Sure?" };

/** A button that asks, and the answers it got, in order. */
function Asker({ answers }: { answers: Array<boolean> }) {
  const confirm = useConfirm();
  return (
    <Button label="Cancel" onClick={() => confirm(QUESTION).then((yes) => answers.push(yes))} />
  );
}

async function tap(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

/** Opens a confirmation at a width, and returns the answers it will get. */
async function ask(width: number): Promise<Array<boolean>> {
  atWidth(width);
  const answers: Array<boolean> = [];
  render(
    <ConfirmHost>
      <Asker answers={answers} />
    </ConfirmHost>,
  );
  await tap(screen.getByRole("button", { name: "Cancel" }));
  await screen.findByRole("dialog");
  return answers;
}

const gone = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

test.each([PHONE, DESKTOP])(
  "a confirmation has a visible Close, which answers no, at %i px",
  async (width) => {
    const answers = await ask(width);

    await tap(screen.getByRole("button", { name: "Close" }));

    await gone();
    await waitFor(() => expect(answers).toEqual([false]));
  },
);

test("Back closes a confirmation, which answers no", async () => {
  const answers = await ask(DESKTOP);

  await act(async () => window.history.back());

  await gone();
  await waitFor(() => expect(answers).toEqual([false]));
});

test.each([
  ["Discard", true],
  ["Keep", false],
])("%s answers %s, and takes the confirmation's history entry", async (label, answer) => {
  const answers = await ask(PHONE);

  await tap(screen.getByRole("button", { name: label }));

  await gone();
  await waitFor(() => expect(answers).toEqual([answer]));
  expect((window.history.state as { overlay?: string } | null)?.overlay).toBeUndefined();
});

/** An overlay its page renames while open, as a new title does. */
function Renamed() {
  const [open, setOpen] = useState(true);
  const [label, setLabel] = useState("First");
  return (
    <Overlay isOpen={open} label={label} onClose={() => setOpen(false)}>
      <Button label="Rename" onClick={() => setLabel("Second")} />
    </Overlay>
  );
}

test("an overlay has a visible Close and Back closes it, though renamed while open, with one entry", async () => {
  render(<Renamed />);
  await tap(screen.getByRole("button", { name: "Rename" }));
  expect(screen.getByRole("dialog", { name: "Second" })).toBeTruthy();

  await act(async () => window.history.back());

  await gone();
  expect((window.history.state as { overlay?: string } | null)?.overlay).toBeUndefined();

  cleanup();
  render(<Renamed />);
  await tap(screen.getByRole("button", { name: "Close" }));
  await gone();
});
