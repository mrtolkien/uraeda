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
  // The sheet slides up: its position settles once its entrance ends.
  await new Promise((resolve) => setTimeout(resolve, 800));
  const box = dialog.getBoundingClientRect();
  if (window.innerWidth < 768) {
    expect(Math.round(box.bottom)).toBe(window.innerHeight);
  } else {
    expect(box.bottom).toBeLessThan(window.innerHeight - 40);
  }
});
