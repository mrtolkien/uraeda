// Home, as the home's redesign draws it, over the fixture repository's real workspace and inbox (see
// `.storybook/fixture.ts`): its data comes from Uraeda's server in Storybook, through fate.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { HomeHub } from "./home/HomeHub.tsx";

const meta = {
  component: HomeHub,
  // The page fills the frame, as in the app's main column.
  parameters: { layout: "fullscreen" },
  title: "Home",
} satisfies Meta<typeof HomeHub>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The home, as a control hub. */
export const Hub: Story = {};
