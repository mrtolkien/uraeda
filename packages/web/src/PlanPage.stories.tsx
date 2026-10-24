// The plan page of the spec page in the terminal look (`specs/2026-10-24-spec-page/`), as the app
// draws it, over the questions page's plan (`fixtures/plan-page/plan.md`) that `addSpecPages`
// commits on two of the spec page's features (see `.storybook/fixture.ts`): its data comes from
// Uraeda's server in Storybook, through fate, on the fake agent.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SPEC_PAGES } from "../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { FilePage } from "./FilePage.tsx";

const meta = {
  args: { folder: SPEC_PAGES.plan, name: "plan.md" },
  component: FilePage,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Plan page",
} satisfies Meta<typeof FilePage>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * An auto-approved plan, in the file's order: Goal, Architecture, and Spec, each section a pane,
 * then each task a pane titled "Task N · <title>" with its `done/total` badge. Beside it, the plan's
 * column with Contents and Session, no Review.
 */
export const AutoApproved: Story = {};

/**
 * The same plan waiting for review: the same panes, the column's Review tab, and the verdict at the
 * page's end, with the risk tier and plan review.
 */
export const Waiting: Story = { args: { folder: SPEC_PAGES.planWaiting } };
