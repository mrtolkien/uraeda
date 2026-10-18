// The session's composer and its recommended message, as a feature's session draws it, over the
// feature page's features that `.storybook/featurePages.ts` builds: the recommendation comes from
// Uraeda's server in Storybook, through fate.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { FEATURE_PAGES } from "../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { SessionPage } from "./SessionPage.tsx";

/** A feature's session, by its folder. */
function FeatureSession({ folder }: { folder: string }) {
  return <SessionPage folder={folder} />;
}

const meta = {
  args: { folder: FEATURE_PAGES.pullRequest },
  component: FeatureSession,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Composer",
} satisfies Meta<typeof FeatureSession>;

export default meta;

type Story = StoryObj<typeof meta>;

/** One message applies: a button inserts it, named by what it asks. */
export const Recommended: Story = {};

/** The message inserted, unsent: Send says what it starts. */
export const Filled: Story = {
  play: async ({ canvasElement }) => {
    const button = await within(canvasElement).findByRole("button", {
      name: "Insert: Address the pull request's comments",
    });
    await userEvent.click(button);
  },
};

/** Nothing applies while the spec waits on you: a line says why, and anything typed still sends. */
export const Nothing: Story = { args: { folder: FEATURE_PAGES.waiting } };
