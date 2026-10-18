// TEMPORARY: mockup of the feature page redesign (specs/2026-10-18-redesign-feature/), replaced by the real page.
// Each state of the planned feature page, from static data.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BLOCKED, DONE, DONE_CHANGE, PULL_REQUEST, WAITING, WORKING } from "./featureMockupData.ts";
import { FeaturePageMockup } from "./FeaturePageMockup.tsx";

const meta = {
  args: { feature: WORKING },
  component: FeaturePageMockup,
  parameters: { layout: "fullscreen" },
  title: "Mockups/Feature page",
} satisfies Meta<typeof FeaturePageMockup>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The agent builds task 7 of 11; three format notes, folded. */
export const Working: Story = {};

/** The spec waits for your review: "Next" holds its one button. */
export const WaitingOnYou: Story = { args: { feature: WAITING } };

/** The pull request is open: open it, or send the agent to its comments. */
export const PullRequest: Story = { args: { feature: PULL_REQUEST } };

/** A status the workflow cannot read: the one problem that blocks, above "Next". */
export const Blocked: Story = { args: { feature: BLOCKED } };

/** The clarifications redesign, merged: every stage dated, its figures, and its record in place. */
export const Done: Story = { args: { feature: DONE } };

/** A change, merged before tokens were recorded: fewer stages, and no questions. */
export const DoneChange: Story = { args: { feature: DONE_CHANGE } };
