// The UI layout decision: short forms are bottom sheets on narrow screens, dialogs on wide ones.
import "./helpers.tsx";
import { Theme } from "@astryxdesign/core/theme";
import { Button } from "@astryxdesign/core/Button";
import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { flushSync } from "react-dom";
import { expect, test } from "vite-plus/test";
import { Overlay } from "../layout/Overlay.tsx";
import { uraedaTheme } from "../theme/built/uraeda.js";

function OpenOverlay({ label }: { label: string }) {
  const [open, setOpen] = useState(true);
  return (
    <Theme mode="light" theme={uraedaTheme}>
      <Overlay isOpen={open} label={label} onClose={() => setOpen(false)}>
        <p>A short form.</p>
      </Overlay>
    </Theme>
  );
}

test("a sheet on the phone, a dialog on the desktop", async () => {
  render(<OpenOverlay label="New priority" />);
  const dialog = screen.getByRole("dialog", { name: "New priority" });
  // Once its entrance ends: a sheet along the screen's bottom edge and its full width, or a dialog
  // in the middle of the screen, narrower than it.
  await expect
    .poll(() => {
      const box = dialog.getBoundingClientRect();
      return window.innerWidth < 768
        ? Math.round(box.bottom) === window.innerHeight &&
            Math.round(box.width) === window.innerWidth
        : Math.abs((box.top + box.bottom) / 2 - window.innerHeight / 2) < 2 &&
            box.width < window.innerWidth / 2;
    })
    .toBe(true);
});

/** An overlay its page closes, as a form's success does, and opens again. */
function OwnedOverlay() {
  const [open, setOpen] = useState(true);
  return (
    <Theme mode="light" theme={uraedaTheme}>
      <Overlay isOpen={open} label="New priority" onClose={() => setOpen(false)}>
        <Button
          label="Done, then open again"
          onClick={() => {
            // Closed, and opened again before the browser went back over its entry.
            flushSync(() => setOpen(false));
            setOpen(true);
          }}
        />
      </Overlay>
    </Theme>
  );
}

const overlayEntry = () => (window.history.state as { overlay?: string } | null)?.overlay;

test("an overlay opened again while its closing goes back stays open, and Back closes it", async () => {
  render(<OwnedOverlay />);
  screen.getByRole("button", { name: "Done, then open again" }).click();
  await new Promise((resolve) => setTimeout(resolve, 300));

  expect(screen.getByRole("dialog", { name: "New priority" })).toBeTruthy();
  expect(overlayEntry()).toBe("New priority");
  window.history.back();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(overlayEntry()).toBeUndefined();
});

/** Two overlays: the first, closed by its page, opens the second at once, as one form leads on. */
function OverlaysInTurn() {
  const [open, setOpen] = useState<"first" | "second" | undefined>("first");
  return (
    <Theme mode="light" theme={uraedaTheme}>
      <Overlay isOpen={open === "first"} label="First" onClose={() => setOpen(undefined)}>
        <Button
          label="Done, then the second"
          onClick={() => {
            // The second opens before the browser went back over the first's entry.
            flushSync(() => setOpen(undefined));
            setOpen("second");
          }}
        />
      </Overlay>
      <Overlay isOpen={open === "second"} label="Second" onClose={() => setOpen(undefined)}>
        <p>The next form.</p>
      </Overlay>
    </Theme>
  );
}

test("an overlay opened while another's closing goes back stays open, and Back closes it", async () => {
  render(<OverlaysInTurn />);
  screen.getByRole("button", { name: "Done, then the second" }).click();
  await new Promise((resolve) => setTimeout(resolve, 300));

  expect(screen.getByRole("dialog", { name: "Second" })).toBeTruthy();
  expect(overlayEntry()).toBe("Second");
  window.history.back();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(overlayEntry()).toBeUndefined();
});
