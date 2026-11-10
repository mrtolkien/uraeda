// Sub-sessions' mockups (spec of Run options): the session's Sub-agents pane listing the sub-sessions
// Uraeda started, three implementers and two reviewers in mixed states; and a sub-session's page,
// the session's view, its bar in place of the composer, while it works and once done. Both read the
// building feature's sub-sessions that Storybook's server keeps (`samples/subSessions.ts`).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FEATURE_PAGES } from "../../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { useFeature } from "../data.ts";
import { Pane } from "../layout/Pane.tsx";
import { SubagentsPanel } from "../session/SubagentsPanel.tsx";
import { useSession } from "../sessionData.ts";
import { SessionPane } from "../SessionView.tsx";
import { useDraft } from "../useDraft.ts";
import type { SubSessionState } from "./subSessions.ts";

/** The building feature's session, which started the sub-sessions. */
function useBuildSession(): string | undefined {
  return useFeature(FEATURE_PAGES.working)?.sessions[0];
}

/** The Sub-agents pane of the build's session, as the session's column draws it. */
function SubagentsPane() {
  const id = useBuildSession();
  return (
    <Pane title="Sub-agents">
      <SubagentsPanel session={id} />
    </Pane>
  );
}

/** The page of the build's first sub-session in `state`. */
function SubSessionPage({ parent, state }: { parent: string; state: SubSessionState }) {
  // A session page's draft, which the bar never writes: the page holds one as any session's does.
  const draft = useDraft(undefined);
  const sub = useSession(parent)?.subSessions.find((each) => each.state === state);
  if (sub === undefined) {
    return null;
  }
  return <SessionPane draft={draft} id={sub.id} title={sub.about} />;
}

/** The page of a sub-session of the build's session, once the feature is read. */
function OfBuild({ state }: { state: SubSessionState }) {
  const id = useBuildSession();
  return id === undefined ? null : <SubSessionPage parent={id} state={state} />;
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
  render: () => <OfBuild state="working" />,
};

/** A sub-session done: its transcript and its bar, without Stop. */
export const SubSessionDone: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <OfBuild state="done" />,
};
