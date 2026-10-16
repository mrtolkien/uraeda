// Home, today's and three redesigns of it for the discovery round of the home's redesign, each over
// the fixture repository's real workspace and inbox (see `.storybook/fixture.ts`): their data comes
// from Uraeda's server in Storybook, through fate.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Home } from "./Home.tsx";
import { HomeCockpit } from "./home/HomeCockpit.tsx";
import { HomeFlow } from "./home/HomeFlow.tsx";
import { HomeHub } from "./home/HomeHub.tsx";

const meta = {
  component: Home,
  // The page fills the frame, as in the app's main column.
  parameters: { layout: "fullscreen" },
  title: "Home",
} satisfies Meta<typeof Home>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Today's home: grey lists of what waits, what runs, the inbox, priorities, and what is done. */
export const Today: Story = {};

/** A control hub of cards over the whole width: stat tiles, then what needs you and the queue. */
export const Hub: Story = { render: () => <HomeHub /> };

/** Uraeda's flow as lanes, left to right: Inbox, Priorities, In flight by step, then Needs you. */
export const Flow: Story = { render: () => <HomeFlow /> };

/** A dense instrument panel: status lights, three panels with gauges, and a ticker of what is done. */
export const Cockpit: Story = { render: () => <HomeCockpit /> };
