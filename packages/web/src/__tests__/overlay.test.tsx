// The UI behaviour decision: every sheet and dialog has a visible close button, and Back closes it.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { expect, test } from "vite-plus/test";
import { Overlay } from "../layout/Overlay.tsx";
import "./helpers.tsx";

/** An overlay opened at once, as a page opens one from a button. */
function OpenOverlay({ label }: { label: string }) {
  const [open, setOpen] = useState(true);
  return (
    <Overlay label={label} isOpen={open} onClose={() => setOpen(false)}>
      <p>A short form.</p>
    </Overlay>
  );
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

test("Back closes an overlay", async () => {
  render(<OpenOverlay label="New priority" />);
  expect(screen.getByRole("dialog", { name: "New priority" })).toBeTruthy();
  await act(async () => window.history.back());
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "New priority" })).toBeNull());
});

test("the overlay has a visible Close", async () => {
  render(<OpenOverlay label="New priority" />);
  await click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
