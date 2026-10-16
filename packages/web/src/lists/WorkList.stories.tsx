// The priorities and the inbox drawn with one list, for the redesign of both pages, over the
// fixture repository's real priorities, workspace, and inbox (see `.storybook/fixture.ts`): their
// data comes from Uraeda's server in Storybook, through fate.
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useWorkspace } from "../data.ts";
import { RepositoryPathContext } from "../routes.tsx";
import { InboxWork } from "./InboxWork.tsx";
import { PrioritiesWork } from "./PrioritiesWork.tsx";

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
  component: PrioritiesWork,
  decorators: [inRepositoryFolder],
  // The page fills the frame, as in the app's main column.
  parameters: { layout: "fullscreen" },
  title: "Lists",
} satisfies Meta<typeof PrioritiesWork>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Now, Next, Later, and Blocked, each in its colour; in Now, the running entries first. */
export const Priorities: Story = {};

/** The second row of Now selected, with the keyboard's focus on it, and the keys shown once. */
export const Selected: Story = { args: { hasHint: true, isFocused: true, select: 1 } };

/** The inbox's categories as the same sections, every note with the same handle. */
export const Inbox: Story = { render: () => <InboxWork /> };
