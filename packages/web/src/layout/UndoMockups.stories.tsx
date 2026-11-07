// The states of the global undo (specs/done/2026-11-07-global-undo.md), drawn by the undo stack itself over
// the home: a delete's toast, with Undo; the toast an undo shows, with its Redo, and `U` in the
// status line while there is something to redo; the question an undo asks once its action was
// committed; and an undo refused because what it would restore changed since. Each records an
// entry that writes nothing, then presses `u` as the keyboard would.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { ConfirmHost } from "../fields/Confirm.tsx";
import { Home } from "../Home.tsx";
import { pressKeys } from "../keys/press.ts";
import { localPath, useRepository } from "../routes.tsx";
import { Shell } from "../Shell.tsx";
import { type UndoEntry, undoStack } from "../undo/stack.ts";
import { useUndo } from "../undo/useUndo.ts";

type State = "deleted" | "undone" | "committed" | "refused";

/** "Color themes" deleted from Next, or moved, on the page open: its undo and redo write nothing. */
function actionOf(state: State, repo: string): UndoEntry {
  return {
    ...(state === "committed" ? { committed: async () => true } : {}),
    label: state === "committed" ? "Moved “Color themes” to Now" : "Deleted “Color themes”",
    place: { path: localPath(window.location.pathname), repo },
    redo: async () => undefined,
    undo: async () =>
      state === "refused"
        ? "Could not undo: “Color themes” changed since in PRIORITIES.md."
        : undefined,
  };
}

/** Records the action, then, but for the delete's own toast, presses `u`. */
function Acting({ state }: { state: State }) {
  const record = useUndo();
  const repo = useRepository();
  useEffect(() => {
    undoStack.clear();
    record(actionOf(state, repo));
    if (state !== "deleted") {
      pressKeys("u");
    }
  }, [record, repo, state]);
  return null;
}

/** The shell around the home, with one of the states over it, inside the shell's keys. */
function UndoState({ state }: { state: State }) {
  return (
    <ConfirmHost>
      <Shell>
        <Home />
        <Acting state={state} />
      </Shell>
    </ConfirmHost>
  );
}

const meta = {
  args: { state: "deleted" },
  component: UndoState,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Global undo",
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
