// The round page of the clarifications redesign
// (`specs/done/2026-10-17-redesign-clarifications.md`),
// as the app draws it, over the mockup features' rounds, written in the redesign's format (see
// `fixtures/round-mockup/` and `.storybook/fixture.ts`): its data comes from Uraeda's server in
// Storybook, through fate.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ROUND_MOCKUPS } from "../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { FilePage } from "./FilePage.tsx";

const meta = {
  args: { folder: ROUND_MOCKUPS.waiting, name: "clarifications-01.md" },
  component: FilePage,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Mockups/Round page",
} satisfies Meta<typeof FilePage>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A round waiting for answers: the verdict, the context's parts, the questions with a diagram, Q1
 * answered B so that its follow-up shows, then the settled points.
 */
export const Waiting: Story = {};

/**
 * Q1 answered with a comment alone: no letter is picked, and its follow-up does not show, with
 * nothing to mark.
 */
export const CommentOnly: Story = { args: { folder: ROUND_MOCKUPS.commentOnly } };
