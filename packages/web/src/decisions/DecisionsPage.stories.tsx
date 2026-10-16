// The constitution and decisions page, for the redesign of home, inbox, and priorities. Nothing in
// the server reads these files yet, so the page takes plain props: the stories pass this
// repository's own constitution and decisions, as literals (`samples.ts`).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DecisionsPage } from "./DecisionsPage.tsx";
import { CONSTITUTION, DECISIONS, UI_BEHAVIOUR } from "./samples.ts";

const meta = {
  args: {
    constitution: CONSTITUTION,
    decisions: DECISIONS,
    documents: { "ui-behaviour": UI_BEHAVIOUR },
  },
  component: DecisionsPage,
  // The page fills the frame, as in the app's main column.
  parameters: { layout: "fullscreen" },
  title: "Decisions",
} satisfies Meta<typeof DecisionsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The principles first, then the 15 decisions, latest change first; nothing open. */
export const List: Story = {};

/** The "UI behaviour" decision open: beside the list on wide screens, its own page on narrow. */
export const Decision: Story = {
  args: { initialSelection: { kind: "decision", slug: "ui-behaviour" } },
};

/** Principle IV, "Review effort matches impact", open. */
export const Principle: Story = {
  args: { initialSelection: { kind: "principle", numeral: "IV" } },
};

/** The decisions sorted A to Z. */
export const SortedAToZ: Story = { args: { initialSort: "a-z" } };
