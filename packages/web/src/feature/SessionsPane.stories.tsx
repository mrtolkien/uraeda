// A feature's sessions, as its page draws them in its column, over the feature page's features that
// `.storybook/featurePages.ts` builds: their sessions come from Uraeda's server in Storybook, through
// fate, on the fake agent, so none works while the story shows.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FEATURE_PAGES } from "../../.storybook/checkouts.ts";
import { atMostWidth, PHONE } from "../../.storybook/widthClass.ts";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { useFeature } from "../data.ts";
import { Page } from "../layout/Page.tsx";
import { SessionsPane } from "./SessionsPane.tsx";

/** The pane of a feature, by its folder, with the sessions its server lists and their sub-sessions. */
function FeatureSessionsPane({ folder }: { folder: string }) {
  const feature = useFeature(folder);
  if (!feature) {
    return null;
  }
  return (
    <Page kind="rows">
      <SessionsPane folder={folder} progress={feature.step.progress} sessions={feature.sessions} />
    </Page>
  );
}

const meta = {
  args: { folder: FEATURE_PAGES.working },
  component: FeatureSessionsPane,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Feature page/Sessions",
} satisfies Meta<typeof FeatureSessionsPane>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A feature's sessions, the latest first, each titled by its first run's step and with its start,
 * here the session of its spec, and "New session", which opens a new session in the feature's
 * worktree, on its own page.
 */
export const FeatureSessions: Story = { args: { folder: FEATURE_PAGES.idle } };

/** A feature without a session yet: "New session" alone. */
export const NoSession: Story = { args: { folder: FEATURE_PAGES.blocked } };

/**
 * The build's session with its sub-sessions nested under it, in the sub-agents' colour: 3
 * implementers and 2 reviewers, each with its role, agent, model, and state, a link to its page.
 */
export const WithSubSessions: Story = {};

/** The same on the phone: each sub-session's head line, its role and agent under it. */
export const WithSubSessionsPhone: Story = { beforeEach: atMostWidth(PHONE) };
