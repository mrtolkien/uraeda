// The states of a story embedded in a workflow file, each a story link of a checkout of the
// fixture repository in that state (see `.storybook/fixture.ts`): its data comes from Uraeda's
// server in Storybook, through fate.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CHECKOUTS } from "../.storybook/checkouts.ts";
import { StoryEmbed } from "./StoryEmbed.tsx";

/** The stories file of the test feature, which exports `Dragging`, `ThinLine`, and `Grip`. */
const STORIES = "packages/web/src/SidebarHandle.stories.tsx";

const dragging = { export: "Dragging", label: "Dragging the handle", path: STORIES };
/** An export the stories file does not have. */
const resizing = { export: "Resizing", label: "Resizing the sidebar", path: STORIES };

const meta = {
  component: StoryEmbed,
  title: "StoryEmbed",
} satisfies Meta<typeof StoryEmbed>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The story at both widths, from its branch's running Storybook. */
export const Ready: Story = { args: { folder: CHECKOUTS.ready, story: dragging } };

/** A Storybook that has not served its index yet: it fails after 2 minutes. */
export const Starting: Story = { args: { folder: CHECKOUTS.starting, story: dragging } };

/** A Storybook that exited, with its last line and "Try again". */
export const Failed: Story = { args: { folder: CHECKOUTS.failed, story: dragging } };

/** A story the branch does not have, with "Open in Storybook". */
export const Missing: Story = { args: { folder: CHECKOUTS.ready, story: resizing } };

/** A variant of an answered round that the agent removed after the answer. */
export const Removed: Story = { args: { folder: CHECKOUTS.ready, removed: true, story: resizing } };

/** A feature without a worktree, whose stories cannot run. */
export const NoWorktree: Story = { args: { folder: CHECKOUTS.noWorktree, story: dragging } };
