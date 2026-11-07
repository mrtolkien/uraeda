// Mockups of the global undo (specs/2026-11-07-global-undo): a delete that goes at once, with the
// toast's Undo; the toast an undo shows, with its Redo, and `U` in the status line while there is
// something to redo; the question an undo asks once its action was committed; and an undo refused
// because what it would restore changed since.
import { Button } from "@astryxdesign/core/Button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createElement, useEffect } from "react";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { ConfirmHost, useConfirm } from "../fields/Confirm.tsx";
import { Home } from "../Home.tsx";
import { KeyCap } from "../keys/KeyCap.tsx";
import { useKeys } from "../keys/registry.tsx";
import { Shell } from "../Shell.tsx";
import { showPageError } from "./useUndoToast.ts";
import { useTimedToast } from "./useTimedToast.tsx";

/** How long a mockup's toast stays: long enough to review it, where the app's stays 5 seconds. */
const REVIEW_MS = 600_000;

/** A toast as the undo stack shows it: what happened, and one button with its key. */
function useMockToast(body: string, label: string, key: string) {
  const showToast = useTimedToast();
  useEffect(() => {
    showToast({
      autoHideDuration: REVIEW_MS,
      body,
      endContent: createElement(Button, {
        endContent: createElement(KeyCap, null, key),
        label,
        variant: "ghost",
      }),
    });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, as the action shows it
  }, []);
}

/** `d` on "Color themes" in Next: the line goes at once, and the toast offers its Undo. */
function Deleted() {
  useMockToast("Deleted “Color themes” · waits on the Git page", "Undo", "u");
  return null;
}

/**
 * `u` after it: the line is back in Next, selected, and the toast says what came back, with Redo.
 * `U` shows in the status line while there is something to redo.
 */
function Undone() {
  useKeys([{ hint: "U", keys: "U", label: "redo", run: () => undefined }], "shell");
  useMockToast("Undone: deleted “Color themes”", "Redo", "U");
  return null;
}

/** `u` on a move committed since on the Git page: the undo would be a new change, so it asks. */
function AskCommitted() {
  const confirm = useConfirm();
  useEffect(() => {
    void confirm({
      body: "Moved “Color themes” to Now",
      cancel: "Keep it",
      confirm: "Undo",
      detail:
        "This change was committed since. Undoing it writes the reverse as a new change, which waits on the Git page.",
      title: "Undo a committed change?",
    });
  }, [confirm]);
  return null;
}

/** `u` once "Color themes" was edited elsewhere: nothing changes, and the page says why. */
function Refused() {
  useEffect(() => {
    showPageError("Could not undo: “Color themes” changed since in PRIORITIES.md.");
  }, []);
  return null;
}

/** The shell around the home, with one of the states above over it, inside the shell's keys. */
function UndoState({ state }: { state: "deleted" | "undone" | "committed" | "refused" }) {
  return (
    <ConfirmHost>
      <Shell>
        <Home />
        {state === "deleted" && <Deleted />}
        {state === "undone" && <Undone />}
        {state === "committed" && <AskCommitted />}
        {state === "refused" && <Refused />}
      </Shell>
    </ConfirmHost>
  );
}

const meta = {
  args: { state: "deleted" },
  component: UndoState,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Mockups/Global undo",
} satisfies Meta<typeof UndoState>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A delete goes at once, without a question: the toast's Undo, or `u`, brings it back. */
export const DeletedAtOnce: Story = {};

/** After `u`: what came back, with Redo, and `U redo` in the status line. */
export const UndoneWithRedo: Story = { args: { state: "undone" } };

/** `u` on a change committed since asks first. */
export const UndoCommitted: Story = { args: { state: "committed" } };

/** An undo refused because what it would restore changed since. */
export const UndoRefused: Story = { args: { state: "refused" } };
