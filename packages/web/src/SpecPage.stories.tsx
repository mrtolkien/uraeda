// The spec page of the spec page in the terminal look (`specs/done/2026-10-24-spec-page.md`), as
// the app draws it, over the spec page's features that `addSpecPages` builds from
// `fixtures/spec-page/` (see `.storybook/fixture.ts`): its data comes from Uraeda's server in
// Storybook, through fate, on the fake agent.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { SPEC_PAGES } from "../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { FilePage } from "./FilePage.tsx";

const meta = {
  args: { folder: SPEC_PAGES.waiting, name: "spec.md" },
  component: FilePage,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Spec page",
} satisfies Meta<typeof FilePage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The block's pane, titled by the revision's record line: drawn once the page is. */
const BLOCK = "Spec to review, revision 2, about 10 minutes.";

/**
 * The spec at its second revision, waiting for review, in titled panes: the block, "Since your
 * review" listing the parts changed since revision 1, each marked Δ in the page, your review
 * answered, the decisions' ledger, each story with its live windows, the data model, then how it is
 * built. Beside it on wide and semi-wide screens, the spec's column with Contents open; on the
 * phone, the status line's Contents, comment count, and Verdict.
 */
export const Waiting: Story = {};

/** The same spec approved: its approval record first, the same panes, no review, no verdict. */
export const Approved: Story = { args: { folder: SPEC_PAGES.approved } };

/**
 * The column's Review tab: the comments with their places, then "Request changes" and "Approve".
 * On the phone, the same list opens from the status line's "Verdict".
 */
export const ReviewTab: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await page.findByRole("region", { name: BLOCK });
    const tab = page.queryByRole("tab", { name: /^Review/ });
    await userEvent.click(tab ?? page.getByRole("button", { name: /^Verdict/ }));
  },
};

/**
 * "Ask the agent" on a rule of Task storage: the column's Session tab opens, its composer holding
 * the rule quoted from the decision's file and lines, and the spec stays where it is. On the phone,
 * asking opens the session's page instead.
 */
export const SessionAsked: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const storage = within(await page.findByRole("region", { name: "Task storage" }));
    await userEvent.click(storage.getByText(/^Data MUST be stored in IndexedDB/));
    await userEvent.click(await page.findByRole("button", { name: "Ask the agent" }));
  },
};

/** The spec's data model on its own page: each entity a pane, its table's rows as the spec's are. */
export const DataModel: Story = { args: { name: "data-model.md" } };
