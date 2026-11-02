// The format notes of a done feature's page, open: its record links two files that moved since it
// merged, which "Fix moved links" rewrites, uncommitted, and one note no repair reaches.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { Page } from "../layout/Page.tsx";
import { Notes } from "./Notes.tsx";

const RECORD = "specs/done/2026-10-30-inbox-again.md";

const meta = {
  args: {
    notes: [
      {
        file: RECORD,
        fixable: true,
        line: 88,
        message:
          "no file /specs/2026-10-30-proposal-start/proposal.md: it became the record /specs/done/2026-10-30-proposal-start.md",
      },
      {
        file: RECORD,
        fixable: true,
        line: 90,
        message:
          "no file /specs/2026-11-05-dark-mode/proposal.md: deleted in a1b2c3d (chore(dark-mode): drop Dark mode)",
      },
      {
        file: RECORD,
        line: 12,
        message: "a sentence of 31 words: split it at 25",
      },
    ],
    onFix: async () => {},
  },
  component: Notes,
  decorators: [
    (Story) => (
      <Page kind="rows">
        <Story />
      </Page>
    ),
  ],
  parameters: { layout: "fullscreen" },
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByText("Format notes"));
  },
  title: "Feature page/Format notes",
} satisfies Meta<typeof Notes>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Two links whose files moved or left, and "Fix moved links", which repairs them both. */
export const MovedLinks: Story = {};

/** A feature still on its branch: the notes say where each file went, without the button. */
export const OnABranch: Story = { args: { onFix: undefined } };
