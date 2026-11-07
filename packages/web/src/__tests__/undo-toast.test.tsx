// The toasts of the undo stack: an action's, with Undo and `u`; after an undo, what came back, with
// Redo and `U`, which the status line hints while there is something to redo; after a redo, what
// was redone, with Undo. On the phone the button hints no key. A timed toast, as each of them is,
// stays while the human is at it.
import { Button } from "@astryxdesign/core/Button";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { expect, test, vi } from "vite-plus/test";
import { KeysProvider, useHints } from "../keys/registry.tsx";
import { RESUME_MS, useTimedToast } from "../layout/useTimedToast.tsx";
import { localPath } from "../routes.tsx";
import { undoStack } from "../undo/stack.ts";
import { UndoKeys } from "../undo/UndoKeys.tsx";
import { useUndo } from "../undo/useUndo.ts";
import { atWidth } from "./helpers.tsx";

/** An action recorded once, "Deleted “Color themes”", here, and the status line's hints. */
function Acting({ redo, undo }: { redo: () => void; undo: () => void }) {
  const record = useUndo();
  const hints = useHints();
  useEffect(() => {
    record({
      label: "Deleted “Color themes”",
      // The page open: the undo selects in place, opening no page.
      place: { path: localPath(window.location.pathname) },
      redo: async () => {
        redo();
        return undefined;
      },
      undo: async () => {
        undo();
        return undefined;
      },
    });
  }, [record, redo, undo]);
  return (
    <ul aria-label="Status line">
      {hints.map((hint) => (
        <li key={hint.keys}>{`${hint.keys} ${hint.label}`}</li>
      ))}
    </ul>
  );
}

/** The app's frame for the stack, as the shell holds it: the toasts' layer, the keys, `UndoKeys`. */
function stack(acting: { redo: () => void; undo: () => void }) {
  return render(
    <LayerProvider>
      <KeysProvider>
        <UndoKeys />
        <Acting {...acting} />
      </KeysProvider>
    </LayerProvider>,
  );
}

/** Presses a key on the page, as a user's reaches the window; a capital is typed with Shift. */
async function press(key: string) {
  await act(async () => {
    fireEvent.keyDown(document.body, { key, shiftKey: /^[A-Z]$/.test(key) });
  });
}

/** The toast's button, by its label, once shown. */
const buttonOf = (label: RegExp) => screen.findByRole("button", { name: label });

/**
 * The button of the toast saying `body`, by its label: the toasts closed stay in the test's DOM,
 * which runs no exit transition, so a button is taken from its own toast.
 */
async function buttonIn(body: string, label: RegExp) {
  const toast = (await screen.findByText(body)).closest<HTMLElement>('[role="status"]')!;
  return within(toast).getByRole("button", { name: label });
}

/** The status line's hints. */
const hints = () =>
  within(screen.getByRole("list", { name: "Status line" })).queryAllByRole("listitem");

// Break: a redo toast with the wrong text or key, `U redo` left in the status line, or `u` hinted.
test("an entry's toast says what was undone and redone", async () => {
  const undo = vi.fn();
  const redo = vi.fn();
  stack({ redo, undo });
  const action = "Deleted “Color themes” · waits on the Git page";
  expect((await buttonIn(action, /^Undo/)).textContent).toMatch(/Undo\s*u$/);
  expect(hints().map((hint) => hint.textContent)).toEqual([]);

  await press("u");
  await waitFor(() => expect(undo).toHaveBeenCalledTimes(1));
  const undone = "Undone: deleted “Color themes”";
  expect((await buttonIn(undone, /^Redo/)).textContent).toMatch(/Redo\s*U$/);
  await waitFor(() => expect(hints().map((hint) => hint.textContent)).toEqual(["U redo"]));

  await press("U");
  await waitFor(() => expect(redo).toHaveBeenCalledTimes(1));
  const redone = "Redone: deleted “Color themes”";
  expect((await buttonIn(redone, /^Undo/)).textContent).toMatch(/Undo\s*u$/);
  await waitFor(() => expect(hints()).toEqual([]));
});

// Break: "Undo u" on a touch screen, where no key is hinted.
test("on the phone, the toast's button shows no key; on a wide screen it shows `u`", async () => {
  atWidth(402);
  const acting = { redo: () => {}, undo: () => {} };
  const phone = stack(acting);
  expect((await buttonOf(/^Undo/)).textContent?.trim()).toBe("Undo");
  phone.unmount();

  atWidth(1440);
  undoStack.clear();
  stack(acting);
  await waitFor(async () => expect((await buttonOf(/^Undo/)).textContent).toMatch(/Undo\s*u/));
});

/** A timed toast with a button, as the undo toast's, and how often it hid. */
function Timed({ onHide }: { onHide: () => void }) {
  const toast = useTimedToast();
  useEffect(() => {
    toast({
      autoHideDuration: 5000,
      body: "Moved the note",
      endContent: <Button label="Put back" />,
      onHide,
    });
  }, [toast, onHide]);
  return null;
}

test("the toast stays while hovered or focused, and hides once both leave", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  try {
    const onHide = vi.fn();
    render(
      <LayerProvider>
        <Timed onHide={onHide} />
      </LayerProvider>,
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    const undo = screen.getByText("Put back").closest("button")!;
    const toast = undo.closest<HTMLElement>('[role="status"]')!;
    await act(() => vi.advanceTimersByTimeAsync(4000));
    fireEvent.pointerEnter(toast);
    act(() => undo.focus());
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(onHide).not.toHaveBeenCalled();
    // The pointer leaves, the focus stays: still held.
    fireEvent.pointerLeave(toast);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(onHide).not.toHaveBeenCalled();
    // The focus leaves too: a short span more, then it hides.
    act(() => undo.blur());
    await act(() => vi.advanceTimersByTimeAsync(RESUME_MS - 100));
    expect(onHide).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(onHide).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});
