// Mockups of the round page in the clarifications redesign
// (`specs/2026-10-17-redesign-clarifications/spec.md`), over the mockup feature's round, written in
// the redesign's format (see `fixtures/round-mockup/`).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoundMockup } from "./mockups/RoundMockup.tsx";

const meta = {
  args: { folder: "2026-10-17-round-mockup", initial: {} },
  component: RoundMockup,
  parameters: { layout: "fullscreen" },
  title: "Mockups/Round page",
} satisfies Meta<typeof RoundMockup>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A round waiting for answers: the verdict, the context's parts, the questions as cards with a
 * diagram, Q1 answered B so that its follow-up shows, then the settled points in their groups.
 */
export const Waiting: Story = { args: { initial: { Q1: { letters: ["B"] } } } };

/**
 * Q1 answered with a comment alone: no letter is picked, and its follow-up does not show, with
 * nothing to mark.
 */
export const CommentOnly: Story = {
  args: {
    initial: {
      Q1: {
        comment: "Neither: keep a single task, but keep the last 10 completions.",
        letters: [],
      },
    },
  },
};
