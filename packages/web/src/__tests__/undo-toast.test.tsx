// An Undo whose read or write fails shows its failure in the page, as a refused one does, never as
// a rejection nothing catches.
import { LayerProvider } from "@astryxdesign/core/Layer";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { expect, test } from "vite-plus/test";
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
