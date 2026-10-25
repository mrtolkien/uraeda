// The page of a feature or a change, as the app draws it, over the feature page's features that
// `samples/features.ts` builds, one per state: their data comes from Uraeda's server in
// Storybook, through fate, their stages timed from their commits, in the browser's time zone.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { FEATURE_PAGES } from "../../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { FeaturePage } from "./FeaturePage.tsx";

const meta = {
  args: { folder: FEATURE_PAGES.working },
  component: FeaturePage,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Feature page",
} satisfies Meta<typeof FeaturePage>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The agent builds task 7 of 11: Build is the current stage, "Next" says what the agent builds,
 * without a button, beside the agent's card, and the format notes are folded at the bottom.
 */
export const Working: Story = {};

/**
 * The spec is approved and no agent works: "Next" offers the plan with its one button, and the
 * column's figures count the agent's time over the feature's two runs.
 */
export const Idle: Story = { args: { folder: FEATURE_PAGES.idle } };

/** The spec waits for your review: "Next" holds its one button, the agent idle beside it. */
export const WaitingOnYou: Story = { args: { folder: FEATURE_PAGES.waiting } };

/**
 * The pull request is open: "Next" opens it on GitHub, and the session's recommended message sends
 * the agent to its comments. The server reads it from a `gh` that lists it (R100).
 */
export const PullRequest: Story = { args: { folder: FEATURE_PAGES.pullRequest } };

/** A status the workflow cannot read: the one problem that blocks, above "Next". */
export const Blocked: Story = { args: { folder: FEATURE_PAGES.blocked } };

/**
 * A feature merged by rebase, its build started the day after its plan: every stage timed, each on
 * one line, figures that lead to their detail, and the record in place, its decisions drawn as the
 * spec page draws them.
 */
export const Done: Story = { args: { folder: FEATURE_PAGES.done } };

/** A change, merged: its own stages, without questions, and its record in place. */
export const DoneChange: Story = { args: { folder: FEATURE_PAGES.doneChange } };

/** The feature's "…" open: Rename, and Drop behind its confirmation. */
export const MenuOpen: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await userEvent.click(await page.findByRole("button", { name: "Feature actions" }));
  },
};

/** The column folded to its rail of icons by `]`, the page taking the room. */
export const ColumnFolded: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole("region", { name: "Next" });
    await userEvent.keyboard("]");
  },
};
