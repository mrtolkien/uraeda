// The folding pane's title on the phone, in WebKit: its button, as tall as a finger needs on a touch
// screen, keeps the title centred on the pane's top border and clear of what is above the pane.
import { Theme } from "@astryxdesign/core/theme";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { Pane } from "../layout/Pane.tsx";
import { uraedaTheme } from "../theme/built/uraeda.js";
import { atSize, drawn } from "./helpers.tsx";

atSize("phone");

test("on the phone, a folding pane's title sits on its top border, clear of the text above", async () => {
  render(
    <Theme mode="dark" theme={uraedaTheme}>
      <p>The text above the pane.</p>
      <Pane fold={{ isOpen: false, onOpenChange: () => {} }} title="Today">
        <p>Inside.</p>
      </Pane>
    </Theme>,
  );
  await drawn();

  const button = screen.getByRole("button", { name: "Today" });
  const section = button.closest("section")!;
  const border =
    section.getBoundingClientRect().top +
    Number.parseFloat(getComputedStyle(section).borderTopWidth) / 2;
  const range = document.createRange();
  range.selectNodeContents(screen.getByText("Today"));
  const title = range.getBoundingClientRect();
  // The title's middle on the border, within a pixel.
  expect(Math.abs((title.top + title.bottom) / 2 - border)).toBeLessThanOrEqual(1);
  // The title, drawn over the border with its background, covers none of the text above.
  expect(button.closest("h2")!.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    screen.getByText("The text above the pane.").getBoundingClientRect().bottom,
  );
  // A finger's target, as tall as the theme's controls on a touch screen: 44 px, centred on it.
  const x = (title.left + title.right) / 2;
  for (const y of [border - 21, border + 21]) {
    expect(button.contains(document.elementFromPoint(x, y)), `at ${y - border} px`).toBe(true);
  }
});
