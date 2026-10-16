// Home, the control hub, over the fixture repository's real workspace, priorities, and inbox (see
// `.storybook/fixture.ts`): its data comes from Uraeda's server in Storybook, through fate.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Home } from "./Home.tsx";

const meta = {
  component: Home,
  // The page fills the frame, as in the app's main column.
  parameters: { layout: "fullscreen" },
  title: "Home",
} satisfies Meta<typeof Home>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The home, as a control hub. */
export const Hub: Story = {};
