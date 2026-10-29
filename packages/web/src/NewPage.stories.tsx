// The New page, behind the sidebar's "＋ New", as the app draws it, with each kind picked, over the
// fixture repository's real inbox and priorities (see `.storybook/fixture.ts`): its data comes
// from Uraeda's server in Storybook, through fate.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { NewPage } from "./NewPage.tsx";

const meta = {
  args: { kind: "session" },
  component: NewPage,
  decorators: [inRepositoryFolder],
  // The page fills the frame, as in the app's main column.
  parameters: { layout: "fullscreen" },
  title: "New page",
} satisfies Meta<typeof NewPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** "＋ New", with Session picked: the composer only. */
export const NewSessionPage: Story = {};

/** "＋ New", with Change picked: the composer, the slug, and the notes and priorities to start from. */
export const NewChangePage: Story = { args: { kind: "change" } };

/** "＋ New", with Feature picked: a title for a new proposal, or a note or a proposal to expand. */
export const NewFeaturePage: Story = { args: { kind: "feature" } };
