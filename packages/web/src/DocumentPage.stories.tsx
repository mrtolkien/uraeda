// The page of a document, as the app draws it: a feature's proposal in panes, with Contents and the
// session's column beside it, over the feature page's features that `samples/features.ts` builds.
// Its data comes from Uraeda's server in Storybook, through fate, on the fake agent.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FEATURE_PAGES } from "../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { FilePage } from "./FilePage.tsx";

const meta = {
  args: { folder: FEATURE_PAGES.working, name: "proposal.md" },
  component: FilePage,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Document page",
} satisfies Meta<typeof FilePage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A proposal: its sections in titled panes, Contents in the column, and the session beside them. */
export const Proposal: Story = {};

/** The round of questions the proposal raised, as a document to read. */
export const Clarifications: Story = { args: { name: "clarifications-01.md" } };
