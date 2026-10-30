// Mockups of a feature's start on its session page: Start lands here at once, the steps run where
// the transcript will be, and a message sent meanwhile waits for them.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StartStepsView } from "./StartSteps.tsx";

const meta = {
  args: { onProposal: () => {}, title: "Starting the feature Performance pass" },
  component: StartStepsView,
  title: "Session page/Start steps",
} satisfies Meta<typeof StartStepsView>;

export default meta;

type Story = StoryObj<typeof meta>;

const COMMIT = "Commit the proposal on main, running your hooks";
const BRANCH = "Make the branch 2026-10-29-performance-pass and its worktree";
const AGENT = "Start the agent with your message";

/** Right after Start: the proposal's commit runs the hooks, the composer holds the message. */
export const Running: Story = {
  args: {
    steps: [
      {
        label: COMMIT,
        output: "⋯ Running tasks for staged files…\n    !*.rs — 2 files\n      ⋯ vp check --fix",
        seconds: 2,
        state: "running",
      },
      { label: BRANCH, state: "waiting" },
      { label: AGENT, state: "waiting" },
    ],
  },
};

/** Sent before the steps ended: the message waits, and the human may already be elsewhere. */
export const MessageQueued: Story = {
  args: {
    queued: "Continue the feature specs/2026-10-29-performance-pass/…",
    steps: [
      { label: COMMIT, seconds: 2, state: "done" },
      { label: BRANCH, seconds: 1, state: "running" },
      { label: AGENT, state: "waiting" },
    ],
  },
};

/** A hook refused the commit: nothing was made, and the message stays unsent. */
export const Refused: Story = {
  args: {
    queued: "Continue the feature specs/2026-10-29-performance-pass/…",
    steps: [
      {
        label: COMMIT,
        output: "✗ vp check --fix\nspecs/2026-10-29-performance-pass/proposal.md:3: a broken link",
        seconds: 2,
        state: "refused",
      },
      { label: BRANCH, state: "waiting" },
      { label: AGENT, state: "waiting" },
    ],
  },
};
