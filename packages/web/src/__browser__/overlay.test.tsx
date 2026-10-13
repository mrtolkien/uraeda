// The UI layout decision: short forms are bottom sheets on narrow screens, dialogs on wide ones.
import "./helpers.tsx";
import { Theme } from "@astryxdesign/core/theme";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, test } from "vite-plus/test";
import { Overlay } from "../layout/Overlay.tsx";
import { uraedaTheme } from "../theme/built/uraeda.js";

function OpenOverlay({ label }: { label: string }) {
  const [open, setOpen] = useState(true);
  return (
    <Theme theme={uraedaTheme} mode="light">
      <Overlay label={label} isOpen={open} onClose={() => setOpen(false)}>
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
