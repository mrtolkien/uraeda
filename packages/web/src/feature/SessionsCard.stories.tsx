// A feature's sessions, as its page draws them beside "Next", over the feature page's features that
// `.storybook/featurePages.ts` builds: their sessions come from Uraeda's server in Storybook, through
// fate, on the fake agent, so none works while the story shows.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FEATURE_PAGES } from "../../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { useFeature } from "../data.ts";
import { Page } from "../layout/Page.tsx";
import { SessionsCard } from "./SessionsCard.tsx";

/** The card of a feature, by its folder, with the sessions its server lists. */
function FeatureSessionsCard({ folder }: { folder: string }) {
  const feature = useFeature(folder);
  if (!feature) {
    return null;
  }
  return (
    <Page>
      <SessionsCard folder={folder} progress={feature.step.progress} sessions={feature.sessions} />
    </Page>
  );
}

const meta = {
  args: { folder: FEATURE_PAGES.working },
  component: FeatureSessionsCard,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Feature page/Sessions",
} satisfies Meta<typeof FeatureSessionsCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A feature's sessions, the latest first, each titled by its first run's step and with its start,
 * here the session of its build, and "New session", which opens a new session in the feature's
 * worktree, on its own page.
 */
export const FeatureSessions: Story = {};

/** A feature without a session yet: "New session" alone. */
export const NoSession: Story = { args: { folder: FEATURE_PAGES.blocked } };
