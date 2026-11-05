// An Undo whose read or write fails shows its failure in the page, as a refused one does, never as
// a rejection nothing catches. A timed toast, as the undo toast is, stays while the human is at it.
import { Button } from "@astryxdesign/core/Button";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { expect, test, vi } from "vite-plus/test";
import { RESUME_MS, useTimedToast } from "../layout/useTimedToast.tsx";
import { useUndoErrors, useUndoToast } from "../layout/useUndoToast.ts";

/** A toast whose Undo rejects, and the page's errors under it. */
function Failing() {
  const toast = useUndoToast();
  const [errors] = useUndoErrors();
  useEffect(() => {
    toast("Deleted the note", () => Promise.reject(new Error("the server is gone")));
  }, [toast]);
  return (
    <ul>
      {errors.map((error) => (
        <li key={error.id}>{error.text}</li>
      ))}
    </ul>
  );
}

test("an Undo that rejects shows its failure in the page", async () => {
  render(
    <LayerProvider>
      <Failing />
    </LayerProvider>,
  );
  // The toasts' region is a popover the test's DOM never shows: its button found as `u` finds it.
  const undo = await waitFor(() => {
    const button = document.querySelector<HTMLButtonElement>("[data-undo] button");
    expect(button).not.toBeNull();
    return button!;
  });
  await act(async () => {
    fireEvent.click(undo);
  });
  expect(await screen.findByText("Could not undo: the server is gone")).toBeTruthy();
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
