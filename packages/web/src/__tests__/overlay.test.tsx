// The UI behaviour decision: every sheet and dialog has a visible close button, and Back closes it.
import { Button } from "@astryxdesign/core/Button";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { expect, test } from "vite-plus/test";
import { Overlay } from "../layout/Overlay.tsx";
import "./helpers.tsx";

/** An overlay opened at once, as a page opens one from a button. */
function OpenOverlay({ label }: { label: string }) {
  const [open, setOpen] = useState(true);
  return (
    <Overlay isOpen={open} label={label} onClose={() => setOpen(false)}>
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

const overlayEntry = () => (window.history.state as { overlay?: string } | null)?.overlay;

/** An overlay its page renames while open, as a new title does. */
function OwnedOverlay() {
  const [open, setOpen] = useState(true);
  const [label, setLabel] = useState("New priority");
  return (
    <Overlay label={label} isOpen={open} onClose={() => setOpen(false)}>
      <Button label="Rename" onClick={() => setLabel("Edit priority")} />
    </Overlay>
  );
}

test("an overlay renamed while open keeps one history entry, which Back takes", async () => {
  render(<OwnedOverlay />);
  await click(screen.getByRole("button", { name: "Rename" }));
  expect(screen.getByRole("dialog", { name: "Edit priority" })).toBeTruthy();

  await act(async () => window.history.back());

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(overlayEntry()).toBeUndefined();
});
