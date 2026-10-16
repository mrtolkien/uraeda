// The priorities and the inbox drawn with one list, for the redesign of both pages, over the
// fixture repository's real priorities, workspace, and inbox (see `.storybook/fixture.ts`): their
// data comes from Uraeda's server in Storybook, through fate.
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useWorkspace } from "../data.ts";
import { InboxPage } from "../InboxPage.tsx";
import { PrioritiesPage } from "../PrioritiesPage.tsx";
import { RepositoryPathContext } from "../routes.tsx";

/** The fixture's folder, as `App` sets it: what keeps the Add rows' unsaved text apart. */
function InRepositoryFolder({ children }: { children: ReactNode }) {
  const root = useWorkspace()?.root;
  return root === undefined ? null : (
    <RepositoryPathContext value={root}>{children}</RepositoryPathContext>
  );
}

const inRepositoryFolder: Decorator = (Story) => (
  <InRepositoryFolder>
    <Story />
  </InRepositoryFolder>
);

const meta = {
  component: PrioritiesPage,
  decorators: [inRepositoryFolder],
  // The page fills the frame, as in the app's main column.
  parameters: { layout: "fullscreen" },
  title: "Lists",
} satisfies Meta<typeof PrioritiesPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** "Ongoing", the running entries, then Now, Next, Later, and Blocked, each in its colour. */
export const Priorities: Story = {};

/** The first row of Next selected, with the keyboard's focus on it. */
export const Selected: Story = {
  args: { isFocused: true, select: "claude-code-runner-triggered-manually" },
};

/**
 * The inbox's categories as the same sections, every note with the same handle and its children,
 * the count beside the heading and "Organize with an agent" on its right.
 */
export const Inbox: Story = { render: () => <InboxPage /> };
