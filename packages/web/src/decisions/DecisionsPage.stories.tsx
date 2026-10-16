// The constitution and decisions page, over the fixture repository's real constitution and
// decisions (see `.storybook/fixture.ts`): its data comes from Uraeda's server in Storybook, through
// fate.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DecisionsPage } from "./DecisionsPage.tsx";

const meta = {
  // A Close and a way back, which close nothing in a story.
  args: { onClose: () => {} },
  component: DecisionsPage,
  // The page fills the frame, as in the app's main column.
  parameters: { layout: "fullscreen" },
  title: "Decisions",
} satisfies Meta<typeof DecisionsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The principles first, then the decisions, latest change first; nothing open. */
export const List: Story = { args: { onClose: undefined } };

/** The "UI behaviour" decision open: beside the list on wide screens, its own page on narrow. */
export const Decision: Story = {
  args: { open: { kind: "decision", name: "ui-behaviour" } },
};

/** Principle IV, "Review effort matches impact", open. */
export const Principle: Story = {
  args: { open: { kind: "principle", slug: "iv" } },
};

/** The decisions sorted A to Z, as the sort control keeps it in the browser. */
export const SortedAToZ: Story = {
  args: { onClose: undefined },
  beforeEach: () => {
    window.localStorage.setItem("uraeda:decisions:sort", "title");
    return () => window.localStorage.removeItem("uraeda:decisions:sort");
  },
};
