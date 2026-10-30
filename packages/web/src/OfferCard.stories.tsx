// The agent's offer in a session, as its transcript draws a closed `uraeda-offer` block: a session
// made a change, its proposal and slug to edit, or a change made a feature, with the agent's
// reason. The slug comes from Uraeda's server in Storybook, through fate; the buttons reach it too.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Page } from "./layout/Page.tsx";
import { OfferCard } from "./OfferCard.tsx";

const PROPOSAL = `# Login redirects twice

The login page redirects to \`/home\`, then to \`/\`, after signing in.`;

const meta = {
  args: {
    isLatest: true,
    kind: "change",
    onClose: () => {},
    proposal: PROPOSAL,
    session: { id: "story", working: false },
  },
  component: OfferCard,
  decorators: [
    (Story) => (
      <Page isSnug kind="session">
        <Story />
      </Page>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Session page/Offer",
} satisfies Meta<typeof OfferCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The agent offers a change: its proposal and slug, editable, then "Start the change". */
export const ChangeOffer: Story = {};

/** The same offer while the agent works: "Start the change" waits for its turn to end. */
export const AgentWorking: Story = { args: { session: { id: "story", working: true } } };

/** In a change's session, the agent offers to make it a feature, with its reason. */
export const FeatureOffer: Story = {
  args: {
    kind: "feature",
    reason:
      "It changes the format of PRIORITIES.md, which every project has: the spec should be approved first.",
    session: { folder: "2026-10-20-priorities-sections", id: "story", working: false },
  },
};
