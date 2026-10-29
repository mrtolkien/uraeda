// The constitution and decisions page, over the fixture repository's real constitution and
// decisions, and the spec page's features, whose branches change two of them (see
// `.storybook/fixture.ts`): its data comes from Uraeda's server in Storybook, through fate. The list
// is the active pane, the reader beside it on wide screens, open on the constitution by default.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { DecisionsPage } from "./DecisionsPage.tsx";

const meta = {
  component: DecisionsPage,
  // The page fills the frame, as in the app's main column.
  parameters: { layout: "fullscreen" },
  title: "Decisions",
} satisfies Meta<typeof DecisionsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Nothing picked: the principles first, then the decisions, latest change first, and the reader on
 * the whole constitution, the list marking principle I. On the phone's frame, the list alone.
 */
export const Constitution: Story = {};

/** Principle III picked: the reader on the whole constitution, scrolled to it. */
export const Principle: Story = {
  args: { open: { kind: "constitution" } },
};

/** The "UI behaviour" decision open: beside the list on wide screens, its own page on narrow. */
export const Decision: Story = {
  args: { open: { kind: "decision", name: "ui-behaviour" } },
};

/**
 * "Task storage", which a feature in flight changes on its branch: the reader shows the change as a
 * diff, "Proposed by" that feature, before the decision's rules.
 */
export const ChangedDecision: Story = {
  args: { open: { kind: "decision", name: "task-storage" } },
};

/**
 * The palette, opened by "Jump to…", "task" typed: the entries it finds, the cursor on the first,
 * and its preview beside them; on the phone's frame, a sheet of the list alone.
 */
export const Palette: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await userEvent.click(await page.findByRole("button", { name: /^Jump to…/ }));
    // The palette is a dialog in the top layer, outside the story's root.
    const dialog = within(canvasElement.ownerDocument.body);
    await userEvent.type(
      await dialog.findByRole("combobox", { name: "Jump to a decision or principle" }),
      "task",
    );
  },
};

/** The decisions sorted A to Z, as the sort control keeps it in the browser. */
export const SortedAToZ: Story = {
  beforeEach: () => {
    window.localStorage.setItem("uraeda:decisions:sort", "title");
    return () => window.localStorage.removeItem("uraeda:decisions:sort");
  },
};
