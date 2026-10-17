// The round page of the clarifications redesign
// (`specs/done/2026-10-17-redesign-clarifications.md`),
// as the app draws it, over the mockup features' rounds, written in the redesign's format (see
// `fixtures/round-mockup/` and `.storybook/fixture.ts`): its data comes from Uraeda's server in
// Storybook, through fate.
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { ROUND_MOCKUPS } from "../.storybook/checkouts.ts";
import { useWorkspace } from "./data.ts";
import { FilePage } from "./FilePage.tsx";
import { RepositoryPathContext } from "./routes.tsx";

/** The fixture's folder, as `App` sets it: what keeps the answers' unsaved text apart. */
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
