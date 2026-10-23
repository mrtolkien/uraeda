// The shell around the home, as the app draws it, over the fixture repository's real workspace,
// sessions, and features (see `.storybook/fixture.ts`): its data comes from Uraeda's server in
// Storybook, through fate. Wide, the column of bordered panes beside the page; semi-wide, its 52 px
// rail, here opened over the page by a tap of its logo; narrow, the bar of icon tabs above the page;
// at every width, the status line at the window's bottom. A semi-wide or narrow story answers the
// width queries as that window's width in the desktop's frame (`.storybook/widthClass.ts`).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { within } from "storybook/test";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { atMostWidth, PHONE, SEMI_WIDE } from "../../.storybook/widthClass.ts";
import { Home } from "../Home.tsx";
import { Shell } from "../Shell.tsx";

/** The shell, around the home. */
function ShellAroundHome() {
  return (
    <Shell>
      <Home />
    </Shell>
  );
}

const meta = {
  component: ShellAroundHome,
  decorators: [inRepositoryFolder],
  // The shell fills the frame, as it fills the window.
  parameters: { layout: "fullscreen" },
  title: "Shell",
} satisfies Meta<typeof ShellAroundHome>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Wide: the column, its logo and repository, New and Note, the search, Navigate, Needs you,
 * Sessions, In progress, and Done, the 5 h window and Settings at its foot, beside the home; the
 * status line under both. On the phone's frame, the tabs.
 */
export const Wide: Story = {};

/** Semi-wide, 1205 px: the 52 px rail, opened over the page at the column's width by its logo. */
export const SemiWide: Story = {
  beforeEach: atMostWidth(SEMI_WIDE),
  play: async ({ canvasElement }) => {
    const shell = within(canvasElement);
    // Once the home is drawn: the shell drawn before its data would be drawn anew, folded.
    await shell.findByRole("heading", { name: "Overview" }, { timeout: 20_000 });
    // A tap, as a touch screen's: a synthetic focus would read as the keyboard's, which opens the
    // rail before the tap that would then fold it.
    shell.getByRole("button", { name: "Open navigation" }).click();
  },
};

/** Narrow: the bar of icon tabs above the home, each count a badge, and the status line under it. */
export const Narrow: Story = { beforeEach: atMostWidth(PHONE) };
