// The folding pane's title on the phone, in WebKit: its button, as tall as a finger needs on a touch
// screen, keeps the title centred on the pane's top border and clear of what is above the pane.
import { Theme } from "@astryxdesign/core/theme";
import { render, screen, within } from "@testing-library/react";
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
  const section = screen.getByRole("region", { name: "Today" });
  const border =
    section.getBoundingClientRect().top +
    Number.parseFloat(getComputedStyle(section).borderTopWidth) / 2;
  const range = document.createRange();
  range.selectNodeContents(screen.getByText("Today"));
  const title = range.getBoundingClientRect();
  // The title's middle on the border, within a pixel.
  expect(Math.abs((title.top + title.bottom) / 2 - border)).toBeLessThanOrEqual(1);
  // The title, drawn over the border with its background, covers none of the text above.
  expect(
    within(section).getByRole("heading", { level: 2 }).getBoundingClientRect().top,
  ).toBeGreaterThanOrEqual(
    screen.getByText("The text above the pane.").getBoundingClientRect().bottom,
  );
  // A finger's target, as tall as the theme's controls on a touch screen: 44 px, centred on it.
  const x = (title.left + title.right) / 2;
  for (const y of [border - 21, border + 21]) {
    expect(button.contains(document.elementFromPoint(x, y)), `at ${y - border} px`).toBe(true);
  }
});

/** The range of an element's text, whose boxes are the lines it is drawn on. */
function textRange(element: Element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range;
}

const LONG = "3 questions and 1 follow-up on the web UI, about 35 minutes.";

test.each([
  { isOpenOnPhone: false, name: "a pane" },
  { isOpenOnPhone: true, name: "a pane open on the phone" },
  { fold: true, isOpenOnPhone: true, name: "a folding pane" },
])(
  "on the phone, $name's long title wraps within the screen, over none of its text",
  async ({ fold, isOpenOnPhone }) => {
    render(
      <Theme mode="dark" theme={uraedaTheme}>
        <Pane
          count={3}
          fold={fold ? { isOpen: true, onOpenChange: () => {} } : undefined}
          icon="uraeda:triangle-alert"
          isOpenOnPhone={isOpenOnPhone}
          title={LONG}
        >
          <p>The first paragraph of the pane.</p>
        </Pane>
      </Theme>,
    );
    await drawn();

    const title = screen.getByText(LONG);
    const section = screen.getByRole("region", { name: LONG });
    const pane = section.getBoundingClientRect();
    const lines = textRange(title).getBoundingClientRect();
    // Within the screen and the pane, on more than one line.
    expect(lines.right).toBeLessThanOrEqual(Math.min(window.innerWidth, pane.right));
    expect(lines.left).toBeGreaterThanOrEqual(pane.left);
    const first = textRange(title).getClientRects()[0]!;
    expect(lines.height).toBeGreaterThan(1.5 * first.height);
    // Its first line on the top border, within a pixel.
    const border = pane.top + Number.parseFloat(getComputedStyle(section).borderTopWidth) / 2;
    expect(Math.abs((first.top + first.bottom) / 2 - border)).toBeLessThanOrEqual(1);
    // Its heading, and its count, end above the pane's text.
    const heading = within(section).getByRole("heading", { level: 2 }).getBoundingClientRect();
    expect(heading.bottom).toBeLessThanOrEqual(
      screen.getByText("The first paragraph of the pane.").getBoundingClientRect().top,
    );
    expect(textRange(screen.getByText("· 3")).getBoundingClientRect().right).toBeLessThanOrEqual(
      window.innerWidth,
    );
    // A run of the top border shows after the title, whose background hides the border behind it.
    expect(pane.right - heading.right).toBeGreaterThanOrEqual(8);
  },
);
