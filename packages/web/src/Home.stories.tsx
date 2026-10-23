// Home, the control hub, over the fixture repository's real workspace, features, sessions,
// priorities, and inbox (see `.storybook/fixture.ts`): its data comes from Uraeda's server in
// Storybook, through fate. The core above the dashed "Overview" line, then the widgets. The
// fixture holds a feature whose status the workflow cannot read, so the Problems pane leads; a home
// without problems is the same page without that pane, which the shared fixture cannot show (R30).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { atMostWidth, SEMI_WIDE } from "../.storybook/widthClass.ts";
import { Home } from "./Home.tsx";

const meta = {
  component: Home,
  // The page fills the frame, as in the app's main column.
  parameters: { layout: "fullscreen" },
  title: "Home",
} satisfies Meta<typeof Home>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Wide: Problems first, naming the feature it stops, then Needs you, then In progress beside
 * Sessions; under "Overview", the priorities now beside the usage, the inbox beside recent activity.
 * On the phone's frame, every pane in one column, in the same order.
 */
export const Hub: Story = {};

/** Semi-wide, 1205 px: In progress and Sessions still side by side, and the widgets in two columns. */
export const SemiWide: Story = { beforeEach: atMostWidth(SEMI_WIDE) };
