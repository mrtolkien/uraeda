// Sub-sessions' mockups (spec of Run options): the session's Sub-agents pane listing the sub-sessions
// Uraeda started, three implementers and two reviewers in mixed states; and a sub-session's page,
// the session's view over a fixture session of Storybook's server, its bar in place of the
// composer, while it works and once done.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FEATURE_PAGES } from "../../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { useFeature } from "../data.ts";
import { Pane } from "../layout/Pane.tsx";
import { SubagentsPanel } from "../session/SubagentsPanel.tsx";
import { SessionPane } from "../SessionView.tsx";
import { useDraft } from "../useDraft.ts";
import { sampleSubSessions } from "./sampleSubSessions.ts";

/** The Sub-agents pane of the build's session, as the session's column draws it. */
function SubagentsPane() {
  return (
    <Pane title="Sub-agents">
      <SubagentsPanel subSessions={sampleSubSessions("build")} />
    </Pane>
  );
}

/** A sub-session's page: a fixture session's transcript, read as the sub-session `index`. */
function SubSessionPage({ index }: { index: number }) {
  const feature = useFeature(FEATURE_PAGES.working);
  // A session page's draft, which the bar never writes: the page holds one as any session's does.
  const draft = useDraft(undefined);
  const id = feature?.sessions[0];
  if (id === undefined) {
    return null;
  }
  const sub = { ...sampleSubSessions(id)[index]!, id };
  return (
    <SessionPane
      draft={draft}
      id={id}
      subSession={{ parentTitle: "Build", sub }}
      title={sub.about}
    />
  );
}

const meta = {
  component: SubagentsPane,
  decorators: [inRepositoryFolder],
  parameters: { layout: "padded" },
  title: "Run options/Sub-sessions",
} satisfies Meta<typeof SubagentsPane>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The Sub-agents pane: 3 implementers, working, done, and failed, then 2 reviewers. */
export const SubagentsPaneMixed: Story = {};

/** A sub-session at work: its transcript, no composer, Stop, and the way back to the build. */
export const SubSessionWorking: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <SubSessionPage index={0} />,
};

/** A sub-session done: its transcript and its bar, without Stop. */
export const SubSessionDone: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <SubSessionPage index={1} />,
};
